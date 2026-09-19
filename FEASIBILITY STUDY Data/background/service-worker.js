/**
 * FEASIBILITY STUDY Data - Direct Google & PropZone Background Service Worker
 * Tìm kiếm APN trực tiếp bằng Google Search & Chuyển thẳng tới Bản đồ Gridics PropZone chính xác (Không lặp tab)
 */

importScripts("../config/county-detector.js");

let lastOpenedPropZoneUrl = null;
let lastOpenedTime = 0;

// Lắng nghe lệnh từ Popup hoặc Content Scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_AUTO_PIPELINE") {
    runDirectSearchPipeline(request.address).then(result => {
      sendResponse(result);
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // async
  }

  // TỰ ĐỘNG XỬ LÝ KHI TÌM THẤY APN TỪ GOOGLE (DUY NHẤT 1 LẦN)
  if (request.action === "APN_AUTO_FOUND_CLOSE") {
    handleApnAutoFound(request.apn, request.details || {}, sender.tab ? sender.tab.id : null);
    sendResponse({ success: true });
    return true;
  }

  // TỰ ĐỘNG LƯU DỮ LIỆU PROPZONE VÀ ĐÓNG TAB KHI ĐÃ CÓ KẾT QUẢ THÀNH CÔNG
  if (request.action === "AUTO_SAVE_AND_CLOSE_TAB" && request.data) {
    chrome.storage.local.get(["lastPipelineResult", "lastSearchQuery"], (res) => {
      const prev = res.lastPipelineResult || {};
      const extractedAddress = request.data.address || request.data.lot?.projectAddress || request.data.lot?.address || request.data.lot?.situsAddress;
      const finalAddress = extractedAddress || prev.address || res.lastSearchQuery || "";

      chrome.storage.local.set({
        lastSearchQuery: finalAddress || res.lastSearchQuery || "",
        lastPipelineResult: {
          ...prev,
          ...request.data,
          address: finalAddress,
          lot: {
            ...(prev.lot || {}),
            ...(request.data.lot || {}),
            projectAddress: finalAddress || prev.lot?.projectAddress || request.data.lot?.projectAddress
          },
          zoning: { ...(prev.zoning || {}), ...(request.data.zoning || {}) },
          setbacks: { ...(prev.setbacks || {}), ...(request.data.setbacks || {}) },
          capacity: { ...(prev.capacity || {}), ...(request.data.capacity || {}) },
          status: "SUCCESS",
          updatedAt: new Date().toISOString()
        }
      });
    });

    if (sender.tab && sender.tab.id) {
      setTimeout(() => {
        chrome.tabs.remove(sender.tab.id).catch(() => {});
        console.log(`🧹 [Service-Worker] PropZone extraction complete. Closed tab: ${sender.tab.id}`);
      }, 600);
    }

    sendResponse({ success: true });
    return true;
  }

  // XỬ LÝ KHI PROPZONE THẤT BẠI SAU 5 LẦN THỬ LẠI
  if (request.action === "PROPZONE_EXTRACTION_FAILED") {
    console.error(`❌ [Service-Worker] PropZone extraction failed after 5 retries for folio: ${request.folio}`);
    chrome.storage.local.get(["lastPipelineResult"], (res) => {
      const prev = res.lastPipelineResult || {};
      chrome.storage.local.set({
        lastPipelineResult: {
          ...prev,
          status: "FAILED_5_RETRIES",
          errorMessage: "PropZone loading timeout after 5 attempts.",
          updatedAt: new Date().toISOString()
        }
      });
    });

    if (sender.tab && sender.tab.id) {
      setTimeout(() => {
        chrome.tabs.remove(sender.tab.id).catch(() => {});
        console.log(`🧹 [Service-Worker] Closed failed PropZone tab: ${sender.tab.id}`);
      }, 600);
    }

    sendResponse({ success: true });
    return true;
  }

  // TỰ ĐỘNG LƯU TOÀN BỘ DỮ LIỆU BÓC TÁCH TỪ PROPZONE VÀO STORAGE
  if (request.action === "AUTO_SAVE_FULL_EXTRACTED_DATA" && request.data) {
    chrome.storage.local.get(["lastPipelineResult", "lastSearchQuery"], (res) => {
      const prev = res.lastPipelineResult || {};
      const extractedAddress = request.data.address || request.data.lot?.projectAddress || request.data.lot?.address || request.data.lot?.situsAddress;
      const finalAddress = extractedAddress || prev.address || res.lastSearchQuery || "";

      chrome.storage.local.set({
        lastSearchQuery: finalAddress || res.lastSearchQuery || "",
        lastPipelineResult: {
          ...prev,
          ...request.data,
          address: finalAddress,
          lot: {
            ...(prev.lot || {}),
            ...(request.data.lot || {}),
            projectAddress: finalAddress || prev.lot?.projectAddress || request.data.lot?.projectAddress
          },
          zoning: { ...(prev.zoning || {}), ...(request.data.zoning || {}) },
          setbacks: { ...(prev.setbacks || {}), ...(request.data.setbacks || {}) },
          capacity: { ...(prev.capacity || {}), ...(request.data.capacity || {}) },
          updatedAt: new Date().toISOString()
        }
      });
    });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "DOWNLOAD_PARCEL_MAP") {
    handleParcelMapDownload(request.apn, request.address, request.countyKey);
    sendResponse({ success: true });
    return true;
  }
});

/**
 * Xử lý khi đã tìm thấy APN: Lưu APN -> Mở Cổng Gridics PropZone chính xác (Có cơ chế chống mở trùng lặp)
 */
async function handleApnAutoFound(apn, details, tabId) {
  if (!apn) return;
  const cleanApn = apn.replace(/[^0-9A-Za-z]/g, "");

  const now = Date.now();
  // CHỐNG MỞ TRÙNG LẶP TAB PROPZONE (Debounce 5 giây)
  if (lastOpenedPropZoneUrl && lastOpenedPropZoneUrl.includes(cleanApn) && (now - lastOpenedTime < 5000)) {
    console.log(`⚠️ [Service-Worker] Ignored duplicate PropZone open request for APN: ${cleanApn}`);
    return;
  }

  console.log(`🎯 [Service-Worker] APN Auto Found: "${cleanApn}" with specs:`, details);

  const { lastSearchQuery, lastPipelineResult } = await chrome.storage.local.get(["lastSearchQuery", "lastPipelineResult"]);
  const address = (details && details.address) || lastSearchQuery || lastPipelineResult?.address || "";
  const countyInfo = CountyDetector.detect(address);

  // 1. Lưu APN và toàn bộ thông số nhà đất vào bộ nhớ Chrome
  await chrome.storage.local.set({
    lastApn: cleanApn,
    lastSearchQuery: address || lastSearchQuery || "",
    lastPipelineResult: {
      ...(lastPipelineResult || {}),
      address: address,
      apn: cleanApn,
      yearBuilt: details.yearBuilt || lastPipelineResult?.yearBuilt || null,
      existingBuildingArea: details.bldgSize || lastPipelineResult?.existingBuildingArea || null,
      lotAreaTaxRecord: details.lotSize || lastPipelineResult?.lotAreaTaxRecord || null,
      existingBuildingUse: details.propType || lastPipelineResult?.existingBuildingUse || null,
      zoningDistrict: details.zoningCode || lastPipelineResult?.zoningDistrict || null,
      source: "Google Search",
      county: details.countyName || countyInfo.name,
      countyKey: countyInfo.countyKey,
      updatedAt: new Date().toISOString()
    }
  });

  // 2. Mở trực tiếp Bản đồ Gridics PropZone với Folio/APN chính xác (Duy nhất 1 tab)
  const targetPropZoneUrl = CountyDetector.getPropZoneUrl(address, cleanApn);
  
  if (targetPropZoneUrl) {
    lastOpenedPropZoneUrl = targetPropZoneUrl;
    lastOpenedTime = now;
    console.log(`🚀 [Service-Worker] Opening single PropZone tab: ${targetPropZoneUrl}`);
    await chrome.tabs.create({ url: targetPropZoneUrl, active: true });
  }

  // 3. Tự động đóng tab Google Search sau khi đã lấy được APN và chuyển tiếp thành công
  if (tabId) {
    try {
      await chrome.tabs.remove(tabId);
      console.log(`🧹 [Service-Worker] Successfully closed Google Search tab: ${tabId}`);
    } catch (e) {
      console.warn(`Could not close Google Search tab ${tabId}:`, e);
    }
  }
}

/**
 * Quy trình Tìm kiếm Trực tiếp bằng Google & Gridics PropZone
 */
async function runDirectSearchPipeline(query) {
  if (!query || !query.trim()) {
    throw new Error("Query is empty");
  }

  const cleanQuery = query.trim();
  console.log(`🚀 [Direct-Pipeline] Executing search for: "${cleanQuery}"`);

  // 1. KIỂM TRA NẾU LÀ APN TRỰC TIẾP
  const isDirectApn = /^[0-9-]{6,15}$/.test(cleanQuery.replace(/\s/g, ""));
  let cleanApn = isDirectApn ? cleanQuery.replace(/[^0-9]/g, "") : "";

  // 2. NẾU LÀ MÃ SỐ APN TRỰC TIẾP -> MỞ THẲNG BẢN ĐỒ PROPZONE
  if (cleanApn) {
    const targetPropZoneUrl = CountyDetector.getPropZoneUrl(cleanQuery, cleanApn);
    const countyInfo = CountyDetector.detect(cleanQuery);

    const payload = {
      address: cleanQuery,
      apn: cleanApn,
      source: "Direct APN",
      county: countyInfo.name,
      countyKey: countyInfo.countyKey,
      updatedAt: new Date().toISOString()
    };

    await chrome.storage.local.set({ 
      lastPipelineResult: payload,
      lastSearchQuery: cleanQuery,
      lastApn: cleanApn
    });

    lastOpenedPropZoneUrl = targetPropZoneUrl;
    lastOpenedTime = Date.now();
    const portalTab = await chrome.tabs.create({ url: targetPropZoneUrl, active: true });
    return { success: true, data: payload, portalUrl: targetPropZoneUrl, portalTabId: portalTab.id };
  }

  // 3. NẾU LÀ ĐỊA CHỈ -> MỞ TAB GOOGLE SEARCH ĐỂ TỰ ĐỘNG BÓC TÁCH APN
  const countyInfo = CountyDetector.detect(cleanQuery);
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery + " The Assessor's Parcel Number (APN)")}`;
  const searchTab = await chrome.tabs.create({ url: googleSearchUrl, active: true });

  const payload = {
    address: cleanQuery,
    apn: null,
    source: "Google Search",
    county: countyInfo.name,
    countyKey: countyInfo.countyKey,
    updatedAt: new Date().toISOString()
  };

  await chrome.storage.local.set({ 
    lastPipelineResult: payload,
    lastSearchQuery: cleanQuery
  });

  return {
    success: true,
    data: payload,
    googleSearchUrl: googleSearchUrl,
    searchTabId: searchTab.id
  };
}

/**
 * Tải xuống bản đồ Parcel Map trực tiếp
 */
function handleParcelMapDownload(apn, address, countyKey) {
  const cleanApn = (apn || "").replace(/[^0-9]/g, "");
  let mapUrl = "";

  if (countyKey === "orange" || (!countyKey && cleanApn.length === 8)) {
    mapUrl = `https://webapps.ocgis.com/oclandinsights/map-viewer?id=2&apn=${cleanApn}`;
  } else if (countyKey === "losAngeles" || cleanApn.length === 10) {
    mapUrl = `https://portal.assessor.lacounty.gov/parceldetail/${cleanApn}`;
  } else {
    mapUrl = `https://portal.assessor.lacounty.gov/`;
  }

  chrome.tabs.create({ url: mapUrl });
}

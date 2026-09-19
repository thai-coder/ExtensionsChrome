/**
 * FEASIBILITY STUDY Data - Direct Google & PropZone Background Service Worker
 * Quản lý quy trình tự động 3 bước chuẩn xác theo Tab ID (Không cần tham số URL):
 * - Bước 1: Mở Google tìm kiếm APN -> Lấy APN -> Đóng Tab 1.
 * - Bước 2: Mở Google "[Địa chỉ] properties" -> Đợi AI Overview / Property Overview -> Lấy Property Type, Stories, Parking / Garage -> Đóng Tab 2.
 * - Bước 3: Mở PropZone Gridics Map -> Bóc tách Lot, Zoning, Setbacks, Capacity -> Đóng Tab 3.
 */

importScripts("../config/county-detector.js");
importScripts("../config/map-sources.js");
importScripts("./map-download-handler.js");

// Thời gian kéo dài giữ mở tab PropZone Gridics trước khi tự động đóng: 10 phút (600,000 ms)
const PROPZONE_TAB_LIFETIME_MS = 10 * 60 * 1000;

// Trạng thái phiên làm việc tự động (Pipeline Session)
let pipelineSession = {
  address: "",
  apn: "",
  apnTabId: null,
  propertyOverviewTabId: null,
  propZoneTabId: null,
  specs: {}
};

let lastOpenedPropZoneUrl = null;
let lastOpenedTime = 0;

// Lắng nghe lệnh từ Popup hoặc Content Scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // 1. KHỞI CHẠY QUY TRÌNH TỰ ĐỘNG TỪ POPUP (NÚT FETCH)
  if (request.action === "START_AUTO_PIPELINE") {
    runDirectSearchPipeline(request.address).then(result => {
      sendResponse(result);
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // async
  }

  // 2. CONTENT SCRIPT HỎI VAI TRÒ CỦA TAB GOOGLE HIỆN TẠI (Dựa trên Tab ID)
  if (request.action === "GET_SEARCH_PIPELINE_ROLE") {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId && tabId === pipelineSession.apnTabId) {
      sendResponse({ role: "APN_SEARCH", address: pipelineSession.address });
    } else if (tabId && tabId === pipelineSession.propertyOverviewTabId) {
      sendResponse({ role: "PROPERTY_OVERVIEW_SEARCH", address: pipelineSession.address, apn: pipelineSession.apn });
    } else {
      sendResponse({ role: "NONE" }); // Người dùng tìm kiếm Google bình thường
    }
    return true;
  }

  // 3. CONTENT SCRIPT HỎI VAI TRÒ CỦA TAB PROPZONE HIỆN TẠI
  if (request.action === "GET_PROPZONE_PIPELINE_ROLE") {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId && tabId === pipelineSession.propZoneTabId) {
      sendResponse({ role: "AUTO_PIPELINE", apn: pipelineSession.apn, address: pipelineSession.address });
    } else {
      sendResponse({ role: "MANUAL" }); // Người dùng mở PropZone thủ công
    }
    return true;
  }

  // 4. BƯỚC 1 HOÀN THÀNH: ĐÃ TÌM THẤY APN -> ĐÓNG TAB 1 VÀ MỞ TIẾP TAB 2 ("[Địa chỉ] properties")
  if (request.action === "STEP1_APN_FOUND") {
    handleStep1ApnFound(request.apn, request.details || {}, sender.tab ? sender.tab.id : null);
    sendResponse({ success: true });
    return true;
  }

  // 5. BƯỚC 2 HOÀN THÀNH: ĐÃ TÌM THẤY PROPERTY OVERVIEW / AI OVERVIEW -> ĐÓNG TAB 2 VÀ MỞ TAB 3 (PROPZONE)
  if (request.action === "STEP2_PROPERTY_OVERVIEW_FOUND") {
    handleStep2PropertyOverviewFound(request.details || {}, sender.tab ? sender.tab.id : null);
    sendResponse({ success: true });
    return true;
  }

  // 6. BƯỚC 3 HOÀN THÀNH: ĐÃ LƯU DỮ LIỆU PROPZONE VÀ ĐÓNG TAB 3
  if (request.action === "AUTO_SAVE_AND_CLOSE_TAB" && request.data) {
    handleStep3SaveAndClose(request.data, sender.tab ? sender.tab.id : null);
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

  // TỰ ĐỘNG LƯU TOÀN BỘ DỮ LIỆU BÓC TÁCH TỪ CÁC TRANG GIS VÀO STORAGE
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

  // KIỂM TRA KẾT NỐI ORANGE COUNTY (VPN HEALTH CHECK)
  if (request.action === "CHECK_OCGIS_CONNECTIVITY") {
    MapDownloadHandler.checkOcgisConnectivity().then(res => {
      sendResponse(res);
    });
    return true;
  }

  // KHỞI CHẠY QUY TRÌNH TẢI BẢN ĐỒ ĐA QUẬN
  if (request.action === "START_MAP_DOWNLOAD_PIPELINE") {
    MapDownloadHandler.startDownload(request).then(res => {
      sendResponse(res);
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  // CONTENT SCRIPT HỎI VAI TRÒ CỦA TAB TẢI BẢN ĐỒ
  if (request.action === "GET_MAP_DOWNLOAD_TAB_ROLE") {
    const tabId = sender.tab ? sender.tab.id : null;
    sendResponse(MapDownloadHandler.getTabRole(tabId));
    return true;
  }

  // CONTENT SCRIPT ĐÃ TÌM THẤY PDF BẢN ĐỒ VÀ YÊU CẦU TẢI VỀ
  if (request.action === "MAP_PDF_FOUND_AND_DOWNLOAD") {
    MapDownloadHandler.handlePdfFoundAndDownload(request, sender.tab ? sender.tab.id : null);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "DOWNLOAD_PARCEL_MAP") {
    MapDownloadHandler.startDownload({
      apn: request.apn,
      address: request.address,
      countyKey: request.countyKey
    }).then(res => sendResponse(res));
    return true;
  }
});

/**
 * Xử lý Bước 1: Nhận APN -> Đóng Tab 1 -> Mở Tab 2 "[Địa chỉ] properties"
 */
async function handleStep1ApnFound(apn, details, tabId) {
  if (!apn) return;
  const formattedApn = apn.trim().replace(/\s+/g, '-');
  const cleanDigits = formattedApn.replace(/[^0-9]/g, "");
  pipelineSession.apn = formattedApn;
  pipelineSession.specs = { ...pipelineSession.specs, ...(details || {}) };

  console.log(`🎯 [Pipeline-Step 1] APN Found: "${formattedApn}" (Digits: ${cleanDigits}). Closing Tab 1 and opening Tab 2 (properties overview)...`);

  const { lastSearchQuery, lastPipelineResult } = await chrome.storage.local.get(["lastSearchQuery", "lastPipelineResult"]);
  const address = (details && details.canonicalAddress) || (details && details.address) || pipelineSession.address || lastSearchQuery || lastPipelineResult?.address || "";
  pipelineSession.address = address;
  const countyInfo = CountyDetector.detect(address);

  // Lưu APN bước 1
  await chrome.storage.local.set({
    lastApn: formattedApn,
    lastSearchQuery: address,
    lastPipelineResult: {
      ...(lastPipelineResult || {}),
      address: address,
      apn: formattedApn,
      lot: {
        ...(lastPipelineResult?.lot || {}),
        parcelId: formattedApn,
        parcelNumber: formattedApn,
        cleanApn: cleanDigits,
        projectAddress: address
      },
      source: "Google Search (Step 1 APN)",
      county: countyInfo.name,
      countyKey: countyInfo.countyKey,
      updatedAt: new Date().toISOString()
    }
  });

  // Đóng Tab 1 (APN search tab)
  if (tabId) {
    try {
      await chrome.tabs.remove(tabId);
      console.log(`🧹 [Pipeline-Step 1] Closed APN Search Tab: ${tabId}`);
    } catch (e) {}
  }
  pipelineSession.apnTabId = null;

  // Mở Bước 2: Google "[Địa chỉ] properties"
  const propOverviewQuery = `${address} properties`;
  const propOverviewUrl = `https://www.google.com/search?q=${encodeURIComponent(propOverviewQuery)}`;
  console.log(`🚀 [Pipeline-Step 2] Opening Properties Search Tab: ${propOverviewUrl}`);
  
  const propTab = await chrome.tabs.create({ url: propOverviewUrl, active: true });
  pipelineSession.propertyOverviewTabId = propTab.id;
}

/**
 * Xử lý Bước 2: Nhận thông tin Property Overview / AI Overview -> Đóng Tab 2 -> Mở Tab 3 (PropZone)
 */
async function handleStep2PropertyOverviewFound(details, tabId) {
  console.log(`🎯 [Pipeline-Step 2] Property Overview Specs received:`, details);

  const { lastSearchQuery, lastPipelineResult } = await chrome.storage.local.get(["lastSearchQuery", "lastPipelineResult"]);
  const address = (details && details.canonicalAddress) || (details && details.address) || pipelineSession.address || lastSearchQuery || lastPipelineResult?.address || "";
  pipelineSession.address = address;
  const cleanApn = pipelineSession.apn || lastPipelineResult?.apn || "";
  const countyInfo = CountyDetector.detect(address);

  // Hợp nhất dữ liệu bước 2
  pipelineSession.specs = { ...pipelineSession.specs, ...(details || {}) };
  const d = pipelineSession.specs;

  await chrome.storage.local.set({
    lastSearchQuery: address,
    lastPipelineResult: {
      ...(lastPipelineResult || {}),
      address: address,
      apn: cleanApn,
      lot: {
        ...(lastPipelineResult?.lot || {}),
        parcelId: cleanApn,
        projectAddress: address,
        parking: d.parking || lastPipelineResult?.lot?.parking || null,
        parkingRaw: d.parkingRaw || lastPipelineResult?.lot?.parkingRaw || null,
        garageArea: d.garageArea || lastPipelineResult?.lot?.garageArea || null,
        garageDimension: d.garageDimension || lastPipelineResult?.lot?.garageDimension || null,
        garageSpaces: d.garageSpaces || lastPipelineResult?.lot?.garageSpaces || null,
        drivewaySpaces: d.drivewaySpaces || lastPipelineResult?.lot?.drivewaySpaces || null,
        totalParkingArea: d.totalParkingArea || lastPipelineResult?.lot?.totalParkingArea || null,
        stories: d.stories || lastPipelineResult?.lot?.stories || null,
        yearBuilt: d.yearBuilt || lastPipelineResult?.lot?.yearBuilt || null,
        existingBuildingArea: d.bldgSize || lastPipelineResult?.lot?.existingBuildingArea || null,
        lotAreaTaxRecord: d.lotSize || lastPipelineResult?.lot?.lotAreaTaxRecord || null,
        existingBuildingUse: d.propType || lastPipelineResult?.lot?.existingBuildingUse || null
      },
      capacity: {
        ...(lastPipelineResult?.capacity || {}),
        maximumHeightStories: d.stories || lastPipelineResult?.capacity?.maximumHeightStories || null
      },
      zoning: {
        ...(lastPipelineResult?.zoning || {}),
        zoningDistrict: d.zoningCode || lastPipelineResult?.zoning?.zoningDistrict || null
      },
      yearBuilt: d.yearBuilt || lastPipelineResult?.yearBuilt || null,
      existingBuildingArea: d.bldgSize || lastPipelineResult?.existingBuildingArea || null,
      lotAreaTaxRecord: d.lotSize || lastPipelineResult?.lotAreaTaxRecord || null,
      existingBuildingUse: d.propType || lastPipelineResult?.existingBuildingUse || null,
      source: "Google Search (AI Property Overview)",
      county: countyInfo.name,
      countyKey: countyInfo.countyKey,
      updatedAt: new Date().toISOString()
    }
  });

  // Đóng Tab 2 (Properties Search Tab)
  if (tabId) {
    try {
      await chrome.tabs.remove(tabId);
      console.log(`🧹 [Pipeline-Step 2] Closed Properties Overview Tab: ${tabId}`);
    } catch (e) {}
  }
  pipelineSession.propertyOverviewTabId = null;

  // Mở Bước 3: Bản đồ PropZone Gridics
  const targetPropZoneUrl = CountyDetector.getPropZoneUrl(address, cleanApn);
  if (targetPropZoneUrl) {
    lastOpenedPropZoneUrl = targetPropZoneUrl;
    lastOpenedTime = Date.now();
    console.log(`🚀 [Pipeline-Step 3] Opening single PropZone Tab: ${targetPropZoneUrl}`);
    const pzTab = await chrome.tabs.create({ url: targetPropZoneUrl, active: true });
    pipelineSession.propZoneTabId = pzTab.id;
  }
}

/**
 * Xử lý Bước 3: Lưu toàn bộ dữ liệu PropZone & Đóng Tab 3
 */
async function handleStep3SaveAndClose(data, tabId) {
  const { lastPipelineResult, lastSearchQuery } = await chrome.storage.local.get(["lastPipelineResult", "lastSearchQuery"]);
  const prev = lastPipelineResult || {};
  const extractedAddress = data.address || data.lot?.projectAddress || data.lot?.address || data.lot?.situsAddress;
  const finalAddress = extractedAddress || prev.address || lastSearchQuery || "";

  await chrome.storage.local.set({
    lastSearchQuery: finalAddress || lastSearchQuery || "",
    lastPipelineResult: {
      ...prev,
      ...data,
      address: finalAddress,
      lot: {
        ...(prev.lot || {}),
        ...(data.lot || {}),
        projectAddress: finalAddress || prev.lot?.projectAddress || data.lot?.projectAddress
      },
      zoning: { ...(prev.zoning || {}), ...(data.zoning || {}) },
      setbacks: { ...(prev.setbacks || {}), ...(data.setbacks || {}) },
      capacity: { ...(prev.capacity || {}), ...(data.capacity || {}) },
      status: "SUCCESS",
      updatedAt: new Date().toISOString()
    }
  });

  if (tabId) {
    setTimeout(() => {
      chrome.tabs.remove(tabId).catch(() => {});
      console.log(`🧹 [Pipeline-Step 3] PropZone extraction complete. Closed tab: ${tabId}`);
    }, 500);
  }
  pipelineSession.propZoneTabId = null;
}

/**
 * Khởi chạy quy trình Tìm kiếm Tự Động
 */
async function runDirectSearchPipeline(query) {
  if (!query || !query.trim()) {
    throw new Error("Query is empty");
  }

  const cleanQuery = query.trim();
  console.log(`🚀 [Auto-Pipeline] Executing search for: "${cleanQuery}"`);

  // 1. KIỂM TRA NẾU CÓ APN ĐỨNG ĐẦU ĐỊA CHỈ (VD: "104944121, 1026 S GREENWOOD AVE, ONTARIO, CA, 91761")
  let leadApn = null;
  let targetAddress = cleanQuery;
  const leadApnMatch = cleanQuery.match(/^(\d{4}[-\s]?\d{3}[-\s]?\d{2}|\d{3,4}[-\s]?\d{3}[-\s]?\d{2,3}|\d{8,12})\s*,\s*(.+)$/i);
  if (leadApnMatch) {
    leadApn = leadApnMatch[1].trim().replace(/\s+/g, '-');
    targetAddress = leadApnMatch[2].trim();
    console.log(`🎯 [Auto-Pipeline] Detected Leading APN: "${leadApn}", Target Address: "${targetAddress}"`);
  }

  // 2. KIỂM TRA NẾU LÀ APN TRỰC TIẾP
  const isDirectApn = /^[0-9-]{6,15}$/.test(cleanQuery.replace(/\s/g, ""));
  let cleanApn = isDirectApn ? cleanQuery.replace(/[^0-9]/g, "") : (leadApn ? leadApn.replace(/[^0-9]/g, "") : "");

  if (isDirectApn) {
    const targetPropZoneUrl = CountyDetector.getPropZoneUrl(cleanQuery, cleanApn);
    const countyInfo = CountyDetector.detect(cleanQuery);

    const payload = {
      address: cleanQuery,
      apn: cleanApn,
      lot: {
        parcelId: cleanApn,
        projectAddress: cleanQuery
      },
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

    pipelineSession = {
      address: cleanQuery,
      apn: cleanApn,
      apnTabId: null,
      propertyOverviewTabId: null,
      propZoneTabId: null,
      specs: {}
    };

    lastOpenedPropZoneUrl = targetPropZoneUrl;
    lastOpenedTime = Date.now();
    const portalTab = await chrome.tabs.create({ url: targetPropZoneUrl, active: true });
    pipelineSession.propZoneTabId = portalTab.id;
    return { success: true, data: payload, portalUrl: targetPropZoneUrl, portalTabId: portalTab.id };
  }

  // 3. NẾU ĐÃ CÓ LEAD APN -> MỞ LUÔN BƯỚC 2 ĐỂ TÌM OVERVIEW & SPECS
  if (leadApn) {
    const countyInfo = CountyDetector.detect(targetAddress);
    const propOverviewQuery = `${targetAddress} properties`;
    const propOverviewUrl = `https://www.google.com/search?q=${encodeURIComponent(propOverviewQuery)}`;

    pipelineSession = {
      address: targetAddress,
      apn: leadApn,
      apnTabId: null,
      propertyOverviewTabId: null,
      propZoneTabId: null,
      specs: {}
    };

    const payload = {
      address: targetAddress,
      apn: leadApn,
      source: "User Provided APN + Address",
      county: countyInfo.name,
      countyKey: countyInfo.countyKey,
      updatedAt: new Date().toISOString()
    };

    await chrome.storage.local.set({ 
      lastPipelineResult: payload,
      lastSearchQuery: targetAddress,
      lastApn: leadApn
    });

    const propTab = await chrome.tabs.create({ url: propOverviewUrl, active: true });
    pipelineSession.propertyOverviewTabId = propTab.id;

    return {
      success: true,
      data: payload,
      googleSearchUrl: propOverviewUrl,
      searchTabId: propTab.id
    };
  }

  // 4. NẾU LÀ ĐỊA CHỈ THUẦN -> BƯỚC 1: MỞ TAB TÌM APN TRƯỚC
  const countyInfo = CountyDetector.detect(cleanQuery);
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery + " The Assessor's Parcel Number (APN)")}`;
  
  pipelineSession = {
    address: cleanQuery,
    apn: "",
    apnTabId: null,
    propertyOverviewTabId: null,
    propZoneTabId: null,
    specs: {}
  };

  const searchTab = await chrome.tabs.create({ url: googleSearchUrl, active: true });
  pipelineSession.apnTabId = searchTab.id;

  const payload = {
    address: cleanQuery,
    apn: null,
    source: "Google Search (Step 1)",
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

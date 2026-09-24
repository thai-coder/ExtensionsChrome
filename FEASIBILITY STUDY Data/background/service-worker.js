/**
 * FEASIBILITY STUDY Data - Background Service Worker
 * Quản lý quy trình tìm kiếm và bóc tách dữ liệu theo phiên làm việc (Tab ID):
 * - Tiền trạm (Nếu nhập APN): Mở Google tìm Địa chỉ thực tế -> Nối tiếp Luồng chính (1*).
 * - Bước 1 (Luồng 1*): Mở Google "[Địa chỉ] properties" -> Bóc tách Property Overview / Specs -> Đóng Tab 1.
 * - Bước 2 (Luồng 1*): Mở PropZone Gridics Map -> Bóc tách Lot, Zoning, Setbacks, Capacity -> Đóng Tab 2.
 */

importScripts("../config/county-detector.js");
importScripts("../config/map-sources.js");
importScripts("./map-download-handler.js");
importScripts("../config/update-config.js");
importScripts("./update-checker.js");

// Thời gian kéo dài giữ mở tab PropZone Gridics trước khi tự động đóng: 10 phút (600,000 ms)
const PROPZONE_TAB_LIFETIME_MS = 10 * 60 * 1000;

// Trạng thái phiên làm việc tự động (Pipeline Session)
let pipelineSession = {
  address: "",
  apn: "",
  apnSearchTabId: null,
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

  // 2. CONTENT SCRIPT HỎI VAI TRÒ CỦA TAB GOOGLE HIỆN TẠI (Dựa trên Tab ID & Persistent Storage)
  if (request.action === "GET_SEARCH_PIPELINE_ROLE") {
    const tabId = sender.tab ? sender.tab.id : null;
    chrome.storage.local.get(["activePipelineSession"], (res) => {
      const session = res.activePipelineSession || pipelineSession || {};
      if (tabId && (tabId === session.apnSearchTabId || tabId === pipelineSession.apnSearchTabId)) {
        sendResponse({ role: "APN_TO_ADDRESS_SEARCH", apn: session.apn || pipelineSession.apn });
      } else if (tabId && (tabId === session.propertyOverviewTabId || tabId === pipelineSession.propertyOverviewTabId)) {
        sendResponse({ role: "PROPERTY_OVERVIEW_SEARCH", address: session.address || pipelineSession.address, apn: session.apn || pipelineSession.apn });
      } else {
        sendResponse({ role: "NONE" }); // Người dùng tìm kiếm Google bình thường
      }
    });
    return true; // async
  }

  // 3. CONTENT SCRIPT HỎI VAI TRÒ CỦA TAB PROPZONE HIỆN TẠI (Dựa trên Tab ID & Persistent Storage)
  if (request.action === "GET_PROPZONE_PIPELINE_ROLE") {
    const tabId = sender.tab ? sender.tab.id : null;
    chrome.storage.local.get(["activePipelineSession", "lastSearchQuery", "lastApn"], (res) => {
      const session = res.activePipelineSession || pipelineSession || {};
      const isTargetTab = tabId && (tabId === session.propZoneTabId || tabId === pipelineSession.propZoneTabId);
      if (isTargetTab) {
        sendResponse({
          role: "AUTO_PIPELINE",
          apn: session.apn || pipelineSession.apn || res.lastApn || "",
          address: session.address || pipelineSession.address || res.lastSearchQuery || ""
        });
      } else {
        sendResponse({ role: "MANUAL" }); // Người dùng mở PropZone thủ công
      }
    });
    return true; // async
  }



  // 4. BƯỚC TIỀN TRẠM HOÀN THÀNH: ĐÃ TÌM THẤY ĐỊA CHỈ TỪ MÃ APN -> NỐI VÀO LUỒNG CHÍNH (1*)
  if (request.action === "APN_ADDRESS_RESOLVED") {
    handleApnAddressResolved(request.apn, request.address, request.specs || {}, sender.tab ? sender.tab.id : null);
    sendResponse({ success: true });
    return true;
  }

  // NẾU TÌM ĐỊA CHỈ TỪ APN BỊ TIMEOUT / THẤT BẠI
  if (request.action === "APN_ADDRESS_RESOLVE_FAILED") {
    if (sender.tab && sender.tab.id) {
      chrome.tabs.remove(sender.tab.id).catch(() => {});
    }
    pipelineSession.apnSearchTabId = null;
    sendResponse({ success: true });
    return true;
  }

  // 5. BƯỚC 1 CỦA LUỒNG CHÍNH: ĐÃ TÌM THẤY PROPERTY OVERVIEW -> MỞ TIẾP BẢN ĐỒ PROPZONE
  if (request.action === "PROPERTY_OVERVIEW_FOUND") {
    handlePropertyOverviewFound(request.details || {}, sender.tab ? sender.tab.id : null);
    sendResponse({ success: true });
    return true;
  }

  // 6. BƯỚC 2 CỦA LUỒNG CHÍNH: ĐÃ LƯU DỮ LIỆU PROPZONE VÀ ĐÓNG TAB PROPZONE
  if (request.action === "AUTO_SAVE_AND_CLOSE_TAB" && request.data) {
    handlePropZoneSaveAndClose(request.data, sender.tab ? sender.tab.id : null);
    sendResponse({ success: true });
    return true;
  }

  // XỬ LÝ KHI PROPZONE THẤT BẠI SAU 5 LẦN THỬ LẠI
  if (request.action === "PROPZONE_EXTRACTION_FAILED") {
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
      }, PROPZONE_TAB_LIFETIME_MS);
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
 * Xử lý Bước 1: Nhận thông tin Property Overview / AI Overview -> Đóng Tab Google -> Mở Tab PropZone
 */
async function handlePropertyOverviewFound(details, tabId) {

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

  // Mở Bước 2: Chuyển hướng tab hiện tại sang Bản đồ PropZone Gridics California (Mượt mà, không nháy màn hình, không mất focus)
  const targetPropZoneUrl = "https://propzone.gridics.com/state/us/ca";
  lastOpenedPropZoneUrl = targetPropZoneUrl;
  lastOpenedTime = Date.now();

  let targetTabId = tabId;

  if (tabId) {
    try {
      await chrome.tabs.update(tabId, { url: targetPropZoneUrl, active: true });
      targetTabId = tabId;
    } catch (e) {
      const pzTab = await chrome.tabs.create({ url: targetPropZoneUrl, active: true });
      targetTabId = pzTab.id;
    }
  } else {
    const pzTab = await chrome.tabs.create({ url: targetPropZoneUrl, active: true });
    targetTabId = pzTab.id;
  }

  pipelineSession.propZoneTabId = targetTabId;
  pipelineSession.propertyOverviewTabId = null;

  // Lưu ngay tab ID và dữ liệu vào Persistent Storage để Service Worker ngủ ngầm vẫn nhận diện 100%
  await chrome.storage.local.set({
    activePipelineSession: {
      address: address,
      apn: cleanApn,
      propZoneTabId: targetTabId,
      step: "PROPZONE_MAP",
      timestamp: Date.now()
    }
  });
}

/**
 * Xử lý Bước 2: Lưu toàn bộ dữ liệu PropZone & Giữ nguyên Tab PropZone mở cho người dùng
 */
async function handlePropZoneSaveAndClose(data, tabId) {
  const { lastPipelineResult, lastSearchQuery } = await chrome.storage.local.get(["lastPipelineResult", "lastSearchQuery"]);
  const prev = lastPipelineResult || {};
  const extractedAddress = data.address || data.lot?.projectAddress || data.lot?.address || data.lot?.situsAddress;
  const finalAddress = extractedAddress || prev.address || lastSearchQuery || "";

  await chrome.storage.local.set({
    lastSearchQuery: finalAddress || lastSearchQuery || "",
    activePipelineSession: null, // Giải phóng phiên làm việc tự động
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

  // Giải phóng phiên làm việc của Tab để không kích hoạt lại pipeline tự động
  if (tabId && tabId === pipelineSession.propZoneTabId) {
    pipelineSession.propZoneTabId = null;
  }
  // Giữ nguyên tab PropZone mở để người dùng xem bản đồ trực quan
}

/**
 * Xử lý khi Bước tiền trạm đã tìm thấy Địa chỉ từ APN -> Nối thẳng vào Luồng chính (1*)
 */
async function handleApnAddressResolved(apn, foundAddress, specs = {}, tabId) {
  if (!foundAddress) return;

  // Đóng tab tìm kiếm APN
  if (tabId) {
    try {
      await chrome.tabs.remove(tabId);
    } catch (e) {}
  }
  pipelineSession.apnSearchTabId = null;

  // Lưu APN, Địa chỉ và Specs vừa tìm được từ Google AI Overview
  pipelineSession.apn = apn;
  pipelineSession.address = foundAddress;
  pipelineSession.specs = { ...pipelineSession.specs, ...specs };

  const countyInfo = CountyDetector.detect(foundAddress);

  await chrome.storage.local.set({
    lastApn: apn,
    lastSearchQuery: foundAddress,
    lastPipelineResult: {
      address: foundAddress,
      apn: apn,
      lot: {
        parcelId: apn,
        projectAddress: foundAddress,
        existingBuildingUse: specs.propType || null,
        existingBuildingArea: specs.bldgSize || null
      },
      county: specs.county || countyInfo.name,
      countyKey: countyInfo.countyKey,
      updatedAt: new Date().toISOString()
    }
  });

  // Tái tiếp tục luồng: Chuyển tiếp vào Luồng chính (1*)
  await runDirectSearchPipeline(foundAddress, apn);
}

/**
 * Khởi chạy quy trình Tìm kiếm Tự Động (Điều phối APN / Địa chỉ)
 */
async function runDirectSearchPipeline(query, providedApn = "") {
  if (!query || !query.trim()) {
    throw new Error("Query is empty");
  }

  const cleanQuery = query.trim();

  // 1. KIỂM TRA NẾU ĐẦU VÀO LÀ MÃ APN TRỰC TIẾP
  const isDirectApn = /^[0-9\-\s]{6,16}$/.test(cleanQuery) && /\d{6,}/.test(cleanQuery.replace(/\D/g, ""));
  const cleanApn = isDirectApn ? cleanQuery.replace(/\s+/g, "-") : (providedApn ? providedApn.replace(/\s+/g, "-") : "");

  if (isDirectApn && !providedApn) {
    // KÍCH HOẠT BƯỚC TIỀN TRẠM: Tìm kiếm Địa chỉ từ APN trên Google với cú pháp "[mã] APN CA"
    const apnSearchQuery = `${cleanApn} APN CA`;
    const apnSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(apnSearchQuery)}`;

    pipelineSession = {
      address: "",
      apn: cleanApn,
      apnSearchTabId: null,
      propertyOverviewTabId: null,
      propZoneTabId: null,
      specs: {}
    };

    const apnTab = await chrome.tabs.create({ url: apnSearchUrl, active: true });
    pipelineSession.apnSearchTabId = apnTab.id;

    await chrome.storage.local.set({
      activePipelineSession: {
        apn: cleanApn,
        apnSearchTabId: apnTab.id,
        step: "APN_SEARCH",
        timestamp: Date.now()
      }
    });

    return {
      success: true,
      role: "APN_TO_ADDRESS_SEARCH",
      apn: cleanApn,
      googleSearchUrl: apnSearchUrl,
      searchTabId: apnTab.id
    };
  }

  // 2. NẾU CÓ APN ĐỨNG ĐẦU ĐỊA CHỈ (VD: "1049-441-21, 1026 S GREENWOOD AVE, ONTARIO, CA, 91761")
  let leadApn = cleanApn;
  let targetAddress = cleanQuery;
  const leadApnMatch = cleanQuery.match(/^(\d{4}[-\s]?\d{3}[-\s]?\d{2}|\d{3,4}[-\s]?\d{3}[-\s]?\d{2,3}|\d{8,12})\s*,\s*(.+)$/i);
  if (leadApnMatch) {
    leadApn = leadApnMatch[1].trim().replace(/\s+/g, '-');
    targetAddress = leadApnMatch[2].trim();
  }

  // 3. LUỒNG CHÍNH (1*): MỞ TAB TÌM PROPERTY OVERVIEW & SPECS
  const countyInfo = CountyDetector.detect(targetAddress);
  const propOverviewQuery = `${targetAddress} properties`;
  const propOverviewUrl = `https://www.google.com/search?q=${encodeURIComponent(propOverviewQuery)}`;

  pipelineSession = {
    address: targetAddress,
    apn: leadApn || "",
    apnSearchTabId: null,
    propertyOverviewTabId: null,
    propZoneTabId: null,
    specs: {}
  };

  const propTab = await chrome.tabs.create({ url: propOverviewUrl, active: true });
  pipelineSession.propertyOverviewTabId = propTab.id;

  const payload = {
    address: targetAddress,
    apn: leadApn || null,
    source: leadApn ? "APN Resolved + AI Overview" : "Google Search (AI Property Overview)",
    county: countyInfo.name,
    countyKey: countyInfo.countyKey,
    updatedAt: new Date().toISOString()
  };

  await chrome.storage.local.set({ 
    lastPipelineResult: payload,
    lastSearchQuery: targetAddress,
    activePipelineSession: {
      address: targetAddress,
      apn: leadApn || "",
      propertyOverviewTabId: propTab.id,
      step: "PROPERTY_OVERVIEW",
      timestamp: Date.now()
    },
    ...(leadApn ? { lastApn: leadApn } : {})
  });

  return {
    success: true,
    data: payload,
    googleSearchUrl: propOverviewUrl,
    searchTabId: propTab.id
  };
}

// Lắng nghe lệnh Cập nhật ngầm và Tự động Reload từ Service Worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "TRIGGER_SILENT_UPDATE_AND_RELOAD") {
    const targetVersion = request.targetVersion || "";

    // 1. Kích hoạt protocol fs-update://run để chạy bộ cài đặt ngầm /VERYSILENT
    chrome.tabs.create({ url: "fs-update://run" }, (tab) => {
      if (tab && tab.id) {
        // Giữ tab đủ lâu để người dùng xác nhận "Always allow" (nếu là lần đầu)
        setTimeout(() => chrome.tabs.remove(tab.id).catch(() => {}), 3000);
      }
    });

    // 2. Định kỳ kiểm tra (Polling) file manifest.json trên đĩa xem FS.exe đã giải nén xong chưa
    let attempts = 0;
    const maxAttempts = 20; // Tối đa 20 giây
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const response = await fetch(chrome.runtime.getURL("manifest.json?_t=" + Date.now()));
        if (response.ok) {
          const manifest = await response.json();
          // Nếu phiên bản trên đĩa đã khớp với bản mới nhất hoặc đã đợi hơn 5 giây
          if ((targetVersion && manifest.version === targetVersion) || attempts >= 6) {
            clearInterval(pollInterval);
            // Tự động nạp lại toàn bộ Extension từ thư mục Documents
            chrome.runtime.reload();
            return;
          }
        }
      } catch (e) {}

      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        chrome.runtime.reload();
      }
    }, 1000);

    sendResponse({ success: true });
    return true;
  }

  // 2. Lệnh yêu cầu Tải lại Extension ngay lập tức từ nút bấm chủ động
  if (request.action === "RELOAD_EXTENSION") {
    setTimeout(() => {
      chrome.runtime.reload();
    }, 100);
    sendResponse({ success: true });
    return true;
  }
});

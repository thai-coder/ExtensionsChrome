/**
 * FEASIBILITY STUDY Data - PropZone Gridics Map Extractor
 * Tách biệt chuyên sâu cho cổng https://propzone.gridics.com/*
 * 
 * Quy trình thực thi:
 * - Bước 1: Khởi tạo, giải mã URL Folio/APN và kiểm tra vai trò Pipeline.
 * - Bước 2: Tự động điền tìm kiếm địa chỉ/APN trên thanh #map-search nếu chưa có dữ liệu.
 * - Bước 3: Mở rộng các bảng Accordion (Lot, Zoning, Setbacks, Capacity) & Lắng nghe DOM.
 * - Bước 4: Trích xuất trọn vẹn thuộc tính quy hoạch, phân khu, kích thước & liên kết.
 * - Bước 5: Fallback & Chuyển tiếp tab mượt mà sang Portal Quận bản địa khi PropZone không có dữ liệu.
 * - Bước 6: Lưu trữ dữ liệu an toàn & kích hoạt Floating UI thông báo kèm nút liên kết bản đồ.
 */

(function () {
  if (window.__PROPZONE_MAP_EXTRACTOR_LOADED__) return;
  window.__PROPZONE_MAP_EXTRACTOR_LOADED__ = true;

  console.log("[PropZone Map Extractor] Khởi động trình trích xuất chuyên biệt PropZone Gridics...");

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Helper: Chờ phần tử xuất hiện trong DOM (Tối đa timeout ms)
  const waitForElement = (selector, timeout = 15000) => {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });
      observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  };

  // Helper: Chuyển tên nhãn thành camelCase key
  const toCamelCase = (str) => {
    if (!str) return '';
    return str
      .replace(/[\(\)\%\$\#\:\/\-\–]/g, ' ')
      .trim()
      .split(/\s+/)
      .map((word, index) => {
        const clean = word.replace(/[^a-zA-Z0-9]/g, '');
        if (!clean) return '';
        if (index === 0) return clean.toLowerCase();
        return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
      })
      .join('');
  };

  // Helper: Chuẩn hóa giá trị
  const parseVal = (key, rawVal) => {
    if (rawVal === undefined || rawVal === null) return null;
    const trimmed = String(rawVal).trim();
    if (trimmed === '-' || trimmed === '' || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'none') {
      return null;
    }

    const lower = trimmed.toLowerCase();
    if (lower === 'yes' || lower === 'true') return true;
    if (lower === 'no' || lower === 'false') return false;

    if (/(parcelid|groupid|legal|tract|code|district|description|desc|alloweduse|use|type|address|situs)/i.test(key)) {
      return trimmed;
    }

    const numMatch = trimmed.replace(/,/g, '').match(/^(-?\d+(\.\d+)?)/);
    if (numMatch && !isNaN(Number(numMatch[0]))) {
      return Number(numMatch[0]);
    }

    return trimmed;
  };

  // Helper: Trích xuất địa chỉ thực tế từ trang
  function extractPageAddress() {
    const fullUsAddressRegex = /\b\d{1,6}\s+[A-Za-z0-9\s\.\,\#\-]+(?:AVE|ST|RD|BLVD|DR|LN|CT|WAY|CIR|BOULEVARD|AVENUE|STREET|ROAD|DRIVE|LANE|COURT|CIRCLE|PLACE|PL|TERRACE|TER|LOOP|PARKWAY|PKWY|HWY|HIGHWAY)\s*,\s*[A-Za-z\s]{3,30}\s*,\s*(?:CA|California)\s*\d{5}\b/i;
    const usAddressRegex = /\b\d{1,6}\s+[A-Za-z0-9\s\.\,\#\-]+(?:AVE|ST|RD|BLVD|DR|LN|CT|WAY|CIR|BOULEVARD|AVENUE|STREET|ROAD|DRIVE|LANE|COURT|CIRCLE|PLACE|PL|TERRACE|TER|LOOP|PARKWAY|PKWY|HWY|HIGHWAY)(?:\s*,\s*[A-Za-z\s]{3,30})?(?:\s*,\s*(?:CA|California))?(?:\s*\d{5})?\b/i;

    const addressSelectors = [
      '[class*="situs" i]', '[id*="situs" i]', '[class*="address" i]', '[id*="address" i]',
      '[class*="property-name" i]', '[class*="property-title" i]', '[class*="property-header" i]',
      '[class*="project-title" i]', '[class*="sidebar-header" i]', '[class*="folio-title" i]',
      '[data-testid*="address" i]', 'h1', 'h2', 'h3'
    ];

    let fallbackShortAddress = null;

    for (const sel of addressSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.children.length > 4) continue;
        const text = (el.innerText || el.textContent || '').trim();
        if (text && text.length >= 8 && text.length <= 160) {
          const fullMatch = text.match(fullUsAddressRegex);
          if (fullMatch) return fullMatch[0].replace(/\s+/g, ' ').trim();

          const shortMatch = text.match(usAddressRegex);
          if (shortMatch && !fallbackShortAddress) {
            fallbackShortAddress = shortMatch[0].replace(/\s+/g, ' ').trim();
          }
        }
      }
    }

    const searchInputs = document.querySelectorAll('input[type="text"], input[type="search"], input[placeholder*="search" i], input[placeholder*="address" i]');
    for (const inp of searchInputs) {
      const val = (inp.value || '').trim();
      if (val && val.length >= 8 && val.length <= 160) {
        const fullMatch = val.match(fullUsAddressRegex);
        if (fullMatch) return fullMatch[0].replace(/\s+/g, ' ').trim();

        const shortMatch = val.match(usAddressRegex);
        if (shortMatch && !fallbackShortAddress) {
          fallbackShortAddress = shortMatch[0].replace(/\s+/g, ' ').trim();
        }
      }
    }

    if (document.title) {
      const fullMatch = document.title.match(fullUsAddressRegex);
      if (fullMatch) return fullMatch[0].replace(/\s+/g, ' ').trim();

      const shortMatch = document.title.match(usAddressRegex);
      if (shortMatch && !fallbackShortAddress) {
        fallbackShortAddress = shortMatch[0].replace(/\s+/g, ' ').trim();
      }
    }

    return fallbackShortAddress || null;
  }

  // Kiểm tra sự xuất hiện của khối thẻ .tables và các bảng phân loại trên PropZone Gridics
  function hasGridicsTablesDOM() {
    const tablesEl = document.querySelector('.tables') || document.querySelector('.tab.capacity .tables');
    if (tablesEl && (tablesEl.children.length > 0 || tablesEl.innerText.trim().length > 10)) return true;
    const hasTableIds = document.querySelector('#Zoning.table, #Lot.table, #Setbacks.table, #Capacity.table, #Zoning, #Lot, #Setbacks, #Capacity');
    return !!hasTableIds;
  }

  // Kiểm tra thông báo không tìm thấy lô đất trên PropZone
  function checkPropZoneNotFound() {
    const text = document.body ? (document.body.innerText || '') : '';
    return /no property found|property not found|no parcel found|invalid folio|no data available/i.test(text);
  }

  // ==========================================
  // KHÓA BẢO VỆ & GIẢI MÃ BỐI CẢNH LỆNH
  // ==========================================
  async function resolvePipelineContext() {
    let roleData = { role: "MANUAL", address: "", apn: "" };
    try {
      roleData = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "GET_PROPZONE_PIPELINE_ROLE" }, (res) => {
          if (chrome.runtime.lastError || !res) resolve({ role: "MANUAL", address: "", apn: "" });
          else resolve(res);
        });
      });
    } catch (e) { }

    let pendingCmd = null;
    try {
      const stored = await chrome.storage.local.get(['pendingExtractorCommand', 'lastSearchQuery', 'lastApn']);
      if (stored && stored.pendingExtractorCommand) {
        const cmd = stored.pendingExtractorCommand;
        const isFresh = cmd.timestamp && (Date.now() - cmd.timestamp < 60000);
        if (isFresh) {
          pendingCmd = cmd;
          // Xóa ngay cờ lệnh để F5/Reload không bị kích hoạt lại
          await chrome.storage.local.remove('pendingExtractorCommand');
        }
      }
    } catch (e) { }

    const isAutoPipeline = roleData.role === "AUTO_PIPELINE";
    const isCommanded = Boolean(pendingCmd) || isAutoPipeline;

    // Khóa chống Reload: Lưu dấu phiên làm việc hiện tại vào sessionStorage
    if (isCommanded) {
      try {
        sessionStorage.setItem("__PROPZONE_SESSION_ACTIVE__", "true");
      } catch (e) { }
    }

    const isSessionActive = Boolean(sessionStorage.getItem("__PROPZONE_SESSION_ACTIVE__"));
    const shouldExecute = isCommanded || isSessionActive;

    let targetAddress = roleData.address || (pendingCmd && pendingCmd.address) || "";
    let targetApn = roleData.apn || (pendingCmd && pendingCmd.apn) || "";

    if (!targetAddress) {
      try {
        const stored = await chrome.storage.local.get(['lastSearchQuery', 'lastApn']);
        targetAddress = stored.lastSearchQuery || "";
        if (!targetApn) targetApn = stored.lastApn || "";
      } catch (e) { }
    }

    return {
      targetAddress,
      targetApn,
      role: roleData.role,
      isAutoPipeline,
      isCommanded,
      shouldExecute
    };
  }

  // ==========================================
  // BƯỚC 1: CHỜ WEB LOAD VÀ NHẬP ĐỊA CHỈ
  // ==========================================
  async function step1_inputAddress(addressToSearch) {
    console.log("=== Bắt đầu Bước 1: Chờ web load và nhập địa chỉ ===");
    if (!addressToSearch || !addressToSearch.trim()) {
      console.warn("[Bước 1] Không có địa chỉ hợp lệ để tìm kiếm.");
      return false;
    }

    const cleanAddress = addressToSearch.trim();
    const inputSelector = 'input[name="search"][placeholder*="Enter an address"], input[name="search"], #map-search input, .search-box.map input, input[placeholder*="Place or Address" i], input[placeholder*="Address" i]';

    console.log("[Bước 1] Đang chờ web load...");
    const searchInput = await waitForElement(inputSelector, 15000);

    if (searchInput) {
      console.log("[Bước 1] Đã tìm thấy ô input. Đang tiến hành nhập liệu...");

      // Click và focus vào ô input trước khi nhập (giả lập thao tác người dùng)
      searchInput.click();
      searchInput.focus();
      await sleep(200);

      // Sử dụng Native Setter để điền dữ liệu (tránh bị React/Vue chặn)
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(searchInput, cleanAddress);
      } else {
        searchInput.value = cleanAddress;
      }

      // Bắn sự kiện input để báo cho trang web biết dữ liệu đã thay đổi
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));

      console.log(`[Bước 1] 🎉 Đã điền xong địa chỉ: "${cleanAddress}"`);
      return true;
    } else {
      console.error("[Bước 1 - Lỗi] Hết thời gian chờ (15s). Không tìm thấy ô nhập địa chỉ.");
      return false;
    }
  }

  // ==========================================
  // BƯỚC 2: BẮT DROPDOWN GỢI Ý HOẶC SUBMIT
  // ==========================================
  async function step2_selectDropdownOrSubmit(addressToSearch) {
    console.log("=== Bắt đầu Bước 2: Bắt dropdown gợi ý hoặc gửi tìm kiếm ===");
    const normalizeAddress = (str) => {
      return (str || '')
        .toUpperCase()
        .replace(/[,.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const targetNormalized = normalizeAddress(addressToSearch);
    let optionFound = false;

    // Vòng lặp chờ danh sách gợi ý xuất hiện (Tối đa 5 giây)
    for (let i = 0; i < 10; i++) {
      await sleep(500);

      const options = document.querySelectorAll('li[role="option"], .place-name, .search-results li, .results li');
      if (options.length > 0) {
        for (let item of options) {
          const placeNameDiv = item.querySelector('.place-name') || item;
          const optionText = normalizeAddress(placeNameDiv.textContent || placeNameDiv.innerText);

          if (optionText.includes(targetNormalized) || targetNormalized.includes(optionText) || optionText.length > 5) {
            console.log(`[Bước 2] 🎉 Tìm thấy địa chỉ khớp: "${placeNameDiv.textContent}"`);
            const clickable = item.tagName === 'LI' ? item : (item.closest('li') || item);
            clickable.click();
            optionFound = true;
            break;
          }
        }
      }

      if (optionFound) break;
    }

    // Fallback: Nhấn nút Submit / Enter nếu không có dropdown
    if (!optionFound) {
      console.log("[Bước 2] Không tìm thấy gợi ý cụ thể, gửi lệnh Enter/Submit...");
      const searchInput = document.querySelector('input[name="search"], #map-search input, .search-box.map input');
      const submitBtn = document.querySelector('#map-search button.form-submit, button[aria-label="Search"], button.form-submit, .map-search button');

      if (submitBtn) {
        submitBtn.click();
      } else if (searchInput) {
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      }
    }

    return true;
  }

  // ==========================================
  // BƯỚC 3: MỞ RỘNG CÁC ACCORDIONS
  // ==========================================
  function step3_ensureAccordionsExpanded() {
    try {
      const headers = Array.from(document.querySelectorAll('.tables .table, .tables [id], button, [role="button"], [class*="header"], [class*="title"], [class*="accordion"], summary'));
      for (const el of headers) {
        if (el.dataset.propzoneExpanded === "true") continue;

        const id = el.id || '';
        const text = (el.innerText || el.textContent || '').trim().toUpperCase();
        if (id === 'Zoning' || id === 'Setbacks' || id === 'Capacity' || id === 'Lot' ||
          text.includes('ZONING') || text.includes('SETBACK') || text.includes('CAPACITY') || text.includes('LOT') || text.includes('OVERVIEW')) {
          const isCollapsed = el.getAttribute('aria-expanded') === 'false'
            || el.classList.contains('collapsed')
            || el.classList.contains('close');
          if (isCollapsed) {
            el.click();
            el.dataset.propzoneExpanded = "true";
          } else if (el.getAttribute('aria-expanded') === 'true') {
            el.dataset.propzoneExpanded = "true";
          }
        }
      }
    } catch (e) { }
  }

  // ==========================================
  // BƯỚC 4: TRÍCH XUẤT DỮ LIỆU PROPZONE
  // ==========================================
  function step4_extractPropZoneData() {
    const results = {
      scrapedAt: new Date().toISOString(),
      domain: window.location.hostname,
      url: window.location.href,
      lot: {},
      zoning: {},
      setbacks: {},
      capacity: {}
    };

    const SECTION_MAPPINGS = [
      { id: 'Lot', key: 'lot' },
      { id: 'Zoning', key: 'zoning' },
      { id: 'Setbacks', key: 'setbacks' },
      { id: 'Capacity', key: 'capacity' }
    ];

    SECTION_MAPPINGS.forEach(({ id, key }) => {
      const secContainer = document.querySelector(`#${id}`)
        || document.querySelector(`[id="${id}" i]`)
        || document.querySelector(`.tables #${id}`)
        || document.querySelector(`.${id.toLowerCase()}`)
        || Array.from(document.querySelectorAll('.table, .card, [class*="section"]')).find(el => {
          const h = el.querySelector('h1, h2, h3, h4, h5, header, [class*="title"], [class*="header"]');
          return h && (h.innerText || '').trim().toUpperCase() === id.toUpperCase();
        });

      if (!secContainer) return;

      const rows = secContainer.querySelectorAll('tr, li, div[class*="row"], div[class*="item"], div[class*="spec"], div[style*="flex"], div');
      rows.forEach(row => {
        if (row.children.length > 4) return;
        const text = (row.innerText || '').trim();
        if (!text || text.toUpperCase() === id.toUpperCase()) return;

        let rowKey = '';
        let rowVal = '';

        if (text.includes(':')) {
          const firstColon = text.indexOf(':');
          rowKey = text.slice(0, firstColon).trim();
          rowVal = text.slice(firstColon + 1).trim();
        } else if (row.children.length === 2) {
          rowKey = (row.children[0].innerText || '').trim();
          rowVal = (row.children[1].innerText || '').trim();
        } else {
          const lbl = row.querySelector('[class*="label"], [class*="name"], span:first-child');
          const v = row.querySelector('[class*="value"], [class*="content"], span:last-child');
          if (lbl && v && lbl !== v) {
            rowKey = lbl.innerText.trim();
            rowVal = v.innerText.trim();
          }
        }

        const linkEl = row.querySelector('a[href]');
        const rowHref = linkEl ? linkEl.href : null;

        if (rowKey && rowVal && rowKey.length < 60 && rowKey !== rowVal) {
          const camelKey = toCamelCase(rowKey);
          if (camelKey) {
            results[key][camelKey] = parseVal(camelKey, rowVal);
            if (rowHref) {
              results[key][camelKey + 'Url'] = rowHref;
              if (camelKey === 'zoningCode' || /zone\s*code/i.test(rowKey)) {
                results.zoning.zoningCodeUrl = rowHref;
              }
            }
          }
        }
      });
    });

    if (!results.zoning.zoningCodeUrl) {
      const zoningLinkEl = document.querySelector('a[href*="municode" i], a[href*="codepublishing" i], a[href*="qcode" i], a[href*="amlegal" i], a[href*="zoning" i]');
      if (zoningLinkEl && zoningLinkEl.href) {
        results.zoning.zoningCodeUrl = zoningLinkEl.href;
      }
    }

    try {
      const urlObj = new URL(window.location.href);
      const urlApn = urlObj.searchParams.get('apn')
        || urlObj.searchParams.get('folio')
        || urlObj.searchParams.get('parcelId')
        || urlObj.searchParams.get('id');
      if (urlApn && /^[0-9A-Za-z-_]+$/.test(urlApn) && urlApn.length >= 6) {
        results.lot.parcelId = urlApn;
      }
    } catch (e) { }

    const pageAddr = extractPageAddress();
    if (pageAddr && !results.lot.projectAddress) {
      results.lot.projectAddress = pageAddr;
    }

    results.apn = results.lot.parcelId || results.lot.parcelNumber || results.lot.apn || null;
    results.address = results.lot.projectAddress || results.lot.address || results.lot.situsAddress || pageAddr || null;
    if (results.address && !results.lot.projectAddress) {
      results.lot.projectAddress = results.address;
    }

    return results;
  }

  // Đánh giá mức độ đầy đủ của dữ liệu đã trích xuất
  function evaluateDataStatus(data, elapsedSec = 0) {
    if (!data) return { ready: false, count: 0, reason: "NO_DATA" };

    const hasTables = hasGridicsTablesDOM();
    if (!hasTables) {
      return { ready: false, count: 0, reason: "WAITING_FOR_TABLES_DOM" };
    }

    const lot = data.lot || {};
    const zoning = data.zoning || {};
    const capacity = data.capacity || {};
    const setbacks = data.setbacks || {};

    const hasLot = !!(lot.lotAreaTaxRecord || lot.existingBuildingArea || lot.yearBuilt || lot.lotAreaAcres || lot.existingLivingUnits || Object.keys(lot).length >= 1);
    const hasZoning = !!(zoning.zoningDistrict || zoning.zoningCode || zoning.existingLandUse || zoning.zoningCodeUrl || Object.keys(zoning).length >= 1);
    const hasSetbacks = !!(setbacks.minimumPrimaryFrontageSetback || setbacks.minimumRearSetback || setbacks.minimumSideSetback || Object.keys(setbacks).length >= 1);
    const hasCapacity = !!(capacity.maximumBuildingHeight || capacity.maximumBuildingArea || capacity.maximumHeightStories || capacity.maximumResidentialUnits || Object.keys(capacity).length >= 1);

    let realFieldCount = 0;
    [lot, zoning, capacity, setbacks].forEach(sec => {
      Object.keys(sec).forEach(k => {
        if (k !== 'parcelId' && k !== 'projectAddress' && k !== 'address' && sec[k] !== null && sec[k] !== undefined && sec[k] !== '' && sec[k] !== '-') {
          realFieldCount++;
        }
      });
    });

    const isIdealComplete = (hasLot && hasZoning && (hasSetbacks || hasCapacity)) || realFieldCount >= 6;
    if (isIdealComplete) {
      return { ready: true, count: realFieldCount, reason: "IDEAL_COMPLETE_WITH_TABLES" };
    }

    if (elapsedSec >= 3.5 && ((hasLot && hasZoning) || realFieldCount >= 3)) {
      return { ready: true, count: realFieldCount, reason: "TABLES_READY_STABLE" };
    }

    return { ready: false, count: realFieldCount, reason: "WAITING_TABLES_CONTENT" };
  }

  // ==========================================
  // BƯỚC 5: FALLBACK & ĐIỀU HƯỚNG TAB QUẬN MƯỢT MÀ
  // ==========================================
  async function step5_handleCountyFallback(targetAddress, targetApn) {
    const rawAddress = targetAddress || extractPageAddress() || "";
    const rawApn = targetApn || "";

    if (!rawAddress && !rawApn) {
      console.warn("[PropZone Map Extractor] [Bước 5] Không có thông tin địa chỉ/APN để điều hướng fallback.");
      return false;
    }

    const countyInfo = (typeof window.CountyDetector !== 'undefined' && window.CountyDetector.detect)
      ? window.CountyDetector.detect(rawAddress)
      : { countyKey: "orange", name: "Orange County" };

    console.warn(`[PropZone Map Extractor] [Bước 5] PropZone không có dữ liệu. Kích hoạt Fallback sang Portal: ${countyInfo.name}...`);

    const addressToSearch = rawAddress.split(',')[0].trim().toUpperCase();
    const zipRegex = rawAddress.match(/\b\d{5}\b/);
    const zipToSearch = zipRegex ? zipRegex[0] : '';

    if (countyInfo.countyKey === 'losAngeles') {
      // Điều hướng mượt sang ZIMAS / LA Assessor như chuỗi ZIMAS -> LA Map
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          laPortalPendingSearch: {
            address: rawAddress || addressToSearch,
            addressToSearch: addressToSearch,
            zipToSearch: zipToSearch,
            timestamp: Date.now()
          }
        });
      }
      window.location.href = "https://zimas.lacity.org/";
      return true;
    } else if (countyInfo.countyKey === 'orange') {
      // Điều hướng mượt sang OCGIS Land Insights
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          pendingExtractorCommand: {
            url: "https://webapps.ocgis.com/ocgislandinsights/",
            portalKey: "ocgis",
            address: rawAddress,
            apn: rawApn,
            timestamp: Date.now()
          }
        });
      }
      window.location.href = "https://webapps.ocgis.com/ocgislandinsights/";
      return true;
    } else if (countyInfo.countyKey === 'riverside') {
      // Điều hướng mượt sang Riverside Portal
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          pendingExtractorCommand: {
            url: "https://ca-riverside-acr.civicplus.pro/",
            portalKey: "rivco",
            address: rawAddress,
            apn: rawApn,
            timestamp: Date.now()
          }
        });
      }
      window.location.href = "https://ca-riverside-acr.civicplus.pro/search/property";
      return true;
    } else if (countyInfo.countyKey === 'sanBernardino') {
      // Điều hướng mượt sang Ontario / San Bernardino Portal
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          pendingExtractorCommand: {
            url: "https://www.arcgis.com/apps/webappviewer/",
            portalKey: "sanbernardino",
            address: rawAddress,
            apn: rawApn,
            timestamp: Date.now()
          }
        });
      }
      window.location.href = "https://www.arcgis.com/apps/webappviewer/index.html?id=8dd3739a341e40ebba35c0fa370caaa8";
      return true;
    }

    return false;
  }

  // ==========================================
  // BƯỚC 6: LƯU DỮ LIỆU & THÔNG BÁO FLOATING UI
  // ==========================================
  async function step6_saveAndNotify(data, isAutoPipeline, shouldNotify = true) {
    const lot = data?.lot || {};
    const zoning = data?.zoning || {};
    const capacity = data?.capacity || {};

    const address = lot.projectAddress || data?.address || "PropZone Gridics";
    const apn = lot.parcelId || data?.apn || "N/A";
    const zone = zoning.zoningCode || zoning.zoningDistrict || "N/A";

    const lines = [];
    if (address && address !== "PropZone Gridics") {
      lines.push(`📍 ${address}`);
    }
    lines.push(`🏷️ APN: ${apn}  |  🏛️ Zone: ${zone}`);

    const details = [];
    const lotArea = lot.lotAreaTaxRecord || lot.lotAreaParcelShape || lot.lotAreaAcres;
    if (lotArea) {
      details.push(`Lot: ${typeof lotArea === 'number' ? lotArea.toLocaleString() : lotArea} sqft`);
    }
    if (capacity.maximumBuildingHeight) {
      details.push(`Max Height: ${capacity.maximumBuildingHeight}`);
    }
    if (details.length > 0) {
      lines.push(details.join('  •  '));
    }

    const title = "Trích xuất PropZone Gridics thành công!";
    const message = lines.join('\n');

    let mapLinks = null;
    try {
      const stored = await chrome.storage.local.get(['ocgisMapLinks']);
      mapLinks = stored?.ocgisMapLinks || null;
    } catch (e) { }

    // Hiển thị Floating UI khi có yêu cầu hoặc trong quy trình có lệnh
    if (shouldNotify && typeof FloatingUI !== 'undefined') {
      FloatingUI.showSuccess(title, message, 8000, mapLinks);
    }

    // Gửi message lưu storage
    if (isAutoPipeline) {
      setTimeout(() => {
        chrome.runtime.sendMessage({
          action: "AUTO_SAVE_AND_CLOSE_TAB",
          data: data
        });
      }, 600);
    } else {
      chrome.runtime.sendMessage({
        action: "AUTO_SAVE_FULL_EXTRACTED_DATA",
        data: data
      });
    }
  }

  // ==========================================
  // PIPELINE ĐIỀU PHỐI CHÍNH
  // ==========================================
  async function initPropZonePipeline() {
    const context = await resolvePipelineContext();
    const { targetAddress, targetApn, isAutoPipeline, shouldExecute } = context;

    // Khóa chống Reload: Nếu không phải lệnh từ extension, dừng thực thi
    if (!shouldExecute) {
      console.log("[PropZone Map Extractor] Chế độ duyệt thông thường. Khóa chống reload đang bật.");
      return;
    }

    // Bước 1 & 2: Nhập địa chỉ tìm kiếm nếu trang chưa có bảng dữ liệu
    if (!hasGridicsTablesDOM() && targetAddress) {
      const inputOk = await step1_inputAddress(targetAddress);
      if (inputOk) {
        await step2_selectDropdownOrSubmit(targetAddress);
      }
    }

    let isCompleted = false;
    let lastFieldCount = 0;
    let stableConsecutiveCycles = 0;
    let startTime = Date.now();

    const tryExtractCycle = async () => {
      if (isCompleted) return;
      const elapsedSec = (Date.now() - startTime) / 1000;

      try {
        step3_ensureAccordionsExpanded();

        const data = step4_extractPropZoneData();
        const status = evaluateDataStatus(data, elapsedSec);

        if (status.count > 0 && status.count === lastFieldCount) {
          stableConsecutiveCycles++;
        } else {
          stableConsecutiveCycles = 0;
          lastFieldCount = status.count;
        }

        const isDone = (status.ready && stableConsecutiveCycles >= 2) || (elapsedSec >= 5 && status.count >= 3);

        if (isDone) {
          isCompleted = true;
          cleanup();
          try { sessionStorage.removeItem("__PROPZONE_SESSION_ACTIVE__"); } catch (e) { }
          await step6_saveAndNotify(data, isAutoPipeline, true);
          return;
        }

        // Nếu sau 6s không tìm thấy: kích hoạt fallback sang portal Quận
        if (elapsedSec >= 6 && checkPropZoneNotFound()) {
          isCompleted = true;
          cleanup();
          try { sessionStorage.removeItem("__PROPZONE_SESSION_ACTIVE__"); } catch (e) { }
          const redirected = await step5_handleCountyFallback(targetAddress, targetApn);
          if (!redirected) {
            await step6_saveAndNotify(data, isAutoPipeline, true);
          }
          return;
        }
      } catch (e) {
        console.warn("[PropZone Map Extractor] Lỗi trong chu kỳ trích xuất:", e);
      }
    };

    // 1. Quét ngay tức thì
    tryExtractCycle();

    // 2. Polling mỗi 400ms
    const pollTimer = setInterval(tryExtractCycle, 400);

    // 3. MutationObserver
    let observer = null;
    try {
      observer = new MutationObserver(() => {
        if (!isCompleted) tryExtractCycle();
      });
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      }
    } catch (e) { }

    const cleanup = () => {
      if (pollTimer) clearInterval(pollTimer);
      if (observer) observer.disconnect();
      if (maxWaitTimer) clearTimeout(maxWaitTimer);
    };

    // 4. Timeout dự phòng 45s
    const maxWaitTimer = setTimeout(async () => {
      if (isCompleted) return;
      isCompleted = true;
      cleanup();
      try { sessionStorage.removeItem("__PROPZONE_SESSION_ACTIVE__"); } catch (e) { }

      const finalData = step4_extractPropZoneData();
      if (!finalData.apn && checkPropZoneNotFound()) {
        const redirected = await step5_handleCountyFallback(targetAddress, targetApn);
        if (redirected) return;
      }
      await step6_saveAndNotify(finalData, isAutoPipeline, true);
    }, 45000);
  }

  // Kích hoạt Pipeline
  initPropZonePipeline();

  // ==========================================
  // LẮNG NGHE LỆNH THỦ CÔNG TỪ POPUP
  // ==========================================
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_DATA' || request.action === 'FORCE_FRESH_EXTRACT') {
      try {
        step3_ensureAccordionsExpanded();
        const data = step4_extractPropZoneData();
        step6_saveAndNotify(data, false, true);

        sendResponse({
          success: true,
          domain: window.location.hostname,
          url: window.location.href,
          data: data
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }
  });

})();



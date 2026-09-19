/**
 * PropZoneData - Universal Multi-Portal Property & Zoning Parser
 * Hỗ trợ bóc tách thông minh 100% dữ liệu từ:
 * 1. Gridics PropZone (propzone.gridics.com)
 * 2. Orange County GIS (webapps.ocgis.com)
 * 3. LA County Assessor (portal.assessor.lacounty.gov)
 * 4. Redfin & Zillow (redfin.com, zillow.com)
 * 5. FEMA ArcGIS & Universal GIS Portals
 */

(function () {
  if (window.__PROPZONE_EXTRACTOR_LOADED__) return;
  window.__PROPZONE_EXTRACTOR_LOADED__ = true;

  const TARGET_SECTIONS = ['LOT', 'ZONING', 'SETBACKS', 'CAPACITY'];

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

    // Giữ nguyên chuỗi cho các mã định danh, mô tả
    if (/(parcelid|groupid|legal|tract|code|district|description|desc|alloweduse|use|type|address|situs)/i.test(key)) {
      return trimmed;
    }

    // Nếu là giá trị số kèm đơn vị (ft², ft, %, acres, ac)
    const numMatch = trimmed.replace(/,/g, '').match(/^(-?\d+(\.\d+)?)/);
    if (numMatch && !isNaN(Number(numMatch[0]))) {
      return Number(numMatch[0]);
    }

    return trimmed;
  };

  // 1. Tự động click mở các Accordion/Tab đang đóng
  async function expandAllAccordions() {
    // A. Mở tab Properties nếu đang ở trạng thái đóng
    const overlayBtns = document.querySelectorAll('[data-testid*="properties" i], [class*="overlay" i], button[title*="Properties" i]');
    overlayBtns.forEach(btn => {
      try {
        if (!btn.classList.contains('active') && !btn.classList.contains('selected')) {
          btn.click();
        }
      } catch (e) {}
    });

    // B. Mở toàn bộ Accordion sections (LOT, ZONING, SETBACKS, CAPACITY)
    const clickableElements = document.querySelectorAll(
      'button, div[role="button"], .accordion-header, [data-toggle], [aria-expanded="false"], [class*="accordion"]'
    );
    
    let clickedAny = false;
    clickableElements.forEach(el => {
      const txt = (el.innerText || '').toUpperCase();
      if (TARGET_SECTIONS.some(s => txt.includes(s)) || txt.includes('PROPERTY') || txt.includes('PARCEL') || txt.includes('CHARACTERISTICS') || txt.includes('DIMENSIONS')) {
        const isExpanded = el.getAttribute('aria-expanded');
        if (isExpanded === 'false' || el.classList.contains('collapsed')) {
          try {
            el.click();
            clickedAny = true;
          } catch (e) {}
        }
      }
    });

    if (clickedAny) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Helper: Trích xuất địa chỉ thực tế từ tiêu đề, thanh tìm kiếm, và document.title
  function extractPageAddress() {
    const usAddressRegex = /\b\d{1,6}\s+[A-Za-z0-9\s\.\,\#\-]+(?:AVE|ST|RD|BLVD|DR|LN|CT|WAY|CIR|BOULEVARD|AVENUE|STREET|ROAD|DRIVE|LANE|COURT|CIRCLE|PLACE|PL|TERRACE|TER|LOOP|PARKWAY|PKWY|HWY|HIGHWAY)\b/i;

    // 1. Quét các thẻ tiêu đề, header, address container
    const addressSelectors = [
      '[class*="address" i]',
      '[id*="address" i]',
      '[class*="property-name" i]',
      '[class*="property-title" i]',
      '[class*="property-header" i]',
      '[class*="project-title" i]',
      '[class*="sidebar-header" i]',
      '[class*="folio-title" i]',
      '[data-testid*="address" i]',
      'h1', 'h2', 'h3'
    ];

    for (const sel of addressSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.children.length > 3) continue;
        const text = (el.innerText || el.textContent || '').trim();
        if (text && text.length >= 8 && text.length <= 150 && usAddressRegex.test(text)) {
          const cleaned = text.split('\n')[0].trim();
          if (cleaned) return cleaned;
        }
      }
    }

    // 2. Quét các ô input tìm kiếm địa chỉ
    const searchInputs = document.querySelectorAll('input[type="text"], input[type="search"], input[placeholder*="search" i], input[placeholder*="address" i]');
    for (const inp of searchInputs) {
      const val = (inp.value || '').trim();
      if (val && val.length >= 8 && val.length <= 150 && usAddressRegex.test(val)) {
        return val;
      }
    }

    // 3. Quét Document Title
    if (document.title) {
      const titleMatch = document.title.match(usAddressRegex);
      if (titleMatch) {
        const fullMatch = document.title.slice(titleMatch.index).split(/[\-\|\|]/)[0].trim();
        if (fullMatch && fullMatch.length >= 8) return fullMatch;
      }
    }

    return null;
  }

  // 2. Trích xuất Gridics PropZone Data
  async function extractGridicsData() {
    await expandAllAccordions();

    const results = {
      lot: {},
      zoning: {},
      setbacks: {},
      capacity: {}
    };

    const allElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, header, div, span, strong, [class*="title"], [class*="header"]'));

    TARGET_SECTIONS.forEach(secName => {
      const secKey = secName.toLowerCase();
      const headerEl = allElements.find(el => {
        const t = (el.innerText || '').trim().toUpperCase();
        return (t === secName || t.startsWith(secName + ' ') || t.startsWith(secName + ':') || t.startsWith(secName + '\n') || t.includes(secName)) && el.children.length <= 4;
      });

      let container = null;
      if (headerEl) {
        container = headerEl.closest('.card, .panel, .accordion-item, [class*="section"], [class*="container"], [class*="wrapper"]') 
                 || headerEl.parentElement;
      }

      const targetScope = container || document.body;
      const rows = targetScope.querySelectorAll('tr, li, div[class*="row"], div[class*="item"], div[class*="spec"], div[style*="flex"]');

      rows.forEach(row => {
        if (headerEl && row.contains(headerEl) && row !== headerEl) return;

        const text = (row.innerText || '').trim();
        if (!text || text === secName) return;

        let key = '';
        let val = '';

        if (text.includes(':')) {
          const firstColon = text.indexOf(':');
          key = text.slice(0, firstColon).trim();
          val = text.slice(firstColon + 1).trim();
        } else if (row.children.length === 2) {
          key = (row.children[0].innerText || '').trim();
          val = (row.children[1].innerText || '').trim();
        } else {
          const lbl = row.querySelector('[class*="label"], [class*="name"], span:first-child');
          const v = row.querySelector('[class*="value"], [class*="content"], span:last-child');
          if (lbl && v && lbl !== v) {
            key = lbl.innerText.trim();
            val = v.innerText.trim();
          }
        }

        if (key && val && key.length < 60) {
          const camelKey = toCamelCase(key);
          if (camelKey) {
            results[secKey][camelKey] = parseVal(camelKey, val);
          }
        }
      });
    });

    const pageAddr = extractPageAddress();
    if (pageAddr && !results.lot.projectAddress) {
      results.lot.projectAddress = pageAddr;
    }

    return results;
  }

  // 3. Trích xuất Đa Năng Cho Mọi Trang GIS (OCGIS, LA Assessor, Redfin, Zillow)
  function extractUniversalDOMData() {
    const fullText = document.body ? (document.body.innerText || '') : '';
    const lot = {};
    const zoning = {};
    const setbacks = {};
    const capacity = {};

    // A. Quét tất cả các cặp Key-Value trên trang (Tables, Definition lists, Info widgets)
    const elements = document.querySelectorAll('tr, dl, div, p, li, [class*="row"], [class*="field"], [class*="item"], [class*="attribute"]');
    elements.forEach(el => {
      if (el.children.length > 4) return;
      const txt = (el.innerText || '').trim();
      if (!txt || txt.length > 250) return;

      let k = '';
      let v = '';

      if (txt.includes(':')) {
        const parts = txt.split(':');
        k = parts[0].trim().toLowerCase();
        v = parts.slice(1).join(':').trim();
      } else if (el.children.length === 2) {
        k = (el.children[0].innerText || '').trim().toLowerCase();
        v = (el.children[1].innerText || '').trim();
      }

      if (!k || !v || k.length > 50) return;

      // Phân loại vào trường phù hợp
      if (/parcel|apn|ain|folio/i.test(k)) {
        lot.parcelId = v.replace(/[^0-9A-Za-z-]/g, '');
      } else if (/address|situs|location|site\s*address|property\s*address/i.test(k) && !lot.projectAddress) {
        lot.projectAddress = v;
      } else if (/year\s*built|built/i.test(k) && !lot.yearBuilt) {
        const y = v.match(/\b(18|19|20)\d{2}\b/);
        if (y) lot.yearBuilt = Number(y[0]);
      } else if (/building\s*area|living\s*area|sq\s*ft|bldg\s*area|gross\s*area/i.test(k) && !lot.existingBuildingArea) {
        const num = v.replace(/,/g, '').match(/\d+/);
        if (num) lot.existingBuildingArea = Number(num[0]);
      } else if (/lot\s*area|lot\s*size|land\s*area/i.test(k) && !lot.lotAreaTaxRecord) {
        const num = v.replace(/,/g, '').match(/\d+/);
        if (num) lot.lotAreaTaxRecord = Number(num[0]);
      } else if (/acres/i.test(k) && !lot.lotAreaAcres) {
        const num = v.match(/\d+(\.\d+)?/);
        if (num) lot.lotAreaAcres = Number(num[0]);
      } else if (/use\s*code|land\s*use|property\s*use|property\s*type|building\s*use/i.test(k)) {
        lot.existingBuildingUse = v;
        zoning.existingLandUse = v;
      } else if (/zoning|zone\s*code|zone\s*district/i.test(k) && !zoning.zoningDistrict) {
        zoning.zoningDistrict = v;
        zoning.zoningCode = v;
      } else if (/legal\s*desc|tract/i.test(k) && !lot.legalDescription) {
        lot.legalDescription = v;
      } else if (/units|living\s*units/i.test(k) && !lot.existingLivingUnits) {
        const num = v.match(/\d+/);
        if (num) lot.existingLivingUnits = Number(num[0]);
      } else if (/frontage/i.test(k) && !lot.frontageLength) {
        const num = v.match(/\d+/);
        if (num) lot.frontageLength = Number(num[0]);
      } else if (/flood/i.test(k) && !zoning.femaFloodZone) {
        zoning.femaFloodZone = v;
      }
    });

    // B. Quét URL Parameters để lấy APN
    try {
      const urlObj = new URL(window.location.href);
      const urlApn = urlObj.searchParams.get('apn') 
                  || urlObj.searchParams.get('folio') 
                  || urlObj.searchParams.get('parcelId') 
                  || urlObj.searchParams.get('id');
      if (urlApn && /^[0-9A-Za-z-_]+$/.test(urlApn) && urlApn.length >= 6) {
        lot.parcelId = urlApn;
      } else {
        const pathMatch = urlObj.pathname.match(/\/(?:parceldetail|parcel|property|folio)\/([0-9A-Za-z-]+)/i);
        if (pathMatch && pathMatch[1]) {
          lot.parcelId = pathMatch[1].replace(/[^0-9A-Za-z-]/g, '');
        }
      }
    } catch (e) {}

    // C. Regex Fallback từ toàn trang nếu APN chưa có
    if (!lot.parcelId) {
      const apnRegex = /(?:APN|Parcel(?: Number| ID| #| No\.?)?|AIN|Folio)[^\d]{0,15}?(\d{4}[-\s]?\d{3}[-\s]?\d{3}|\d{3}[-\s]?\d{3}[-\s]?\d{2,3}|\d{8,10})\b/gi;
      let m;
      while ((m = apnRegex.exec(fullText)) !== null) {
        if (m[1]) {
          lot.parcelId = m[1].replace(/\s/g, '');
          break;
        }
      }
    }

    if (!lot.projectAddress) {
      const pageAddr = extractPageAddress();
      if (pageAddr) lot.projectAddress = pageAddr;
    }

    return { lot, zoning, setbacks, capacity };
  }

  // 4. Tổng Hợp & Đồng Bộ Dữ Liệu
  async function extractAllData() {
    const isGridics = window.location.hostname.includes('propzone') || window.location.hostname.includes('gridics');
    
    let base = {
      scrapedAt: new Date().toISOString(),
      domain: window.location.hostname,
      url: window.location.href,
      lot: {},
      zoning: {},
      setbacks: {},
      capacity: {}
    };

    if (isGridics) {
      const gData = await extractGridicsData();
      base.lot = { ...base.lot, ...gData.lot };
      base.zoning = { ...base.zoning, ...gData.zoning };
      base.setbacks = { ...base.setbacks, ...gData.setbacks };
      base.capacity = { ...base.capacity, ...gData.capacity };
    }

    // Luôn kết hợp Universal DOM extractor để đảm bảo không bỏ sót trường nào
    const uData = extractUniversalDOMData();
    base.lot = { ...uData.lot, ...base.lot };
    base.zoning = { ...uData.zoning, ...base.zoning };
    base.setbacks = { ...uData.setbacks, ...base.setbacks };
    base.capacity = { ...uData.capacity, ...base.capacity };

    // Chuẩn hóa APN & Address
    base.apn = base.lot.parcelId || base.lot.parcelNumber || base.lot.apn || null;
    base.address = base.lot.projectAddress || base.lot.address || base.lot.situsAddress || extractPageAddress() || null;
    if (base.address && !base.lot.projectAddress) {
      base.lot.projectAddress = base.address;
    }

    return base;
  }

  // 5. Kiểm tra và tự động lưu khi có dữ liệu
  let hasSentAutoSave = false;

  async function checkAndAutoSave() {
    try {
      const data = await extractAllData();
      const hasLotData = Object.keys(data.lot).length > 0;
      const hasZoningData = Object.keys(data.zoning).length > 0;
      const hasApn = !!data.apn;

      if (hasApn || hasLotData || hasZoningData) {
        console.log(`🎯 [Extractor] Extracted data from ${window.location.hostname}:`, data);
        
        chrome.runtime.sendMessage({
          action: "AUTO_SAVE_FULL_EXTRACTED_DATA",
          data: data
        });

        hasSentAutoSave = true;
      }
    } catch (e) {}
  }

  // 6. Quy trình Tự động Lặp Lại 5 Lần & Đóng Tab Khi Có Dữ Liệu trên PropZone
  const isGridics = window.location.hostname.includes('propzone') || window.location.hostname.includes('gridics');
  const urlParams = new URLSearchParams(window.location.search);
  const hasTargetFolio = urlParams.has('folio') || urlParams.has('apn') || urlParams.has('parcelId') || urlParams.has('leftOverlay');

  // Hàm kiểm tra nghiêm ngặt: Dữ liệu thực sự đã được tải từ Gridics API hay chưa
  function isPropZoneDataFullyLoaded(data) {
    if (!data) return false;
    const lot = data.lot || {};
    const zoning = data.zoning || {};
    const capacity = data.capacity || {};
    const setbacks = data.setbacks || {};

    // Các thuộc tính thực tế bắt buộc từ bảng chi tiết (không tính apn hay address lấy từ URL)
    const hasLotSpecs = !!(lot.lotAreaTaxRecord || lot.existingBuildingArea || lot.yearBuilt || lot.lotAreaAcres || lot.existingBuildingUse || lot.existingLivingUnits);
    const hasZoningSpecs = !!(zoning.zoningDistrict || zoning.zoningCode || zoning.existingLandUse);
    const hasCapacityOrSetbacks = !!(capacity.maximumBuildingHeight || capacity.maximumBuildingArea || capacity.maximumHeightStories || setbacks.minimumPrimaryFrontageSetback || setbacks.minimumRearSetback);

    let realFieldCount = 0;
    [lot, zoning, capacity, setbacks].forEach(sec => {
      Object.keys(sec).forEach(k => {
        if (k !== 'parcelId' && k !== 'projectAddress' && k !== 'address' && sec[k] !== null && sec[k] !== undefined && sec[k] !== '' && sec[k] !== '-') {
          realFieldCount++;
        }
      });
    });

    // Chỉ coi là hoàn tất khi có thông số Lot/Zoning thực tế HOẶC tối thiểu 3 trường thông số chi tiết
    return (hasLotSpecs && (hasZoningSpecs || hasCapacityOrSetbacks)) || realFieldCount >= 4;
  }

  if (isGridics && hasTargetFolio) {
    let attemptCount = parseInt(sessionStorage.getItem('__PROPZONE_ATTEMPT_COUNT__') || '1', 10);
    console.log(`%c🔄 [PropZone Pipeline] Đang mở quét dữ liệu (Lần ${attemptCount} / 5)...`, "color: #38bdf8; font-weight: bold; font-size: 13px;");

    const ATTEMPT_TIMEOUT_MS = 30000; // Chờ 30 giây cho mỗi lần tải (đủ cho Mapbox & API PropZone phản hồi)
    let isCompleted = false;
    let isStabilizing = false;

    // Kiểm tra liên tục mỗi 1.5 giây
    const checkInterval = setInterval(async () => {
      if (isCompleted || isStabilizing) return;
      try {
        const data = await extractAllData();
        const isLoaded = isPropZoneDataFullyLoaded(data);

        if (isLoaded) {
          isStabilizing = true;
          console.log(`%c⏳ [PropZone Pipeline] Đã phát hiện dữ liệu ở Lần ${attemptCount}. Chờ 3 giây để thu thập trọn vẹn tất cả các tab...`, "color: #f59e0b; font-weight: bold;");

          // Chờ 3 giây để đảm bảo toàn bộ 4 tab (Lot, Zoning, Setbacks, Capacity) được bung và bóc tách đầy đủ 100%
          setTimeout(async () => {
            if (isCompleted) return;
            isCompleted = true;
            clearInterval(checkInterval);
            clearTimeout(retryTimeoutTimer);
            sessionStorage.removeItem('__PROPZONE_ATTEMPT_COUNT__');

            // Bóc tách lại một lần cuối cùng trọn vẹn nhất
            const finalData = await extractAllData();
            console.log(`%c✅ [PropZone Pipeline] Thu thập hoàn tất 100% dữ liệu ở Lần ${attemptCount}! Đang lưu và đóng tab...`, "color: #10b981; font-weight: bold; font-size: 14px;", finalData);

            chrome.runtime.sendMessage({
              action: "AUTO_SAVE_AND_CLOSE_TAB",
              data: finalData,
              attempt: attemptCount
            });
          }, 3000);
        }
      } catch (e) {}
    }, 1500);

    // Xử lý khi hết thời gian chờ của lần thử hiện tại
    const retryTimeoutTimer = setTimeout(() => {
      if (isCompleted || isStabilizing) return;
      clearInterval(checkInterval);

      if (attemptCount < 5) {
        console.warn(`⚠️ [PropZone Pipeline] Lần ${attemptCount} chưa lấy đủ data sau 30s. Đang tự động tải lại (Lần ${attemptCount + 1} / 5)...`);
        sessionStorage.setItem('__PROPZONE_ATTEMPT_COUNT__', String(attemptCount + 1));
        window.location.reload();
      } else {
        console.error(`❌ [PropZone Pipeline] Đã thử 5 lần nhưng không thể tải data. Đang đóng tab và báo lỗi...`);
        sessionStorage.removeItem('__PROPZONE_ATTEMPT_COUNT__');
        chrome.runtime.sendMessage({
          action: "PROPZONE_EXTRACTION_FAILED",
          url: window.location.href,
          folio: urlParams.get('folio') || urlParams.get('apn') || ''
        });
      }
    }, ATTEMPT_TIMEOUT_MS);
  }

  // Lắng nghe Message từ Popup / Background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_DATA' || request.action === 'FORCE_FRESH_EXTRACT') {
      extractAllData().then(data => {
        sendResponse({
          success: true,
          domain: window.location.hostname,
          url: window.location.href,
          data: data
        });
      }).catch(err => {
        sendResponse({
          success: false,
          message: 'Error: ' + err.message
        });
      });
      return true;
    }
  });

  // Tự động kiểm tra liên tục theo thời gian (kể cả khi SPA tải chậm sau 3 - 8 giây)
  const pollTimes = [500, 1200, 2500, 4500, 7500];
  pollTimes.forEach(t => setTimeout(checkAndAutoSave, t));

  // Theo dõi DOM thay đổi
  const observer = new MutationObserver(() => {
    checkAndAutoSave();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      checkAndAutoSave();
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  }

})();

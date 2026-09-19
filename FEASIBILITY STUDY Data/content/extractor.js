/**
 * FEASIBILITY STUDY Data - Universal Multi-Portal Property & Zoning Parser
 * Chế độ bóc tách thông minh, Eager DOM Scanner & MutationObserver thời gian thực.
 */

(function initExtractor() {
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

    if (/(parcelid|groupid|legal|tract|code|district|description|desc|alloweduse|use|type|address|situs)/i.test(key)) {
      return trimmed;
    }

    const numMatch = trimmed.replace(/,/g, '').match(/^(-?\d+(\.\d+)?)/);
    if (numMatch && !isNaN(Number(numMatch[0]))) {
      return Number(numMatch[0]);
    }

    return trimmed;
  };

  // Helper: Trích xuất địa chỉ thực tế từ trang (Ưu tiên địa chỉ đầy đủ có City, State, Zip)
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
          // Ưu tiên 1: Địa chỉ đầy đủ cả City, CA, Zip
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

  // 1. Trích xuất Gridics PropZone Data trực tiếp từ container .tables & các #ID (Zoning, Setbacks, Capacity, Lot)
  function extractGridicsData() {
    const results = { lot: {}, zoning: {}, setbacks: {}, capacity: {} };

    const SECTION_MAPPINGS = [
      { id: 'Lot', key: 'lot' },
      { id: 'Zoning', key: 'zoning' },
      { id: 'Setbacks', key: 'setbacks' },
      { id: 'Capacity', key: 'capacity' }
    ];

    SECTION_MAPPINGS.forEach(({ id, key }) => {
      // Tìm container chính xác theo ID bảng (#Lot, #Zoning, #Setbacks, #Capacity) hoặc class
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

    const pageAddr = extractPageAddress();
    if (pageAddr && !results.lot.projectAddress) {
      results.lot.projectAddress = pageAddr;
    }

    return results;
  }

  // 2. Trích xuất Đa Năng Cho Mọi Trang GIS (OCGIS, LA Assessor, Redfin, Zillow)
  function extractUniversalDOMData() {
    const fullText = document.body ? (document.body.innerText || '') : '';
    const lot = {};
    const zoning = {};
    const setbacks = {};
    const capacity = {};

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
        const linkEl = el.querySelector('a[href]');
        if (linkEl && linkEl.href) {
          zoning.zoningCodeUrl = linkEl.href;
        }
      } else if (/legal\s*desc|tract/i.test(k) && !lot.legalDescription) {
        lot.legalDescription = v;
      } else if (/units|living\s*units/i.test(k) && !lot.existingLivingUnits) {
        const num = v.match(/\d+/);
        if (num) lot.existingLivingUnits = Number(num[0]);
      } else if (/frontage/i.test(k) && !lot.frontageLength) {
        const num = v.match(/\d+/);
        if (num) lot.frontageLength = Number(num[0]);
      } else if (/parking|garage|carport/i.test(k) && !lot.parking) {
        lot.parking = v;
        capacity.parkingSpaces = v;
      } else if (/stories|story|levels|floors/i.test(k) && !lot.stories) {
        const num = v.match(/\d+/);
        lot.stories = num ? Number(num[0]) : v;
        if (!capacity.maximumHeightStories) {
          capacity.maximumHeightStories = num ? Number(num[0]) : v;
        }
      } else if (/flood/i.test(k) && !zoning.femaFloodZone) {
        zoning.femaFloodZone = v;
      }
    });

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

    if (!lot.parcelId) {
      const apnPatterns = [
        /(?:APN|Parcel(?:\s*(?:Number|ID|#|No\.?))?|AIN|Folio)[\s:\-–—#\.\t]{1,15}(\d{3,5}[\s\-\.]\d{2,4}[\s\-\.]\d{2,4}(?:[\s\-\.]\d{2,4})?|\d{8,12})\b/gi,
        /\bAPN\s*[:#\s]?\s*(\d{4}[\s\-\.]\d{3}[\s\-\.]\d{2})\b/gi,
        /\bAPN\s*[:#\s]?\s*(\d{3,4}[\s\-\.]\d{3}[\s\-\.]\d{2,3})\b/gi,
        /\bAPN\s*[:#\s]?\s*(\d{8,12})\b/gi
      ];
      for (const pat of apnPatterns) {
        let m;
        while ((m = pat.exec(fullText)) !== null) {
          if (m[1]) {
            const raw = m[1].trim();
            const clean = raw.replace(/[\s\-\.]/g, '');
            if (clean.length >= 8 && clean.length <= 12) {
              lot.parcelId = raw.replace(/\s+/g, '-');
              break;
            }
          }
        }
        if (lot.parcelId) break;
      }
    }

    if (!lot.projectAddress) {
      const pageAddr = extractPageAddress();
      if (pageAddr) lot.projectAddress = pageAddr;
    }

    return { lot, zoning, setbacks, capacity };
  }

  // 3. Tổng Hợp Dữ Liệu
  function extractAllData() {
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
      const gData = extractGridicsData();
      base.lot = { ...base.lot, ...gData.lot };
      base.zoning = { ...base.zoning, ...gData.zoning };
      base.setbacks = { ...base.setbacks, ...gData.setbacks };
      base.capacity = { ...base.capacity, ...gData.capacity };
    }

    const uData = extractUniversalDOMData();
    base.lot = { ...uData.lot, ...base.lot };
    base.zoning = { ...uData.zoning, ...base.zoning };
    base.setbacks = { ...uData.setbacks, ...base.setbacks };
    base.capacity = { ...uData.capacity, ...base.capacity };

    base.apn = base.lot.parcelId || base.lot.parcelNumber || base.lot.apn || null;
    base.address = base.lot.projectAddress || base.lot.address || base.lot.situsAddress || extractPageAddress() || null;
    if (base.address && !base.lot.projectAddress) {
      base.lot.projectAddress = base.address;
    }

    return base;
  }

  // Mở rộng các accordion ZONING, SETBACKS, CAPACITY nếu đang bị đóng (Idempotent Safe Click)
  function ensureGridicsAccordionsExpanded() {
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
    } catch (e) {}
  }

  // Kiểm tra nhanh thông báo không tìm thấy lô đất trên PropZone
  function checkPropZoneNotFound() {
    const text = document.body ? (document.body.innerText || '') : '';
    return /no property found|property not found|no parcel found|invalid folio|no data available/i.test(text);
  }

  // Kiểm tra xem dữ liệu PropZone đã được tải đầy đủ các khối hay chưa
  function isPropZoneDataFullyLoaded(data, elapsedSec = 0) {
    if (!data) return { ready: false, count: 0, reason: "NO_DATA" };

    const isGridics = window.location.hostname.includes('propzone') || window.location.hostname.includes('gridics');

    // BẮT BUỘC TRÊN PROPZONE: Phải xuất hiện thẻ container .tables hoặc các bảng #Zoning, #Lot, #Setbacks
    if (isGridics) {
      const hasTables = hasGridicsTablesDOM();
      if (!hasTables) {
        return { ready: false, count: 0, reason: "WAITING_FOR_TABLES_DOM" };
      }
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

    // 1. Điều kiện lý tưởng: Đã có .tables trong DOM VÀ có đầy đủ cả Lot, Zoning, Setbacks hoặc Capacity (hoặc >= 6 trường)
    const isIdealComplete = (hasLot && hasZoning && (hasSetbacks || hasCapacity)) || realFieldCount >= 6;
    if (isIdealComplete) {
      return { ready: true, count: realFieldCount, reason: "IDEAL_COMPLETE_WITH_TABLES" };
    }

    // 2. Đã có .tables trong DOM và đã có ít nhất Lot hoặc Zoning (realFieldCount >= 3) sau 3.5s
    if (elapsedSec >= 3.5 && ((hasLot && hasZoning) || realFieldCount >= 3)) {
      return { ready: true, count: realFieldCount, reason: "TABLES_READY_STABLE" };
    }

    return { ready: false, count: realFieldCount, reason: "WAITING_TABLES_CONTENT" };
  }

  // 4. QUY TRÌNH PIPELINE TRÊN PROPZONE (CHẾ ĐỘ EAGER EXTRACTION TỨC THÌ)
  async function startPropZonePipeline() {
    try {
      const isGridics = window.location.hostname.includes('propzone') || window.location.hostname.includes('gridics');
      const urlParams = new URLSearchParams(window.location.search);
      const hasTargetFolio = urlParams.has('folio') || urlParams.has('apn') || urlParams.has('parcelId') || urlParams.has('leftOverlay');

      if (!isGridics || !hasTargetFolio) return;

      chrome.runtime.sendMessage({ action: "GET_PROPZONE_PIPELINE_ROLE" }, (pzRoleRes) => {
        if (chrome.runtime.lastError || !pzRoleRes || pzRoleRes.role !== "AUTO_PIPELINE") {
          return; // Mở thủ công: tuyệt đối không can thiệp hay thay đổi bất cứ điều gì trên trang web
        }

      let isCompleted = false;
      let checkCount = 0;
      let lastFieldCount = 0;
      let stableConsecutiveCycles = 0;
      const startTime = Date.now();

      const tryExtract = () => {
        if (isCompleted) return;
        checkCount++;
        const elapsedSec = (Date.now() - startTime) / 1000;

        try {
          ensureGridicsAccordionsExpanded();

          const data = extractAllData();
          const status = isPropZoneDataFullyLoaded(data, elapsedSec);

          if (status.count > 0 && status.count === lastFieldCount) {
            stableConsecutiveCycles++;
          } else {
            stableConsecutiveCycles = 0;
            lastFieldCount = status.count;
          }

          // Kiểm tra hoàn tất:
          // (a) Đủ Lot + Zoning + Setbacks/Capacity VÀ ổn định qua ít nhất 2 chu kỳ (~800ms)
          // (b) Hoặc đã quét qua 4 giây và có ít nhất Lot + Zoning (>= 3 trường)
          const isDone = (status.ready && stableConsecutiveCycles >= 2) || (elapsedSec >= 4 && status.count >= 3);

          if (isDone) {
            isCompleted = true;
            cleanup();

            // Đợi 600ms an toàn rồi gửi lệnh lưu dữ liệu vào storage
            setTimeout(() => {
              chrome.runtime.sendMessage({
                action: "AUTO_SAVE_AND_CLOSE_TAB",
                data: data
              });
            }, 600);
            return;
          }

          // Kiểm tra nếu trang thông báo không tìm thấy lô đất
          if (elapsedSec >= 5 && checkPropZoneNotFound()) {
            isCompleted = true;
            cleanup();
            chrome.runtime.sendMessage({
              action: "AUTO_SAVE_AND_CLOSE_TAB",
              data: data
            });
            return;
          }
        } catch (e) {}
      };

      // 1. Quét ngay tức thì
      tryExtract();

      // 2. Fast Polling mỗi 400ms
      const pollTimer = setInterval(tryExtract, 400);

      // 3. MutationObserver theo dõi DOM thay đổi
      let observer = null;
      try {
        observer = new MutationObserver(() => {
          if (!isCompleted) tryExtract();
        });
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        }
      } catch (e) {}

      const cleanup = () => {
        if (pollTimer) clearInterval(pollTimer);
        if (observer) observer.disconnect();
        if (maxWaitTimer) clearTimeout(maxWaitTimer);
      };

      // 4. Timeout quét dự phòng 45s (đảm bảo trang SPA tải xong hoàn toàn dữ liệu)
      const maxWaitTimer = setTimeout(() => {
        if (isCompleted) return;
        isCompleted = true;
        cleanup();

        const currentData = extractAllData();
        chrome.runtime.sendMessage({
          action: "AUTO_SAVE_AND_CLOSE_TAB",
          data: currentData
        });
      }, 45000);
    });
    } catch (e) {}
  }

  // Khởi động bất đồng bộ
  startPropZonePipeline();

  // 5. LẮNG NGHE LỆNH TỪ POPUP (THỦ CÔNG)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_DATA' || request.action === 'FORCE_FRESH_EXTRACT') {
      try {
        const data = extractAllData();
        sendResponse({
          success: true,
          domain: window.location.hostname,
          url: window.location.href,
          data: data
        });
      } catch (err) {
        sendResponse({
          success: false,
          message: 'Error: ' + err.message
        });
      }
      return true;
    }
  });

})();

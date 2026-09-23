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

  // 1. Trích xuất Đa Năng Cho Mọi Trang GIS (OCGIS, LA Assessor, Redfin, Zillow)
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

  // 2. Tổng Hợp Dữ Liệu Universal
  function extractAllData() {
    const uData = extractUniversalDOMData();
    let base = {
      scrapedAt: new Date().toISOString(),
      domain: window.location.hostname,
      url: window.location.href,
      lot: uData.lot || {},
      zoning: uData.zoning || {},
      setbacks: uData.setbacks || {},
      capacity: uData.capacity || {}
    };

    base.apn = base.lot.parcelId || base.lot.parcelNumber || base.lot.apn || null;
    base.address = base.lot.projectAddress || base.lot.address || base.lot.situsAddress || extractPageAddress() || null;
    if (base.address && !base.lot.projectAddress) {
      base.lot.projectAddress = base.address;
    }

    return base;
  }



  // 3. QUY TRÌNH BÓC TÁCH KHI CÓ LỆNH ĐIỀU HƯỚNG TỪ EXTENSION

  // 3. NHẬN DIỆN TÊN CỔNG TRA CỨU
  function getPortalDisplayName() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('zillow')) return 'Zillow';
    if (host.includes('redfin')) return 'Redfin';
    if (host.includes('assessor.lacounty.gov')) return 'LA Assessor';
    if (host.includes('ocgis')) return 'OCGIS Map';
    if (host.includes('arcgis')) return 'FEMA / ArcGIS';
    return host;
  }

  // 4. HIỂN THỊ THÔNG BÁO NỔI (FLOATING UI) KÈM NÚT MAP KHI TRÍCH XUẤT THÀNH CÔNG
  function showExtractionSuccessNotification(data, sourceTitle) {
    if (typeof FloatingUI === 'undefined') return;

    const lot = data?.lot || {};
    const zoning = data?.zoning || {};
    const capacity = data?.capacity || {};

    const address = lot.projectAddress || data?.address || window.location.hostname;
    const apn = lot.parcelId || data?.apn || "N/A";
    const zone = zoning.zoningCode || zoning.zoningDistrict || "N/A";

    const lines = [];
    if (address && address !== window.location.hostname) {
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

    const title = `Trích xuất ${sourceTitle || 'dữ liệu'} thành công!`;
    const message = lines.join('\n');

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['ocgisMapLinks'], (res) => {
        const mapLinks = res?.ocgisMapLinks || null;
        FloatingUI.showSuccess(title, message, 8000, mapLinks);
      });
    } else {
      FloatingUI.showSuccess(title, message, 8000);
    }
  }

  // 5. BÓC TÁCH KHI CÓ LỆNH ĐIỀU HƯỚNG TỪ EXTENSION (KHÔNG CHẠY KHI F5/RELOAD THÔNG THƯỜNG)
  function initCommandedExtractor() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

    chrome.storage.local.get(['pendingExtractorCommand'], (res) => {
      const cmd = res?.pendingExtractorCommand;
      if (!cmd) return;

      const now = Date.now();
      const isFresh = cmd.timestamp && (now - cmd.timestamp < 60000);
      const isMatching = cmd.url && (
        window.location.href.includes(cmd.url) ||
        cmd.url.includes(window.location.hostname) ||
        (cmd.portalKey === 'fema' && window.location.hostname.includes('arcgis'))
      );

      if (!isFresh || !isMatching) return;

      // XÓA NGAY LẬP TỨC ĐỂ RELOAD (F5) SAU ĐÓ KHÔNG BỊ COI LÀ LỆNH
      chrome.storage.local.remove('pendingExtractorCommand');

      let isDone = false;
      let startTime = Date.now();

      const tryExtract = () => {
        if (isDone) return;
        const elapsedSec = (Date.now() - startTime) / 1000;

        const data = extractAllData();
        const lot = data.lot || {};
        const zoning = data.zoning || {};
        const hasKeyData = !!(lot.parcelId || zoning.zoningCode || zoning.zoningDistrict || lot.projectAddress || data.address);

        if (hasKeyData || elapsedSec >= 4) {
          isDone = true;
          cleanup();

          chrome.runtime.sendMessage({
            action: "AUTO_SAVE_FULL_EXTRACTED_DATA",
            data: data
          });

          showExtractionSuccessNotification(data, getPortalDisplayName());
        }
      };

      const pollTimer = setInterval(tryExtract, 500);
      let observer = null;
      try {
        observer = new MutationObserver(() => {
          if (!isDone) tryExtract();
        });
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        }
      } catch (e) {}

      const cleanup = () => {
        if (pollTimer) clearInterval(pollTimer);
        if (observer) observer.disconnect();
      };

      setTimeout(() => {
        if (!isDone) {
          isDone = true;
          cleanup();
          const data = extractAllData();
          showExtractionSuccessNotification(data, getPortalDisplayName());
        }
      }, 15000);
    });
  }

  // Khởi động các luồng có lệnh
  initCommandedExtractor();

  // 6. LẮNG NGHE LỆNH TỪ POPUP (THỦ CÔNG)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_DATA' || request.action === 'FORCE_FRESH_EXTRACT') {
      try {
        const data = extractAllData();
        showExtractionSuccessNotification(data, getPortalDisplayName());
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

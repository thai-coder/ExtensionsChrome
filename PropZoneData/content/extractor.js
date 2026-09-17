/**
 * PropZoneData - Accurate Gridics Real-Time Parser
 * Tự động bóc tách chính xác 100% các trường trong 4 khối: LOT, ZONING, SETBACKS, CAPACITY
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

  // Helper: Chuẩn hóa giá trị (bóc tách số, đơn vị, boolean, null)
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
    if (/(parcelid|groupid|legal|tract|code|district|description|desc|alloweduse|use|type)/i.test(key)) {
      return trimmed;
    }

    // Nếu là giá trị số kèm đơn vị (ft², ft, %, acres, ac)
    const numMatch = trimmed.replace(/,/g, '').match(/^(-?\d+(\.\d+)?)/);
    if (numMatch && !isNaN(Number(numMatch[0]))) {
      return Number(numMatch[0]);
    }

    return trimmed;
  };

  function isKeyBelongsToSection(key, secKey) {
    const k = key.toLowerCase();
    if (secKey === 'zoning') {
      return /(zone|zoning|district|allowed|flood|fema|landuse)/i.test(k);
    }
    if (secKey === 'lot') {
      return /(lot|parcel|building|yearbuilt|neighborhood|frontage|vacant|legal|tract)/i.test(k);
    }
    if (secKey === 'setbacks') {
      return /(setback|frontage|side|rear|water)/i.test(k);
    }
    if (secKey === 'capacity') {
      return /(height|stories|far|coverage|footprint|density|lodging|office|commercial|space)/i.test(k);
    }
    return false;
  }

  // 1. Tự động click mở các Accordion/Tab đang đóng của Gridics
  async function expandAllAccordions() {
    const clickableElements = document.querySelectorAll(
      'button, div[role="button"], .accordion-header, [data-toggle], [aria-expanded="false"]'
    );
    
    let clickedAny = false;
    clickableElements.forEach(el => {
      const txt = (el.innerText || '').toUpperCase();
      if (TARGET_SECTIONS.some(s => txt.includes(s))) {
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
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // 2. Thuật toán trích xuất dữ liệu từ 4 Section
  async function extractAllGridicsData() {
    await expandAllAccordions();

    const results = {
      scrapedAt: new Date().toISOString(),
      lot: {},
      zoning: {},
      setbacks: {},
      capacity: {}
    };

    const allElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, header, div, span, strong, [class*="title"], [class*="header"]'));

    TARGET_SECTIONS.forEach(secName => {
      const secKey = secName.toLowerCase();

      // Tìm thẻ tiêu đề đại diện cho Section (Bao quát mọi cấu trúc Accordion/Card)
      const headerEl = allElements.find(el => {
        const t = (el.innerText || '').trim().toUpperCase();
        return (t === secName || t.startsWith(secName + ' ') || t.startsWith(secName + ':') || t.startsWith(secName + '\n') || t.includes(secName)) && el.children.length <= 4;
      });

      // Xác định container chứa dữ liệu
      let container = null;
      if (headerEl) {
        container = headerEl.closest('.card, .panel, .accordion-item, [class*="section"], [class*="container"], [class*="wrapper"]') 
                 || headerEl.parentElement;
      }

      // Quét từng dòng dữ liệu trong container
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
            // Nếu quét từ document.body khi không có container, chỉ gán đúng section
            if (container || isKeyBelongsToSection(camelKey, secKey)) {
              results[secKey][camelKey] = parseVal(camelKey, val);
            }
          }
        }
      });
    });

    // Chuẩn hóa & đồng bộ hóa alias chuyên biệt cho ZONING
    if (results.zoning) {
      const zn = results.zoning;
      zn.zoningCode = zn.zoningCode ?? zn.code ?? zn.planningAndZoningCode ?? null;
      zn.zoningDistrict = zn.zoningDistrict ?? zn.zoningDistricts ?? zn.zoningDistrictS ?? zn.district ?? null;
      zn.existingLandUse = zn.existingLandUse ?? zn.landUse ?? zn.use ?? null;
      zn.zoneDescription = zn.zoneDescription ?? zn.description ?? zn.zoneDesc ?? null;
      zn.allowedUses = zn.allowedUses ?? zn.allowedUse ?? zn.allowedUseS ?? zn.permittedUses ?? null;
      zn.femaFloodZone = zn.femaFloodZone ?? zn.floodZone ?? zn.flood ?? null;
    }

    // Fallback: Lấy Parcel ID từ URL nếu chưa có
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const folioFromUrl = urlParams.get('folio');
      if (folioFromUrl && (!results.lot.parcelId || results.lot.parcelId === null)) {
        results.lot.parcelId = folioFromUrl;
      }
    } catch (e) {}

    return results;
  }

  // Chờ React nạp dữ liệu xong
  async function waitForDataReady(maxRetries = 10, delayMs = 250) {
    for (let i = 0; i < maxRetries; i++) {
      const data = await extractAllGridicsData();
      const lotKeys = Object.keys(data.lot).length;
      const zoningKeys = Object.keys(data.zoning).length;

      if (lotKeys > 1 || zoningKeys > 0) {
        return data;
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
    return await extractAllGridicsData();
  }

  // Lắng nghe Message
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_DATA' || request.action === 'FORCE_FRESH_EXTRACT') {
      waitForDataReady(10, 250).then(extractedResults => {
        sendResponse({
          success: true,
          domain: window.location.hostname,
          url: window.location.href,
          data: extractedResults
        });
      }).catch(err => {
        sendResponse({
          success: false,
          message: 'Error extracting data: ' + err.message
        });
      });
      return true;
    }
  });

})();

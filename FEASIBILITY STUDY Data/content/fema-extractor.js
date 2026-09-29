/**
 * FEASIBILITY STUDY Data - FEMA Flood Zone Map Extractor & Automator
 * Cổng: FEMA National Flood Hazard Layer (NFHL) on ArcGIS Experience Builder
 * URL: https://experience.arcgis.com/experience/9d22cdae8b7542b88e0d555a3eb92949/page/Main?org=hazards-FEMA
 */

(function () {
  'use strict';

  if (window.__FEMA_EXTRACTOR_LOADED__) return;
  window.__FEMA_EXTRACTOR_LOADED__ = true;

  console.log('[FEMA Extractor] Script initialized on FEMA ArcGIS Experience.');

  const floatingUI = typeof FloatingUI !== 'undefined' ? new FloatingUI() : null;

  let isHandlingLoginPanel = false;
  let isInitialLoginCleared = false;
  let isFlowStarted = false;

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function tryTriggerAutomation(cmd) {
    if (isFlowStarted || !cmd) return;

    const now = Date.now();
    const isFresh = cmd.timestamp ? (now - cmd.timestamp < 45000) : false;
    const isMatching = cmd.portalKey === 'fema' || (cmd.url && cmd.url.includes('experience.arcgis.com'));

    if (!isFresh || !isMatching) return;

    const targetAddress = cmd.searchQuery || '';
    if (!targetAddress) return;

    isFlowStarted = true;
    chrome.storage.local.remove('pendingExtractorCommand');

    console.log('[FEMA Extractor] Nhận lệnh tự động hoá cho địa chỉ:', targetAddress);
    initFemaAutomationFlow(targetAddress);
  }

  // 1. Chỉ kích hoạt khi có pendingExtractorCommand MỚI được phát từ Extension
  chrome.storage.local.get(['pendingExtractorCommand'], (res) => {
    if (res?.pendingExtractorCommand) {
      tryTriggerAutomation(res.pendingExtractorCommand);
    }
  });

  // 2. Lắng nghe nếu lệnh được ghi vào storage sau khi tab mở
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pendingExtractorCommand?.newValue) {
      tryTriggerAutomation(changes.pendingExtractorCommand.newValue);
    }
  });

  // ==========================================
  // BƯỚC CHẠY NGẦM: QUẢN LÝ BẢNG LOGIN
  // ==========================================
  function startLoginPanelObserver() {
    const observer = new MutationObserver(async () => {
      if (isHandlingLoginPanel) return;

      const allCalciteButtons = document.querySelectorAll('calcite-button');
      let cancelBtn = Array.from(allCalciteButtons).find(
        btn => btn.textContent && btn.textContent.trim() === 'Cancel'
      );

      if (cancelBtn) {
        isHandlingLoginPanel = true;
        console.log('⚠️ Phát hiện bảng Login. Tạm dừng để bấm Cancel...');

        await delay(300);
        cancelBtn.click();
        console.log('🖱️ Đã click nút Cancel.');

        let waitTime = 0;
        while (document.contains(cancelBtn) && waitTime < 5000) {
          await delay(300);
          waitTime += 300;
        }

        console.log('✅ Bảng Login đã tắt.');
        isHandlingLoginPanel = false;
        isInitialLoginCleared = true;
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log('🕵️ Đã bật trình theo dõi ngầm bảng Login.');
  }

  async function waitIfLocked() {
    while (isHandlingLoginPanel) {
      await delay(300);
    }
  }

  // ==========================================
  // B1: NHẬP ĐỊA CHỈ & TÌM KIẾM
  // ==========================================
  async function searchAddress(addressText) {
    await waitIfLocked();
    console.log(`📍 Nhập địa chỉ: "${addressText}"`);

    let inputEl = null;
    let waitInputTime = 0;
    while (waitInputTime < 30000) {
      inputEl = document.querySelector('input.jimu-input-base[placeholder="Find address or place"]') ||
                document.querySelector('input.jimu-input-base') ||
                document.querySelector('input.search-input');
      if (inputEl) break;
      await delay(300);
      waitInputTime += 300;
    }

    if (!inputEl) {
      console.log('❌ Không tìm thấy ô nhập địa chỉ.');
      return false;
    }

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(inputEl, addressText);
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));

    await delay(800);
    await waitIfLocked();

    const searchBtn = document.querySelector('button.search-button[aria-label="Search"], button.jimu-button-contained-primary.search-button, button.search-button');
    if (searchBtn) {
      searchBtn.click();
      console.log('🔍 Đã bấm nút Kính lúp.');
    }
    return true;
  }

  async function clickFirstSearchResult() {
    await waitIfLocked();
    console.log('⏳ Đang chờ danh sách kết quả...');

    let timeWaited = 0;
    let firstResultBtn = null;

    while (timeWaited < 10000) {
      await waitIfLocked();
      firstResultBtn = document.querySelector('div[role="listbox"] button');
      if (firstResultBtn) break;
      await delay(300);
      timeWaited += 300;
    }

    if (firstResultBtn) {
      await waitIfLocked();
      await delay(300);
      firstResultBtn.click();
      const addressText = firstResultBtn.textContent.replace(/\s+/g, ' ').trim();
      console.log(`✅ Đã chọn kết quả: "${addressText}"`);
      return true;
    } else {
      console.log('❌ Quá thời gian chờ danh sách kết quả.');
      return false;
    }
  }

  // ==========================================
  // B2: QUÉT CANVAS & CLICK TÂM BẢN ĐỒ
  // ==========================================
  async function clickMapCanvasCenter() {
    await waitIfLocked();
    console.log('🕵️ B2: Bắt đầu quét sâu toàn bộ trang web để tìm thẻ Canvas...');

    function deepFindCanvas(root) {
      if (!root) return null;
      let canvas = root.querySelector('canvas');
      if (canvas) return canvas;

      const allElements = root.querySelectorAll('*');
      for (let el of allElements) {
        if (el.shadowRoot) {
          let found = deepFindCanvas(el.shadowRoot);
          if (found) return found;
        }
      }
      return null;
    }

    let mapCanvas = null;
    let waitCanvasTime = 0;
    while (waitCanvasTime < 20000) {
      await waitIfLocked();
      mapCanvas = deepFindCanvas(document);
      if (mapCanvas) break;
      await delay(500);
      waitCanvasTime += 500;
    }

    if (!mapCanvas) {
      console.log('❌ B2: Không tìm thấy Canvas bản đồ.');
      return false;
    }

    console.log('✅ B2: ĐÃ TÌM THẤY THẺ CANVAS BỊ GIẤU!', mapCanvas);

    for (let attempt = 1; attempt <= 3; attempt++) {
      const rect = mapCanvas.getBoundingClientRect();
      const offsetX = (attempt === 2 ? 15 : (attempt === 3 ? -15 : 0));
      const offsetY = (attempt === 2 ? 15 : (attempt === 3 ? -15 : 0));
      const centerX = rect.left + (rect.width / 2) + offsetX;
      const centerY = rect.top + (rect.height / 2) + offsetY;

      console.log(`🎯 B2: Click tâm bản đồ lần ${attempt}/3 tại X=${centerX}, Y=${centerY}...`);

      const opts = { clientX: centerX, clientY: centerY, bubbles: true, cancelable: true, view: window };
      mapCanvas.dispatchEvent(new PointerEvent('pointerdown', opts));
      mapCanvas.dispatchEvent(new MouseEvent('mousedown', opts));
      mapCanvas.dispatchEvent(new PointerEvent('pointerup', opts));
      mapCanvas.dispatchEvent(new MouseEvent('mouseup', opts));
      mapCanvas.dispatchEvent(new MouseEvent('click', opts));

      await delay(2500);
      const hasPopup = deepFind(document, 'button[aria-label="Select feature"], .esri-popup, calcite-flow-item, .esri-feature');
      if (hasPopup) {
        console.log('✅ B2: Đã kích hoạt hiển thị Popup thành công!');
        return true;
      }
    }
    return true;
  }

  // ==========================================
  // B3: CÀO DỮ LIỆU TOÀN TẬP TỪ CÁC TRANG POPUP
  // ==========================================
  // Hàm quét xuyên tường Shadow DOM
  function deepFind(root, selector) {
    if (!root) return null;
    let found = root.querySelector(selector);
    if (found) return found;
    for (let el of root.querySelectorAll('*')) {
      if (el.shadowRoot) {
        found = deepFind(el.shadowRoot, selector);
        if (found) return found;
      }
    }
    return null;
  }

  // Hàm lấy danh sách thẻ xuyên tường Shadow DOM
  function deepFindAll(root, selector, results = []) {
    if (!root) return results;
    root.querySelectorAll(selector).forEach(el => results.push(el));
    root.querySelectorAll('*').forEach(el => {
      if (el.shadowRoot) deepFindAll(el.shadowRoot, selector, results);
    });
    return results;
  }

  // ==========================================
  // LỆNH CLICK NÚT NEXT (CHUYÊN TRỊ CALCITE COMPONENT)
  // ==========================================
  function fireNextClick(root) {
    let action = root.querySelector('calcite-action[title="Next"]');
    if (action) { action.click(); return true; }

    let btn = root.querySelector('button[aria-label="Next"]');
    if (btn && btn.getRootNode().host) { btn.getRootNode().host.click(); return true; }

    for (let el of root.querySelectorAll('*')) {
      if (el.shadowRoot && fireNextClick(el.shadowRoot)) return true;
    }
    return false;
  }

  async function scrapeAllPopupPages(targetAddress = '') {
    const targetFields = [
      "FIRM Panels", 
      "Map Effective Date", 
      "CID", 
      "Political Jurisdictions", 
      "FLD_ZONE", 
      "ZONE_SUBTY",
      "Flood Hazard Zones"
    ];
    console.log('🚀 B3: Bắt đầu quét cạn đáy ArcGIS...');

    let popupReady = false;
    let waitPopupTime = 0;
    while (waitPopupTime < 20000) {
      await waitIfLocked();
      const selectBtn = deepFind(document, 'button[aria-label="Select feature"]');
      if (selectBtn) {
        popupReady = true;
        break;
      }
      await delay(500);
      waitPopupTime += 500;
    }

    if (!popupReady) {
      console.log('❌ B3: Không tìm thấy bảng popup sau 20s chờ đợi.');
      return;
    }

    let collectedDataMap = {};
    targetFields.forEach(f => collectedDataMap[f] = '');
    let allExtractedData = [];

    while (true) {
      await waitIfLocked();

      // 1. TÌM CHỐT CHẶN BÁO TRANG
      const selectFeatureBtn = deepFind(document, 'button[aria-label="Select feature"]');
      if (!selectFeatureBtn) {
        console.log('❌ Không tìm thấy nút Select feature.');
        break;
      }

      const textContainer = selectFeatureBtn.querySelector('.text-container') || selectFeatureBtn;
      let currentPageText = textContainer.textContent.trim();

      const match = currentPageText.match(/(\d+)\s+of\s+(\d+)/i);
      if (!match) break;

      let currentX = parseInt(match[1]);
      let maxY = parseInt(match[2]);

      // 2. NHẶT DATA TRANG HIỆN TẠI
      let pageData = { "Trang": currentPageText };
      targetFields.forEach(field => pageData[field] = "---");

      // A. Quét trong bảng (th và td)
      const allThs = deepFindAll(document, 'th');
      allThs.forEach(th => {
        const thText = th.textContent.trim();
        targetFields.forEach(field => {
          if (thText.includes(field)) {
            const td = th.nextElementSibling;
            if (td) pageData[field] = td.textContent.trim();
          }
        });
      });

      // B. Quét ngoài bảng (Bao gồm slot="heading", thẻ p, thẻ div, thẻ span...)
      const allTextElements = deepFindAll(document, 'div[slot="heading"], .heading, p, span, strong, h2');
      allTextElements.forEach(el => {
        const text = el.textContent.trim();
        targetFields.forEach(field => {
          if (text.includes(field) && pageData[field] === "---") {
            let cleanText = text.substring(text.indexOf(field) + field.length).replace(/^[:\s]+/, '').trim();
            if (cleanText === "") {
              const nextEl = el.nextElementSibling;
              if (nextEl) cleanText = nextEl.textContent.trim();
            }
            if (cleanText !== "") {
              pageData[field] = cleanText;
            }
          }
        });
      });

      targetFields.forEach(f => {
        if (pageData[f] && pageData[f] !== '---' && !collectedDataMap[f]) {
          collectedDataMap[f] = pageData[f];
        }
      });

      allExtractedData.push(pageData);
      console.log(`✅ Đã cào xong: ${currentPageText}`, pageData);

      // 3. ĐIỀU KIỆN DỪNG (Vòng lặp 1 lần duy nhất)
      if (currentX === maxY) {
        console.log(`🏁 Đã duyệt hết tất cả các trang (${currentX}/${maxY})`);
        break;
      }

      // 4. CLICK NEXT VÀ CHỜ
      let clicked = fireNextClick(document);
      if (!clicked) {
        console.log('❌ Không tìm thấy nút Next để bấm.');
        break;
      }

      let waitTime = 0;
      let newPageText = currentPageText;

      while (newPageText === currentPageText && waitTime < 5000) {
        await delay(200);
        waitTime += 200;

        const checkBtn = deepFind(document, 'button[aria-label="Select feature"]');
        if (checkBtn) {
          const checkTextContainer = checkBtn.querySelector('.text-container') || checkBtn;
          newPageText = checkTextContainer.textContent.trim();
        }
      }

      if (newPageText === currentPageText) {
        console.log('⏳ Hết thời gian chờ chuyển trang.');
        break;
      }
    }

    console.log('\n🎉 HOÀN TẤT B3! KẾT QUẢ TỔNG HỢP:');
    console.table(allExtractedData);

    const finalFldZone = collectedDataMap['FLD_ZONE'] || '';
    const finalFloodHazardZones = collectedDataMap['Flood Hazard Zones'] || '';
    const finalZoneSubty = collectedDataMap['ZONE_SUBTY'] || '';
    const finalFirmPanel = collectedDataMap['FIRM Panels'] || '';
    const finalMapEffectiveDate = collectedDataMap['Map Effective Date'] || '';
    const finalCid = collectedDataMap['CID'] || '';
    const finalJurisdiction = collectedDataMap['Political Jurisdictions'] || '';

    let cleanFloodZone = finalFldZone;
    if (!cleanFloodZone || cleanFloodZone === '---') {
      if (finalFloodHazardZones && finalFloodHazardZones !== '---') {
        const m = finalFloodHazardZones.match(/Zone\s*([A-Z0-9]+)/i);
        cleanFloodZone = m ? m[1] : finalFloodHazardZones;
      }
    }
    if (!cleanFloodZone || cleanFloodZone === '---') {
      cleanFloodZone = (finalZoneSubty && /minimal/i.test(finalZoneSubty) ? 'X' : finalZoneSubty) || 'N/A';
    }

    console.log('[FEMA Extractor] Tổng hợp kết quả:', {
      femaFloodZone: cleanFloodZone,
      floodHazardZones: finalFloodHazardZones,
      floodSubtype: finalZoneSubty,
      firmPanel: finalFirmPanel,
      mapEffectiveDate: finalMapEffectiveDate,
      cid: finalCid,
      jurisdiction: finalJurisdiction
    });

    chrome.runtime.sendMessage({
      action: 'AUTO_SAVE_FULL_EXTRACTED_DATA',
      closeTab: true,
      data: {
        address: targetAddress,
        zoning: {
          femaFloodZone: cleanFloodZone,
          floodDescription: finalZoneSubty || finalFloodHazardZones || ''
        },
        civil: {
          femaFloodZone: cleanFloodZone,
          floodSubtype: finalZoneSubty || '',
          floodHazardZones: finalFloodHazardZones || '',
          firmPanel: finalFirmPanel || '',
          mapEffectiveDate: finalMapEffectiveDate || '',
          cid: finalCid || '',
          jurisdiction: finalJurisdiction || '',
          notes: `FIRM: ${finalFirmPanel || '-'} | Effective: ${finalMapEffectiveDate || '-'} | CID: ${finalCid || '-'} | Jurisdiction: ${finalJurisdiction || '-'}`
        }
      }
    });

    if (floatingUI && typeof floatingUI.showSuccess === 'function') {
      floatingUI.showSuccess(
        'FEMA Flood Zone Đã Được Lưu!',
        `Zone: ${cleanFloodZone}\nPanel: ${finalFirmPanel || '-'}\nJurisdiction: ${finalJurisdiction || '-'}`
      );
    }
  }

  // ==========================================
  // KHỞI CHẠY HỆ THỐNG
  // ==========================================
  async function initFemaAutomationFlow(address) {
    startLoginPanelObserver();

    console.log('⏳ Đang chờ trang khởi tạo và bảng Login xuất hiện (tối đa 30s)...');

    let initialWait = 0;
    while (!isInitialLoginCleared && initialWait < 30000) {
      await delay(500);
      initialWait += 500;
    }

    if (isInitialLoginCleared) {
      console.log('🚀 Đã tắt Login thành công. Nghỉ 1.5 giây cho trang web ổn định trước khi gõ...');
      await delay(1500);
    } else {
      console.log('⚠️ Chờ 30 giây không thấy bảng Login nào. Bắt đầu tiến hành gõ địa chỉ...');
    }

    const searched = await searchAddress(address);
    if (!searched) return;

    await clickFirstSearchResult();

    console.log('⏳ Chờ bản đồ định vị và tải layer (4.5s)...');
    await delay(4500);

    await clickMapCanvasCenter();

    console.log('⏳ Chờ Popup thông tin nạp dữ liệu (2.5s)...');
    await delay(2500);

    await scrapeAllPopupPages(address);
  }
})();

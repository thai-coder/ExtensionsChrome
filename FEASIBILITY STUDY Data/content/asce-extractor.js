/**
 * FEASIBILITY STUDY Data - ASCE 7 Hazard Tool Extractor (B1 + B2 + B3 + B4 + B5)
 * URL: https://ascehazardtool.org/
 * 
 * Luồng tự động hóa 5 bước có cơ chế đồng bộ và độ trễ an toàn:
 * - B1: Nhập địa chỉ & Tìm kiếm định vị bản đồ
 * - B2: Ánh xạ từng tiêu chí từ tab Wood (Criteria) với độ trễ đệm cho từng checkbox
 * - B3: Đợi hệ thống tính toán (3s) rồi kích hoạt nút "View Results" (khi đã enable)
 * - Đệm: Chờ nút "Details" của kết quả tải trọng xuất hiện (xác nhận dữ liệu nạp thành công)
 * - B4: Đồng bộ chờ toàn bộ dữ liệu Hazard queries xong và nút "Full Report" gỡ bỏ 'disabled'
 * - B5: Đồng bộ chờ file tải về máy hoàn tất -> Tự động đóng tab an toàn
 */

(function () {
  'use strict';

  if (window.__ASCE_EXTRACTOR_LOADED__) return;
  window.__ASCE_EXTRACTOR_LOADED__ = true;

  // ==========================================
  // 1. CẤU HÌNH MẶC ĐỊNH CRITERIA
  // ==========================================
  const defaultCriteriaConfig = {
    standard: "7-22",       // '7-10' | '7-16' | '7-22' | '41-17' | '41-23'
    riskCategory: "2",      // '1' (I) | '2' (II) | '3' (III) | '4' (IV)
    soilClass: "0",         // '0' (Default) | '1' (A) | '2' (B) | '3' (BC) | '4' (C) | '5' (CD) | '6' (D) | '7' (DE) | '8' (E)
    measurement: "imperial",// 'imperial' (Customary) | 'si' (SI)
    loadTypes: {
      Wind: true,
      Seismic: false,
      Ice: false,
      Snow: false,
      Rain: false,
      Flood: false,
      Tsunami: false,
      Tornado: false
    }
  };

  // ==========================================
  // 2. CHUYỂN ĐỔI BIẾN TỪ TAB WOOD (POPUP) SANG ASCE CRITERIA
  // ==========================================
  function convertPopupSettingsToCriteria(popupSettings) {
    if (!popupSettings) return defaultCriteriaConfig;

    // 1. Standard Version (ví dụ: "ASCE/SEI 7-22" -> "7-22")
    let standard = "7-22";
    if (popupSettings.version) {
      const v = popupSettings.version;
      if (v.includes("7-22")) standard = "7-22";
      else if (v.includes("7-16")) standard = "7-16";
      else if (v.includes("7-10")) standard = "7-10";
      else if (v.includes("41-23")) standard = "41-23";
      else if (v.includes("41-17")) standard = "41-17";
    }

    // 2. Risk Category (ví dụ: "Risk Category II" -> "2")
    let riskCategory = "2";
    if (popupSettings.risk) {
      const r = popupSettings.risk;
      if (r.includes("IV") || r === "4") riskCategory = "4";
      else if (r.includes("III") || r === "3") riskCategory = "3";
      else if (r.includes("II") || r === "2") riskCategory = "2";
      else if (r.includes("I") || r === "1") riskCategory = "1";
    }

    // 3. Site Soil Class (ví dụ: "Default" -> "0")
    let soilClass = "0";
    if (popupSettings.soil) {
      const s = popupSettings.soil.toLowerCase();
      if (s.includes("default")) soilClass = "0";
      else if (s === "site class a" || s === "a") soilClass = "1";
      else if (s === "site class b" || s === "b") soilClass = "2";
      else if (s.includes("bc") || s === "site class c" || s === "c") soilClass = "3";
      else if (s.includes("cd") || s === "site class d" || s === "d") soilClass = "4";
      else if (s === "site class e" || s === "e") soilClass = "8";
      else soilClass = popupSettings.soil;
    }

    // 4. Measurements (ví dụ: "Customary" -> "imperial", "SI" -> "si")
    let measurement = "imperial";
    if (popupSettings.measurement) {
      measurement = popupSettings.measurement.toLowerCase() === "si" ? "si" : "imperial";
    }

    // 5. Load Types (Checkboxes)
    const loadTypes = popupSettings.loadTypes || defaultCriteriaConfig.loadTypes;

    return { standard, riskCategory, soilClass, measurement, loadTypes };
  }

  // ==========================================
  // 3. HÀM THỰC THI ÁNH XẠ DỮ LIỆU VÀO GIAO DIỆN (B2)
  // ==========================================
  async function applyCriteriaSettings(config) {
    const cfg = Object.assign({}, defaultCriteriaConfig, config || {});

    // --- Hàm phụ trợ cập nhật <select> và placeholder đi kèm ---
    const updateSelect = async (selectId, value) => {
      if (value === undefined || value === null) return;
      const selectEl = document.getElementById(selectId);
      if (!selectEl) return;

      // Khớp value hoặc text option
      let matchedOpt = Array.from(selectEl.options).find(opt => opt.value === String(value));
      if (!matchedOpt && typeof value === 'string') {
        matchedOpt = Array.from(selectEl.options).find(opt =>
          opt.text.toLowerCase().includes(value.toLowerCase())
        );
      }

      if (matchedOpt) {
        selectEl.value = matchedOpt.value;
      } else {
        selectEl.value = value;
      }

      // Cập nhật text hiển thị trên giao diện (thẻ placeholder của Materialize)
      const placeholder = selectEl.parentElement?.querySelector('.risk-level-selected-placeholder');
      const selectedOption = selectEl.options[selectEl.selectedIndex];
      if (placeholder && selectedOption) {
        placeholder.textContent = selectedOption.text;
      }

      // Bắn sự kiện change để trang web nhận diện
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 500));
    };

    // 1. Thiết lập Standard Version
    if (cfg.standard) {
      console.log('[ASCE] 📝 B2: Thiết lập Standard ->', cfg.standard);
      await updateSelect('standards-selector', cfg.standard);
    }

    // 2. Thiết lập Risk Category
    if (cfg.riskCategory) {
      console.log('[ASCE] 📝 B2: Thiết lập Risk Category ->', cfg.riskCategory);
      await updateSelect('risk-level-selector', cfg.riskCategory);
    }

    // 3. Thiết lập Site Soil Class
    if (cfg.soilClass !== undefined) {
      console.log('[ASCE] 📝 B2: Thiết lập Soil Class ->', cfg.soilClass);
      await updateSelect('site-soil-class-selector', cfg.soilClass);
    }

    // 4. Thiết lập Đơn vị đo lường (Measurements: 'imperial' hoặc 'si')
    if (cfg.measurement) {
      const radioBtn = document.getElementById(cfg.measurement);
      if (radioBtn && !radioBtn.checked) {
        console.log('[ASCE] 📝 B2: Thiết lập Measurement ->', cfg.measurement);
        const label = document.querySelector(`label[for="${cfg.measurement}"]`);
        if (label) {
          label.click();
        } else {
          radioBtn.checked = true;
          radioBtn.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // 5. Thiết lập Load Types (Checkboxes) với khoảng trễ đệm cho từng checkbox
    if (cfg.loadTypes) {
      for (const [id, shouldCheck] of Object.entries(cfg.loadTypes)) {
        const checkbox = document.getElementById(id);
        if (!checkbox) continue;

        if (checkbox.checked !== !!shouldCheck) {
          console.log(`[ASCE] 📝 B2: Đổi trạng thái [${id}] -> ${shouldCheck ? 'BẬT' : 'TẮT'}`);
          const label = document.querySelector(`label[for="${id}"]`);
          if (label) {
            label.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            label.click();
          } else {
            checkbox.checked = !!shouldCheck;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          }
          await new Promise(r => setTimeout(r, 400));
        }
      }
    }

    console.log('[ASCE] ✅ Đã hoàn tất cài đặt toàn bộ thông số Criteria từ tab Wood!');
  }

  // ==========================================
  // 4. BƯỚC 3: ĐỒNG BỘ CHỜ & CLICK NÚT "VIEW RESULTS" (B3)
  // ==========================================
  async function triggerViewResults(timeoutMs = 30000) {
    console.log('[ASCE] ⏳ B3: Đang chờ nút "View Results" sẵn sàng kích hoạt...');

    const start = Date.now();
    let viewResultsBtn = null;

    while (Date.now() - start < timeoutMs) {
      // 1. Tìm nút View Results bên trong #resultsButton hoặc trên trang
      const container = document.getElementById('resultsButton');
      let btn = container ? container.querySelector('a') : null;

      if (!btn) {
        btn = Array.from(document.querySelectorAll('a.btn-large, a.waves-effect, .btn'))
          .find(el => (el.textContent || '').trim().includes('View Results'));
      }

      // 2. BẮT BUỘC: Kiểm tra nút không còn class disabled
      if (btn) {
        const isDisabled = btn.classList.contains('disabled') ||
          btn.hasAttribute('disabled') ||
          btn.getAttribute('aria-disabled') === 'true';
        if (!isDisabled) {
          viewResultsBtn = btn;
          break;
        }
      }

      await new Promise(r => setTimeout(r, 500));
    }

    if (viewResultsBtn && !viewResultsBtn.classList.contains('disabled')) {
      viewResultsBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Đợi quan sát 1.5s trước khi click giống như thao tác người dùng
      await new Promise(r => setTimeout(r, 1500));
      viewResultsBtn.click();
      console.log("[ASCE] 🎉 B3: Đã click nút 'View Results' thành công!");
      return true;
    } else {
      console.warn("[ASCE] ⚠️ B3: Không tìm thấy nút 'View Results' ở trạng thái enabled.");
      return false;
    }
  }

  // ==========================================
  // 5. BƯỚC 4: ĐỒNG BỘ CHỜ HẾT "RETRIEVING DATA..." & CLICK "FULL REPORT" (B4)
  // ==========================================
  async function waitForResultsAndTriggerFullReport(timeoutMs = 60000) {
    console.log('[ASCE] ⏳ B4: Đang chờ website tải xong dữ liệu (chờ hết "Retrieving Data..." và các nút tự mở sáng)...');

    const start = Date.now();
    let isReady = false;
    let reportBtn = null;

    while (Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 1000));

      const bodyText = document.body ? (document.body.innerText || '') : '';
      const isRetrievingData = /Retrieving\s*Data/i.test(bodyText);

      // 1. Nếu trang web vẫn còn chữ "Retrieving Data..." -> Web chưa tính xong, tiếp tục chờ
      if (isRetrievingData) {
        console.log('[ASCE] ⏳ Dữ liệu đang được tải từ máy chủ ("Retrieving Data..."), tiếp tục chờ...');
        continue;
      }

      // 2. Tìm nút Full Report
      const candidates = Array.from(document.querySelectorAll('a.report-button, .full-report-container a, a.btn-large, a.btn'));
      const btn = candidates.find(el => (el.textContent || '').trim().toUpperCase().includes('FULL REPORT'));

      if (!btn) {
        console.log('[ASCE] ⏳ Đang chờ nút Full Report xuất hiện trên giao diện...');
        continue;
      }

      // 3. Kiểm tra nút Full Report có bị disabled/mờ không
      const isReportDisabled = btn.classList.contains('disabled') ||
        btn.hasAttribute('disabled') ||
        btn.getAttribute('aria-disabled') === 'true' ||
        btn.style.pointerEvents === 'none';

      // 4. Kiểm tra có nút Details nào vẫn còn bị disabled không
      const disabledDetails = document.querySelectorAll('a.loads-details.disabled, a.details-btn.disabled');

      if (isReportDisabled || disabledDetails.length > 0) {
        console.log('[ASCE] ⏳ Các nút Details/Full Report vẫn đang mờ (disabled), tiếp tục chờ web mở...');
        continue;
      }

      // 5. Thỏa mãn: Hết Retrieving Data + Tất cả nút Details & Full Report đã tự mở sáng
      reportBtn = btn;
      isReady = true;
      break;
    }

    if (isReady && reportBtn) {
      console.log('[ASCE] 🎯 B4: Website đã tải xong 100% dữ liệu! Các nút đã sáng rõ.');
      // Đợi thêm 2.5 giây để bảng số liệu và đồ họa kết xuất hoàn thiện
      await new Promise(r => setTimeout(r, 2500));

      reportBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(r => setTimeout(r, 800));
      reportBtn.click();
      console.log("[ASCE] 🎉 B4: Đã click 'Full Report' thành công!");
      return true;
    } else {
      console.warn("[ASCE] ⚠️ B4: Quá thời gian chờ tải dữ liệu kết quả hoặc nút 'Full Report' không sẵn sàng.");
      return false;
    }
  }

  // ==========================================
  // 6. BƯỚC 5: ĐỒNG BỘ CHỜ TẢI FILE XONG & GIỮ NGUYÊN TAB (B5)
  // ==========================================
  function waitForFileDownload(timeoutMs = 90000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageListener);
        reject(new Error("Quá thời gian chờ tải file."));
      }, timeoutMs);

      const messageListener = (request, sender, sendResponse) => {
        if (request.action === "FILE_DOWNLOAD_COMPLETE") {
          clearTimeout(timer);
          chrome.runtime.onMessage.removeListener(messageListener);
          resolve(request.filename);
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);
    });
  }

  // ==========================================
  // 7. LUỒNG TỰ ĐỘNG HÓA TỔNG THỂ (B1 -> B2 -> B3 -> B4 -> B5)
  // ==========================================
  async function runAutomation(targetAddress, popupSettings) {
    if (!targetAddress) return;

    // --- BƯỚC CHUẨN BỊ: Âm thầm xóa popup (chạy 1 lần duy nhất) ---
    await new Promise((resolve) => {
      const removePopups = () => {
        const popups = document.querySelectorAll('.details-popup-wrapper');
        if (popups.length > 0) {
          popups.forEach(el => el.remove());
          document.body.style.overflow = 'auto';
          document.documentElement.style.overflow = 'auto';
          return true;
        }
        return false;
      };

      if (removePopups()) {
        resolve();
        return;
      }

      const observer = new MutationObserver(() => {
        if (removePopups()) {
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 3000);
    });

    // Chờ ô #geocoder_input xuất hiện
    let input = document.getElementById('geocoder_input');
    if (!input) {
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 200));
        input = document.getElementById('geocoder_input');
        if (input) break;
      }
    }

    // --- BƯỚC 1: Thao tác nhập địa chỉ từ tốn & bấm SEARCH ---
    if (!input) {
      console.warn('[ASCE] Không tìm thấy ô input #geocoder_input');
      return;
    }

    console.log('[ASCE] 📍 B1: Đang nhập địa chỉ vào ô tìm kiếm:', targetAddress);
    input.focus();
    await new Promise(r => setTimeout(r, 300));
    input.value = targetAddress;

    // Kích hoạt sự kiện để Dojo / ArcGIS nội bộ nhận diện giá trị
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 500));

    const searchBtn = document.getElementById('locate-address');
    if (searchBtn) {
      searchBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      await new Promise(r => setTimeout(r, 300));
      searchBtn.click();
      console.log('[ASCE] 📍 B1: Đã bấm nút SEARCH. Đang chờ bản đồ định vị vị trí (4 giây)...');
    } else {
      console.warn('[ASCE] Không tìm thấy nút #locate-address');
    }

    // BẮT BUỘC ĐỢI 4 GIÂY ĐỂ BẢN ĐỒ ESRI / ARCGIS ĐỊNH VỊ, GẮN PIN VÀ TẢI CRITERIA CHO TỌA ĐỘ NÀY
    await new Promise(r => setTimeout(r, 4000));

    // --- BƯỚC 2: Chuyển đổi và áp dụng biến từ tab Wood vào Criteria ---
    const mappedConfig = convertPopupSettingsToCriteria(popupSettings);
    console.log('[ASCE] ⚙️ B2: Bắt đầu áp dụng thông số vào Criteria:', mappedConfig);
    await applyCriteriaSettings(mappedConfig);

    // ĐỢI 3 GIÂY ĐỂ HỆ THỐNG ASCE ĐỒNG BỘ VÀ TÍNH TOÁN CÁC THÔNG SỐ VỪA CHỌN
    console.log('[ASCE] ⏳ Đang chờ hệ thống cập nhật đồng bộ các tải trọng đã chọn (3s)...');
    await new Promise(r => setTimeout(r, 3000));

    // --- BƯỚC 3: Đồng bộ chờ & click nút "View Results" ---
    const b3Success = await triggerViewResults(30000);

    if (b3Success) {
      // Đệm 2.5s để hệ thống ASCE kích hoạt các tiến trình nạp dữ liệu và mở bảng kết quả
      await new Promise(r => setTimeout(r, 2500));

      // --- BƯỚC 4: Đồng bộ chờ hết "Retrieving Data..." và nút tự mở sáng rồi click "Full Report" ---
      const b4Success = await waitForResultsAndTriggerFullReport(60000);

      // --- BƯỚC 5: Chờ tải file về máy hoàn tất -> TỰ ĐỘNG ĐÓNG TAB ---
      if (b4Success) {
        console.log('[ASCE] ⏳ B5: Đã bấm Full Report, bắt đầu chờ file tải về máy...');
        try {
          const fileName = await waitForFileDownload(90000);
          console.log('[ASCE] 🎉 B5: Xác nhận file đã tải về máy thành công ->', fileName);
          console.log('[ASCE] ✅ Hoàn tất toàn bộ quy trình bóc tách! Đang tiến hành đóng tab...');

          // Đợi 1.5 giây an toàn rồi gửi yêu cầu đóng tab
          await new Promise(r => setTimeout(r, 1500));
          chrome.runtime.sendMessage({ action: "CLOSE_CURRENT_TAB" });
        } catch (error) {
          console.error('[ASCE] ❌ B5 Lỗi:', error.message);
        }
      }
    }
  }

  // ==========================================
  // 8. LẮNG NGHE LỆNH TỪ EXTENSION POPUP
  // ==========================================
  chrome.storage.local.get(['pendingExtractorCommand'], (res) => {
    if (res?.pendingExtractorCommand?.searchQuery) {
      const cmd = res.pendingExtractorCommand;
      chrome.storage.local.remove('pendingExtractorCommand');
      runAutomation(cmd.searchQuery, cmd.asceSettings);
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pendingExtractorCommand?.newValue?.searchQuery) {
      const cmd = changes.pendingExtractorCommand.newValue;
      chrome.storage.local.remove('pendingExtractorCommand');
      runAutomation(cmd.searchQuery, cmd.asceSettings);
    }
  });

})();

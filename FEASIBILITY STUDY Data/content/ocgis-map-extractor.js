/**
 * FEASIBILITY STUDY Data - Orange County OCGIS Map Extractor (Isolated Content Script)
 * Dành riêng cho trang: webapps.ocgis.com / gis.ocgov.com
 * Quy trình bất đồng bộ:
 * - Bước 1: Truy cập link bản đồ
 * - Bước 2: Chờ web / bản đồ load hoàn tất -> Chạy Bước 4
 * - Bước 3: Theo dõi bất đồng bộ Disclaimer Modal -> Khi bấm "Agree" -> Chạy Bước 4
 * - Bước 4: Đợi Layer List render hoàn tất -> Tự động bật (tick = true) Parcels và Cities
 */

(function () {
  if (window.__OCGIS_MAP_EXTRACTOR_LOADED__) return;
  window.__OCGIS_MAP_EXTRACTOR_LOADED__ = true;

  let lastHandledTime = 0;
  const COOLDOWN_MS = 2000;
  const TARGET_LAYERS_TO_TICK = ["parcels", "cities"];
  let step4Completed = false;

  /**
   * BƯỚC 3: Kiểm tra Disclaimer modal và bấm nút "Agree" (Bất đồng bộ)
   */
  function checkAndCloseDisclaimerModal() {
    if (Date.now() - lastHandledTime < COOLDOWN_MS) return false;

    try {
      const dialogs = document.querySelectorAll('div[role="dialog"], .MuiDialog-paper, #alert-dialog-title, #alert-dialog-description');

      for (const node of dialogs) {
        const dialog = node.closest('[role="dialog"], .MuiDialog-paper, .MuiPaper-root') || node;
        const fullText = (dialog.textContent || dialog.innerText || '').toLowerCase();

        if (fullText.includes('disclaimer') || fullText.includes('oc land insights') || fullText.includes('orange county assumes no legal responsibility') || fullText.includes('informational purposes only')) {
          const buttons = Array.from(dialog.querySelectorAll('button'));
          for (const btn of buttons) {
            const btnText = (btn.textContent || btn.innerText || '').trim().toLowerCase();

            if (btnText.includes('disagree') || btn.closest('a[href]')) {
              continue;
            }

            if (btnText === 'agree' || /^agree$/i.test(btnText)) {
              lastHandledTime = Date.now();
              btn.click();
              console.log('[OCGIS Extractor] Step 3: Successfully clicked Disclaimer "Agree" button.');

              // BƯỚC 3 => BƯỚC 4: Sau khi đóng Disclaimer, đợi 1.5s để Esri render Layer List rồi chạy Bước 4
              setTimeout(() => {
                attemptStep4LayerTicking();
              }, 1500);
              return true;
            }
          }
        }
      }

      // Fallback quét nút Agree
      const actionButtons = Array.from(document.querySelectorAll('.MuiDialogActions-root button, div[role="dialog"] button, .MuiDialog-paper button'));
      for (const btn of actionButtons) {
        const btnText = (btn.textContent || btn.innerText || '').trim().toLowerCase();

        if (btnText.includes('disagree') || btn.closest('a[href]')) {
          continue;
        }

        if (btnText === 'agree' || /^agree$/i.test(btnText)) {
          lastHandledTime = Date.now();
          btn.click();
          console.log('[OCGIS Extractor] Step 3: Clicked "Agree" button (Fallback).');

          setTimeout(() => {
            attemptStep4LayerTicking();
          }, 1500);
          return true;
        }
      }
    } catch (e) {
      console.warn('[OCGIS Extractor] Step 3 error:', e);
    }

    return false;
  }

  /**
   * Kiểm tra chính xác trạng thái ĐÃ TICK (Checked) của Layer Esri theo chuẩn HTML DOM:
   * - Checked: aria-checked="true", title="Hide layer", chứa icon .esri-icon-visible
   * - Unchecked: aria-checked="false", title="Show layer", chứa icon .esri-icon-non-visible
   */
  function isEsriToggleChecked(toggleEl, itemEl) {
    if (!toggleEl) return false;
    const ariaChecked = toggleEl.getAttribute('aria-checked') === 'true';
    const titleAttr = (toggleEl.getAttribute('title') || '').toLowerCase();
    const isHideLayer = titleAttr.includes('hide layer');
    const hasVisibleIcon = Boolean(toggleEl.querySelector('.esri-icon-visible')) ||
      (itemEl && Boolean(itemEl.querySelector('.esri-icon-visible')));

    return ariaChecked || isHideLayer || hasVisibleIcon;
  }

  /**
   * Kích hoạt sự kiện Click thực tế cho công tắc Esri JS API Widget
   * Kiểm tra xác nhận lại sau 120ms; nếu chưa bật (false) sẽ chạy lại tối đa 3 lần.
   */
  function triggerEsriToggleClick(toggleEl, itemEl, retryAttempt = 0) {
    if (!toggleEl) return;

    try {
      // 1. Click trực tiếp vào icon chưa visible (.esri-icon-non-visible) nếu có
      const nonVisibleIcon = toggleEl.querySelector('.esri-icon-non-visible');
      if (nonVisibleIcon) {
        nonVisibleIcon.click();
      }

      // 2. Click công tắc toggleEl
      toggleEl.click();

      // 3. Dispatch chuỗi sự kiện chuột / pointer events tương thích với ArcGIS JS API
      ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(eventType => {
        toggleEl.dispatchEvent(new MouseEvent(eventType, {
          bubbles: true,
          cancelable: true,
          view: window
        }));
      });

      // 4. Dispatch sự kiện bàn phím Space / Enter
      toggleEl.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', keyCode: 32, code: 'Space', bubbles: true }));
      toggleEl.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', keyCode: 32, code: 'Space', bubbles: true }));

      // 5. Fallback: Nếu vẫn chưa tick, click vào label container
      const label = itemEl ? itemEl.querySelector('.esri-layer-list__item-label') : null;
      if (label && !isEsriToggleChecked(toggleEl, itemEl)) {
        label.click();
      }

      // 6. Xác nhận lại sau 120ms. Nếu chưa được (false), chạy lại tối đa 3 lần
      setTimeout(() => {
        if (!isEsriToggleChecked(toggleEl, itemEl)) {
          if (retryAttempt < 3) {
            console.log(`[OCGIS Extractor] Retry ${retryAttempt + 1}/3 clicking Esri toggle...`);
            triggerEsriToggleClick(toggleEl, itemEl, retryAttempt + 1);
          } else {
            console.warn('[OCGIS Extractor] Max 3 retries reached for Esri toggle click.');
          }
        }
      }, 120);
    } catch (e) {
      console.warn('[OCGIS Extractor] Toggle click error:', e);
    }
  }

  /**
   * BƯỚC 4: Tự động bật các layer theo đúng đoạn mã console do người dùng cung cấp
   * ĐẢM BẢO CHẠY 1 LẦN DUY NHẤT (Tránh spam / cướp sóng)
   */
  function attemptStep4LayerTicking() {
    if (step4Completed) return;

    try {
      // Khai báo một mảng chứa tên tất cả các layer bạn muốn bật
      const cacLayerCanBat = ["Parcels"];

      // Tìm tất cả các tiêu đề layer hiện có trên bản đồ
      const danhSachLayer = document.querySelectorAll('.esri-layer-list__item-title');
      if (!danhSachLayer || danhSachLayer.length === 0) return;

      // Đánh dấu ĐÃ CHẠY HOÀN TẤT -> CHỈ CHẠY 1 LẦN DUY NHẤT
      step4Completed = true;

      danhSachLayer.forEach(layer => {
        const tenLayer = layer.textContent.trim();

        // Kiểm tra xem tên layer hiện tại có nằm trong mảng cần bật hay không
        if (cacLayerCanBat.includes(tenLayer)) {
          // Tìm nút click (nằm ngay bên cạnh thẻ tên)
          const nutToggle = layer.parentElement ? layer.parentElement.querySelector('.esri-layer-list__item-toggle') : null;

          // Nếu nó đang tắt thì click để bật
          if (nutToggle && nutToggle.getAttribute('aria-checked') === 'false') {
            nutToggle.click();
            console.log('Đã click bật layer: ' + tenLayer);
          }
        }
      });

      // BƯỚC 4 XONG CHỜ 200 MS -> BƯỚC 5: Tự động nhập địa chỉ từ Popup
      setTimeout(() => {
        getPopupAddressAndExecuteStep5();
      }, 200);

    } catch (e) {
      console.warn('[OCGIS Extractor] Lỗi Bước 4:', e);
    }
  }

  /**
   * BƯỚC 5: Nhập địa chỉ/thửa đất từ Popup vào ô tìm kiếm .esri-search__input
   */
  function executeStep5SearchInput(targetAddress) {
    if (!targetAddress) {
      console.log("[OCGIS Extractor] Bước 5: Không có giá trị địa chỉ/APN từ Popup để điền.");
      return;
    }

    try {
      // 1. Tìm ô nhập liệu bằng class (không dùng ID vì nó thay đổi liên tục)
      const oTimKiem = document.querySelector('.esri-search__input');

      if (oTimKiem) {
        // 2. Điền địa chỉ lấy từ Popup vào đây
        oTimKiem.value = targetAddress;

        // 3. Giả lập sự kiện để bản đồ nhận diện có chữ vừa được gõ vào
        oTimKiem.dispatchEvent(new Event('input', { bubbles: true }));
        oTimKiem.dispatchEvent(new Event('change', { bubbles: true }));

        // Focus vào ô để bạn dễ thao tác tiếp (ví dụ: nhấn Enter)
        oTimKiem.focus();

        console.log(`Đã nhập địa chỉ thành công: "${targetAddress}"!`);

        // BƯỚC 5 => BƯỚC 6: Kích hoạt Bước 6 tự động chờ và chọn gợi ý
        thucHienBuoc6();
      } else {
        console.log("Không tìm thấy ô tìm kiếm.");
      }
    } catch (e) {
      console.warn('[OCGIS Extractor] Lỗi Bước 5:', e);
    }
  }

  /**
   * BƯỚC 6: Hàm tạo độ trễ và kiểm tra bất đồng bộ trả về một Promise
   */
  function choBangGoiYXuatHien(thoiGianToiDa = 5000) {
    return new Promise((resolve) => {
      let thoiGianDaQua = 0;
      const thoiGianKiemTra = 200; // Cứ mỗi 200ms sẽ kiểm tra 1 lần

      const kiemTra = setInterval(() => {
        thoiGianDaQua += thoiGianKiemTra;

        // Tìm menu gợi ý xuất hiện trên trang
        const menuGoiY = document.querySelector('.esri-search__suggestions-menu');

        if (menuGoiY) {
          // Tìm các tiêu đề bên trong menu
          const cacTieuDe = menuGoiY.querySelectorAll('.esri-menu__header');
          for (let tieuDe of cacTieuDe) {
            if (tieuDe.textContent.trim() === "Address ArcGIS world locator") {
              clearInterval(kiemTra); // Dừng vòng lặp kiểm tra
              resolve(tieuDe); // Trả về thẻ tiêu đề thành công
              return;
            }
          }
        }

        // Nếu hết thời gian tối đa (5 giây) mà không thấy thì dừng lại
        if (thoiGianDaQua >= thoiGianToiDa) {
          clearInterval(kiemTra);
          resolve(null); // Trả về null báo hiệu thất bại
        }
      }, thoiGianKiemTra);
    });
  }

  /**
   * BƯỚC 6: Hàm thực thi chính (sử dụng async/await) chọn kết quả gợi ý
   */
  async function thucHienBuoc6() {
    console.log("Đang chờ bảng gợi ý tải (bất đồng bộ)...");

    // Mã sẽ "tạm dừng" ở đây chờ cho đến khi tìm thấy bảng hoặc hết giờ
    const tieuDeArcGIS = await choBangGoiYXuatHien(5000); // Đợi tối đa 5 giây

    if (tieuDeArcGIS) {
      const danhSachUL = tieuDeArcGIS.nextElementSibling;

      if (danhSachUL && danhSachUL.tagName === 'UL') {
        const ketQuaDauTien = danhSachUL.querySelector('li.esri-menu__list-item');

        if (ketQuaDauTien) {
          ketQuaDauTien.click();
          console.log("Đã click chọn kết quả Address ArcGIS world locator thành công!");

          // BƯỚC 6 => BƯỚC 7 & 8: Chờ 500ms rồi kích hoạt kịch bản thử lại (Retry) click canvas & click Next feature
          setTimeout(() => {
            batDauTimKiemPopup(5);
          }, 500);
        }
      }
    } else {
      console.log("Quá thời gian! Không tìm thấy bảng gợi ý ArcGIS.");
    }
  }

  /**
   * BƯỚC 7: Đóng gói Bước 7 thành một hàm để giả lập click vào trung tâm canvas bản đồ
   */
  function clickCanvasCenter() {
    const canvas = document.querySelector('.esri-view-surface canvas');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      // Tùy chỉnh độ lệch ở đây nếu cần thiết
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const taoSuKien = (loaiSuKien) => new PointerEvent(loaiSuKien, {
        bubbles: true, cancelable: true,
        clientX: rect.left + centerX, clientY: rect.top + centerY,
        pointerId: 1, pointerType: "mouse", button: 0, buttons: 1
      });

      canvas.dispatchEvent(taoSuKien('pointerdown'));
      canvas.dispatchEvent(taoSuKien('pointerup'));
      canvas.dispatchEvent(taoSuKien('click'));
      console.log("Đã giả lập click vào tọa độ trung tâm bản đồ!");
      return true;
    } else {
      console.log("Lỗi: Không tìm thấy thẻ canvas của bản đồ.");
      return false;
    }
  }

  /**
   * BƯỚC 8: Hàm chờ nút Next xuất hiện (trả về Promise: true nếu tìm thấy, false nếu quá giờ)
   */
  function choVaClickNutNext(thoiGianChoToiDa = 3000) {
    return new Promise((resolve) => {
      let thoiGianDaQua = 0;
      const thoiGianKiemTra = 500; // Quét mỗi 500ms

      const kiemTraPopup = setInterval(() => {
        thoiGianDaQua += thoiGianKiemTra;
        const bangPopup = document.querySelector('.esri-popup__main-container');

        if (bangPopup) {
          const nutNext = bangPopup.querySelector('.esri-popup__pagination-next');
          if (nutNext) {
            clearInterval(kiemTraPopup);
            nutNext.click();
            console.log("-> Đã thấy và click nút Next feature thành công!");
            resolve(true); // Báo hiệu thành công
            return;
          }
        }

        // Hết thời gian chờ (ví dụ 3 giây) mà không thấy
        if (thoiGianDaQua >= thoiGianChoToiDa) {
          clearInterval(kiemTraPopup);
          console.log("-> Không thấy nút Next. Cần click lại bản đồ...");
          resolve(false); // Báo hiệu thất bại
        }
      }, thoiGianKiemTra);
    });
  }

  /**
   * BƯỚC 7 & 8: Hàm thực thi chính với cơ chế lặp (Retry tối đa 5 lần)
   */
  async function batDauTimKiemPopup(soLanThuToiDa = 5) {
    for (let i = 1; i <= soLanThuToiDa; i++) {
      console.log(`\n--- Đang thử lần thứ ${i} ---`);

      // Thực hiện click vào giữa bản đồ (Bước 7)
      const daClick = clickCanvasCenter();
      if (!daClick) break; // Nếu không có canvas thì dừng toàn bộ

      // Đợi 3 giây để tìm nút Next (Bước 8)
      const timThayNutNext = await choVaClickNutNext(3000);

      if (timThayNutNext) {
        console.log("🎉 Xong! Đã qua được bước click popup.");
        return; // Thoát khỏi vòng lặp
      } else {
        console.log(`Lần ${i} thất bại. Chuẩn bị click lại...`);
        // Vòng lặp sẽ tiếp tục và tự động gọi lại clickCanvasCenter()
      }
    }

    console.log(`❌ Đã thử tối đa ${soLanThuToiDa} lần nhưng vẫn không tìm thấy nút Next.`);
  }

  /**
   * Lấy địa chỉ/thửa đất từ Chrome Storage (Extension Popup) hoặc URL Parameter
   */
  function getPopupAddressAndExecuteStep5() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlVal = urlParams.get('address') || urlParams.get('q') || urlParams.get('apn');

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["lastSearchQuery", "lastApn", "lastPipelineResult"], (res) => {
          const popupVal = (res && res.lastSearchQuery) ||
            (res && res.lastApn) ||
            (res && res.lastPipelineResult && (res.lastPipelineResult.address || res.lastPipelineResult.lot?.projectAddress));

          const finalSearchVal = popupVal || urlVal || "";
          executeStep5SearchInput(finalSearchVal);
        });
      } else if (urlVal) {
        executeStep5SearchInput(urlVal);
      }
    } catch (e) {
      console.warn('[OCGIS Extractor] getPopupAddressAndExecuteStep5 error:', e);
    }
  }

  // 1. BƯỚC 3: Chạy theo dõi bất đồng bộ Disclaimer Modal ngầm liên tục
  checkAndCloseDisclaimerModal();

  // 2. BƯỚC 2 => BƯỚC 4 & BƯỚC 3 => BƯỚC 4: Polling chờ web load xong -> Chạy Bước 4 đúng 1 lần duy nhất
  const mainLoop = setInterval(() => {
    checkAndCloseDisclaimerModal();

    if (!step4Completed) {
      attemptStep4LayerTicking();
    } else {
      // Đã thực hiện xong Bước 4 -> Dừng ngay lập tức, không spam hay cướp sóng
      clearInterval(mainLoop);
    }
  }, 500);

  // 3. Persistent MutationObserver: Theo dõi toàn bộ sự thay đổi của DOM
  try {
    const observer = new MutationObserver(() => {
      checkAndCloseDisclaimerModal();
      if (!step4Completed) {
        attemptStep4LayerTicking();
      }
    });

    const initObserver = () => {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          if (document.body) observer.observe(document.body, { childList: true, subtree: true });
        });
      }
    };
    initObserver();
  } catch (e) { }

  // 4. Lắng nghe thêm sự kiện focus / visibilitychange
  window.addEventListener('focus', () => {
    checkAndCloseDisclaimerModal();
    if (!step4Completed) attemptStep4LayerTicking();
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAndCloseDisclaimerModal();
      if (!step4Completed) attemptStep4LayerTicking();
    }
  }, { passive: true });

})();

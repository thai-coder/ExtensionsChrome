/**
 * FEASIBILITY STUDY Data - Orange County OCGIS Map Extractor (Isolated Content Script)
 * Dành riêng cho trang: webapps.ocgis.com / gis.ocgov.com
 * Quy trình tự động hóa:
 * - Bước 1 & 2: Theo dõi trang tải (Observer/Interval)
 * - Bước 3: Đóng Disclaimer Modal
 * - Bước 4: Bật Layer (Parcels, Cities)
 * - Bước 5: Nhập địa chỉ / APN
 * - Bước 6: Chọn kết quả gợi ý
 * - Bước 7: Click trung tâm bản đồ
 * - Bước 8: Chờ và click nút Next popup
 * - Bước 9: Mở tài liệu iframe trong tab mới
 */

(function () {
  if (window.__OCGIS_MAP_EXTRACTOR_LOADED__) return;
  window.__OCGIS_MAP_EXTRACTOR_LOADED__ = true;

  console.log("[OCGIS Extractor] Khởi động trình trích xuất bản đồ OC Land...");

  let lastHandledTime = 0;
  const COOLDOWN_MS = 2000;
  let step4Completed = false;

  // ==========================================
  // BƯỚC 3: ĐÓNG DISCLAIMER MODAL
  // ==========================================
  function step3_checkAndCloseDisclaimerModal() {
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

            if (btnText.includes('disagree') || btn.closest('a[href]')) continue;

            if (btnText === 'agree' || /^agree$/i.test(btnText)) {
              lastHandledTime = Date.now();
              btn.click();
              console.log('[OCGIS Extractor] BƯỚC 3: Đã tự động đóng Disclaimer Modal ("Agree").');

              // Đợi 1.5s để Esri render Layer List rồi chạy Bước 4
              setTimeout(() => {
                step4_attemptLayerTicking();
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
        if (btnText.includes('disagree') || btn.closest('a[href]')) continue;

        if (btnText === 'agree' || /^agree$/i.test(btnText)) {
          lastHandledTime = Date.now();
          btn.click();
          console.log('[OCGIS Extractor] BƯỚC 3: Đã tự động đóng Disclaimer Modal (Fallback).');

          setTimeout(() => {
            step4_attemptLayerTicking();
          }, 1500);
          return true;
        }
      }
    } catch (e) {
      console.warn('[OCGIS Extractor] Lỗi Bước 3:', e);
    }
    return false;
  }

  // ==========================================
  // BƯỚC 4: BẬT LAYER BẢN ĐỒ (PARCELS, CITIES)
  // ==========================================
  function step4_attemptLayerTicking() {
    if (step4Completed) return;

    try {
      const cacLayerCanBat = ["Parcels", "Tract Map"];
      const danhSachLayer = document.querySelectorAll('.esri-layer-list__item-title');
      if (!danhSachLayer || danhSachLayer.length === 0) return;

      console.log("[OCGIS Extractor] BƯỚC 4: Đang kiểm tra và bật các Layer cần thiết...");
      step4Completed = true; // Chỉ chạy 1 lần

      danhSachLayer.forEach(layer => {
        const tenLayer = layer.textContent.trim();
        if (cacLayerCanBat.includes(tenLayer)) {
          const nutToggle = layer.parentElement ? layer.parentElement.querySelector('.esri-layer-list__item-toggle') : null;
          if (nutToggle && nutToggle.getAttribute('aria-checked') === 'false') {
            nutToggle.click();
            console.log(`[OCGIS Extractor] -> Đã tự động bật layer: ${tenLayer}`);
          }
        }
      });

      // Chuyển sang Bước 5 sau 200ms
      setTimeout(() => {
        step5_getPopupAddressAndExecute();
      }, 200);

    } catch (e) {
      console.warn('[OCGIS Extractor] Lỗi Bước 4:', e);
    }
  }

  // ==========================================
  // BƯỚC 5: LẤY ĐỊA CHỈ & NHẬP VÀO Ô TÌM KIẾM
  // ==========================================
  function step5_getPopupAddressAndExecute() {
    console.log("[OCGIS Extractor] BƯỚC 5: Bắt đầu lấy địa chỉ để tìm kiếm...");

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlVal = urlParams.get('address') || urlParams.get('q') || urlParams.get('apn');

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["lastSearchQuery", "lastApn", "lastPipelineResult"], (res) => {
          const popupVal = (res && res.lastSearchQuery) ||
            (res && res.lastApn) ||
            (res && res.lastPipelineResult && (res.lastPipelineResult.address || res.lastPipelineResult.lot?.projectAddress));

          const finalSearchVal = popupVal || urlVal || "";
          step5_executeSearchInput(finalSearchVal);
        });
      } else if (urlVal) {
        step5_executeSearchInput(urlVal);
      } else {
        console.log("[OCGIS Extractor] BƯỚC 5: Không có giá trị địa chỉ/APN để tìm kiếm.");
      }
    } catch (e) {
      console.warn('[OCGIS Extractor] Lỗi lấy địa chỉ (Bước 5):', e);
    }
  }

  function step5_executeSearchInput(targetAddress) {
    if (!targetAddress) return;

    try {
      const oTimKiem = document.querySelector('.esri-search__input');
      if (oTimKiem) {
        oTimKiem.value = targetAddress;
        oTimKiem.dispatchEvent(new Event('input', { bubbles: true }));
        oTimKiem.dispatchEvent(new Event('change', { bubbles: true }));
        oTimKiem.focus();

        console.log(`[OCGIS Extractor] -> Đã nhập địa chỉ thành công: "${targetAddress}"`);

        // Chuyển sang Bước 6
        step6_thucHien();
      } else {
        console.log("[OCGIS Extractor] BƯỚC 5: Không tìm thấy ô tìm kiếm.");
      }
    } catch (e) {
      console.warn('[OCGIS Extractor] Lỗi điền địa chỉ (Bước 5):', e);
    }
  }

  // ==========================================
  // BƯỚC 6: CHỌN GỢI Ý ArcGIS
  // ==========================================
  function choBangGoiYXuatHien(thoiGianToiDa = 5000) {
    return new Promise((resolve) => {
      let thoiGianDaQua = 0;
      const thoiGianKiemTra = 200;

      const kiemTra = setInterval(() => {
        thoiGianDaQua += thoiGianKiemTra;
        const menuGoiY = document.querySelector('.esri-search__suggestions-menu');

        if (menuGoiY) {
          const cacTieuDe = menuGoiY.querySelectorAll('.esri-menu__header');
          for (let tieuDe of cacTieuDe) {
            if (tieuDe.textContent.trim() === "Address ArcGIS world locator") {
              clearInterval(kiemTra);
              resolve(tieuDe);
              return;
            }
          }
        }

        if (thoiGianDaQua >= thoiGianToiDa) {
          clearInterval(kiemTra);
          resolve(null);
        }
      }, thoiGianKiemTra);
    });
  }

  async function step6_thucHien() {
    console.log("[OCGIS Extractor] BƯỚC 6: Đang chờ bảng gợi ý tìm kiếm...");

    const tieuDeArcGIS = await choBangGoiYXuatHien(5000);

    if (tieuDeArcGIS) {
      const danhSachUL = tieuDeArcGIS.nextElementSibling;
      if (danhSachUL && danhSachUL.tagName === 'UL') {
        const ketQuaDauTien = danhSachUL.querySelector('li.esri-menu__list-item');
        if (ketQuaDauTien) {
          ketQuaDauTien.click();
          console.log("[OCGIS Extractor] -> Đã chọn kết quả đầu tiên từ Address ArcGIS world locator.");

          // Chờ 500ms để bản đồ di chuyển rồi thực hiện Bước 7 & 8
          setTimeout(() => {
            step7_8_batDauTimKiemPopup(5);
          }, 500);
        }
      }
    } else {
      console.log("[OCGIS Extractor] BƯỚC 6: Hết giờ, không tìm thấy bảng gợi ý.");
    }
  }

  // ==========================================
  // BƯỚC 7 & BƯỚC 8: CLICK BẢN ĐỒ VÀ CHỜ NÚT NEXT
  // ==========================================
  function step7_clickCanvasCenter() {
    const canvas = document.querySelector('.esri-view-surface canvas');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
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
      console.log("[OCGIS Extractor] BƯỚC 7: Đã giả lập click vào trung tâm bản đồ.");
      return true;
    } else {
      console.log("[OCGIS Extractor] BƯỚC 7: Lỗi - Không tìm thấy thẻ canvas bản đồ.");
      return false;
    }
  }

  function step8_choVaClickNutNext(thoiGianChoToiDa = 3000) {
    return new Promise((resolve) => {
      let thoiGianDaQua = 0;
      const thoiGianKiemTra = 500;
      console.log("[OCGIS Extractor] BƯỚC 8: Đang tìm nút Next trên popup...");

      const kiemTraPopup = setInterval(() => {
        thoiGianDaQua += thoiGianKiemTra;
        const bangPopup = document.querySelector('.esri-popup__main-container');

        if (bangPopup) {
          const nutNext = bangPopup.querySelector('.esri-popup__pagination-next');
          if (nutNext) {
            clearInterval(kiemTraPopup);
            nutNext.click();
            console.log("[OCGIS Extractor] -> Đã thấy và click nút Next thành công!");
            resolve(true);
            return;
          }
        }

        if (thoiGianDaQua >= thoiGianChoToiDa) {
          clearInterval(kiemTraPopup);
          console.log("[OCGIS Extractor] -> Hết giờ chờ nút Next ở lần thử này.");
          resolve(false);
        }
      }, thoiGianKiemTra);
    });
  }

  async function step7_8_batDauTimKiemPopup(soLanThuToiDa = 5) {
    for (let i = 1; i <= soLanThuToiDa; i++) {
      console.log(`\n[OCGIS Extractor] === THỬ CLICK BẢN ĐỒ LẦN ${i} ===`);

      const daClick = step7_clickCanvasCenter();
      if (!daClick) break;

      const timThayNutNext = await step8_choVaClickNutNext(3000);

      if (timThayNutNext) {
        console.log("[OCGIS Extractor] 🎉 Đã click thành công vào thửa đất, chuyển sang Bước 9.");
        // Chờ 1 giây để bảng thông tin tải xong rồi chạy Bước 9
        setTimeout(async () => {
          await step9_timVaLayLink();
        }, 1000);
        return;
      }
    }
    console.log(`[OCGIS Extractor] ❌ BƯỚC 7 & 8: Thử ${soLanThuToiDa} lần nhưng thất bại.`);
  }

  // ==========================================
  // BƯỚC 9: TÌM VÀ LẤY LINK TÀI LIỆU (Parcels & Tract Map)
  // ==========================================
  const choDoi = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  async function timVaLayLink(tuKhoaCanTim, linkCuCuaBuocTruoc = "") {
    console.log(`\n[OCGIS Extractor] 🔍 Bắt đầu tìm: "${tuKhoaCanTim}"`);
    const soLanQuetToiDa = 10; 

    for (let i = 0; i < soLanQuetToiDa; i++) {
      const theTieuDe = document.querySelector('h2.esri-feature__title');
      const noiDungTieuDeCu = theTieuDe ? theTieuDe.textContent : "";

      if (noiDungTieuDeCu.includes(tuKhoaCanTim)) {
        console.log(`[OCGIS Extractor] ✅ Đã đúng mục "${tuKhoaCanTim}". Đang chờ render link tải mới...`);
        
        let linkMoiTaiVe = "";
        
        for(let wait = 0; wait < 30; wait++) {
          const theLinkBox = document.querySelector('.doc__navbar a[href*="box.com/s/"]');
          
          if (theLinkBox && theLinkBox.href && theLinkBox.href !== linkCuCuaBuocTruoc) {
            linkMoiTaiVe = theLinkBox.href;
            break;
          }
          await choDoi(500);
        }
        
        if (linkMoiTaiVe !== "") {
          console.log(`[OCGIS Extractor] 🎉 Thành công! Đã lấy được link: ${linkMoiTaiVe}`);
          return linkMoiTaiVe;
        } else {
          console.log(`[OCGIS Extractor] ❌ Lỗi: Link cho ${tuKhoaCanTim} không xuất hiện, hoặc bị kẹt trùng với link cũ.`);
          return null;
        }
      }

      // Nếu tiêu đề không khớp, click Next
      const nutNextFeature = document.querySelector('button[title="next identified feature"]');
      if (nutNextFeature) {
        console.log("[OCGIS Extractor] -> Chưa đúng mục. Click 'Next'...");
        nutNextFeature.click();

        let daTaiXong = false;
        for(let wait = 0; wait < 40; wait++) { 
          await choDoi(500);
          const tieuDeMoi = document.querySelector('h2.esri-feature__title');
          if (tieuDeMoi && tieuDeMoi.textContent !== noiDungTieuDeCu) {
            daTaiXong = true;
            break; 
          }
        }
        if (!daTaiXong) console.log("[OCGIS Extractor] ⚠️ Mạng quá chậm, tiêu đề không đổi sau khi click Next.");
      } else {
        console.log("[OCGIS Extractor] ⚠️ Đã hết trang. Không tìm thấy nút 'Next'.");
        break; 
      }
    }
    return null;
  }

  async function step9_timVaLayLink() {
    console.log("[OCGIS Extractor] BƯỚC 9: Đang lấy link Parcels và Tract Map...");
    
    // 1. Lấy link Parcels
    let linkParcels = await timVaLayLink("Parcels:", "");
    
    console.log("[OCGIS Extractor] ⏳ Nghỉ 1.5 giây để hệ thống ổn định trước khi tìm mục tiếp theo...");
    await choDoi(1500);
    
    // 2. Lấy link Tract Map
    let linkTractMap = await timVaLayLink("Tract Map:", linkParcels || "");
    
    console.log("\n=============================");
    console.log("📊 BÁO CÁO KẾT QUẢ TRÍCH XUẤT OCGIS MAP:");
    console.log("- Link Parcels   :", linkParcels || "Không tìm thấy");
    console.log("- Link Tract Map :", linkTractMap || "Không tìm thấy");
    
    if (linkParcels && linkTractMap && linkParcels !== linkTractMap) {
        console.log("🎯 TUYỆT VỜI! Đã lấy thành công 2 link khác nhau hoàn toàn.");
    } else if (linkParcels === linkTractMap && linkParcels !== null) {
        console.log("⚠️ CẢNH BÁO: Link bị trùng nhau. Web xử lý quá chậm!");
    }

    // Lưu vào chrome storage để popup hiển thị
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        ocgisMapLinks: {
          parcels: linkParcels,
          tractMap: linkTractMap,
          updatedAt: Date.now()
        }
      });
      console.log("[OCGIS Extractor] Đã lưu link vào storage cho Popup.");
    }
  }


  // ==========================================
  // BƯỚC 1 & BƯỚC 2: THEO DÕI SỰ KIỆN TẢI TRANG
  // ==========================================
  console.log("[OCGIS Extractor] BƯỚC 1 & 2: Theo dõi trang và Disclaimer modal...");

  step3_checkAndCloseDisclaimerModal();

  const mainLoop = setInterval(() => {
    step3_checkAndCloseDisclaimerModal();
    if (!step4Completed) {
      step4_attemptLayerTicking();
    } else {
      clearInterval(mainLoop);
    }
  }, 500);

  try {
    const observer = new MutationObserver(() => {
      step3_checkAndCloseDisclaimerModal();
      if (!step4Completed) {
        step4_attemptLayerTicking();
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

  window.addEventListener('focus', () => {
    step3_checkAndCloseDisclaimerModal();
    if (!step4Completed) step4_attemptLayerTicking();
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      step3_checkAndCloseDisclaimerModal();
      if (!step4Completed) step4_attemptLayerTicking();
    }
  }, { passive: true });

})();

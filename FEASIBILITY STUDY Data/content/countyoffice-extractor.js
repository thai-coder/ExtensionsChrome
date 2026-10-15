/**
 * FEASIBILITY STUDY Data - CountyOffice.org Content Extractor
 * Khắc phục triệt để lỗi 403 Forbidden do Rate Limiting / Double Event Trigger
 * Website: https://www.countyoffice.org/*
 */

(function () {
  if (window.self !== window.top) return; // Chặn chạy trong iframe
  if (window.__COUNTYOFFICE_EXTRACTOR_LOADED__) return;
  window.__COUNTYOFFICE_EXTRACTOR_LOADED__ = true;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Helper: Chờ phần tử xuất hiện trong DOM
  const waitForElement = (selector, timeout = 10000) => {
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

  /**
   * Bước 1: Tự động tìm kiếm an toàn (Chống WAF 403 & Chống Multi-Trigger)
   */
  async function runStep1Search() {
    // 1. KIỂM TRA PHÁT HIỆN BỊ WAF CHẶN (403 FORBIDDEN)
    const pageText = document.body ? document.body.innerText : "";
    if (pageText.includes("403 Forbidden") || pageText.includes("administrative rules") || document.title.includes("403")) {
      console.error("🛑 [CountyOffice] Yêu cầu bị chặn (403 Forbidden - Request forbidden by administrative rules).");
      console.warn("💡 Vui lòng bật VPN US hoặc chờ 5 phút để WAF giải phóng IP.");
      return;
    }

    // 2. CHỈ CHẠY TÌM KIẾM TRÊN TRANG CHỦ (Tránh vòng lặp khi chuyển sang trang kết quả)
    const currentPath = window.location.pathname;
    const isHomePage = currentPath === "/" || currentPath === "" || currentPath.endsWith("/index.html");
    if (!isHomePage) {
      console.log(`[CountyOffice] Đang ở trang con (${currentPath}), dừng Bước 1.`);
      return;
    }

    // 3. CHỐNG CHẠY LẶP (SESSION GUARD)
    if (sessionStorage.getItem("__COUNTYOFFICE_SEARCHED__")) {
      console.log("[CountyOffice] Tìm kiếm đã được thực hiện trong phiên này. Bỏ qua.");
      return;
    }

    // 4. Lấy địa chỉ cần tìm kiếm từ Storage
    let addressToSearch = "";
    try {
      const stored = await chrome.storage.local.get(["activePipelineSession", "lastSearchQuery"]);
      addressToSearch = stored.activePipelineSession?.address || stored.lastSearchQuery || "";
    } catch (e) {
      console.warn("[CountyOffice] Không đọc được địa chỉ từ Storage:", e);
    }

    if (!addressToSearch || !addressToSearch.trim()) {
      console.log("[CountyOffice] Không có địa chỉ tìm kiếm.");
      return;
    }

    console.log(`[CountyOffice] Địa chỉ mục tiêu: "${addressToSearch}"`);

    // 5. Tìm ô nhập liệu Radar Autocomplete
    const inputElement = (await waitForElement('.radar-autocomplete-input', 8000)) ||
      document.querySelector('.radar-autocomplete-input');

    if (!inputElement) {
      console.error("❌ Không tìm thấy ô nhập liệu .radar-autocomplete-input.");
      return;
    }

    // Đợi 800ms cho trang và Radar SDK nạp hoàn tất cấu hình
    await sleep(800);

    // 6. Focus và điền giá trị
    inputElement.focus();
    inputElement.value = addressToSearch;

    // 7. Kích hoạt DUY NHẤT 1 sự kiện input chuẩn (KHÔNG bắn chùm change/keyup cùng lúc để tránh rate-limit)
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));

    console.log(`⏳ Đã nhập "${addressToSearch}", đang chờ danh sách gợi ý...`);

    // 8. Polling tìm kết quả gợi ý
    let attempts = 0;
    let isSelected = false;

    const checkInterval = setInterval(() => {
      attempts++;
      if (isSelected) {
        clearInterval(checkInterval);
        return;
      }

      const listItems = document.querySelectorAll('.radar-autocomplete-results-item');

      if (listItems.length > 0) {
        isSelected = true;
        clearInterval(checkInterval);
        sessionStorage.setItem("__COUNTYOFFICE_SEARCHED__", "true");

        console.log(`🔎 Tìm thấy ${listItems.length} kết quả. Đang so khớp...`);

        const cleanString = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
        const targetClean = cleanString(addressToSearch);

        let bestMatch = listItems[0];
        for (let item of listItems) {
          const itemTextClean = cleanString(item.textContent);
          if (itemTextClean.includes(targetClean) || targetClean.includes(itemTextClean)) {
            bestMatch = item;
            break;
          }
        }

        // 9. THỰC HIỆN DUY NHẤT 1 HÀNH ĐỘNG CLICK (Tránh bắn cả mousedown + mouseup + click làm x3 request)
        setTimeout(() => {
          console.log(`✅ Tự động chọn: "${bestMatch.textContent.trim()}"`);
          // Chỉ gọi 1 click duy nhất để Radar SDK gọi onSelection 1 lần
          bestMatch.click();
        }, 350);

      } else if (attempts > 12) {
        clearInterval(checkInterval);
        console.warn("⚠️ Hết thời gian chờ danh sách gợi ý (6s).");
      }
    }, 500);
  }

  // Khởi chạy khi trang đã sẵn sàng
  if (document.readyState === "complete") {
    runStep1Search();
  } else {
    window.addEventListener("load", runStep1Search, { once: true });
  }
})();

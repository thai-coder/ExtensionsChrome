/**
 * FEASIBILITY STUDY Data - USDA Web Soil Survey Content Extractor
 * Tự động thao tác trên https://websoilsurvey.nrcs.usda.gov/ để trích xuất Hydrologic Soil Group
 */

(function () {
  if (window.__SOIL_EXTRACTOR_LOADED__) return;
  window.__SOIL_EXTRACTOR_LOADED__ = true;

  console.log("[SoilExtractor] Content script injected on USDA Web Soil Survey.");

  // 1. Kiểm tra vai trò từ Background Service Worker
  chrome.runtime.sendMessage({ action: "GET_SOIL_PIPELINE_ROLE" }, (response) => {
    if (chrome.runtime.lastError || !response || response.role !== "SOIL_EXTRACTION") {
      return; // Không can thiệp nếu người dùng duyệt bình thường
    }

    console.log("[SoilExtractor] Bắt đầu tự động hoá bóc tách Soil cho:", response.address);
    initSoilExtractionFlow(response.address);
  });

  async function initSoilExtractionFlow(targetAddress) {
    // Nếu đang ở trang bìa /app/, click nút Start WSS
    if (window.location.pathname.endsWith("/app/") || window.location.pathname.endsWith("/app")) {
      const startBtn = document.querySelector('a[href*="WebSoilSurvey.aspx"], input[value*="Start Web Soil Survey"]');
      if (startBtn) {
        startBtn.click();
        return;
      }
    }

    // Chờ giao diện WebSoilSurvey.aspx sẵn sàng
    await waitForElement('#QuickNavigation, input[id*="Address"], [id*="Navigation"]', 15000);

    // Bước 1: Mở accordion Address trong Quick Navigation
    const addressHeader = Array.from(document.querySelectorAll('a, div, span, button')).find(
      el => el.textContent && el.textContent.trim().toLowerCase() === "address" && el.closest('#QuickNavigation, [id*="Navigation"]')
    );
    if (addressHeader) {
      addressHeader.click();
      await sleep(600);
    }

    // Bước 2: Điền địa chỉ vào ô input Address
    const addressInput = document.querySelector('input[id*="txtAddress"], input[id*="Address"], textarea[id*="Address"]');
    if (addressInput && targetAddress) {
      addressInput.value = targetAddress;
      addressInput.dispatchEvent(new Event("input", { bubbles: true }));
      addressInput.dispatchEvent(new Event("change", { bubbles: true }));

      // Bước 3: Nhấn nút View
      const viewBtn = document.querySelector('input[id*="btnAddressView"], input[value="View"], button[id*="AddressView"]') ||
        Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button')).find(
          b => (b.value || b.textContent || "").trim() === "View" && b.closest('#QuickNavigation, [id*="Navigation"]')
        );

      if (viewBtn) {
        viewBtn.click();
      }
    }

    // Bước 4: Lắng nghe bảng dữ liệu Hydrologic Soil Group hoặc các phần tử chứa rating
    pollForHydrologicSoilGroup();
  }

  function pollForHydrologicSoilGroup() {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const result = scanForSoilGroupRating();

      if (result) {
        clearInterval(interval);
        console.log("[SoilExtractor] Tìm thấy Hydrologic Soil Group:", result);
        chrome.runtime.sendMessage({
          action: "SOIL_DATA_EXTRACTED",
          soilGroup: result.group,
          details: result.details || ""
        });
      } else if (attempts >= 40) {
        clearInterval(interval);
      }
    }, 500);
  }

  function scanForSoilGroupRating() {
    // 1. Quét các thẻ bảng chứa cột Rating / Hydrologic Soil Group
    const tables = document.querySelectorAll("table");
    for (const table of tables) {
      const text = table.textContent || "";
      if (text.includes("Hydrologic Soil Group") || text.includes("Rating")) {
        const rows = table.querySelectorAll("tr");
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll("td"));
          for (let i = 0; i < cells.length; i++) {
            const val = cells[i].textContent.trim();
            // Rating nhóm đất chuẩn NRCS: A, B, C, D, A/D, B/D, C/D
            if (/^[ABCD](\/[ABCD])?$/.test(val)) {
              return { group: val, details: row.textContent.replace(/\s+/g, ' ').trim() };
            }
          }
        }
      }
    }

    // 2. Quét văn bản định dạng "Hydrologic Soil Group: [A-D]"
    const bodyText = document.body.innerText || "";
    const match = bodyText.match(/Hydrologic\s+Soil\s+Group(?:\s*\(Rating\))?[:\s-]+([A-D](?:\/[A-D])?)\b/i);
    if (match) {
      return { group: match[1].toUpperCase(), details: match[0] };
    }

    return null;
  }

  function waitForElement(selector, timeoutMs = 10000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const start = Date.now();
      const timer = setInterval(() => {
        const found = document.querySelector(selector);
        if (found || Date.now() - start > timeoutMs) {
          clearInterval(timer);
          resolve(found || null);
        }
      }, 300);
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();

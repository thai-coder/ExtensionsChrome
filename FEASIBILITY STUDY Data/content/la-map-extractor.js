/**
 * FEASIBILITY STUDY Data - Los Angeles County Map Extractor (Isolated Content Script)
 * Dành riêng cho trang: portal.assessor.lacounty.gov
 * Chuyên bóc tách link Assessor Map Book (PDF) theo số APN / AIN 10 số của LA County.
 */

(function () {
  if (window.__LA_MAP_EXTRACTOR_LOADED__) return;
  window.__LA_MAP_EXTRACTOR_LOADED__ = true;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  };

  function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
    const proto = Object.getPrototypeOf(element);
    const protoSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (protoSetter && valueSetter !== protoSetter) {
      protoSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findAinInDom() {
    const urlMatch = window.location.pathname.match(/\/parceldetail\/(\d{7,10})/);
    if (urlMatch) return urlMatch[1];

    const text = document.body.innerText || "";
    const ainMatch = text.match(/(?:AIN|APN|Parcel(?:\s+Number)?)\s*[:#]?\s*(\d{4}[-\s]?\d{3}[-\s]?\d{3})/i);
    if (ainMatch) return ainMatch[1].replace(/[^0-9]/g, "");

    const genericMatch = text.match(/\b\d{4}-\d{3}-\d{3}\b/);
    if (genericMatch) return genericMatch[0].replace(/[^0-9]/g, "");

    return null;
  }

  // Khởi động
  chrome.runtime.sendMessage({ action: "GET_MAP_DOWNLOAD_TAB_ROLE" }, (response) => {
    chrome.storage.local.get(["laPortalPendingSearch"], (data) => {
      const pending = data?.laPortalPendingSearch;
      const isRecent = pending && (Date.now() - pending.timestamp < 300000);
      const isMapRole = response && response.role === "MAP_DOWNLOAD";

      if (!isMapRole && !isRecent) {
        console.log("[LA Map Extractor] Không có vai trò MAP_DOWNLOAD. Bỏ qua.");
        return;
      }

      const apn = response?.apn || "";
      const address = response?.address || (isRecent ? pending.address : "");

      if (pending) {
        chrome.storage.local.remove(["laPortalPendingSearch"]);
      }

      step1_initAssessorPortal({ apn, address });
    });
  });

  /**
   * BƯỚC 1: Chiếm quyền hoạt động khi chuyển từ ZIMAS sang LA Assessor Portal
   */
  async function step1_initAssessorPortal(sessionData) {
    const { apn, address } = sessionData;
    console.log("[LA Map Extractor] === [Bước 1] Chiếm quyền hoạt động trên portal.assessor.lacounty.gov ===");
    console.log(`[LA Map Extractor] Đã nhận thông tin: Address="${address || ''}", APN="${apn || ''}"`);

    const existingAin = findAinInDom();
    if (existingAin) {
      return finishExtraction(existingAin);
    }

    if (apn) {
      startLAExtraction(apn);
    } else if (address) {
      await step2_searchAddressOnPortal(address);
    }
  }

  async function step2_searchAddressOnPortal(address) {
    const streetAddr = (address || "").split(",")[0].trim();
    if (!streetAddr) return;

    console.log(`[LA Map Extractor] === [Bước 2] Tìm kiếm địa chỉ trên LA Assessor Portal: "${streetAddr}" ===`);

    const existingAin = findAinInDom();
    if (existingAin) {
      console.log(`[LA Map Extractor] [Bước 2] Đã tìm thấy AIN ngay trên trang: ${existingAin}`);
      return finishExtraction(existingAin);
    }

    const searchInput = await waitForElement(
      'input.MuiInputBase-input, input[placeholder*="Search" i], input[placeholder*="AIN" i], input[placeholder*="Address" i], input[type="search"], input[type="text"]',
      12000
    );

    if (!searchInput) {
      console.warn("[LA Map Extractor] [Bước 2] Không tìm thấy ô tìm kiếm trên portal.assessor.lacounty.gov.");
      return;
    }

    searchInput.focus();
    setNativeValue(searchInput, streetAddr);
    await sleep(500);

    searchInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
    searchInput.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));

    const searchBtn = document.querySelector('button[type="submit"], button[aria-label*="search" i], .search-btn, button svg[data-testid="SearchIcon"]')?.closest("button");
    if (searchBtn) searchBtn.click();

    await sleep(1500);
    const suggestion = document.querySelector('.MuiAutocomplete-popper li, [role="listbox"] [role="option"], .search-result-item, .search-result');
    if (suggestion) {
      console.log("[LA Map Extractor] [Bước 2] Click chọn gợi ý:", suggestion.textContent.trim());
      suggestion.click();
    }

    let pollCount = 0;
    const maxPoll = 15;
    const pollInterval = setInterval(() => {
      pollCount++;
      const ain = findAinInDom();
      if (ain) {
        clearInterval(pollInterval);
        console.log(`[LA Map Extractor] [Bước 2] 🎉 Đã tìm thấy AIN sau tìm kiếm: ${ain}`);
        finishExtraction(ain);
      } else if (pollCount >= maxPoll) {
        clearInterval(pollInterval);
        console.warn("[LA Map Extractor] [Bước 2] Hết thời gian chờ kết quả tìm kiếm trên LA Assessor.");
        if (typeof FloatingUI !== "undefined") {
          FloatingUI.showWarning("LA Assessor", `Không tìm thấy thông tin cho địa chỉ: ${streetAddr}`);
        }
      }
    }, 1000);
  }

  function startLAExtraction(targetApn) {
    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(() => {
      attempts++;
      const pdfUrl = scanLADomForMap(targetApn);
      if (pdfUrl) {
        clearInterval(interval);
        finishExtraction(targetApn, pdfUrl);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        finishExtraction(targetApn, null);
      }
    }, 1000);
  }

  function scanLADomForMap(targetApn) {
    const allLinks = Array.from(document.querySelectorAll("a[href], button"));
    for (const el of allLinks) {
      const href = el.getAttribute("href") || "";
      const text = (el.innerText || "").toLowerCase();
      if (
        (href.includes(".pdf") && (href.includes("assessor") || href.includes("map"))) ||
        text.includes("assessor map") ||
        text.includes("map index") ||
        text.includes("map book")
      ) {
        if (href.startsWith("http")) return href;
        if (href.startsWith("/")) return window.location.origin + href;
      }
    }
    const mapTab = document.querySelector("#map-tab, .map-container a");
    if (mapTab && mapTab.href && mapTab.href.includes(".pdf")) return mapTab.href;
    return null;
  }

  async function finishExtraction(targetApn, foundPdfUrl) {
    const cleanApn = (targetApn || "").replace(/[^0-9]/g, "");
    if (!cleanApn || cleanApn.length < 7) {
      console.warn("[LA Map Extractor] Không có APN hợp lệ:", targetApn);
      return;
    }

    const mapBook = cleanApn.substring(0, 4);
    const page = cleanApn.substring(4, 7);
    const directPdf = `https://maps.assessor.lacounty.gov/mapping/maps/${mapBook}/${mapBook}-${page}.pdf`;
    const finalPdfUrl = foundPdfUrl || directPdf;
    const parcelUrl = `https://portal.assessor.lacounty.gov/parceldetail/${cleanApn}`;

    console.log(`[LA Map Extractor] 🎉 Hoàn tất! APN=${cleanApn}, PDF=${finalPdfUrl}`);

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({
        ocgisMapLinks: {
          source: "la-assessor",
          parcels: parcelUrl,
          tractMap: finalPdfUrl,
          updatedAt: Date.now()
        }
      });
      console.log("[LA Map Extractor] Đã lưu link Parcels & Tract Map vào storage cho Popup.");
    }

    if (typeof FloatingUI !== "undefined") {
      FloatingUI.showSuccess(
        "Trích xuất LA Assessor thành công!",
        `AIN: ${cleanApn}\nMap Book: ${mapBook}-${page}`
      );
    }

    chrome.runtime.sendMessage({
      action: "MAP_PDF_FOUND_AND_DOWNLOAD",
      countyKey: "losAngeles",
      countyName: "Los Angeles County",
      apn: cleanApn,
      pdfUrl: finalPdfUrl,
      isDirectLink: Boolean(finalPdfUrl)
    });
  }
})();

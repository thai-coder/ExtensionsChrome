/**
 * FEASIBILITY STUDY Data - Zillow Parcel Number (APN) & Fact Extractor
 */

(function () {
  if (window.__ZILLOW_PARCEL_EXTRACTOR__) return;
  window.__ZILLOW_PARCEL_EXTRACTOR__ = true;

  function extractZillowData() {
    let parcelNumber = null;
    let yearBuilt = null;
    let livingArea = null;
    let lotSize = null;
    let propertyUse = null;
    let stories = null;
    let parking = null;

    // 1. Phương pháp 1: Đọc trực tiếp từ cấu trúc dữ liệu JSON của React Next.js (window.__NEXT_DATA__)
    try {
      const nextDataEl = document.getElementById("__NEXT_DATA__");
      if (nextDataEl && nextDataEl.textContent) {
        const json = JSON.parse(nextDataEl.textContent);
        const propData = json?.props?.pageProps?.componentProps?.gdpClientCache;
        if (propData) {
          const firstKey = Object.keys(propData)[0];
          const property = propData[firstKey]?.property;
          if (property) {
            parcelNumber = property.resoFacts?.parcelNumber || property.parcelId || null;
            yearBuilt = property.resoFacts?.yearBuilt || property.yearBuilt || null;
            livingArea = property.resoFacts?.livingArea || property.livingArea || null;
            lotSize = property.resoFacts?.lotSize || property.lotSize || null;
            propertyUse = property.resoFacts?.homeType || property.homeType || null;
            stories = property.resoFacts?.stories || property.resoFacts?.levels || null;
            parking = property.resoFacts?.parkingCapacity 
              ? `${property.resoFacts.parkingCapacity} spaces`
              : (property.resoFacts?.garageParkingCapacity ? `${property.resoFacts.garageParkingCapacity} Car Garage` : null);
          }
        }
      }
    } catch (e) {}

    // 2. Phương pháp 2: Quét trực tiếp trên giao diện DOM (Facts & Details)
    if (!parcelNumber) {
      const allTextNodes = Array.from(document.querySelectorAll("li, tr, div, span, p"));
      for (const el of allTextNodes) {
        if (el.children.length > 2) continue;
        const txt = (el.innerText || "").trim();
        
        // Tìm dòng "Parcel number: 20360123" hoặc "Parcel number"
        if (/parcel\s*number/i.test(txt) || /\bapn\b/i.test(txt)) {
          const colonIdx = txt.indexOf(":");
          if (colonIdx !== -1) {
            parcelNumber = txt.slice(colonIdx + 1).trim();
          } else {
            const next = el.nextElementSibling || el.parentElement?.querySelector("span:last-child");
            if (next) parcelNumber = (next.innerText || "").trim();
          }
          if (parcelNumber) break;
        }
      }
    }

    // Làm sạch số APN (ví dụ loại bỏ ký tự rác)
    if (parcelNumber) {
      parcelNumber = parcelNumber.replace(/[^0-9A-Za-z-]/g, "").trim();
    }

    return {
      success: !!parcelNumber,
      parcelNumber,
      yearBuilt,
      livingArea,
      lotSize,
      propertyUse,
      stories,
      parking,
      url: window.location.href,
      extractedAt: new Date().toISOString()
    };
  }

  // Tự động kiểm tra và phản hồi tức thì (Instant Zero-Delay)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "EXTRACT_ZILLOW_PARCEL") {
      // 1. Thử bóc tách ngay lập tức (0ms)
      const immediateRes = extractZillowData();
      if (immediateRes && immediateRes.success) {
        sendResponse(immediateRes);
        return false;
      }

      // 2. Nếu trang đang hydrate, kiểm tra nhanh tối đa 4 lần (150ms mỗi lần)
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        const res = extractZillowData();
        if (res.success || attempts >= 4) {
          clearInterval(interval);
          sendResponse(res);
        }
      }, 150);
      return true; // async
    }
  });

  // Tự động thông báo nếu mở tab chạy trong background
  const data = extractZillowData();
  if (data.success) {
    chrome.runtime.sendMessage({ action: "ZILLOW_DATA_AUTO_EXTRACTED", data });
  }
})();

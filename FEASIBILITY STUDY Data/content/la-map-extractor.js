/**
 * FEASIBILITY STUDY Data - Los Angeles County Map Extractor (Isolated Content Script)
 * Dành riêng cho trang: portal.assessor.lacounty.gov
 * Chuyên bóc tách link Assessor Map Book (PDF) theo số APN / AIN 10 số của LA County.
 */

(function () {
  if (window.__LA_MAP_EXTRACTOR_LOADED__) return;
  window.__LA_MAP_EXTRACTOR_LOADED__ = true;

  console.log("🟪 [LA-Map-Extractor] Initialized on LA County Assessor portal.");

  chrome.runtime.sendMessage({ action: "GET_MAP_DOWNLOAD_TAB_ROLE" }, (response) => {
    if (chrome.runtime.lastError || !response || response.role !== "MAP_DOWNLOAD") {
      console.log("ℹ️ [LA-Map-Extractor] Manual user browsing mode.");
      return;
    }

    console.log("🎯 [LA-Map-Extractor] Automation mode active for APN:", response.apn);
    startLAExtraction(response.apn);
  });

  function startLAExtraction(targetApn) {
    let attempts = 0;
    const maxAttempts = 15;

    const interval = setInterval(() => {
      attempts++;
      const pdfUrl = scanLADomForMap(targetApn);

      if (pdfUrl) {
        clearInterval(interval);
        console.log("✅ [LA-Map-Extractor] Found LA Map PDF URL:", pdfUrl);
        chrome.runtime.sendMessage({
          action: "MAP_PDF_FOUND_AND_DOWNLOAD",
          countyKey: "losAngeles",
          countyName: "Los Angeles County",
          apn: targetApn,
          pdfUrl: pdfUrl
        });
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.warn("⚠️ [LA-Map-Extractor] Generating direct LA County Assessor Map URL from AIN.");
        
        const cleanApn = (targetApn || "").replace(/[^0-9]/g, "");
        let directPdf = null;
        if (cleanApn.length >= 7) {
          const mapBook = cleanApn.substring(0, 4);
          const page = cleanApn.substring(4, 7);
          directPdf = `https://maps.assessor.lacounty.gov/mapping/maps/${mapBook}/${mapBook}-${page}.pdf`;
        }

        chrome.runtime.sendMessage({
          action: "MAP_PDF_FOUND_AND_DOWNLOAD",
          countyKey: "losAngeles",
          countyName: "Los Angeles County",
          apn: targetApn,
          pdfUrl: directPdf || window.location.href,
          isDirectLink: Boolean(directPdf)
        });
      }
    }, 1000);
  }

  function scanLADomForMap(targetApn) {
    // 1. Quét các thẻ nút/link "Assessor Map (PDF)"
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

    // 2. Thẻ a trong tab Maps
    const mapTab = document.querySelector("#map-tab, .map-container a");
    if (mapTab && mapTab.href && mapTab.href.includes(".pdf")) {
      return mapTab.href;
    }

    return null;
  }
})();

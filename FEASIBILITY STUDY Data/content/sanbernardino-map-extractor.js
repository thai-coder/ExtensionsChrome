/**
 * FEASIBILITY STUDY Data - San Bernardino County & City of Ontario Map Extractor (Isolated Content Script)
 * Dành riêng cho cổng: San Bernardino County GIS / City of Ontario (ci.ontario.ca.us / arcgis.com)
 * Chuyên bóc tách link Assessor Parcel Map (PDF) hoặc bản đồ thửa đất theo APN San Bernardino.
 */

(function () {
  if (window.__SB_ONTARIO_MAP_EXTRACTOR_LOADED__) return;
  window.__SB_ONTARIO_MAP_EXTRACTOR_LOADED__ = true;

  chrome.runtime.sendMessage({ action: "GET_MAP_DOWNLOAD_TAB_ROLE" }, (response) => {
    if (chrome.runtime.lastError || !response || response.role !== "MAP_DOWNLOAD") {
      return;
    }

    startSBExtraction(response.apn);
  });

  function startSBExtraction(targetApn) {
    let attempts = 0;
    const maxAttempts = 15;

    const interval = setInterval(() => {
      attempts++;
      const pdfUrl = scanSBDomForMap(targetApn);

      if (pdfUrl) {
        clearInterval(interval);
        chrome.runtime.sendMessage({
          action: "MAP_PDF_FOUND_AND_DOWNLOAD",
          countyKey: "sanBernardino",
          countyName: "San Bernardino County",
          apn: targetApn,
          pdfUrl: pdfUrl
        });
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        
        chrome.runtime.sendMessage({
          action: "MAP_PDF_FOUND_AND_DOWNLOAD",
          countyKey: "sanBernardino",
          countyName: "San Bernardino County",
          apn: targetApn,
          pdfUrl: window.location.href,
          isDirectLink: false
        });
      }
    }, 1000);
  }

  function scanSBDomForMap(targetApn) {
    const links = Array.from(document.querySelectorAll("a[href]"));
    for (const a of links) {
      const href = a.href || "";
      const text = (a.innerText || "").toLowerCase();
      if (
        (href.includes(".pdf") && (href.includes("Assessor") || href.includes("Parcel") || href.includes("Map"))) ||
        text.includes("assessor map") ||
        text.includes("parcel map") ||
        text.includes("download map")
      ) {
        return href;
      }
    }
    return null;
  }
})();

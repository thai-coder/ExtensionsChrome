/**
 * FEASIBILITY STUDY Data - Riverside County Map Extractor (Isolated Content Script)
 * Dành riêng cho trang: rivcoacr.org / ca-riverside-acr.civicplus.pro / gis.countyofriverside.us
 * Chuyên bóc tách link Assessor Plat Map (PDF) theo số APN Riverside 9 số.
 */

(function () {
  if (window.__RIVCO_MAP_EXTRACTOR_LOADED__) return;
  window.__RIVCO_MAP_EXTRACTOR_LOADED__ = true;

  // Hỏi Service Worker xem tab này có nhiệm vụ tải Map không
  chrome.runtime.sendMessage({ action: "GET_MAP_DOWNLOAD_TAB_ROLE" }, (response) => {
    if (chrome.runtime.lastError || !response || response.role !== "MAP_DOWNLOAD") {
      return;
    }

    startRiversideExtraction(response.apn);
  });

  function startRiversideExtraction(targetApn) {
    let attempts = 0;
    const maxAttempts = 12;

    const interval = setInterval(() => {
      attempts++;
      const pdfUrl = scanRiversideDomForMap(targetApn);

      if (pdfUrl) {
        clearInterval(interval);
        chrome.runtime.sendMessage({
          action: "MAP_PDF_FOUND_AND_DOWNLOAD",
          countyKey: "riverside",
          countyName: "Riverside County",
          apn: targetApn,
          pdfUrl: pdfUrl
        });
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        
        const cleanApn = (targetApn || "").replace(/[^0-9]/g, "");
        let directPdf = null;
        if (cleanApn.length >= 6) {
          const book = cleanApn.substring(0, 3);
          const page = cleanApn.substring(3, 6);
          directPdf = `https://gis.countyofriverside.us/AssessorMaps/PDFs/${book}/${book}${page}.pdf`;
        }

        chrome.runtime.sendMessage({
          action: "MAP_PDF_FOUND_AND_DOWNLOAD",
          countyKey: "riverside",
          countyName: "Riverside County",
          apn: targetApn,
          pdfUrl: directPdf || window.location.href,
          isDirectLink: Boolean(directPdf)
        });
      }
    }, 1000);
  }

  function scanRiversideDomForMap(targetApn) {
    const links = Array.from(document.querySelectorAll("a[href]"));
    for (const a of links) {
      const href = a.href || "";
      const text = (a.innerText || "").toLowerCase();
      if (
        (href.includes(".pdf") && (href.includes("Assessor") || href.includes("Map") || href.includes("Plat"))) ||
        text.includes("assessor map") ||
        text.includes("plat map") ||
        text.includes("download map")
      ) {
        return href;
      }
    }
    return null;
  }
})();

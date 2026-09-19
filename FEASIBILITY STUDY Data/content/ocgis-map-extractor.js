/**
 * FEASIBILITY STUDY Data - Orange County OCGIS Map Extractor (Isolated Content Script)
 * Dành riêng cho trang: webapps.ocgis.com / gis.ocgov.com
 * Chuyên bóc tách link Assessor Parcel Map (PDF) và gửi về Service Worker để tự động tải và đóng tab.
 */

(function () {
  if (window.__OCGIS_MAP_EXTRACTOR_LOADED__) return;
  window.__OCGIS_MAP_EXTRACTOR_LOADED__ = true;

  console.log("🟧 [OCGIS-Map-Extractor] Initialized on Orange County portal.");

  // Hỏi Background Service Worker xem tab này có phải tab tự động tải Map không
  chrome.runtime.sendMessage({ action: "GET_MAP_DOWNLOAD_TAB_ROLE" }, (response) => {
    if (chrome.runtime.lastError || !response || response.role !== "MAP_DOWNLOAD") {
      console.log("ℹ️ [OCGIS-Map-Extractor] Manual user browsing mode.");
      return;
    }

    console.log("🎯 [OCGIS-Map-Extractor] Automation mode active for APN:", response.apn);
    startExtractionPipeline(response.apn);
  });

  function startExtractionPipeline(targetApn) {
    let attempts = 0;
    const maxAttempts = 15;

    const interval = setInterval(() => {
      attempts++;
      const pdfUrl = scanForMapPdf(targetApn);

      if (pdfUrl) {
        clearInterval(interval);
        console.log("✅ [OCGIS-Map-Extractor] Found Map PDF URL:", pdfUrl);
        chrome.runtime.sendMessage({
          action: "MAP_PDF_FOUND_AND_DOWNLOAD",
          countyKey: "orange",
          countyName: "Orange County",
          apn: targetApn,
          pdfUrl: pdfUrl
        });
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.warn("⚠️ [OCGIS-Map-Extractor] Timeout finding interactive PDF link, using standard Assessor Map book fallback.");
        
        // Tạo link chuẩn theo APN nếu không tìm thấy nút trên DOM
        const cleanApn = (targetApn || "").replace(/[^0-9]/g, "");
        let fallbackPdf = null;
        if (cleanApn.length >= 5) {
          const book = cleanApn.substring(0, 3);
          const page = cleanApn.substring(3, 5);
          fallbackPdf = `https://tax.ocgov.com/reports/maps/${book}/${book}-${page}.pdf`;
        }

        chrome.runtime.sendMessage({
          action: "MAP_PDF_FOUND_AND_DOWNLOAD",
          countyKey: "orange",
          countyName: "Orange County",
          apn: targetApn,
          pdfUrl: fallbackPdf || window.location.href,
          isDirectLink: Boolean(fallbackPdf)
        });
      }
    }, 1000);
  }

  function scanForMapPdf(targetApn) {
    // 1. Quét các thẻ <a> có liên kết .pdf hoặc chữ "Assessor Map" / "Parcel Map"
    const links = Array.from(document.querySelectorAll("a[href]"));
    for (const a of links) {
      const href = a.href || "";
      const text = (a.innerText || "").toLowerCase();
      if (href.endsWith(".pdf") || text.includes("assessor map") || text.includes("parcel map") || text.includes("plat map")) {
        return href;
      }
    }

    // 2. Quét các nút button / tab chứa link map trong ArcGIS WebApp Viewer
    const mapButtons = document.querySelectorAll(".jimu-widget, .esri-popup__content a, .feature-content a");
    for (const el of mapButtons) {
      if (el.href && el.href.includes(".pdf")) {
        return el.href;
      }
    }

    // 3. Quét iframe
    const iframes = document.querySelectorAll("iframe");
    for (const f of iframes) {
      if (f.src && f.src.includes(".pdf")) {
        return f.src;
      }
    }

    return null;
  }
})();

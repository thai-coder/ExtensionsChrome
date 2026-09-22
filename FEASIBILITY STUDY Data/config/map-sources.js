/**
 * FEASIBILITY STUDY Data - Map Sources & Isolated County Download Engine
 * Định nghĩa cấu hình và cơ chế tải bản đồ độc lập cho từng Quận
 */

(function () {
  if (typeof window !== "undefined" && window.MapSources) return;

  const MAP_SOURCES = {
    orange: {
      countyKey: "orange",
      countyName: "Orange County (CA)",
      requiresVpn: true,
      pingUrl: "https://webapps.ocgis.com/oclandinsights/map-viewer?id=2",
      portalName: "OCGIS Land Insights",
      formatApn: (raw) => (raw || "").replace(/[^0-9]/g, ""),
      getUrl: (apn) => {
        const clean = (apn || "").replace(/[^0-9]/g, "");
        return `https://webapps.ocgis.com/oclandinsights/map-viewer?id=2${clean ? `&apn=${clean}` : ""}`;
      },
      getDirectPdfUrl: (apn) => {
        const clean = (apn || "").replace(/[^0-9]/g, "");
        if (!clean || clean.length < 5) return null;
        const book = clean.substring(0, 3);
        const page = clean.substring(3, 5);
        return `https://tax.ocgov.com/reports/maps/${book}/${book}-${page}.pdf`;
      },
      fallbackUrl: (address, apn) => {
        return `https://propzone.gridics.com/city/us/ca/orange-county?leftOverlay=properties${apn ? `&folio=${apn}` : ""}`;
      }
    },

    riverside: {
      countyKey: "riverside",
      countyName: "County of Riverside (CA)",
      requiresVpn: false,
      pingUrl: "https://www.rivcoacr.org/",
      portalName: "RivCo ACR / GIS Portal",
      formatApn: (raw) => (raw || "").replace(/[^0-9]/g, ""),
      getUrl: (apn) => {
        const clean = (apn || "").replace(/[^0-9]/g, "");
        return `https://ca-riverside-acr.civicplus.pro/search?query=${clean || ""}`;
      },
      getDirectPdfUrl: (apn) => {
        const clean = (apn || "").replace(/[^0-9]/g, "");
        if (!clean || clean.length < 6) return null;
        const book = clean.substring(0, 3);
        const page = clean.substring(3, 6);
        return `https://gis.countyofriverside.us/AssessorMaps/PDFs/${book}/${book}${page}.pdf`;
      },
      fallbackUrl: (address, apn) => {
        return `https://propzone.gridics.com/city/us/ca/riverside-county?leftOverlay=properties${apn ? `&folio=${apn}` : ""}`;
      }
    },

    losAngeles: {
      countyKey: "losAngeles",
      countyName: "Los Angeles County (CA)",
      requiresVpn: false,
      pingUrl: "https://zimas.lacity.org/",
      portalName: "ZIMAS / LA County Assessor Portal",
      formatApn: (raw) => (raw || "").replace(/[^0-9]/g, ""),
      getUrl: (apn) => {
        // B1: Mặc định tra cứu ở ZIMAS
        return `https://zimas.lacity.org/`;
      },
      getAssessorUrl: (apn) => {
        // C1: Fallback nếu không có ở ZIMAS
        const clean = (apn || "").replace(/[^0-9]/g, "");
        return clean ? `https://portal.assessor.lacounty.gov/parceldetail/${clean}` : `https://portal.assessor.lacounty.gov/`;
      },
      getDirectPdfUrl: (apn) => {
        const clean = (apn || "").replace(/[^0-9]/g, "");
        if (!clean || clean.length < 7) return null;
        const mapBook = clean.substring(0, 4);
        const page = clean.substring(4, 7);
        return `https://maps.assessor.lacounty.gov/mapping/maps/${mapBook}/${mapBook}-${page}.pdf`;
      },
      fallbackUrl: (address, apn) => {
        return `https://propzone.gridics.com/city/us/ca/los-angeles-county?leftOverlay=properties${apn ? `&folio=${apn}` : ""}`;
      }
    },

    sanBernardino: {
      countyKey: "sanBernardino",
      countyName: "San Bernardino County (CA)",
      requiresVpn: false,
      pingUrl: "https://www.arcgis.com/apps/webappviewer/index.html?id=e704eb0429f448c4a45a5d115e5102a2",
      portalName: "San Bernardino County GIS / City of Ontario",
      formatApn: (raw) => (raw || "").replace(/[^0-9]/g, ""),
      getUrl: (apn) => {
        const clean = (apn || "").replace(/[^0-9]/g, "");
        return `https://www.arcgis.com/apps/webappviewer/index.html?id=e704eb0429f448c4a45a5d115e5102a2${clean ? `&query=Parcels,ParcelNumber,${clean}` : ""}`;
      },
      getDirectPdfUrl: (apn) => {
        return null;
      },
      fallbackUrl: (address, apn) => {
        return `https://propzone.gridics.com/city/us/ca/san-bernardino-county/ontario?leftOverlay=properties${apn ? `&folio=${apn}` : ""}`;
      },
      cityProfiles: {
        ontario: {
          cityName: "Ontario",
          jurisdiction: "City of Ontario",
          zoning: "CITY OF ONTARIO",
          zoningDesc: "City of Ontario",
          zoningUrl: "http://www.ci.ontario.ca.us/",
          officialUrl: "http://www.ci.ontario.ca.us/"
        }
      }
    }
  };

  class MapSourcesEngine {
    static getSource(countyKey) {
      return MAP_SOURCES[countyKey] || MAP_SOURCES.orange;
    }

    static getAllSources() {
      return MAP_SOURCES;
    }

    static getParcelPlatMapUrl(address, apn) {
      if (typeof CountyDetector !== "undefined" && CountyDetector.getParcelPlatMapUrl) {
        return CountyDetector.getParcelPlatMapUrl(address, apn);
      }
      const clean = (apn || "").replace(/[^0-9]/g, "");
      return `https://webapps.ocgis.com/oclandinsights/map-viewer?id=2${clean ? `&apn=${clean}` : ""}`;
    }
  }

  if (typeof window !== "undefined") {
    window.MAP_SOURCES = MAP_SOURCES;
    window.MapSourcesEngine = MapSourcesEngine;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.MAP_SOURCES = MAP_SOURCES;
    globalThis.MapSourcesEngine = MapSourcesEngine;
  }
  if (typeof module !== "undefined") {
    module.exports = { MAP_SOURCES, MapSourcesEngine };
  }
})();

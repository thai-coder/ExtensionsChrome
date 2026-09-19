/**
 * FEASIBILITY STUDY Data - Supported Portals & Rules
 * Quản lý danh sách các website nguồn dữ liệu chính cho Feasibility Studies
 */

(function () {
  if (typeof window !== "undefined" && window.PropZoneRules) return;

  const SUPPORTED_PORTALS = [
    { id: "propzone", name: "Gridics PropZone", domain: "propzone.gridics.com" },
    { id: "ocgis", name: "Orange County GIS", domain: "webapps.ocgis.com" },
    { id: "la-assessor", name: "LA County Assessor", domain: "portal.assessor.lacounty.gov" },
    { id: "redfin", name: "Redfin Real Estate", domain: "redfin.com" },
    { id: "zillow", name: "Zillow Homes", domain: "zillow.com" },
    { id: "fema-arcgis", name: "FEMA Flood ArcGIS", domain: "experience.arcgis.com" }
  ];

  const DEFAULT_EXTRACTION_RULES = [
    {
      id: "gridics-propzone",
      name: "Gridics PropZone",
      urlPattern: "^https?:\\/\\/propzone\\.gridics\\.com\\/.*",
      enabled: true
    },
    {
      id: "ocgis-portal",
      name: "Orange County GIS",
      urlPattern: "^https?:\\/\\/webapps\\.ocgis\\.com\\/.*",
      enabled: true
    },
    {
      id: "la-assessor-portal",
      name: "LA County Assessor",
      urlPattern: "^https?:\\/\\/portal\\.assessor\\.lacounty\\.gov\\/.*",
      enabled: true
    },
    {
      id: "redfin-portal",
      name: "Redfin Real Estate",
      urlPattern: "^https?:\\/\\/.*\\.redfin\\.com\\/.*",
      enabled: true
    },
    {
      id: "zillow-portal",
      name: "Zillow Homes",
      urlPattern: "^https?:\\/\\/.*\\.zillow\\.com\\/.*",
      enabled: true
    },
    {
      id: "fema-arcgis-portal",
      name: "FEMA Flood ArcGIS Map",
      urlPattern: "^https?:\\/\\/experience\\.arcgis\\.com\\/.*",
      enabled: true
    }
  ];

  class RuleMatcher {
    /**
     * Kiểm tra URL có thuộc danh sách cổng dữ liệu nghiên cứu được hỗ trợ hay không
     * @param {string} url 
     * @returns {boolean}
     */
    static isAllowedSite(url) {
      if (!url) return false;
      try {
        const urlObj = new URL(url);
        const host = urlObj.hostname.toLowerCase();
        return SUPPORTED_PORTALS.some(portal => host === portal.domain || host.endsWith("." + portal.domain));
      } catch (e) {
        return false;
      }
    }

    static getPortalInfo(url) {
      if (!url) return null;
      try {
        const urlObj = new URL(url);
        const host = urlObj.hostname.toLowerCase();
        return SUPPORTED_PORTALS.find(portal => host === portal.domain || host.endsWith("." + portal.domain)) || null;
      } catch (e) {
        return null;
      }
    }

    static findMatchingRule(url) {
      if (!this.isAllowedSite(url)) return null;
      for (const rule of DEFAULT_EXTRACTION_RULES) {
        if (new RegExp(rule.urlPattern, "i").test(url)) return rule;
      }
      return DEFAULT_EXTRACTION_RULES[0];
    }
  }

  const exportObj = {
    SUPPORTED_PORTALS,
    DEFAULT_EXTRACTION_RULES,
    RuleMatcher
  };

  if (typeof window !== "undefined") {
    window.PropZoneRules = exportObj;
  }
  if (typeof globalThis !== "undefined") {
    globalThis.PropZoneRules = exportObj;
  }
  if (typeof module !== "undefined") {
    module.exports = exportObj;
  }
})();

/**
 * PropZoneData - Strict Domain Configuration
 * Chỉ cho phép hoạt động DUY NHẤT trên hệ thống https://propzone.gridics.com/
 */

const ALLOWED_DOMAIN = "propzone.gridics.com";

const DEFAULT_EXTRACTION_RULES = [
  {
    id: "gridics-propzone",
    name: "Gridics PropZone Property",
    urlPattern: "^https?:\\/\\/propzone\\.gridics\\.com\\/.*",
    enabled: true
  }
];

class RuleMatcher {
  /**
   * Kiểm tra URL có thuộc hệ thống https://propzone.gridics.com/ hay không
   * @param {string} url 
   * @returns {boolean}
   */
  static isAllowedSite(url) {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === ALLOWED_DOMAIN || urlObj.hostname.endsWith("." + ALLOWED_DOMAIN);
    } catch (e) {
      return false;
    }
  }

  static findMatchingRule(url) {
    if (!this.isAllowedSite(url)) return null;
    return DEFAULT_EXTRACTION_RULES[0];
  }
}

if (typeof window !== "undefined") {
  window.PropZoneRules = {
    ALLOWED_DOMAIN,
    DEFAULT_EXTRACTION_RULES,
    RuleMatcher
  };
}

/**
 * FEASIBILITY STUDY Data - Map Download Background Handler (Modular Engine)
 * Quản lý định tuyến tải bản đồ đa quận và xử lý VPN / Chặn IP độc lập.
 */

const MapDownloadHandler = {
  session: {
    tabId: null,
    countyKey: null,
    apn: null,
    address: null
  },

  /**
   * Kiểm tra khả năng kết nối tới máy chủ Orange County OCGIS (Kiểm tra VPN US)
   */
  async checkOcgisConnectivity() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch("https://webapps.ocgis.com/oclandinsights/map-viewer?id=2", {
        method: "HEAD",
        mode: "no-cors",
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      // Nếu không ném lỗi -> Kết nối tới OCGIS thành công (đã bật VPN US)
      return { reachable: true, isVpnActive: true };
    } catch (err) {
      return { reachable: false, isVpnActive: false, error: err.message };
    }
  },

  /**
   * Khởi chạy quy trình tải bản đồ tương ứng theo Quận
   */
  async startDownload(params) {
    const { address, apn, countyKey } = params;
    const cleanApn = (apn || "").replace(/[^0-9A-Za-z]/g, "");

    // 1. Xác định Quận
    const detected = CountyDetector.detect(address);
    const targetCountyKey = countyKey || detected.countyKey || "orange";
    const sourceConfig = MapSourcesEngine.getSource(targetCountyKey);

    // 2. Xử lý riêng biệt cho Orange County khi yêu cầu VPN
    if (sourceConfig.requiresVpn) {
      const connectivity = await this.checkOcgisConnectivity();
      if (!connectivity.reachable) {
        return {
          success: false,
          vpnRequired: true,
          countyKey: "orange",
          countyName: sourceConfig.countyName,
          apn: cleanApn,
          portalUrl: sourceConfig.getUrl(cleanApn),
          fallbackUrl: sourceConfig.fallbackUrl(address, cleanApn),
          message: "Orange County (OCGIS) chặn IP ngoài Hoa Kỳ. Vui lòng bật VPN kết nối máy chủ US."
        };
      }
    }

    // 3. Mở trang đích chuyên biệt cho từng Quận
    const targetUrl = sourceConfig.getUrl(cleanApn);

    const tab = await chrome.tabs.create({ url: targetUrl, active: true });
    this.session = {
      tabId: tab.id,
      countyKey: targetCountyKey,
      apn: cleanApn,
      address: address
    };

    return {
      success: true,
      tabId: tab.id,
      countyKey: targetCountyKey,
      portalUrl: targetUrl
    };
  },

  /**
   * Kiểm tra vai trò của tab khi Content Script hỏi
   */
  getTabRole(tabId) {
    if (tabId && tabId === this.session.tabId) {
      return {
        role: "MAP_DOWNLOAD",
        countyKey: this.session.countyKey,
        apn: this.session.apn,
        address: this.session.address
      };
    }
    return { role: "NONE" };
  },

  /**
   * Mở xem bản đồ trực tiếp trên browser (không ép tải hay tự đóng tab)
   */
  async handlePdfFoundAndDownload(data, tabId) {
    this.session = { tabId: null, countyKey: null, apn: null, address: null };
  }
};

if (typeof globalThis !== "undefined") {
  globalThis.MapDownloadHandler = MapDownloadHandler;
}

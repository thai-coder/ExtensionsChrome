/**
 * FEASIBILITY STUDY Data - Soil Survey Handler
 * Module độc lập quản lý quy trình tra cứu Hydrologic Soil Group từ USDA Web Soil Survey
 */

(function () {
  if (typeof self !== "undefined" && self.SoilHandler) return;

  const SoilHandler = {
    session: null,

    /**
     * Bắt đầu pipeline bóc tách Soil Group
     * @param {Object} params - { address, coords }
     */
    async startExtraction(params = {}) {
      const address = (params.address || "").trim();
      const coords = params.coords || null;

      if (!address && !coords) {
        return { success: false, error: "Missing address or coordinates" };
      }

      const wssUrl = "https://websoilsurvey.nrcs.usda.gov/app/WebSoilSurvey.aspx";

      try {
        // Mở tab WSS điều hướng
        const tab = await chrome.tabs.create({ url: wssUrl, active: true });

        this.session = {
          tabId: tab.id,
          address: address,
          coords: coords,
          startedAt: Date.now()
        };

        // Kích hoạt song song SDA REST API USDA nếu có tọa độ hoặc geocode được
        this.querySdaApiFallback(address, coords, tab.id);

        return { success: true, tabId: tab.id };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    /**
     * Cung cấp vai trò cho Content Script khi tab WSS tải xong
     */
    getTabRole(tabId) {
      if (this.session && this.session.tabId === tabId) {
        return {
          role: "SOIL_EXTRACTION",
          address: this.session.address,
          coords: this.session.coords
        };
      }
      return { role: "NONE" };
    },

    /**
     * Nhận kết quả bóc tách từ content script hoặc SDA API
     */
    async handleSoilExtracted(payload = {}, tabId = null) {
      const soilGroup = payload.soilGroup || payload.hydrologicSoilGroup || "";
      if (!soilGroup) return { success: false, error: "Empty soil group" };

      // 1. Lưu kết quả vào storage lastPipelineResult
      const stored = await chrome.storage.local.get(["lastPipelineResult"]);
      const prev = stored.lastPipelineResult || {};
      const updated = {
        ...prev,
        civil: {
          ...(prev.civil || {}),
          hydrologicSoilGroup: soilGroup,
          soilDetails: payload.details || ""
        }
      };

      await chrome.storage.local.set({ lastPipelineResult: updated });

      // 2. Tự động đóng tab điều hướng WSS nếu tabId khớp
      const targetTabId = tabId || (this.session ? this.session.tabId : null);
      if (targetTabId) {
        try {
          await chrome.tabs.remove(targetTabId);
        } catch (e) {
          // Tab có thể đã được người dùng đóng trước
        }
      }

      this.session = null;
      return { success: true, soilGroup: soilGroup };
    },

    /**
     * Hỗ trợ dự phòng SDA REST API trực tiếp từ USDA NRCS
     */
    async querySdaApiFallback(address, coords, tabId) {
      try {
        let lat = coords?.lat;
        let lng = coords?.lng;

        if (!lat || !lng) {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`, {
            headers: { "User-Agent": "ChromeExtension-SoilLookup/1.0" }
          });
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData && geoData[0]) {
              lat = parseFloat(geoData[0].lat);
              lng = parseFloat(geoData[0].lon);
            }
          }
        }

        if (lat && lng) {
          const sql = `SELECT TOP 1 c.hydgrp, c.compname, mu.muname FROM sacatalog sac INNER JOIN legend l ON l.areasymbol = sac.areasymbol INNER JOIN mapunit mu ON mu.lkey = l.lkey INNER JOIN component c ON c.mukey = mu.mukey AND c.majcompflag = 'Yes' WHERE mu.mukey IN (SELECT * from SDA_Get_Mukey_from_intersection_with_WktWgs84('POINT(${lng} ${lat})')) ORDER BY c.comppct_r DESC`;

          const sdaRes = await fetch("https://sdmdataaccess.nrcs.usda.gov/Tabular/post.rest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: sql, format: "JSON" })
          });

          if (sdaRes.ok) {
            const data = await sdaRes.json();
            if (data && data.Table && data.Table.length > 0 && data.Table[0][0]) {
              const hydgrp = data.Table[0][0];
              const compname = data.Table[0][1] || "";
              const muname = data.Table[0][2] || "";

              // Để tab mở trong chốc lát để người dùng thấy tương tác trước khi tự đóng
              setTimeout(() => {
                if (this.session && this.session.tabId === tabId) {
                  this.handleSoilExtracted({
                    soilGroup: hydgrp,
                    details: `${compname} (${muname})`
                  }, tabId);
                }
              }, 1800);
            }
          }
        }
      } catch (e) {
        // Im lặng nếu lỗi mạng, Content script trên tab WSS tiếp tục quét
      }
    }
  };

  if (typeof self !== "undefined") {
    self.SoilHandler = SoilHandler;
  }
})();

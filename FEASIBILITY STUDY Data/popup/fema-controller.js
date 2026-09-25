/**
 * FEASIBILITY STUDY Data - FEMA Flood Zone Controller (Tab Civil)
 * Quản lý độc lập tác vụ kích hoạt và lấy dữ liệu FEMA Flood Zone
 */

(function () {
  if (window.FemaController) return;

  const FemaController = {
    init() {
      const btnGetFema = document.getElementById("btn-get-fema");
      if (btnGetFema) {
        btnGetFema.addEventListener("click", () => this.handleGetFemaClick());
      }

      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes.lastPipelineResult?.newValue) {
          const res = changes.lastPipelineResult.newValue;
          const floodVal = res?.civil?.femaFloodZone ?? res?.zoning?.femaFloodZone ?? res?.zoning?.floodZone;
          if (floodVal) {
            this.populateFemaData(floodVal);
          }
        }
      });
    },

    handleGetFemaClick() {
      const inputAddress = document.getElementById("input-address");
      const query = inputAddress ? inputAddress.value.trim() : "";

      if (!query) {
        this.showToast("⚠️ Vui lòng nhập địa chỉ trước khi lấy FEMA Flood Zone.");
        return;
      }

      const femaUrl = "https://experience.arcgis.com/experience/9d22cdae8b7542b88e0d555a3eb92949/page/Main?org=hazards-FEMA";
      chrome.storage.local.set({
        pendingExtractorCommand: {
          url: femaUrl,
          portalKey: "fema",
          searchQuery: query
        }
      });

      chrome.tabs.create({ url: femaUrl });
      this.showToast("🌊 Đang điều hướng FEMA Flood Map...");
    },

    populateFemaData(floodZone) {
      const valEl = document.getElementById("v-cv-flood");
      if (valEl) {
        valEl.textContent = floodZone || "-";
        valEl.classList.remove("text-dim");
        valEl.classList.add("text-cyan");
      }
      this.showToast(`✅ FEMA Flood Zone: ${floodZone}`);
    },

    showToast(message) {
      const toast = document.getElementById("toast");
      if (!toast) return;
      toast.textContent = message;
      toast.classList.remove("hidden");
      setTimeout(() => {
        toast.classList.add("hidden");
      }, 3500);
    }
  };

  window.FemaController = FemaController;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => FemaController.init());
  } else {
    FemaController.init();
  }
})();

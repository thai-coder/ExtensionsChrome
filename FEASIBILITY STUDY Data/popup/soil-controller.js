/**
 * FEASIBILITY STUDY Data - Soil Controller (Tab Civil)
 * Quản lý độc lập giao diện và kích hoạt tự động bóc tách Hydrologic Soil Group
 */

(function () {
  if (window.SoilController) return;

  const SoilController = {
    init() {
      const btnGetSoil = document.getElementById("btn-get-soil");
      if (btnGetSoil) {
        btnGetSoil.addEventListener("click", () => this.handleGetSoilClick());
      }

      // Lắng nghe thay đổi storage từ Background khi bóc tách xong
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local" && changes.lastPipelineResult?.newValue) {
          const res = changes.lastPipelineResult.newValue;
          if (res?.civil?.hydrologicSoilGroup) {
            this.populateSoilData(res.civil.hydrologicSoilGroup);
          }
        }
      });
    },

    /**
     * Bóc tách tự động: Mở tab WSS, trích xuất và điền ngược lại
     */
    async handleGetSoilClick() {
      const inputAddress = document.getElementById("input-address");
      const query = inputAddress ? inputAddress.value.trim() : "";

      if (!query) {
        this.showToast("⚠️ Vui lòng nhập địa chỉ trước khi lấy Hydrologic Soil Group.");
        return;
      }

      const btnGetSoil = document.getElementById("btn-get-soil");
      if (btnGetSoil) {
        btnGetSoil.classList.add("loading");
        btnGetSoil.disabled = true;
        btnGetSoil.textContent = "⏳...";
      }

      this.showToast("🌱 Đang mở Web Soil Survey và bóc tách dữ liệu...");

      chrome.runtime.sendMessage({
        action: "START_SOIL_EXTRACTION_PIPELINE",
        address: query
      }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          this.showToast("⚠️ Không thể khởi chạy Web Soil Survey.");
          if (btnGetSoil) {
            btnGetSoil.classList.remove("loading");
            btnGetSoil.disabled = false;
            btnGetSoil.textContent = "⚡ Get";
          }
          return;
        }

        this.showToast("⏳ Đang tra cứu Hydrologic Soil Group...");
      });
    },

    /**
     * Hàm riêng biệt tự động điền giá trị Soil Group vào Popup
     * @param {string} soilGroup - Giá trị nhóm đất (A, B, C, D, A/D, ...)
     */
    populateSoilData(soilGroup) {
      const valEl = document.getElementById("v-cv-soil-group");
      if (valEl) {
        valEl.textContent = soilGroup || "-";
        valEl.classList.remove("text-dim");
        valEl.classList.add("text-cyan");
      }

      const btnGetSoil = document.getElementById("btn-get-soil");
      if (btnGetSoil) {
        btnGetSoil.classList.remove("loading");
        btnGetSoil.disabled = false;
        btnGetSoil.textContent = "⚡ Get";
      }

      this.showToast(`✅ Đã nhận Hydrologic Soil Group: ${soilGroup}`);
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

  window.SoilController = SoilController;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => SoilController.init());
  } else {
    SoilController.init();
  }
})();

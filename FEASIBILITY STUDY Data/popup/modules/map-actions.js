/**
 * FEASIBILITY STUDY Data - Map Actions & VPN Router Module
 * Quản lý tính năng tải bản đồ Parcels / Plat Map đa Quận (OCGIS, ZIMAS, LA...) và điều hướng Modal VPN.
 */

(function () {
  const SUPPORTED_MAP_COUNTIES = ["orange", "losAngeles", "riverside", "sanBernardino"];

  let lastVpnRetryParams = null;
  let lastVpnFallbackUrl = null;

  const FsMapActions = {
    SUPPORTED_MAP_COUNTIES,

    /**
     * Quản lý trạng thái nút Get Parcels / Plat Map (Enable/Disable dựa trên địa chỉ)
     */
    updateMapButtonState(addr, btnDownloadMap, currentDetectedCounty) {
      if (!btnDownloadMap) return;
      const query = addr !== undefined ? addr : "";
      if (!query) {
        btnDownloadMap.disabled = true;
        btnDownloadMap.classList.add("disabled");
        btnDownloadMap.title = "Vui lòng nhập địa chỉ hợp lệ để mở bản đồ";
        return;
      }

      const county = currentDetectedCounty || (window.CountyDetector ? window.CountyDetector.detect(query) : null);
      if (!county || county.isUnknown || county.isStreetOnly || county.countyKey === "unknown") {
        btnDownloadMap.disabled = true;
        btnDownloadMap.classList.add("disabled");
        btnDownloadMap.title = "Địa chỉ chưa xác định được Quận/Thành phố. Vui lòng bổ sung City/Zip.";
        return;
      }

      btnDownloadMap.disabled = false;
      btnDownloadMap.classList.remove("disabled");
      btnDownloadMap.title = `Mở Parcels / Plat Map cho ${county.name || "Quận"}`;
    },

    /**
     * Cập nhật giao diện thanh link bản đồ bóc tách được (OCGIS / ZIMAS)
     */
    updateMapLinksUI(linksData, btnLinkParcels, btnLinkTract) {
      if (!linksData) return;

      const isDirect = linksData.source === "zimas" || linksData.source === "la-assessor";
      const parcelUrl = isDirect ? linksData.parcels : (linksData.tractMap || linksData.parcels);

      if (btnLinkParcels && parcelUrl) {
        btnLinkParcels.classList.remove("disabled");
        btnLinkParcels.classList.add("active");
        btnLinkParcels.disabled = false;
        btnLinkParcels.onclick = () => {
          chrome.tabs.create({ url: parcelUrl });
        };
      }

      if (btnLinkTract && linksData.tractMap && !isDirect) {
        btnLinkTract.classList.remove("disabled");
        btnLinkTract.classList.add("active");
        btnLinkTract.disabled = false;
        btnLinkTract.onclick = () => {
          chrome.tabs.create({ url: linksData.tractMap });
        };
      }
    },

    /**
     * Khởi tạo các sự kiện cho nút Map và VPN Modal
     */
    initMapActions(options = {}) {
      const {
        btnDownloadMap, inputAddress, getCurrentCounty,
        getCurrentApn, getCurrentPayload, vpnModal,
        btnVpnRetry, btnVpnFallback, btnVpnClose, showToast
      } = options;

      if (btnDownloadMap) {
        btnDownloadMap.addEventListener("click", () => {
          const query = inputAddress ? inputAddress.value.trim() : "";
          if (!query) {
            if (showToast) showToast("⚠️ Vui lòng nhập địa chỉ trước khi mở bản đồ.");
            return;
          }

          const county = (getCurrentCounty && getCurrentCounty()) || (window.CountyDetector ? window.CountyDetector.detect(query) : null);
          if (!county || county.isUnknown || county.isStreetOnly || county.countyKey === "unknown") {
            if (showToast) showToast("⚠️ Địa chỉ chưa xác định được Quận. Vui lòng thêm City hoặc Zipcode.");
            return;
          }

          const countyKey = county.countyKey;
          if (!SUPPORTED_MAP_COUNTIES.includes(countyKey)) {
            if (showToast) showToast(`⚠️ Chúng tôi chưa hỗ trợ Parcels / Plat Map cho ${county.name || "County này"}.`);
            return;
          }

          const payload = getCurrentPayload ? getCurrentPayload() : null;
          const apn = (getCurrentApn && getCurrentApn()) || payload?.lot?.parcelId || query;
          const cityLabel = county?.matchedCity ? `, ${county.matchedCity.toUpperCase()}` : "";

          if (showToast) showToast(`Checking Parcels / Plat Map (${county?.name || "County"}${cityLabel})...`);

          chrome.runtime.sendMessage({
            action: "START_MAP_DOWNLOAD_PIPELINE",
            apn: apn,
            address: query,
            countyKey: countyKey
          }, (response) => {
            if (chrome.runtime.lastError) {
              if (showToast) showToast("Error starting map download.");
              return;
            }

            if (response && response.vpnRequired) {
              lastVpnRetryParams = { apn, address: query, countyKey };
              lastVpnFallbackUrl = response.fallbackUrl || response.portalUrl;
              if (vpnModal) vpnModal.classList.remove("hidden");
            } else if (response && response.success) {
              if (showToast) showToast(`Connecting Parcels / Plat Map Viewer...`);
            }
          });
        });
      }

      if (btnVpnRetry) {
        btnVpnRetry.addEventListener("click", () => {
          if (vpnModal) vpnModal.classList.add("hidden");
          if (showToast) showToast("Retrying connection with VPN...");
          if (lastVpnRetryParams) {
            chrome.runtime.sendMessage({
              action: "START_MAP_DOWNLOAD_PIPELINE",
              ...lastVpnRetryParams
            });
          }
        });
      }

      if (btnVpnFallback) {
        btnVpnFallback.addEventListener("click", () => {
          if (vpnModal) vpnModal.classList.add("hidden");
          if (lastVpnFallbackUrl) {
            chrome.tabs.create({ url: lastVpnFallbackUrl });
          }
        });
      }

      if (btnVpnClose) {
        btnVpnClose.addEventListener("click", () => {
          if (vpnModal) vpnModal.classList.add("hidden");
        });
      }
    }
  };

  window.FsMapActions = FsMapActions;
})();

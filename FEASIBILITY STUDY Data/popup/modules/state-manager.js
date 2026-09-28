/**
 * FEASIBILITY STUDY Data - State & Storage Manager Module
 * Quản lý vòng đời dữ liệu, đồng bộ hóa chrome.storage, merge dữ liệu sâu và dọn dẹp phiên làm việc.
 */

(function () {
  const ALL_FIELD_IDS = [
    "v-ov-apn", "v-ov-taxArea", "v-ov-bldgArea", "v-ov-maxHeight", "v-ov-maxUnits",
    "v-ov-zoning", "v-ov-yearBuilt", "v-ov-typeAcres", "v-ov-storiesParking", "v-ov-setbacks", "v-ov-maxBldgArea",
    "v-lot-address", "v-lot-bldgArea", "v-lot-bldgUse", "v-lot-stories", "v-lot-parking", "v-lot-garageArea", "v-lot-units", "v-lot-yearBuilt", "v-lot-neighborhood",
    "v-lot-parcelId", "v-lot-groupId", "v-lot-taxRecord", "v-lot-parcelShape", "v-lot-acres",
    "v-lot-type", "v-lot-frontage", "v-lot-vacant", "v-lot-legal",
    "v-zn-landUse", "v-zn-code", "v-zn-district", "v-zn-desc", "v-zn-allowed", "v-zn-flood",
    "v-sb-primary", "v-sb-secondary", "v-sb-side", "v-sb-rear", "v-sb-water",
    "v-cp-bldgArea", "v-cp-stories", "v-cp-height", "v-cp-far", "v-cp-lotCov",
    "v-cp-footprint", "v-cp-openSpace", "v-cp-resDensity", "v-cp-resArea", "v-cp-resUnits",
    "v-cp-lodgingDensity", "v-cp-lodgingArea", "v-cp-officeArea", "v-cp-commArea",
    "v-cv-flood", "v-cv-fema-panel", "v-cv-fema-eff-date", "v-cv-fema-cid", "v-cv-fema-jurisdiction", "v-cv-fema-fld-zone", "v-cv-fema-zone-subty",
    "v-cv-soil-group", "v-cv-water", "v-cv-sewer", "v-cv-drainage", "v-cv-slope", "v-cv-fire", "v-cv-notes"
  ];

  const FsStateManager = {
    allFieldIds: ALL_FIELD_IDS,

    /**
     * Hợp nhất sâu (Deep Merge) đối tượng dữ liệu mà không làm mất các trường cũ
     */
    mergeDeep(target, source) {
      if (!source) return target;
      if (!target) return JSON.parse(JSON.stringify(source));

      const output = Object.assign({}, target);
      Object.keys(source).forEach(key => {
        const srcVal = source[key];
        const tgtVal = target[key];
        if (srcVal !== null && srcVal !== undefined && srcVal !== "" && srcVal !== "-") {
          if (typeof srcVal === "object" && !Array.isArray(srcVal)) {
            output[key] = FsStateManager.mergeDeep(tgtVal || {}, srcVal);
          } else {
            output[key] = srcVal;
          }
        }
      });
      return output;
    },

    /**
     * Xóa dữ liệu phiên làm việc (Session Data)
     */
    resetSessionData(keepAddress = false, elements = {}) {
      const {
        inputAddress, btnClearAddress, vDetectedCounty,
        statusLabel, statusPill, btnLinkParcels, btnLinkTract,
        updateMapButtonState, showToast, onStateReset
      } = elements;

      if (!keepAddress) {
        chrome.storage.local.remove(["lastSearchQuery", "lastPipelineResult", "lastApn", "ocgisMapLinks", "activePipelineSession"]);
        if (inputAddress) inputAddress.value = "";
        if (btnClearAddress) btnClearAddress.classList.add("hidden");
        if (vDetectedCounty) vDetectedCounty.textContent = "-";
        if (statusLabel) statusLabel.textContent = "Ready";
        if (statusPill) statusPill.className = "status-pill pending";
      } else {
        chrome.storage.local.remove(["lastPipelineResult", "lastApn", "ocgisMapLinks", "activePipelineSession"]);
      }

      ALL_FIELD_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = "-";
          el.style.color = "#64748b";
        }
      });

      if (btnLinkParcels) {
        btnLinkParcels.classList.add("disabled");
        btnLinkParcels.classList.remove("active");
        btnLinkParcels.disabled = true;
        btnLinkParcels.onclick = null;
      }
      if (btnLinkTract) {
        btnLinkTract.classList.add("disabled");
        btnLinkTract.classList.remove("active");
        btnLinkTract.disabled = true;
        btnLinkTract.onclick = null;
      }

      if (updateMapButtonState) updateMapButtonState("");
      if (onStateReset) onStateReset(keepAddress);

      if (!keepAddress && showToast) {
        showToast("Session data cleaned!");
      }
    },

    /**
     * Đọc dữ liệu từ chrome.storage khi khởi động popup
     */
    loadStoredData(callbacks = {}) {
      const {
        togglePropZoneExtract, inputAddress, btnClearAddress,
        updateCountyBadge, updateMapButtonState, applyPipelineResult,
        updateMapLinksUI, setStoredApn, setText, statusLabel, statusPill
      } = callbacks;

      chrome.storage.local.get(["lastSearchQuery", "lastPipelineResult", "lastApn", "ocgisMapLinks", "allowPropZoneExtract"], (res) => {
        if (togglePropZoneExtract) {
          togglePropZoneExtract.checked = (res.allowPropZoneExtract !== false);
        }
        if (res.lastSearchQuery && inputAddress && !inputAddress.value) {
          inputAddress.value = res.lastSearchQuery;
          if (btnClearAddress) btnClearAddress.classList.remove("hidden");
          if (updateCountyBadge) updateCountyBadge(res.lastSearchQuery);
        } else if (updateMapButtonState && inputAddress) {
          updateMapButtonState(inputAddress.value.trim());
        }
        if (res.lastApn) {
          if (setStoredApn) setStoredApn(res.lastApn);
          if (setText) {
            setText("v-ov-apn", res.lastApn);
            setText("v-lot-parcelId", res.lastApn);
          }
          if (statusLabel) statusLabel.textContent = `APN: ${res.lastApn}`;
          if (statusPill) statusPill.className = "status-pill active";
        }
        if (res.lastPipelineResult && applyPipelineResult) {
          applyPipelineResult(res.lastPipelineResult);
        }
        if (res.ocgisMapLinks && updateMapLinksUI) {
          updateMapLinksUI(res.ocgisMapLinks);
        }
      });
    },

    /**
     * Lắng nghe Storage thay đổi theo thời gian thực (Real-Time Auto Sync)
     */
    setupStorageListener(callbacks = {}) {
      const {
        togglePropZoneExtract, inputAddress, btnClearAddress,
        updateCountyBadge, applyPipelineResult, updateMapLinksUI,
        setStoredApn, setText, statusLabel, statusPill, showToast
      } = callbacks;

      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local") {
          if (changes.allowPropZoneExtract && togglePropZoneExtract) {
            togglePropZoneExtract.checked = (changes.allowPropZoneExtract.newValue !== false);
          }
          if (changes.lastSearchQuery && changes.lastSearchQuery.newValue && inputAddress) {
            const addrVal = changes.lastSearchQuery.newValue;
            if (!inputAddress.value.trim()) {
              inputAddress.value = addrVal;
              if (btnClearAddress) btnClearAddress.classList.remove("hidden");
              if (updateCountyBadge) updateCountyBadge(addrVal);
            }
          }
          if (changes.lastApn && changes.lastApn.newValue) {
            const apnVal = changes.lastApn.newValue;
            if (setStoredApn) setStoredApn(apnVal);
            if (setText) {
              setText("v-ov-apn", apnVal);
              setText("v-lot-parcelId", apnVal);
            }
            if (statusLabel) statusLabel.textContent = `APN: ${apnVal}`;
            if (statusPill) statusPill.className = "status-pill active";
          }
          if (changes.lastPipelineResult && changes.lastPipelineResult.newValue) {
            const res = changes.lastPipelineResult.newValue;
            if (res.status === "FAILED_5_RETRIES") {
              if (statusLabel) statusLabel.textContent = "Failed (5 retries)";
              if (statusPill) statusPill.className = "status-pill pending";
              if (showToast) showToast("PropZone Timeout after 5 retries!");
            } else if (applyPipelineResult) {
              applyPipelineResult(res);
            }
          }
          if (changes.ocgisMapLinks && changes.ocgisMapLinks.newValue && updateMapLinksUI) {
            updateMapLinksUI(changes.ocgisMapLinks.newValue);
          }
        }
      });
    }
  };

  window.FsStateManager = FsStateManager;
})();

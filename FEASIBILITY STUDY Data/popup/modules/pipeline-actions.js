/**
 * FEASIBILITY STUDY Data - Pipeline Actions & Automation Module
 * Quản lý quy trình Auto Pipeline, kiểm tra County theo thời gian thực, bóc tách trang hiện tại và bóc tách Civil.
 */

(function () {
  const FsPipelineActions = {
    /**
     * Nhận diện và cập nhật hiển thị Quận/Thành phố theo địa chỉ
     */
    updateCountyBadge(addr, vDetectedCounty, callbacks = {}) {
      const { onCountyDetected, updateMapButtonState } = callbacks;

      if (!addr) {
        if (vDetectedCounty) {
          vDetectedCounty.textContent = "Chưa nhập địa chỉ";
          vDetectedCounty.classList.add("county-warn");
          vDetectedCounty.title = "Vui lòng nhập địa chỉ";
        }
        if (onCountyDetected) onCountyDetected(null);
        if (updateMapButtonState) updateMapButtonState("");
        return;
      }

      if (window.CountyDetector) {
        const detected = window.CountyDetector.detect(addr);
        if (onCountyDetected) onCountyDetected(detected);

        if (vDetectedCounty) {
          if (detected.isStreetOnly) {
            vDetectedCounty.textContent = "KHÔNG XÁC ĐỊNH (⚠️ Thiếu City/Zip)";
            vDetectedCounty.title = "Địa chỉ chỉ có tên đường, thiếu Thành phố / Zipcode! Thêm ví dụ: ', Santa Ana' hoặc '92701'";
            vDetectedCounty.classList.add("county-warn");
          } else if (detected.isUnknown) {
            vDetectedCounty.textContent = "KHÔNG XÁC ĐỊNH (CA)";
            vDetectedCounty.title = "Không tìm thấy Quận/Thành phố trong cơ sở dữ liệu 483 thành phố CA";
            vDetectedCounty.classList.add("county-warn");
          } else {
            vDetectedCounty.textContent = `${detected.name} (CA)`;
            vDetectedCounty.title = detected.matchedCity ? `Thành phố: ${detected.matchedCity.toUpperCase()}` : "";
            vDetectedCounty.classList.remove("county-warn");
          }
        }

        if (updateMapButtonState) updateMapButtonState(addr);
      }
    },

    /**
     * Quét trực tiếp dữ liệu từ Console tab hiện tại
     */
    async triggerFreshConsoleExecution(isManual = false, options = {}) {
      const { refreshIcon, statusLabel, statusPill, inputAddress, btnClearAddress, showToast, updateCountyBadge, setStoredApn, setText, renderDashboard, getCurrentPayload, setCurrentPayload } = options;

      if (refreshIcon) refreshIcon.classList.add("spinning");

      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab || !activeTab.url) {
          if (refreshIcon) refreshIcon.classList.remove("spinning");
          if (statusLabel) statusLabel.textContent = "Ready";
          return;
        }

        const isPropZone = activeTab.url.includes("propzone.gridics.com");

        if (!isManual) {
          if (!isPropZone) {
            if (refreshIcon) refreshIcon.classList.remove("spinning");
            if (statusLabel) statusLabel.textContent = "Ready";
            return;
          }

          const res = await chrome.storage.local.get("allowPropZoneExtract");
          if (res.allowPropZoneExtract === false) {
            if (refreshIcon) refreshIcon.classList.remove("spinning");
            if (statusLabel) statusLabel.textContent = "PropZone: Manual";
            return;
          }
        }

        const isAllowed = window.PropZoneRules?.RuleMatcher.isAllowedSite(activeTab.url);
        const portalInfo = window.PropZoneRules?.RuleMatcher.getPortalInfo(activeTab.url);

        if (!isAllowed) {
          if (refreshIcon) refreshIcon.classList.remove("spinning");
          if (statusLabel) statusLabel.textContent = "Ready";
          return;
        }

        chrome.tabs.sendMessage(activeTab.id, { action: "FORCE_FRESH_EXTRACT" }, async (response) => {
          if (chrome.runtime.lastError || !response) {
            try {
              const scriptFiles = ["content/floating-ui.js", "config/county-detector.js", "config/rules.js"];
              scriptFiles.push(isPropZone ? "content/propzone-map-extractor.js" : "content/extractor.js");

              await chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                files: scriptFiles
              });
              chrome.tabs.sendMessage(activeTab.id, { action: "FORCE_FRESH_EXTRACT" }, (res2) => {
                if (refreshIcon) refreshIcon.classList.remove("spinning");
                if (res2 && res2.success) {
                  FsPipelineActions.handleSuccess(res2, portalInfo ? portalInfo.name : "Online", options);
                } else if (statusLabel) {
                  statusLabel.textContent = portalInfo ? portalInfo.name : "Ready";
                }
              });
            } catch (e) {
              if (refreshIcon) refreshIcon.classList.remove("spinning");
              if (statusLabel) statusLabel.textContent = portalInfo ? portalInfo.name : "Ready";
            }
          } else if (response.success) {
            FsPipelineActions.handleSuccess(response, portalInfo ? portalInfo.name : "Online", options);
          } else {
            if (refreshIcon) refreshIcon.classList.remove("spinning");
            if (statusLabel) statusLabel.textContent = portalInfo ? portalInfo.name : "Ready";
          }
        });
      } catch (err) {
        if (refreshIcon) refreshIcon.classList.remove("spinning");
        if (statusLabel) statusLabel.textContent = "Ready";
      }
    },

    handleSuccess(res, portalTitle, options = {}) {
      const { refreshIcon, statusPill, statusLabel, inputAddress, btnClearAddress, updateCountyBadge, setStoredApn, renderDashboard, getCurrentPayload, setCurrentPayload } = options;

      if (refreshIcon) refreshIcon.classList.remove("spinning");
      if (res && res.data) {
        const prev = getCurrentPayload ? getCurrentPayload() : {};
        const currentPayload = window.FsStateManager ? window.FsStateManager.mergeDeep(prev || {}, res.data) : { ...prev, ...res.data };
        if (setCurrentPayload) setCurrentPayload(currentPayload);

        if (statusPill) statusPill.className = "status-pill active";
        if (statusLabel) statusLabel.textContent = portalTitle || "Online";

        const lot = currentPayload.lot || {};
        const extractedAddress = currentPayload.address || lot.projectAddress || lot.address || lot.situsAddress;
        if (extractedAddress && inputAddress && !inputAddress.value.trim()) {
          inputAddress.value = extractedAddress;
          if (btnClearAddress) btnClearAddress.classList.remove("hidden");
          if (updateCountyBadge) updateCountyBadge(extractedAddress);
          chrome.storage.local.set({ lastSearchQuery: extractedAddress });
        }

        const extractedApn = lot.parcelId || lot.parcelNumber || lot.apn || res.data.apn;
        if (extractedApn) {
          if (setStoredApn) setStoredApn(extractedApn);
          chrome.storage.local.set({ lastApn: extractedApn });
        }

        chrome.storage.local.set({ lastPipelineResult: currentPayload });
        if (renderDashboard) renderDashboard(currentPayload);
      }
    },

    /**
     * Khởi tạo toàn bộ sự kiện cho Pipeline, Ô nhập địa chỉ, Toggle và Nút Civil
     */
    initPipelineActions(options = {}) {
      const {
        btnAutoPipeline, inputAddress, btnClearAddress, btnRecheckCounty,
        vDetectedCounty, statusLabel, statusPill, togglePropZoneExtract,
        btnGetFema, btnGetSoil, showToast, resetSessionData,
        updateCountyBadge, updateMapButtonState, setText,
        getCurrentCounty, setStoredApn, setStoredCounty
      } = options;

      // 1. Lắng nghe ô nhập địa chỉ
      if (inputAddress) {
        inputAddress.addEventListener("input", () => {
          const val = inputAddress.value.trim();
          if (btnClearAddress) {
            btnClearAddress.classList.toggle("hidden", val === "");
          }
          if (updateCountyBadge) updateCountyBadge(val);
        });

        inputAddress.addEventListener("keyup", (e) => {
          if (e.key === "Enter" && btnAutoPipeline) {
            btnAutoPipeline.click();
          }
        });
      }

      if (btnClearAddress) {
        btnClearAddress.addEventListener("click", () => {
          if (inputAddress) inputAddress.value = "";
          btnClearAddress.classList.add("hidden");
          if (updateCountyBadge) updateCountyBadge("");
          if (inputAddress) inputAddress.focus();
        });
      }

      if (btnRecheckCounty) {
        btnRecheckCounty.addEventListener("click", () => {
          const addr = inputAddress ? inputAddress.value.trim() : "";
          if (updateCountyBadge) updateCountyBadge(addr);
          if (showToast) showToast("Rechecked County!");
        });
      }

      // 2. Nút khởi chạy Auto Pipeline
      if (btnAutoPipeline) {
        btnAutoPipeline.addEventListener("click", () => {
          const address = inputAddress ? inputAddress.value.trim() : "";
          if (!address) {
            if (showToast) showToast("Please enter an address!");
            if (inputAddress) inputAddress.focus();
            return;
          }

          if (resetSessionData) resetSessionData(true);

          const county = (getCurrentCounty && getCurrentCounty()) || window.CountyDetector?.detect(address);
          if (updateCountyBadge) updateCountyBadge(address);
          chrome.storage.local.set({ lastSearchQuery: address });

          const isApn = /^[0-9\-\s]{6,16}$/.test(address) && /\d{6,}/.test(address.replace(/\D/g, ""));
          const cleanApn = isApn ? address.replace(/[^0-9]/g, "") : "";

          if (cleanApn) {
            if (setStoredApn) setStoredApn(cleanApn);
            if (setText) {
              setText("v-ov-apn", cleanApn);
              setText("v-lot-parcelId", cleanApn);
            }
            if (statusLabel) statusLabel.textContent = `Finding Address from APN: ${cleanApn}...`;
            if (statusPill) statusPill.className = "status-pill active";
            if (showToast) showToast(`Searching Address for APN: ${cleanApn}...`);
          } else {
            if (county?.isStreetOnly) {
              if (showToast) showToast("⚠️ Đang tìm với địa chỉ thiếu City/Zip! Khuyên dùng: thêm ', City'");
            } else if (showToast) {
              showToast("Starting Pipeline: Property Overview → PropZone...");
            }
            if (statusLabel) statusLabel.textContent = "Finding Property Overview...";
            if (statusPill) statusPill.className = "status-pill active";
          }

          chrome.runtime.sendMessage({
            action: "START_AUTO_PIPELINE",
            address: address
          });
        });
      }

      // 3. Toggle PropZone Auto
      if (togglePropZoneExtract) {
        togglePropZoneExtract.addEventListener("change", (e) => {
          const isChecked = e.target.checked;
          chrome.storage.local.set({ allowPropZoneExtract: isChecked });
          if (showToast) showToast(isChecked ? "PropZone Auto: ON" : "PropZone Auto: OFF");
        });
      }

      // 4. Civil Actions: FEMA Flood Zone
      if (btnGetFema) {
        btnGetFema.addEventListener("click", () => {
          const query = inputAddress ? inputAddress.value.trim() : "";
          if (!query) {
            if (showToast) showToast("⚠️ Vui lòng nhập địa chỉ trước khi lấy FEMA Flood Zone.");
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
          if (showToast) showToast("🌊 Đang điều hướng FEMA Flood Map...");
        });
      }

      // 5. Civil Actions: Soil Group
      if (btnGetSoil) {
        btnGetSoil.addEventListener("click", () => {
          const query = inputAddress ? inputAddress.value.trim() : "";
          if (!query) {
            if (showToast) showToast("⚠️ Vui lòng nhập địa chỉ trước khi lấy Hydrologic Soil Group.");
            return;
          }

          btnGetSoil.classList.add("loading");
          btnGetSoil.disabled = true;
          btnGetSoil.textContent = "⏳...";
          if (showToast) showToast("🌱 Đang mở Web Soil Survey và bóc tách dữ liệu...");

          chrome.runtime.sendMessage({
            action: "START_SOIL_EXTRACTION_PIPELINE",
            address: query
          }, (response) => {
            if (chrome.runtime.lastError || !response || !response.success) {
              if (showToast) showToast("⚠️ Không thể khởi chạy Web Soil Survey.");
              if (btnGetSoil) {
                btnGetSoil.classList.remove("loading");
                btnGetSoil.disabled = false;
                btnGetSoil.textContent = "⚡ Get";
              }
              return;
            }

            if (showToast) showToast("⏳ Đang tra cứu Hydrologic Soil Group...");
          });
        });
      }
    }
  };

  window.FsPipelineActions = FsPipelineActions;
})();

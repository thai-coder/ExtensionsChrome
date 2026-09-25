/**
 * FEASIBILITY STUDY Data - Popup Master Orchestrator
 * Điều phối toàn bộ các module: UI Helpers, State Manager, Tab Renderer, Map Actions, Pipeline Actions.
 */

document.addEventListener("DOMContentLoaded", () => {
  const { showToast, setText } = window.FsUiHelpers || {};
  const StateManager = window.FsStateManager;
  const TabRenderer = window.FsTabRenderer;
  const MapActions = window.FsMapActions;
  const PipelineActions = window.FsPipelineActions;

  // 1. DOM Elements
  const statusPill = document.getElementById("status-pill");
  const statusLabel = document.getElementById("status-label");
  const btnClean = document.getElementById("btn-clean");
  const btnRefresh = document.getElementById("btn-refresh");
  const refreshIcon = document.getElementById("refresh-icon");

  const inputAddress = document.getElementById("input-address");
  const btnClearAddress = document.getElementById("btn-clear-address");
  const btnAutoPipeline = document.getElementById("btn-auto-pipeline");
  const vDetectedCounty = document.getElementById("v-detected-county");
  const btnRecheckCounty = document.getElementById("btn-recheck-county");
  const togglePropZoneExtract = document.getElementById("toggle-propzone-extract");

  // Tabs & Views
  const navTabs = [
    { btn: document.getElementById("tab-overview"), view: document.getElementById("view-overview") },
    { btn: document.getElementById("tab-lot"), view: document.getElementById("view-lot") },
    { btn: document.getElementById("tab-zoning"), view: document.getElementById("view-zoning") },
    { btn: document.getElementById("tab-setbacks"), view: document.getElementById("view-setbacks") },
    { btn: document.getElementById("tab-capacity"), view: document.getElementById("view-capacity") },
    { btn: document.getElementById("tab-civil"), view: document.getElementById("view-civil") }
  ];

  // Actions
  const btnCopyJson = document.getElementById("btn-copy-json");
  const btnDownloadMap = document.getElementById("btn-download-map");
  const btnLinkParcels = document.getElementById("btn-link-parcels");
  const btnLinkTract = document.getElementById("btn-link-tract");

  // Civil Actions
  const btnGetFema = document.getElementById("btn-get-fema");
  const btnGetSoil = document.getElementById("btn-get-soil");

  // VPN Modal
  const vpnModal = document.getElementById("vpn-modal");
  const btnVpnRetry = document.getElementById("btn-vpn-retry");
  const btnVpnFallback = document.getElementById("btn-vpn-fallback");
  const btnVpnClose = document.getElementById("btn-vpn-close");

  // Update Elements
  const updateBanner = document.getElementById("fs-update-banner");
  const updateText = document.getElementById("fs-update-text");
  const btnCopyInstaller = document.getElementById("fs-btn-copy-installer");
  const btnReloadExt = document.getElementById("btn-reload-ext");
  const btnReloadNow = document.getElementById("fs-btn-reload-now");

  // 2. Local State
  let currentPayload = null;
  let currentDetectedCounty = null;
  let storedApn = null;

  // 3. Tab Switching
  navTabs.forEach(item => {
    if (item.btn) {
      item.btn.addEventListener("click", () => {
        navTabs.forEach(t => {
          if (t.btn) t.btn.classList.remove("active");
          if (t.view) {
            t.view.classList.add("hidden");
            t.view.classList.remove("active");
          }
        });
        item.btn.classList.add("active");
        if (item.view) {
          item.view.classList.remove("hidden");
          item.view.classList.add("active");
        }
      });
    }
  });

  // 4. Update UI Wrappers
  function updateMapButtonState(addr) {
    if (MapActions) {
      MapActions.updateMapButtonState(addr, btnDownloadMap, currentDetectedCounty);
    }
  }

  function updateCountyBadge(addr) {
    if (PipelineActions) {
      PipelineActions.updateCountyBadge(addr, vDetectedCounty, {
        onCountyDetected: (c) => { currentDetectedCounty = c; },
        updateMapButtonState: updateMapButtonState
      });
    }
  }

  function renderDashboard(data) {
    if (TabRenderer) {
      TabRenderer.renderDashboard(data, {
        storedApn,
        inputAddress,
        btnGetSoil
      });
    }
  }

  function applyPipelineResult(p) {
    if (!p) return;
    currentPayload = StateManager ? StateManager.mergeDeep(currentPayload || {}, p) : { ...(currentPayload || {}), ...p };
    storedApn = p.apn || (p.lot && p.lot.parcelId) || (currentPayload.lot && currentPayload.lot.parcelId) || storedApn || null;

    if (storedApn && setText) {
      setText("v-ov-apn", storedApn);
      setText("v-lot-parcelId", storedApn);
      if (statusLabel) statusLabel.textContent = `APN: ${storedApn}`;
      if (statusPill) statusPill.className = "status-pill active";
    }

    const extractedAddress = p.address || (p.lot && (p.lot.projectAddress || p.lot.address || p.lot.situsAddress)) || (currentPayload && currentPayload.address) || (currentPayload && currentPayload.lot && currentPayload.lot.projectAddress);
    if (extractedAddress && inputAddress && !inputAddress.value.trim()) {
      inputAddress.value = extractedAddress;
      if (btnClearAddress) btnClearAddress.classList.remove("hidden");
      updateCountyBadge(extractedAddress);
    }

    renderDashboard(currentPayload);
  }

  function resetSessionData(keepAddress = false) {
    if (StateManager) {
      StateManager.resetSessionData(keepAddress, {
        inputAddress, btnClearAddress, vDetectedCounty,
        statusLabel, statusPill, btnLinkParcels, btnLinkTract,
        updateMapButtonState, showToast,
        onStateReset: (keep) => {
          currentPayload = null;
          storedApn = null;
          if (!keep) currentDetectedCounty = null;
        }
      });
    }
  }

  // 5. Init Sub-Modules
  if (MapActions) {
    MapActions.initMapActions({
      btnDownloadMap, inputAddress,
      getCurrentCounty: () => currentDetectedCounty,
      getCurrentApn: () => storedApn,
      getCurrentPayload: () => currentPayload,
      vpnModal, btnVpnRetry, btnVpnFallback, btnVpnClose,
      showToast
    });
  }

  if (PipelineActions) {
    PipelineActions.initPipelineActions({
      btnAutoPipeline, inputAddress, btnClearAddress, btnRecheckCounty,
      vDetectedCounty, statusLabel, statusPill, togglePropZoneExtract,
      btnGetFema, btnGetSoil, showToast, resetSessionData,
      updateCountyBadge, updateMapButtonState, setText,
      getCurrentCounty: () => currentDetectedCounty,
      setStoredApn: (apn) => { storedApn = apn; }
    });
  }

  // 6. State & Storage Sync
  if (StateManager) {
    StateManager.loadStoredData({
      togglePropZoneExtract, inputAddress, btnClearAddress,
      updateCountyBadge, updateMapButtonState, applyPipelineResult,
      updateMapLinksUI: (links) => MapActions?.updateMapLinksUI(links, btnLinkParcels, btnLinkTract),
      setStoredApn: (apn) => { storedApn = apn; },
      setText, statusLabel, statusPill
    });

    StateManager.setupStorageListener({
      togglePropZoneExtract, inputAddress, btnClearAddress,
      updateCountyBadge, applyPipelineResult,
      updateMapLinksUI: (links) => MapActions?.updateMapLinksUI(links, btnLinkParcels, btnLinkTract),
      setStoredApn: (apn) => { storedApn = apn; },
      setText, statusLabel, statusPill, showToast
    });
  }

  // 7. General Actions (Clean, Copy JSON, Refresh, Update Check)
  if (btnClean) {
    btnClean.addEventListener("click", () => resetSessionData(false));
  }

  if (btnCopyJson) {
    btnCopyJson.addEventListener("click", async () => {
      if (!currentPayload) return;
      try {
        await navigator.clipboard.writeText(JSON.stringify(currentPayload, null, 2));
        if (showToast) showToast("JSON Copied to Clipboard!");
      } catch (e) {
        if (showToast) showToast("Clipboard Error");
      }
    });
  }

  function triggerFreshConsoleExecution(isManual = false) {
    if (PipelineActions) {
      PipelineActions.triggerFreshConsoleExecution(isManual, {
        refreshIcon, statusLabel, statusPill, inputAddress, btnClearAddress,
        showToast, updateCountyBadge,
        setStoredApn: (apn) => { storedApn = apn; },
        setText, renderDashboard,
        getCurrentPayload: () => currentPayload,
        setCurrentPayload: (p) => { currentPayload = p; }
      });
    }
  }

  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => triggerFreshConsoleExecution(true));
  }

  // Auto Updater & Reload Helpers
  function triggerProactiveReload() {
    if (showToast) showToast("🔄 Đang tải lại Extension...");
    try {
      chrome.runtime.sendMessage({ action: "RELOAD_EXTENSION" });
    } catch (e) { }
    setTimeout(() => {
      try {
        if (chrome.runtime && chrome.runtime.reload) chrome.runtime.reload();
      } catch (e) { }
    }, 150);
  }

  if (btnReloadExt) btnReloadExt.onclick = triggerProactiveReload;
  if (btnReloadNow) btnReloadNow.onclick = triggerProactiveReload;

  function checkAndDisplayUpdate() {
    chrome.storage.local.get("fs_update_info", (result) => {
      const info = result.fs_update_info;
      if (info && info.hasUpdate && updateBanner) {
        updateBanner.style.display = "flex";
        if (updateText) updateText.textContent = `Đã có bản mới v${info.serverVersion}!`;
        if (btnCopyInstaller) {
          btnCopyInstaller.onclick = () => {
            const path = info.installerPath || "\\\\192.168.11.250\\Sharing\\THAILE\\Tools\\Extensions\\FS.exe";
            navigator.clipboard.writeText(path).catch(() => { });
            btnCopyInstaller.disabled = true;
            btnCopyInstaller.textContent = "⏳ Đang chạy...";
            chrome.runtime.sendMessage({
              action: "TRIGGER_SILENT_UPDATE_AND_RELOAD",
              targetVersion: info.serverVersion || ""
            });
            if (showToast) showToast("⚡ Đang cài đặt ngầm & tự động tải lại Extension...");
          };
        }
      } else if (updateBanner) {
        updateBanner.style.display = "none";
      }
    });
  }

  checkAndDisplayUpdate();
  try {
    chrome.runtime.sendMessage({ action: "MANUAL_CHECK_UPDATE" }, (res) => {
      if (!chrome.runtime.lastError) checkAndDisplayUpdate();
    });
  } catch (e) { }

  try {
    const brandVersionEl = document.getElementById("brand-version");
    const currentManifestVersion = chrome.runtime?.getManifest?.()?.version;
    if (brandVersionEl && currentManifestVersion) {
      brandVersionEl.textContent = `v${currentManifestVersion}`;
    }
  } catch (err) { }

  triggerFreshConsoleExecution(false);
});

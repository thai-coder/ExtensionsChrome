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

  // Main Tabs & Views (Arch, Civil, Wood)
  const mainNavTabs = [
    { btn: document.getElementById("tab-arch"), view: document.getElementById("view-arch") },
    { btn: document.getElementById("tab-civil"), view: document.getElementById("view-civil") },
    { btn: document.getElementById("tab-wood"), view: document.getElementById("view-wood") }
  ];

  // Arch Subtabs & Views (Overview, Lot, Zoning, Setbacks, Capacity)
  const archSubTabs = [
    { btn: document.getElementById("subtab-overview"), view: document.getElementById("view-overview") },
    { btn: document.getElementById("subtab-lot"), view: document.getElementById("view-lot") },
    { btn: document.getElementById("subtab-zoning"), view: document.getElementById("view-zoning") },
    { btn: document.getElementById("subtab-setbacks"), view: document.getElementById("view-setbacks") },
    { btn: document.getElementById("subtab-capacity"), view: document.getElementById("view-capacity") }
  ];

  // Actions
  const btnCopyJson = document.getElementById("btn-copy-json");
  const btnDownloadMap = document.getElementById("btn-download-map");
  const btnLinkParcels = document.getElementById("btn-link-parcels");
  const btnLinkTract = document.getElementById("btn-link-tract");

  // Civil Actions
  const btnGetFema = document.getElementById("btn-get-fema");
  const btnGetSoil = document.getElementById("btn-get-soil");
  const btnToggleFemaDetails = document.getElementById("btn-toggle-fema-details");
  const femaDetailsPanel = document.getElementById("fema-details-panel");

  // Wood Actions
  const btnAsceHazard = document.getElementById("btn-asce-hazard");
  const btnToggleAsceDetails = document.getElementById("btn-toggle-asce-details");
  const asceOptionsPanel = document.getElementById("asce-options-panel");
  const asceOptVersion = document.getElementById("asce-opt-version");
  const asceOptRisk = document.getElementById("asce-opt-risk");
  const asceOptSoil = document.getElementById("asce-opt-soil");
  const asceBtnSelectAll = document.getElementById("asce-btn-select-all");
  const vWdAsce = document.getElementById("v-wd-asce");

  function setupCustomDropdowns() {
    document.querySelectorAll(".custom-dropdown").forEach(dropdown => {
      const btn = dropdown.querySelector(".custom-dropdown-btn");
      const textEl = dropdown.querySelector(".custom-dropdown-text");
      const menu = dropdown.querySelector(".custom-dropdown-menu");
      const hiddenInput = dropdown.querySelector("input[type='hidden']");
      const items = dropdown.querySelectorAll(".custom-dropdown-item");

      if (!btn || !menu || !hiddenInput) return;

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".custom-dropdown").forEach(d => {
          if (d !== dropdown) {
            d.classList.remove("open");
            d.querySelector(".custom-dropdown-menu")?.classList.add("hidden");
          }
        });
        const isOpen = dropdown.classList.toggle("open");
        menu.classList.toggle("hidden", !isOpen);
      });

      items.forEach(item => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const val = item.getAttribute("data-value");
          hiddenInput.value = val;
          if (textEl) textEl.textContent = item.textContent.trim();
          items.forEach(i => i.classList.remove("selected"));
          item.classList.add("selected");
          dropdown.classList.remove("open");
          menu.classList.add("hidden");
          hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
        });
      });
    });

    document.addEventListener("click", () => {
      document.querySelectorAll(".custom-dropdown").forEach(d => {
        d.classList.remove("open");
        d.querySelector(".custom-dropdown-menu")?.classList.add("hidden");
      });
    });
  }

  function updateDropdownUI(hiddenInputId, value) {
    const hiddenInput = document.getElementById(hiddenInputId);
    if (!hiddenInput) return;
    hiddenInput.value = value;
    const dropdown = hiddenInput.closest(".custom-dropdown");
    if (!dropdown) return;
    const textEl = dropdown.querySelector(".custom-dropdown-text");
    const items = dropdown.querySelectorAll(".custom-dropdown-item");
    items.forEach(item => {
      if (item.getAttribute("data-value") === value) {
        item.classList.add("selected");
        if (textEl) textEl.textContent = item.textContent.trim();
      } else {
        item.classList.remove("selected");
      }
    });
  }

  setupCustomDropdowns();

  function getAsceSettings() {
    const version = asceOptVersion ? asceOptVersion.value : "ASCE/SEI 7-22";
    const risk = asceOptRisk ? asceOptRisk.value : "Risk Category II";
    const soil = asceOptSoil ? asceOptSoil.value : "Default";
    const measCustomary = document.getElementById("asce-meas-customary");
    const measurement = (measCustomary && measCustomary.checked) ? "Customary" : "SI";

    const loadCheckboxes = document.querySelectorAll(".asce-load-item");
    const loadTypes = {};
    loadCheckboxes.forEach(cb => {
      loadTypes[cb.value] = cb.checked;
    });

    return { version, risk, soil, measurement, loadTypes };
  }

  function saveAsceSettings() {
    const settings = getAsceSettings();
    chrome.storage.local.set({ asceHazardSettings: settings });
    if (vWdAsce) {
      vWdAsce.textContent = settings.version.replace("ASCE/SEI ", "ASCE ");
    }
  }

  function loadAsceSettings() {
    chrome.storage.local.get(["asceHazardSettings"], (res) => {
      const s = res?.asceHazardSettings;
      if (!s) return;
      if (s.version) updateDropdownUI("asce-opt-version", s.version);
      if (s.risk) updateDropdownUI("asce-opt-risk", s.risk);
      if (s.soil) updateDropdownUI("asce-opt-soil", s.soil);
      if (s.measurement) {
        const rad = document.querySelector(`input[name="asce-measurement"][value="${s.measurement}"]`);
        if (rad) rad.checked = true;
      }
      if (s.loadTypes) {
        Object.entries(s.loadTypes).forEach(([val, checked]) => {
          const cb = document.querySelector(`.asce-load-item[value="${val}"]`);
          if (cb) cb.checked = !!checked;
        });
      }
      if (vWdAsce && s.version) {
        vWdAsce.textContent = s.version.replace("ASCE/SEI ", "ASCE ");
      }
    });
  }

  loadAsceSettings();

  if (asceOptVersion) asceOptVersion.addEventListener("change", saveAsceSettings);
  if (asceOptRisk) asceOptRisk.addEventListener("change", saveAsceSettings);
  if (asceOptSoil) asceOptSoil.addEventListener("change", saveAsceSettings);
  document.querySelectorAll('input[name="asce-measurement"]').forEach(r => {
    r.addEventListener("change", saveAsceSettings);
  });
  document.querySelectorAll(".asce-load-item").forEach(cb => {
    cb.addEventListener("change", saveAsceSettings);
  });

  if (asceBtnSelectAll) {
    asceBtnSelectAll.addEventListener("click", () => {
      const allCb = Array.from(document.querySelectorAll(".asce-load-item"));
      const someUnchecked = allCb.some(cb => !cb.checked);
      allCb.forEach(cb => { cb.checked = someUnchecked; });
      asceBtnSelectAll.textContent = someUnchecked ? "Deselect all" : "Select all";
      saveAsceSettings();
    });
  }

  if (btnToggleAsceDetails && asceOptionsPanel) {
    btnToggleAsceDetails.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = asceOptionsPanel.classList.toggle("hidden");
      btnToggleAsceDetails.classList.toggle("open", !isHidden);
    });
  }

  if (btnAsceHazard) {
    btnAsceHazard.addEventListener("click", () => {
      const query = inputAddress ? inputAddress.value.trim() : "";
      const asceUrl = "https://ascehazardtool.org/";
      const asceSettings = getAsceSettings();

      if (query) {
        chrome.storage.local.set({
          lastSearchQuery: query,
          pendingExtractorCommand: {
            url: asceUrl,
            portalKey: "asce",
            searchQuery: query,
            asceSettings: asceSettings,
            timestamp: Date.now()
          }
        }, () => {
          chrome.tabs.create({ url: asceUrl });
          if (showToast) showToast("🌪️ Đang mở ASCE Hazard Tool và tự động xử lý...");
        });
      } else {
        chrome.storage.local.set({
          pendingExtractorCommand: {
            url: asceUrl,
            portalKey: "asce",
            searchQuery: "",
            asceSettings: asceSettings,
            timestamp: Date.now()
          }
        }, () => {
          chrome.tabs.create({ url: asceUrl });
          if (showToast) showToast("🌪️ Đang mở ASCE Hazard Tool...");
        });
      }
    });
  }

  if (btnToggleFemaDetails && femaDetailsPanel) {
    btnToggleFemaDetails.addEventListener("click", (e) => {
      e.stopPropagation();
      const isHidden = femaDetailsPanel.classList.toggle("hidden");
      btnToggleFemaDetails.classList.toggle("open", !isHidden);
    });
  }

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

  // 3. Tab Switching: Main Tabs (Arch / Civil / Wood)
  function switchMainTab(btn, save = true) {
    if (!btn) return;
    mainNavTabs.forEach(t => {
      if (t.btn) t.btn.classList.remove("active");
      if (t.view) {
        t.view.classList.add("hidden");
        t.view.classList.remove("active");
      }
    });
    btn.classList.add("active");
    const activeItem = mainNavTabs.find(t => t.btn === btn);
    if (activeItem && activeItem.view) {
      activeItem.view.classList.remove("hidden");
      activeItem.view.classList.add("active");
    }
    if (save && btn.id) {
      chrome.storage.local.set({ lastActiveMainTab: btn.id });
      try { localStorage.setItem("lastActiveMainTab", btn.id); } catch (e) {}
    }
  }

  // 3b. Tab Switching: Arch Subtabs (Overview / Lot / Zoning / Setbacks / Capacity)
  function switchArchSubTab(btn, save = true) {
    if (!btn) return;
    archSubTabs.forEach(t => {
      if (t.btn) t.btn.classList.remove("active");
      if (t.view) {
        t.view.classList.add("hidden");
        t.view.classList.remove("active");
      }
    });
    btn.classList.add("active");
    const activeItem = archSubTabs.find(t => t.btn === btn);
    if (activeItem && activeItem.view) {
      activeItem.view.classList.remove("hidden");
      activeItem.view.classList.add("active");
    }
    if (save && btn.id) {
      chrome.storage.local.set({ lastActiveArchSubTab: btn.id });
      try { localStorage.setItem("lastActiveArchSubTab", btn.id); } catch (e) {}
    }
  }

  mainNavTabs.forEach(item => {
    if (item.btn) {
      item.btn.addEventListener("click", () => switchMainTab(item.btn));
    }
  });

  archSubTabs.forEach(item => {
    if (item.btn) {
      item.btn.addEventListener("click", () => switchArchSubTab(item.btn));
    }
  });

  // Khôi phục Tab đã mở trước đó
  try {
    const cachedMainTab = localStorage.getItem("lastActiveMainTab");
    if (cachedMainTab) switchMainTab(document.getElementById(cachedMainTab), false);
    const cachedSubTab = localStorage.getItem("lastActiveArchSubTab");
    if (cachedSubTab) switchArchSubTab(document.getElementById(cachedSubTab), false);
  } catch (e) {}

  chrome.storage.local.get(["lastActiveMainTab", "lastActiveArchSubTab", "lastActiveTab"], res => {
    if (res?.lastActiveMainTab) {
      switchMainTab(document.getElementById(res.lastActiveMainTab), false);
    } else if (res?.lastActiveTab) {
      if (res.lastActiveTab === "tab-civil" || res.lastActiveTab === "tab-wood") {
        switchMainTab(document.getElementById(res.lastActiveTab), false);
      } else {
        switchMainTab(document.getElementById("tab-arch"), false);
      }
    }

    if (res?.lastActiveArchSubTab) {
      switchArchSubTab(document.getElementById(res.lastActiveArchSubTab), false);
    } else if (res?.lastActiveTab && res.lastActiveTab.startsWith("tab-")) {
      const subId = res.lastActiveTab.replace("tab-", "subtab-");
      const targetSubBtn = document.getElementById(subId);
      if (targetSubBtn) switchArchSubTab(targetSubBtn, false);
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

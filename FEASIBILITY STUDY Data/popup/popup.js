/**
 * FEASIBILITY STUDY Data - Multi-Portal Navigation & Automated Pipeline Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  // Top Elements
  const statusPill = document.getElementById("status-pill");
  const statusLabel = document.getElementById("status-label");
  const activePanel = document.getElementById("active-panel");
  const btnClean = document.getElementById("btn-clean");
  const btnRefresh = document.getElementById("btn-refresh");
  const refreshIcon = document.getElementById("refresh-icon");
  const toast = document.getElementById("toast");

  // Address & Auto Pipeline Elements
  const inputAddress = document.getElementById("input-address");
  const btnClearAddress = document.getElementById("btn-clear-address");
  const btnAutoPipeline = document.getElementById("btn-auto-pipeline");
  const vDetectedCounty = document.getElementById("v-detected-county");
  const btnRecheckCounty = document.getElementById("btn-recheck-county");
  const togglePropZoneExtract = document.getElementById("toggle-propzone-extract");

  // Quick Portal Launcher Badges
  const btnNavFema = document.getElementById("btn-nav-fema");

  // Tabs
  const tabOverview = document.getElementById("tab-overview");
  const tabLot = document.getElementById("tab-lot");
  const tabZoning = document.getElementById("tab-zoning");
  const tabSetbacks = document.getElementById("tab-setbacks");
  const tabCapacity = document.getElementById("tab-capacity");
  const tabCivil = document.getElementById("tab-civil");

  // Views
  const viewOverview = document.getElementById("view-overview");
  const viewLot = document.getElementById("view-lot");
  const viewZoning = document.getElementById("view-zoning");
  const viewSetbacks = document.getElementById("view-setbacks");
  const viewCapacity = document.getElementById("view-capacity");
  const viewCivil = document.getElementById("view-civil");

  // Actions
  const btnCopyJson = document.getElementById("btn-copy-json");
  const btnDownloadMap = document.getElementById("btn-download-map");

  // OCGIS Map Links
  const btnLinkParcels = document.getElementById("btn-link-parcels");
  const btnLinkTract = document.getElementById("btn-link-tract");

  // VPN Modal Elements
  const vpnModal = document.getElementById("vpn-modal");
  const btnVpnRetry = document.getElementById("btn-vpn-retry");
  const btnVpnFallback = document.getElementById("btn-vpn-fallback");
  const btnVpnClose = document.getElementById("btn-vpn-close");

  let currentPayload = null;
  let toastTimer = null;
  let currentDetectedCounty = null;
  let storedApn = null;
  let lastVpnRetryParams = null;
  let lastVpnFallbackUrl = null;

  // --- Kiểm tra & Hiển thị Thông Báo Cập Nhật ---
  const updateBanner = document.getElementById("fs-update-banner");
  const updateText = document.getElementById("fs-update-text");
  const btnCopyInstaller = document.getElementById("fs-btn-copy-installer");

  // --- Nút Tải lại Extension chủ động (Reload) ---
  const btnReloadExt = document.getElementById("btn-reload-ext");
  const btnReloadNow = document.getElementById("fs-btn-reload-now");

  function triggerProactiveReload() {
    showToast("🔄 Đang tải lại Extension...");
    try {
      chrome.runtime.sendMessage({ action: "RELOAD_EXTENSION" });
    } catch (e) { }
    setTimeout(() => {
      try {
        if (chrome.runtime && chrome.runtime.reload) {
          chrome.runtime.reload();
        }
      } catch (e) { }
    }, 150);
  }

  if (btnReloadExt) {
    btnReloadExt.onclick = triggerProactiveReload;
  }
  if (btnReloadNow) {
    btnReloadNow.onclick = triggerProactiveReload;
  }

  function checkAndDisplayUpdate() {
    chrome.storage.local.get("fs_update_info", (result) => {
      const info = result.fs_update_info;
      if (info && info.hasUpdate && updateBanner) {
        updateBanner.style.display = "flex";
        if (updateText) {
          updateText.textContent = `Đã có bản mới v${info.serverVersion}!`;
        }
        if (btnCopyInstaller) {
          btnCopyInstaller.onclick = () => {
            const path = info.installerPath || "\\\\192.168.11.250\\Sharing\\THAILE\\Tools\\Extensions\\FS.exe";
            // 1. Copy đường dẫn vào Clipboard làm phương án dự phòng
            navigator.clipboard.writeText(path).catch(() => { });

            // 2. Cập nhật giao diện nút bấm để người dùng thấy rõ tiến trình
            btnCopyInstaller.disabled = true;
            btnCopyInstaller.textContent = "⏳ Đang chạy...";

            // 3. Gửi lệnh xuống Background Service Worker để chạy cài đặt ngầm và tự động Reload
            chrome.runtime.sendMessage({
              action: "TRIGGER_SILENT_UPDATE_AND_RELOAD",
              targetVersion: info.serverVersion || ""
            });

            showToast("⚡ Đang cài đặt ngầm & tự động tải lại Extension...");
          };
        }
      } else if (updateBanner) {
        updateBanner.style.display = "none";
      }
    });
  }

  checkAndDisplayUpdate();
  // Kích hoạt kiểm tra phiên bản mới từ background service worker khi mở popup
  try {
    chrome.runtime.sendMessage({ action: "MANUAL_CHECK_UPDATE" }, (res) => {
      if (!chrome.runtime.lastError) {
        checkAndDisplayUpdate();
      }
    });
  } catch (e) {
    // Service worker có thể đang bận
  }

  // Hiển thị phiên bản đang sử dụng từ manifest.json
  try {
    const brandVersionEl = document.getElementById("brand-version");
    const currentManifestVersion = chrome.runtime?.getManifest?.()?.version;
    if (brandVersionEl && currentManifestVersion) {
      brandVersionEl.textContent = `v${currentManifestVersion}`;
    }
  } catch (err) {
    // Không đọc được version
  }

  // Deep merge utility to retain session data across multiple page scans
  function mergeDeep(target, source) {
    if (!source) return target;
    if (!target) return JSON.parse(JSON.stringify(source));

    const output = Object.assign({}, target);
    Object.keys(source).forEach(key => {
      const srcVal = source[key];
      const tgtVal = target[key];
      if (srcVal !== null && srcVal !== undefined && srcVal !== "" && srcVal !== "-") {
        if (typeof srcVal === "object" && !Array.isArray(srcVal)) {
          output[key] = mergeDeep(tgtVal || {}, srcVal);
        } else {
          output[key] = srcVal;
        }
      }
    });
    return output;
  }

  // Reset/Clean session data explicitly on Clean button click or when starting a new Fetch
  function resetSessionData(keepAddress = false) {
    if (!keepAddress) {
      chrome.storage.local.remove(["lastSearchQuery", "lastPipelineResult", "lastApn", "ocgisMapLinks", "activePipelineSession"]);
      inputAddress.value = "";
      btnClearAddress.classList.add("hidden");
      if (vDetectedCounty) vDetectedCounty.textContent = "-";
      statusLabel.textContent = "Ready";
      statusPill.className = "status-pill pending";
      currentDetectedCounty = null;
    } else {
      chrome.storage.local.remove(["lastPipelineResult", "lastApn", "ocgisMapLinks", "activePipelineSession"]);
    }

    currentPayload = null;
    storedApn = null;

    const allFieldIds = [
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
      "v-cv-flood", "v-cv-water", "v-cv-sewer", "v-cv-drainage", "v-cv-slope", "v-cv-fire", "v-cv-notes"
    ];

    allFieldIds.forEach(id => {
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

    updateMapButtonState("");

    if (!keepAddress) {
      showToast("Session data cleaned!");
    }
  }

  if (btnClean) {
    btnClean.addEventListener("click", () => resetSessionData(false));
  }

  // 1. Tab Switching Setup
  const navTabs = [
    { btn: tabOverview, view: viewOverview },
    { btn: tabLot, view: viewLot },
    { btn: tabZoning, view: viewZoning },
    { btn: tabSetbacks, view: viewSetbacks },
    { btn: tabCapacity, view: viewCapacity },
    { btn: tabCivil, view: viewCivil }
  ];

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

  // Danh sách các Quận đã hỗ trợ công cụ Parcels / Plat Map
  const SUPPORTED_MAP_COUNTIES = ["orange", "losAngeles", "riverside", "sanBernardino"];

  // Quản lý trạng thái nút Get Parcels / Plat Map
  function updateMapButtonState(addr) {
    if (!btnDownloadMap) return;
    const query = addr !== undefined ? addr : (inputAddress ? inputAddress.value.trim() : "");
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
  }

  // 2. Real-time County Detection on Address Input
  function updateCountyBadge(addr) {
    if (!addr) {
      if (vDetectedCounty) {
        vDetectedCounty.textContent = "Chưa nhập địa chỉ";
        vDetectedCounty.classList.add("county-warn");
        vDetectedCounty.title = "Vui lòng nhập địa chỉ";
      }
      currentDetectedCounty = null;
      updateMapButtonState("");
      return;
    }

    if (window.CountyDetector) {
      currentDetectedCounty = window.CountyDetector.detect(addr);
      if (vDetectedCounty) {
        if (currentDetectedCounty.isStreetOnly) {
          vDetectedCounty.textContent = "KHÔNG XÁC ĐỊNH (⚠️ Thiếu City/Zip)";
          vDetectedCounty.title = "Địa chỉ chỉ có tên đường, thiếu Thành phố / Zipcode! Thêm ví dụ: ', Santa Ana' hoặc '92701'";
          vDetectedCounty.classList.add("county-warn");
        } else if (currentDetectedCounty.isUnknown) {
          vDetectedCounty.textContent = "KHÔNG XÁC ĐỊNH (CA)";
          vDetectedCounty.title = "Không tìm thấy Quận/Thành phố trong cơ sở dữ liệu 483 thành phố CA";
          vDetectedCounty.classList.add("county-warn");
        } else {
          vDetectedCounty.textContent = `${currentDetectedCounty.name} (CA)`;
          vDetectedCounty.title = currentDetectedCounty.matchedCity ? `Thành phố: ${currentDetectedCounty.matchedCity.toUpperCase()}` : "";
          vDetectedCounty.classList.remove("county-warn");
        }
      }
      updateMapButtonState(addr);
    }
  }

  if (btnRecheckCounty) {
    btnRecheckCounty.addEventListener("click", async () => {
      btnRecheckCounty.classList.add("spinning");
      let query = inputAddress ? inputAddress.value.trim() : "";

      if (!query || (window.CountyDetector && window.CountyDetector.detect(query).isStreetOnly)) {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab && tab.title) {
            const rawTitle = tab.title.split("|")[0].split("-")[0].trim();
            if (rawTitle && rawTitle.length > 3 && rawTitle.includes(",")) {
              query = rawTitle;
              if (inputAddress) {
                inputAddress.value = query;
                if (btnClearAddress) btnClearAddress.classList.remove("hidden");
              }
            }
          }
        } catch (e) {
          console.warn("Could not inspect active tab title", e);
        }
      }

      updateCountyBadge(query);

      setTimeout(() => {
        btnRecheckCounty.classList.remove("spinning");
        if (currentDetectedCounty?.isStreetOnly) {
          showToast("⚠️ KHÔNG XÁC ĐỊNH: Thiếu City/Zip! Thêm ví dụ: ', Santa Ana'");
        } else if (currentDetectedCounty?.isUnknown) {
          showToast("⚠️ KHÔNG XÁC ĐỊNH: Không tìm thấy Quận trong 483 thành phố CA");
        } else {
          const cityInfo = currentDetectedCounty?.matchedCity 
            ? ` [${currentDetectedCounty.matchedCity.toUpperCase()}]` 
            : "";
          showToast(`📍 County: ${currentDetectedCounty?.name || "Orange County"}${cityInfo}`);
        }
      }, 350);
    });
  }

  // Load Stored Address & Pipeline Result
  function loadStoredData() {
    chrome.storage.local.get(["lastSearchQuery", "lastPipelineResult", "lastApn", "ocgisMapLinks", "allowPropZoneExtract"], (res) => {
      if (togglePropZoneExtract) {
        togglePropZoneExtract.checked = (res.allowPropZoneExtract !== false);
      }
      if (res.lastSearchQuery && !inputAddress.value) {
        inputAddress.value = res.lastSearchQuery;
        btnClearAddress.classList.remove("hidden");
        updateCountyBadge(res.lastSearchQuery);
      } else {
        updateMapButtonState(inputAddress.value.trim());
      }
      if (res.lastApn) {
        storedApn = res.lastApn;
        setText("v-ov-apn", res.lastApn);
        setText("v-lot-parcelId", res.lastApn);
        statusLabel.textContent = `APN: ${res.lastApn}`;
        statusPill.className = "status-pill active";
      }
      if (res.lastPipelineResult) {
        applyPipelineResult(res.lastPipelineResult);
      }
      if (res.ocgisMapLinks) {
        updateMapLinksUI(res.ocgisMapLinks);
      }
    });
  }

  function applyPipelineResult(p) {
    if (!p) return;
    currentPayload = mergeDeep(currentPayload || {}, p);
    storedApn = p.apn || (p.lot && p.lot.parcelId) || (currentPayload.lot && currentPayload.lot.parcelId) || storedApn || null;

    if (storedApn) {
      setText("v-ov-apn", storedApn);
      setText("v-lot-parcelId", storedApn);
      statusLabel.textContent = `APN: ${storedApn}`;
      statusPill.className = "status-pill active";
    }

    const extractedAddress = p.address || (p.lot && (p.lot.projectAddress || p.lot.address || p.lot.situsAddress)) || (currentPayload && currentPayload.address) || (currentPayload && currentPayload.lot && currentPayload.lot.projectAddress);
    // Chỉ cập nhật ô input nếu ô input hiện tại đang trống (không tự động ghi đè khi người dùng đang nhập)
    if (extractedAddress && !inputAddress.value.trim()) {
      inputAddress.value = extractedAddress;
      btnClearAddress.classList.remove("hidden");
      updateCountyBadge(extractedAddress);
    }

    renderDashboard(currentPayload);
  }

  // Lắng nghe Storage thay đổi theo thời gian thực (Real-Time Auto Update)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes.allowPropZoneExtract && togglePropZoneExtract) {
        togglePropZoneExtract.checked = (changes.allowPropZoneExtract.newValue !== false);
      }
      if (changes.lastSearchQuery && changes.lastSearchQuery.newValue) {
        const addrVal = changes.lastSearchQuery.newValue;
        if (!inputAddress.value.trim()) {
          inputAddress.value = addrVal;
          btnClearAddress.classList.remove("hidden");
          updateCountyBadge(addrVal);
        }
      }
      if (changes.lastApn && changes.lastApn.newValue) {
        const apnVal = changes.lastApn.newValue;
        storedApn = apnVal;
        setText("v-ov-apn", apnVal);
        setText("v-lot-parcelId", apnVal);
        statusLabel.textContent = `APN: ${apnVal}`;
        statusPill.className = "status-pill active";
      }
      if (changes.lastPipelineResult && changes.lastPipelineResult.newValue) {
        const res = changes.lastPipelineResult.newValue;
        if (res.status === "FAILED_5_RETRIES") {
          statusLabel.textContent = "Failed (5 retries)";
          statusPill.className = "status-pill pending";
          showToast("PropZone Timeout after 5 retries!");
        } else {
          applyPipelineResult(res);
        }
      }
      if (changes.ocgisMapLinks && changes.ocgisMapLinks.newValue) {
        updateMapLinksUI(changes.ocgisMapLinks.newValue);
      }
    }
  });

  function updateMapLinksUI(linksData) {
    if (!linksData) return;

    const isDirect = linksData.source === "zimas" || linksData.source === "la-assessor";
    const parcelUrl = isDirect ? linksData.parcels : (linksData.tractMap || linksData.parcels);
    const tractUrl = isDirect ? linksData.tractMap : (linksData.parcels || linksData.tractMap);

    if (linksData.parcels && btnLinkParcels) {
      btnLinkParcels.classList.remove("disabled");
      btnLinkParcels.classList.add("active");
      btnLinkParcels.disabled = false;
      btnLinkParcels.onclick = () => chrome.tabs.create({ url: parcelUrl });
    }

    if (linksData.tractMap && btnLinkTract) {
      btnLinkTract.classList.remove("disabled");
      btnLinkTract.classList.add("active");
      btnLinkTract.disabled = false;
      btnLinkTract.onclick = () => chrome.tabs.create({ url: tractUrl });
    }
  }

  loadStoredData();

  // 3. Address Input Events
  inputAddress.addEventListener("input", () => {
    const val = inputAddress.value.trim();
    if (val) {
      btnClearAddress.classList.remove("hidden");
      chrome.storage.local.set({ lastSearchQuery: val });
      updateCountyBadge(val);
    } else {
      btnClearAddress.classList.add("hidden");
      updateCountyBadge("");
    }
  });

  inputAddress.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnAutoPipeline.click();
    }
  });

  btnClearAddress.addEventListener("click", () => {
    inputAddress.value = "";
    btnClearAddress.classList.add("hidden");
    updateCountyBadge("");
    inputAddress.focus();
  });

  // 4. Direct Google Search & Gridics PropZone Instant Launcher (Auto Fetch)
  btnAutoPipeline.addEventListener("click", () => {
    const address = inputAddress.value.trim();

    if (!address) {
      showToast("Please enter an address!");
      inputAddress.focus();
      return;
    }

    // Xoá toàn bộ data cũ giống Clean ngoại trừ ô nhập địa chỉ
    resetSessionData(true);

    const county = currentDetectedCounty || window.CountyDetector?.detect(address);
    updateCountyBadge(address);
    chrome.storage.local.set({ lastSearchQuery: address });

    // Kiểm tra nếu người dùng dán trực tiếp mã APN vào ô địa chỉ
    const isApn = /^[0-9\-\s]{6,16}$/.test(address) && /\d{6,}/.test(address.replace(/\D/g, ""));
    const cleanApn = isApn ? address.replace(/[^0-9]/g, "") : "";

    if (cleanApn) {
      storedApn = cleanApn;
      setText("v-ov-apn", cleanApn);
      setText("v-lot-parcelId", cleanApn);
      statusLabel.textContent = `Finding Address from APN: ${cleanApn}...`;
      statusPill.className = "status-pill active";
      showToast(`Searching Address for APN: ${cleanApn}...`);
    } else {
      if (county?.isStreetOnly) {
        showToast("⚠️ Đang tìm với địa chỉ thiếu City/Zip! Khuyên dùng: thêm ', City'");
      } else {
        showToast("Starting Pipeline: Property Overview → PropZone...");
      }
      statusLabel.textContent = "Finding Property Overview...";
      statusPill.className = "status-pill active";
    }

    // GỬI LỆNH ĐẾN BACKGROUND SERVICE WORKER KHỞI CHẠY QUY TRÌNH
    chrome.runtime.sendMessage({
      action: "START_AUTO_PIPELINE",
      address: address
    });
  });

  // 5. Multi-Portal Navigation Router
  function navigateToPortal(portalKey) {
    const query = inputAddress.value.trim();
    const county = currentDetectedCounty || window.CountyDetector?.detect(query);
    const apn = storedApn || currentPayload?.apn || currentPayload?.lot?.parcelId || "";
    let targetUrl = "";

    switch (portalKey) {
      case "google":
        targetUrl = query
          ? `https://www.google.com/search?q=${encodeURIComponent(query + " The Assessor's Parcel Number (APN)")}`
          : "https://www.google.com/";
        break;

      case "propzone":
        targetUrl = "https://propzone.gridics.com/state/us/ca";
        break;

      case "fema":
        targetUrl = "https://experience.arcgis.com/experience/9d22cdae8b7542b88e0d555a3eb92949/page/Main?org=hazards-FEMA";
        break;

      default:
        targetUrl = "https://propzone.gridics.com/state/us/ca";
        break;
    }

    if (targetUrl) {
      chrome.storage.local.set({
        pendingExtractorCommand: {
          url: targetUrl,
          portalKey: portalKey,
          timestamp: Date.now()
        }
      });
      chrome.tabs.create({ url: targetUrl });
    }
  }

  // Bind Navigation Buttons
  [
    { btn: btnNavFema, key: "fema" }
  ].forEach(item => {
    if (item.btn) item.btn.addEventListener("click", () => navigateToPortal(item.key));
  });

  // 6. Parcels / Plat Map Action (Isolated Multi-County & City Engine)
  btnDownloadMap.addEventListener("click", () => {
    const query = inputAddress ? inputAddress.value.trim() : "";
    if (!query) {
      showToast("⚠️ Vui lòng nhập địa chỉ trước khi mở bản đồ.");
      return;
    }

    const county = currentDetectedCounty || (window.CountyDetector ? window.CountyDetector.detect(query) : null);
    if (!county || county.isUnknown || county.isStreetOnly || county.countyKey === "unknown") {
      showToast("⚠️ Địa chỉ chưa xác định được Quận. Vui lòng thêm City hoặc Zipcode.");
      return;
    }

    const countyKey = county.countyKey;
    if (!SUPPORTED_MAP_COUNTIES.includes(countyKey)) {
      showToast(`⚠️ Chúng tôi chưa hỗ trợ Parcels / Plat Map cho ${county.name || "County này"}.`);
      return;
    }

    const apn = storedApn || currentPayload?.lot?.parcelId || query;
    const cityLabel = county?.matchedCity ? `, ${county.matchedCity.toUpperCase()}` : "";

    showToast(`Checking Parcels / Plat Map (${county?.name || "County"}${cityLabel})...`);

    chrome.runtime.sendMessage({
      action: "START_MAP_DOWNLOAD_PIPELINE",
      apn: apn,
      address: query,
      countyKey: countyKey
    }, (response) => {
      if (chrome.runtime.lastError) {
        showToast("Error starting map download.");
        return;
      }

      if (response && response.vpnRequired) {
        lastVpnRetryParams = { apn, address: query, countyKey };
        lastVpnFallbackUrl = response.fallbackUrl || response.portalUrl;
        if (vpnModal) vpnModal.classList.remove("hidden");
      } else if (response && response.success) {
        showToast(`Connecting Parcels / Plat Map Viewer...`);
      }
    });
  });

  // VPN Modal Event Listeners
  if (btnVpnRetry) {
    btnVpnRetry.addEventListener("click", () => {
      if (vpnModal) vpnModal.classList.add("hidden");
      showToast("Retrying connection with VPN...");
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

  if (togglePropZoneExtract) {
    togglePropZoneExtract.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      chrome.storage.local.set({ allowPropZoneExtract: isChecked });
      showToast(isChecked ? "PropZone Auto: ON" : "PropZone Auto: OFF");
    });
  }

  function showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.classList.remove("hidden");
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 2500);
  }

  /**
   * Fresh Console Execution On Demand (Always keeps Overview Dashboard visible)
   */
  async function triggerFreshConsoleExecution(isManual = false) {
    if (refreshIcon) refreshIcon.classList.add("spinning");

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || !activeTab.url) {
        if (refreshIcon) refreshIcon.classList.remove("spinning");
        statusLabel.textContent = "Ready";
        return;
      }

      const isPropZone = activeTab.url.includes("propzone.gridics.com");

      // Tự động quét khi mở popup: CHỈ CHO PHÉP TRÊN TRANG PROPZONE VÀ KHI TOGGLE ĐANG BẬT
      if (!isManual) {
        if (!isPropZone) {
          if (refreshIcon) refreshIcon.classList.remove("spinning");
          statusLabel.textContent = "Ready";
          return;
        }

        const res = await chrome.storage.local.get("allowPropZoneExtract");
        if (res.allowPropZoneExtract === false) {
          if (refreshIcon) refreshIcon.classList.remove("spinning");
          statusLabel.textContent = "PropZone: Manual";
          return;
        }
      }

      const isAllowed = window.PropZoneRules?.RuleMatcher.isAllowedSite(activeTab.url);
      const portalInfo = window.PropZoneRules?.RuleMatcher.getPortalInfo(activeTab.url);

      if (!isAllowed) {
        if (refreshIcon) refreshIcon.classList.remove("spinning");
        statusLabel.textContent = "Ready";
        return;
      }

      // Try sending message first; if content script is not yet active, inject gracefully
      chrome.tabs.sendMessage(activeTab.id, { action: "FORCE_FRESH_EXTRACT" }, async (response) => {
        if (chrome.runtime.lastError || !response) {
          try {
            const isPropZone = activeTab.url && activeTab.url.includes("propzone.gridics.com");
            const scriptFiles = ["content/floating-ui.js", "config/county-detector.js", "config/rules.js"];
            scriptFiles.push(isPropZone ? "content/propzone-map-extractor.js" : "content/extractor.js");

            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: scriptFiles
            });
            chrome.tabs.sendMessage(activeTab.id, { action: "FORCE_FRESH_EXTRACT" }, (res2) => {
              if (refreshIcon) refreshIcon.classList.remove("spinning");
              if (res2 && res2.success) {
                handleSuccess(res2, portalInfo ? portalInfo.name : "Online");
              } else {
                statusLabel.textContent = portalInfo ? portalInfo.name : "Ready";
              }
            });
          } catch (e) {
            if (refreshIcon) refreshIcon.classList.remove("spinning");
            statusLabel.textContent = portalInfo ? portalInfo.name : "Ready";
          }
        } else if (response.success) {
          handleSuccess(response, portalInfo ? portalInfo.name : "Online");
        } else {
          if (refreshIcon) refreshIcon.classList.remove("spinning");
          statusLabel.textContent = portalInfo ? portalInfo.name : "Ready";
        }
      });
    } catch (err) {
      if (refreshIcon) refreshIcon.classList.remove("spinning");
      statusLabel.textContent = "Ready";
    }
  }

  function handleSuccess(res, portalTitle) {
    if (refreshIcon) refreshIcon.classList.remove("spinning");
    if (res && res.data) {
      currentPayload = mergeDeep(currentPayload || {}, res.data);
      statusPill.className = "status-pill active";
      statusLabel.textContent = portalTitle || "Online";

      const lot = currentPayload.lot || {};
      const extractedAddress = currentPayload.address || lot.projectAddress || lot.address || lot.situsAddress;
      // BUG FIX: Chỉ cập nhật ô textbox nếu người dùng chưa nhập gì (để trống). Không tự ý sửa địa chỉ đã nhập.
      if (extractedAddress && !inputAddress.value.trim()) {
        inputAddress.value = extractedAddress;
        btnClearAddress.classList.remove("hidden");
        updateCountyBadge(extractedAddress);
        chrome.storage.local.set({ lastSearchQuery: extractedAddress });
      }

      const extractedApn = lot.parcelId || lot.parcelNumber || lot.apn || res.data.apn || storedApn;
      if (extractedApn) {
        storedApn = extractedApn;
        chrome.storage.local.set({ lastApn: extractedApn });
      }

      // Persist merged session state
      chrome.storage.local.set({ lastPipelineResult: currentPayload });

      renderDashboard(currentPayload);
    }
  }

  function renderDashboard(data) {
    const lot = data.lot || {};
    const zoning = data.zoning || {};
    const setbacks = data.setbacks || {};
    const capacity = data.capacity || {};

    // 1. Overview Tab
    const currentApn = lot.parcelId
      || lot.parcelIdApn
      || lot.parcelNumber
      || lot.parcelNumberApn
      || lot.apn
      || lot.apnNumber
      || lot.soApn
      || lot.folio
      || lot.folioNumber
      || data.apn
      || storedApn
      || "-";

    if (currentApn !== "-" && !storedApn) {
      storedApn = currentApn;
    }

    setText("v-ov-apn", currentApn);
    setText("v-lot-parcelId", currentApn);

    // Detect City / County info for fallback zoning metadata
    const currentAddr = data.address || lot.projectAddress || inputAddress.value || "";
    const detectedCityInfo = window.CountyDetector ? window.CountyDetector.detect(currentAddr) : null;

    const finalZoningDistrict = zoning.zoningDistrict ?? zoning.zoningDistricts ?? zoning.zoningCode ?? detectedCityInfo?.zoningDistrict ?? detectedCityInfo?.zoning ?? "-";
    const finalZoningDesc = zoning.zoneDescription ?? zoning.description ?? zoning.zoningDesc ?? detectedCityInfo?.zoningDesc ?? "-";
    const finalZoningCode = zoning.zoningCode ?? zoning.code ?? detectedCityInfo?.zoningCode ?? detectedCityInfo?.zoning ?? "-";
    const finalZoningUrl = zoning.zoningCodeUrl ?? zoning.codeUrl ?? zoning.zoningUrl ?? detectedCityInfo?.zoningCodeUrl ?? detectedCityInfo?.officialUrl ?? null;

    setText("v-ov-taxArea", formatSqFt(lot.lotAreaTaxRecord));
    setText("v-ov-bldgArea", formatSqFt(lot.existingBuildingArea));
    setText("v-ov-maxHeight", formatFt(capacity.maximumBuildingHeight));
    setText("v-ov-maxUnits", capacity.maximumResidentialUnitsAllowed ?? "-");
    setText("v-ov-zoning", finalZoningDistrict);
    setText("v-ov-yearBuilt", lot.yearBuilt);

    const lotTypeStr = `${lot.lotType ?? "-"} / ${lot.lotAreaAcres ? lot.lotAreaAcres + " ac" : "-"}`;
    setText("v-ov-typeAcres", lotTypeStr);

    const stVal = lot.stories ?? capacity.maximumHeightStories ?? "-";
    const pkVal = lot.parking ?? "-";
    const stPkStr = `${stVal !== "-" ? (stVal + " st") : "-"} / ${pkVal}`;
    setText("v-ov-storiesParking", stPkStr);

    const sbPrim = setbacks.minimumPrimaryFrontageSetback ?? setbacks.frontSetback ?? "-";
    const sbRear = setbacks.minimumRearSetback ?? setbacks.rearSetback ?? "-";
    setText("v-ov-setbacks", `${formatFt(sbPrim)} / ${formatFt(sbRear)}`);
    setText("v-ov-maxBldgArea", formatSqFt(capacity.maximumBuildingArea));

    // 2. Lot Tab
    setText("v-lot-address", data.address || lot.projectAddress || lot.address || lot.situsAddress || inputAddress.value || "-");
    setText("v-lot-bldgArea", formatSqFt(lot.existingBuildingArea));
    setText("v-lot-bldgUse", lot.existingBuildingUse);
    setText("v-lot-stories", lot.stories ?? capacity.maximumHeightStories);
    setText("v-lot-parking", lot.parking);

    let garageAreaStr = "-";
    if (lot.garageArea) {
      garageAreaStr = `${Number(lot.garageArea).toLocaleString()} ft²${lot.garageDimension ? ` (${lot.garageDimension})` : ""}`;
    } else if (lot.parking) {
      const pInfo = parseGarageParking(lot.parking);
      if (pInfo.garageArea) {
        garageAreaStr = `${Number(pInfo.garageArea).toLocaleString()} ft²${pInfo.garageDimension ? ` (${pInfo.garageDimension})` : ""}`;
      }
    }
    setText("v-lot-garageArea", garageAreaStr);

    setText("v-lot-units", lot.existingLivingUnits);
    setText("v-lot-yearBuilt", lot.yearBuilt);
    setText("v-lot-neighborhood", lot.neighborhood);
    setText("v-lot-parcelId", currentApn);
    setText("v-lot-groupId", lot.groupId);
    setText("v-lot-taxRecord", formatSqFt(lot.lotAreaTaxRecord));
    setText("v-lot-parcelShape", formatSqFt(lot.lotAreaParcelShape));
    setText("v-lot-acres", lot.lotAreaAcres);
    setText("v-lot-type", lot.lotType);
    setText("v-lot-frontage", formatFt(lot.frontageLength));
    setText("v-lot-vacant", lot.vacant === false ? "No" : (lot.vacant === true ? "Yes" : "-"));
    setText("v-lot-legal", lot.legalDescription);

    // 3. Zoning Tab
    setText("v-zn-landUse", zoning.existingLandUse ?? zoning.landUse);

    const zCode = finalZoningCode;
    const zUrl = finalZoningUrl;
    const znCodeEl = document.getElementById("v-zn-code");
    if (znCodeEl) {
      if (zCode && zCode !== "-") {
        if (zUrl) {
          znCodeEl.innerHTML = `<a href="${zUrl}" target="_blank" style="color: var(--accent-cyan); text-decoration: underline; word-break: break-all;">${zCode} ↗</a>`;
        } else {
          znCodeEl.textContent = String(zCode);
          znCodeEl.style.color = "";
        }
      } else {
        znCodeEl.textContent = "-";
        znCodeEl.style.color = "#64748b";
      }
    }

    setText("v-zn-district", finalZoningDistrict);
    setText("v-zn-desc", finalZoningDesc);
    setText("v-zn-allowed", zoning.allowedUses ?? zoning.allowedUse ?? zoning.permittedUses);
    setText("v-zn-flood", zoning.femaFloodZone ?? zoning.floodZone ?? "N/A");

    // 4. Setbacks Tab
    setText("v-sb-primary", formatFt(setbacks.minimumPrimaryFrontageSetback ?? setbacks.frontSetback));
    setText("v-sb-secondary", formatFt(setbacks.minimumSecondaryFrontageSetback ?? setbacks.sideStreet));
    setText("v-sb-side", formatFt(setbacks.minimumSideSetback ?? setbacks.sideInterior));
    setText("v-sb-rear", formatFt(setbacks.minimumRearSetback ?? setbacks.rearSetback));
    setText("v-sb-water", setbacks.minimumWaterSetback ? formatFt(setbacks.minimumWaterSetback) : "N/A");

    // 5. Capacity Tab
    setText("v-cp-bldgArea", formatSqFt(capacity.maximumBuildingArea));
    setText("v-cp-stories", capacity.maximumHeightStories);
    setText("v-cp-height", formatFt(capacity.maximumBuildingHeight));
    setText("v-cp-far", capacity.floorAreaRatio);
    setText("v-cp-lotCov", capacity.maximumLotCoverage ?? "N/A");
    setText("v-cp-footprint", formatSqFt(capacity.maximumBuildingFootprint));
    setText("v-cp-openSpace", capacity.minimumOpenSpace ?? "N/A");
    setText("v-cp-resDensity", capacity.residentialDensity ?? "N/A");
    setText("v-cp-resArea", formatSqFt(capacity.maximumResidentialAreaAllowed));
    setText("v-cp-resUnits", capacity.maximumResidentialUnitsAllowed);
    setText("v-cp-lodgingDensity", capacity.lodgingDensity ?? "-");
    setText("v-cp-lodgingArea", formatSqFt(capacity.maximumLodgingAreaAllowed));
    setText("v-cp-officeArea", formatSqFt(capacity.maximumOfficeAreaAllowed));
    setText("v-cp-commArea", formatSqFt(capacity.maximumCommercialAreaAllowed));

    // 6. Civil Tab
    const civil = data.civil || {};
    setText("v-cv-flood", zoning.femaFloodZone ?? zoning.floodZone ?? civil.femaFloodZone ?? "N/A");
    setText("v-cv-water", civil.waterService ?? civil.water ?? "-");
    setText("v-cv-sewer", civil.sewerService ?? civil.sewer ?? "-");
    setText("v-cv-drainage", civil.stormDrainage ?? civil.drainage ?? "-");
    setText("v-cv-slope", civil.topography ?? civil.slope ?? "-");
    setText("v-cv-fire", civil.fireHazardSeverity ?? civil.fireZone ?? "-");
    setText("v-cv-notes", civil.notes ?? "Civil data will be updated here.");
  }

  function formatSqFt(val) {
    if (val === undefined || val === null || val === "" || val === "-") return "-";
    if (typeof val === "number") return `${val.toLocaleString()} ft²`;
    return String(val);
  }

  function formatFt(val) {
    if (val === undefined || val === null || val === "" || val === "-") return "-";
    if (typeof val === "number") return `${val} ft`;
    return String(val);
  }

  function setText(elementId, value) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (value === undefined || value === null || value === "" || value === "-") {
      el.textContent = "-";
      el.style.color = "#64748b";
    } else {
      el.textContent = String(value);
      el.style.color = "";
    }
  }

  function parseGarageParking(raw) {
    if (!raw || raw === "-" || /^(none|n\/a|0)$/i.test(String(raw).trim())) {
      return { garageSpaces: 0, drivewaySpaces: 0, garageArea: null, garageDimension: null, drivewayArea: null, totalParkingArea: null, formattedSummary: "-" };
    }
    const str = String(raw).trim();
    let garageSpaces = 0;
    let drivewaySpaces = 0;
    const isAttached = /attached/i.test(str);
    const isDetached = /detached/i.test(str);
    const isCarport = /carport/i.test(str);

    const garageMatch = str.match(/(\d+)\s*[-\s]?car\s*(?:attached|detached)?\s*(?:garage|covered)?/i)
      || str.match(/(\d+)\s*(?:garage|covered)\s*spaces?/i)
      || str.match(/garage(?:\s*spaces?)?[\s:\-–—]{1,5}(\d+)/i)
      || str.match(/garage[^\d]{0,15}(\d+)\s*chỗ/i);
    if (garageMatch && garageMatch[1]) {
      garageSpaces = parseInt(garageMatch[1], 10);
    } else if (/garage/i.test(str)) {
      garageSpaces = 2;
    }

    const driveMatch = str.match(/(\d+)\s*[-\s]?car\s*driveway/i)
      || str.match(/(\d+)\s*driveway\s*spaces?/i);
    if (driveMatch && driveMatch[1]) {
      drivewaySpaces = parseInt(driveMatch[1], 10);
    }

    if (garageSpaces === 0 && drivewaySpaces === 0) {
      const spMatch = str.match(/(\d+)\s*(?:spaces?|cars?|parking)/i);
      if (spMatch && spMatch[1]) garageSpaces = parseInt(spMatch[1], 10);
    }

    let garageArea = 0;
    let garageDimension = "";
    if (garageSpaces === 1) {
      garageArea = 240;
      garageDimension = "12×20 ft";
    } else if (garageSpaces === 2) {
      garageArea = 484;
      garageDimension = "22×22 ft";
    } else if (garageSpaces === 3) {
      garageArea = 704;
      garageDimension = "32×22 ft";
    } else if (garageSpaces >= 4) {
      garageArea = garageSpaces * 240;
      garageDimension = `${garageSpaces} × (12×20 ft)`;
    }

    const drivewayArea = drivewaySpaces * 240;
    const totalParkingArea = (garageArea || 0) + (drivewayArea || 0);
    return { garageSpaces, drivewaySpaces, garageArea: garageArea || null, garageDimension: garageDimension || null, drivewayArea: drivewayArea || null, totalParkingArea: totalParkingArea || null };
  }

  // Copy JSON Action
  btnCopyJson.addEventListener("click", async () => {
    if (!currentPayload) return;
    try {
      const jsonStr = JSON.stringify(currentPayload, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      showToast("JSON Copied to Clipboard!");
    } catch (e) {
      showToast("Clipboard Error");
    }
  });

  btnRefresh.addEventListener("click", () => triggerFreshConsoleExecution(true));

  triggerFreshConsoleExecution(false);
});

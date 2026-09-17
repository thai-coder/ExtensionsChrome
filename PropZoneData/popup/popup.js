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

  // Quick Portal Launcher Badges
  const btnNavGoogle = document.getElementById("btn-nav-google");
  const btnNavPropZone = document.getElementById("btn-nav-propzone");
  const btnNavAssessor = document.getElementById("btn-nav-assessor");
  const btnNavFema = document.getElementById("btn-nav-fema");

  // Tabs
  const tabOverview = document.getElementById("tab-overview");
  const tabLot = document.getElementById("tab-lot");
  const tabZoning = document.getElementById("tab-zoning");
  const tabSetbacks = document.getElementById("tab-setbacks");
  const tabCapacity = document.getElementById("tab-capacity");

  // Views
  const viewOverview = document.getElementById("view-overview");
  const viewLot = document.getElementById("view-lot");
  const viewZoning = document.getElementById("view-zoning");
  const viewSetbacks = document.getElementById("view-setbacks");
  const viewCapacity = document.getElementById("view-capacity");

  // Actions
  const btnCopyJson = document.getElementById("btn-copy-json");
  const btnDownloadMap = document.getElementById("btn-download-map");

  let currentPayload = null;
  let toastTimer = null;
  let currentDetectedCounty = null;
  let storedApn = null;

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

  // Reset/Clean session data explicitly on Clean button click
  function resetSessionData() {
    chrome.storage.local.remove(["lastSearchQuery", "lastPipelineResult", "lastApn"], () => {
      console.log("🧹 [Popup] Session data wiped.");
    });

    currentPayload = null;
    storedApn = null;
    currentDetectedCounty = null;

    inputAddress.value = "";
    btnClearAddress.classList.add("hidden");
    if (vDetectedCounty) vDetectedCounty.textContent = "-";

    statusLabel.textContent = "Ready";
    statusPill.className = "status-pill pending";

    const allFieldIds = [
      "v-ov-apn", "v-ov-taxArea", "v-ov-bldgArea", "v-ov-maxHeight", "v-ov-maxUnits",
      "v-ov-zoning", "v-ov-yearBuilt", "v-ov-typeAcres", "v-ov-setbacks", "v-ov-maxBldgArea",
      "v-lot-address", "v-lot-bldgArea", "v-lot-bldgUse", "v-lot-units", "v-lot-yearBuilt", "v-lot-neighborhood",
      "v-lot-parcelId", "v-lot-groupId", "v-lot-taxRecord", "v-lot-parcelShape", "v-lot-acres",
      "v-lot-type", "v-lot-frontage", "v-lot-vacant", "v-lot-legal",
      "v-zn-landUse", "v-zn-code", "v-zn-district", "v-zn-desc", "v-zn-allowed", "v-zn-flood",
      "v-sb-primary", "v-sb-secondary", "v-sb-side", "v-sb-rear", "v-sb-water",
      "v-cp-bldgArea", "v-cp-stories", "v-cp-height", "v-cp-far", "v-cp-lotCov",
      "v-cp-footprint", "v-cp-openSpace", "v-cp-resDensity", "v-cp-resArea", "v-cp-resUnits",
      "v-cp-lodgingDensity", "v-cp-lodgingArea", "v-cp-officeArea", "v-cp-commArea"
    ];

    allFieldIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = "-";
        el.style.color = "#64748b";
      }
    });

    showToast("Session data cleaned!");
  }

  if (btnClean) {
    btnClean.addEventListener("click", resetSessionData);
  }

  // 1. Tab Switching Setup
  const navTabs = [
    { btn: tabOverview, view: viewOverview },
    { btn: tabLot, view: viewLot },
    { btn: tabZoning, view: viewZoning },
    { btn: tabSetbacks, view: viewSetbacks },
    { btn: tabCapacity, view: viewCapacity }
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

  // 2. Real-time County Detection on Address Input
  function updateCountyBadge(addr) {
    if (window.CountyDetector) {
      currentDetectedCounty = window.CountyDetector.detect(addr);
      if (vDetectedCounty) {
        vDetectedCounty.textContent = `${currentDetectedCounty.name} (CA)`;
      }
    }
  }

  // Load Stored Address & Pipeline Result
  function loadStoredData() {
    chrome.storage.local.get(["lastSearchQuery", "lastPipelineResult", "lastApn"], (res) => {
      if (res.lastSearchQuery && !inputAddress.value) {
        inputAddress.value = res.lastSearchQuery;
        btnClearAddress.classList.remove("hidden");
        updateCountyBadge(res.lastSearchQuery);
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
    if (extractedAddress && (!inputAddress.value || inputAddress.value !== extractedAddress)) {
      inputAddress.value = extractedAddress;
      btnClearAddress.classList.remove("hidden");
      updateCountyBadge(extractedAddress);
    }

    renderDashboard(currentPayload);
  }

  // Lắng nghe Storage thay đổi theo thời gian thực (Real-Time Auto Update)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes.lastSearchQuery && changes.lastSearchQuery.newValue) {
        const addrVal = changes.lastSearchQuery.newValue;
        if (!inputAddress.value || inputAddress.value !== addrVal) {
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
        console.log("⚡ [Popup] Real-time storage update received:", changes.lastPipelineResult.newValue);
        const res = changes.lastPipelineResult.newValue;
        if (res.status === "FAILED_5_RETRIES") {
          statusLabel.textContent = "Failed (5 retries)";
          statusPill.className = "status-pill pending";
          showToast("PropZone Timeout after 5 retries!");
        } else {
          applyPipelineResult(res);
        }
      }
    }
  });

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

    const county = currentDetectedCounty || window.CountyDetector?.detect(address);
    updateCountyBadge(address);
    chrome.storage.local.set({ lastSearchQuery: address });

    // Kiểm tra nếu người dùng dán trực tiếp mã APN vào ô địa chỉ
    const isApn = /^[0-9-]{6,15}$/.test(address.replace(/\s/g, ""));
    const cleanApn = isApn ? address.replace(/[^0-9]/g, "") : "";

    if (cleanApn) {
      storedApn = cleanApn;
      setText("v-ov-apn", cleanApn);
      setText("v-lot-parcelId", cleanApn);
      statusLabel.textContent = `APN: ${cleanApn}`;
      statusPill.className = "status-pill active";
      showToast(`Opening PropZone for APN: ${cleanApn}`);
      
      const propZoneUrl = window.CountyDetector?.getPropZoneUrl(address, cleanApn) || `https://propzone.gridics.com/`;
      chrome.tabs.create({ url: propZoneUrl });
      return;
    }

    // MỞ TAB GOOGLE SEARCH TÌM APN VÀ TỰ ĐỘNG CHUYỂN TỚI PROPZONE
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(address + " The Assessor's Parcel Number (APN)")}`;
    showToast("Searching Google for APN...");
    chrome.tabs.create({ url: googleSearchUrl, active: true });

    // Lưu trạng thái
    chrome.storage.local.set({
      lastPipelineResult: {
        address: address,
        county: county?.name || "California",
        countyKey: county?.countyKey || "other",
        updatedAt: new Date().toISOString()
      }
    });

    statusLabel.textContent = county?.name || "Searching...";
    statusPill.className = "status-pill active";
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
        targetUrl = window.CountyDetector?.getPropZoneUrl(query, apn) || "https://propzone.gridics.com/";
        break;

      case "assessor": {
        const cleanApn = apn.replace(/[^0-9]/g, "");
        if (county?.countyKey === "orange") {
          targetUrl = county.getParcelMapUrl(cleanApn);
        } else if (county?.countyKey === "losAngeles") {
          targetUrl = cleanApn ? county.getParcelMapUrl(cleanApn) : county.assessorUrl;
        } else {
          targetUrl = county?.assessorUrl || "https://portal.assessor.lacounty.gov/";
        }
        break;
      }

      case "fema":
        targetUrl = "https://experience.arcgis.com/experience/9d22cdae8b7542b88e0d555a3eb92949/page/Main?org=hazards-FEMA";
        break;

      default:
        targetUrl = "https://propzone.gridics.com/";
        break;
    }

    if (targetUrl) {
      chrome.tabs.create({ url: targetUrl });
    }
  }

  // Bind Navigation Buttons
  [
    { btn: btnNavGoogle, key: "google" },
    { btn: btnNavPropZone, key: "propzone" },
    { btn: btnNavAssessor, key: "assessor" },
    { btn: btnNavFema, key: "fema" }
  ].forEach(item => {
    if (item.btn) item.btn.addEventListener("click", () => navigateToPortal(item.key));
  });

  // 6. Download Parcel Map Action
  btnDownloadMap.addEventListener("click", () => {
    const apn = storedApn || currentPayload?.lot?.parcelId || inputAddress.value.trim();
    const query = inputAddress.value.trim();
    const county = currentDetectedCounty || window.CountyDetector?.detect(query);

    showToast("Opening Official Parcel Map...");
    chrome.runtime.sendMessage({
      action: "DOWNLOAD_PARCEL_MAP",
      apn: apn,
      address: query,
      countyKey: county?.countyKey
    });
  });

  function showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.classList.remove("hidden");
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 2500);
  }

  /**
   * Fresh Console Execution On Demand (Always keeps Overview Dashboard visible)
   */
  async function triggerFreshConsoleExecution() {
    if (refreshIcon) refreshIcon.classList.add("spinning");

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || !activeTab.url) {
        if (refreshIcon) refreshIcon.classList.remove("spinning");
        statusLabel.textContent = "Ready";
        return;
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
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ["config/county-detector.js", "config/rules.js", "content/extractor.js"]
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
      if (extractedAddress && (!inputAddress.value || inputAddress.value !== extractedAddress)) {
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

    setText("v-ov-taxArea", formatSqFt(lot.lotAreaTaxRecord));
    setText("v-ov-bldgArea", formatSqFt(lot.existingBuildingArea));
    setText("v-ov-maxHeight", formatFt(capacity.maximumBuildingHeight));
    setText("v-ov-maxUnits", capacity.maximumResidentialUnitsAllowed ?? "-");
    setText("v-ov-zoning", zoning.zoningDistrict ?? zoning.zoningDistricts ?? zoning.zoningCode ?? "-");
    setText("v-ov-yearBuilt", lot.yearBuilt);
    
    const lotTypeStr = `${lot.lotType ?? "-"} / ${lot.lotAreaAcres ? lot.lotAreaAcres + " ac" : "-"}`;
    setText("v-ov-typeAcres", lotTypeStr);

    const sbPrim = setbacks.minimumPrimaryFrontageSetback ?? setbacks.frontSetback ?? "-";
    const sbRear = setbacks.minimumRearSetback ?? setbacks.rearSetback ?? "-";
    setText("v-ov-setbacks", `${formatFt(sbPrim)} / ${formatFt(sbRear)}`);
    setText("v-ov-maxBldgArea", formatSqFt(capacity.maximumBuildingArea));

    // 2. Lot Tab
    setText("v-lot-address", data.address || lot.projectAddress || lot.address || lot.situsAddress || inputAddress.value || "-");
    setText("v-lot-bldgArea", formatSqFt(lot.existingBuildingArea));
    setText("v-lot-bldgUse", lot.existingBuildingUse);
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
    setText("v-zn-code", zoning.zoningCode ?? zoning.code);
    setText("v-zn-district", zoning.zoningDistrict ?? zoning.zoningDistricts ?? zoning.district);
    setText("v-zn-desc", zoning.zoneDescription ?? zoning.description);
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

  btnRefresh.addEventListener("click", triggerFreshConsoleExecution);

  triggerFreshConsoleExecution();
});

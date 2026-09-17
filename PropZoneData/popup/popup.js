/**
 * PropZoneData - English Executive Dashboard Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const statusPill = document.getElementById("status-pill");
  const statusLabel = document.getElementById("status-label");
  const activePanel = document.getElementById("active-panel");
  const blockedPanel = document.getElementById("blocked-panel");

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
  const btnRefresh = document.getElementById("btn-refresh");
  const refreshIcon = document.getElementById("refresh-icon");
  const btnOpenPropZone = document.getElementById("btn-open-propzone");
  const toast = document.getElementById("toast");

  let currentPayload = null;
  let toastTimer = null;

  // Tab Switching Setup (No JSON tab)
  const navTabs = [
    { btn: tabOverview, view: viewOverview },
    { btn: tabLot, view: viewLot },
    { btn: tabZoning, view: viewZoning },
    { btn: tabSetbacks, view: viewSetbacks },
    { btn: tabCapacity, view: viewCapacity }
  ];

  navTabs.forEach(item => {
    item.btn.addEventListener("click", () => {
      navTabs.forEach(t => {
        t.btn.classList.remove("active");
        t.view.classList.add("hidden");
        t.view.classList.remove("active");
      });
      item.btn.classList.add("active");
      item.view.classList.remove("hidden");
      item.view.classList.add("active");
    });
  });

  function showToast(msg) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.classList.remove("hidden");
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 2000);
  }

  if (btnOpenPropZone) {
    btnOpenPropZone.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://propzone.gridics.com/" });
    });
  }

  /**
   * Fresh Console Execution On Demand
   */
  async function triggerFreshConsoleExecution() {
    if (refreshIcon) refreshIcon.classList.add("spinning");
    statusPill.className = "status-pill pending";
    statusLabel.textContent = "Scanning...";
    activePanel.classList.add("hidden");
    blockedPanel.classList.add("hidden");

    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || !activeTab.url) {
        setBlockedState();
        return;
      }

      const isAllowed = window.PropZoneRules?.RuleMatcher.isAllowedSite(activeTab.url);
      if (!isAllowed) {
        setBlockedState();
        return;
      }

      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ["config/rules.js", "content/extractor.js"]
      });

      chrome.tabs.sendMessage(activeTab.id, { action: "FORCE_FRESH_EXTRACT" }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          setBlockedState();
        } else {
          handleSuccess(response);
        }
      });
    } catch (err) {
      setBlockedState();
    }
  }

  function handleSuccess(res) {
    if (refreshIcon) refreshIcon.classList.remove("spinning");
    if (res && res.data) {
      currentPayload = res.data;
      statusPill.className = "status-pill active";
      statusLabel.textContent = "Online";
      activePanel.classList.remove("hidden");
      blockedPanel.classList.add("hidden");

      renderDashboard(res.data);
    }
  }

  function renderDashboard(data) {
    const lot = data.lot || {};
    const zoning = data.zoning || {};
    const setbacks = data.setbacks || {};
    const capacity = data.capacity || {};

    // 1. Overview Tab
    setText("v-ov-taxArea", formatSqFt(lot.lotAreaTaxRecord));
    setText("v-ov-bldgArea", formatSqFt(lot.existingBuildingArea));
    setText("v-ov-maxHeight", formatFt(capacity.maximumBuildingHeight));
    setText("v-ov-maxUnits", capacity.maximumResidentialUnitsAllowed ?? "-");
    setText("v-ov-yearBuilt", lot.yearBuilt);
    
    const lotTypeStr = `${lot.lotType ?? "-"} / ${lot.lotAreaAcres ? lot.lotAreaAcres + " ac" : "-"}`;
    setText("v-ov-typeAcres", lotTypeStr);

    const sbPrim = setbacks.minimumPrimaryFrontageSetback ?? setbacks.frontSetback ?? "-";
    const sbRear = setbacks.minimumRearSetback ?? setbacks.rearSetback ?? "-";
    setText("v-ov-setbacks", `${formatFt(sbPrim)} / ${formatFt(sbRear)}`);
    setText("v-ov-maxBldgArea", formatSqFt(capacity.maximumBuildingArea));

    // 3. Lot Tab
    setText("v-lot-bldgArea", formatSqFt(lot.existingBuildingArea));
    setText("v-lot-bldgUse", lot.existingBuildingUse);
    setText("v-lot-units", lot.existingLivingUnits);
    setText("v-lot-yearBuilt", lot.yearBuilt);
    setText("v-lot-neighborhood", lot.neighborhood);
    setText("v-lot-parcelId", lot.parcelId);
    setText("v-lot-groupId", lot.groupId);
    setText("v-lot-taxRecord", formatSqFt(lot.lotAreaTaxRecord));
    setText("v-lot-parcelShape", formatSqFt(lot.lotAreaParcelShape));
    setText("v-lot-acres", lot.lotAreaAcres);
    setText("v-lot-type", lot.lotType);
    setText("v-lot-frontage", formatFt(lot.frontageLength));
    setText("v-lot-vacant", lot.vacant === false ? "No" : (lot.vacant === true ? "Yes" : "-"));
    setText("v-lot-legal", lot.legalDescription);

    // 4. Zoning Tab
    setText("v-zn-landUse", zoning.existingLandUse ?? zoning.landUse);
    setText("v-zn-code", zoning.zoningCode ?? zoning.code);
    setText("v-zn-district", zoning.zoningDistrict ?? zoning.zoningDistricts ?? zoning.zoningDistrictS ?? zoning.district);
    setText("v-zn-desc", zoning.zoneDescription ?? zoning.description);
    setText("v-zn-allowed", zoning.allowedUses ?? zoning.allowedUse ?? zoning.allowedUseS ?? zoning.permittedUses);
    setText("v-zn-flood", zoning.femaFloodZone ?? zoning.floodZone ?? "N/A");

    // 5. Setbacks Tab
    setText("v-sb-primary", formatFt(setbacks.minimumPrimaryFrontageSetback ?? setbacks.frontSetback));
    setText("v-sb-secondary", formatFt(setbacks.minimumSecondaryFrontageSetback ?? setbacks.sideStreet));
    setText("v-sb-side", formatFt(setbacks.minimumSideSetback ?? setbacks.sideInterior));
    setText("v-sb-rear", formatFt(setbacks.minimumRearSetback ?? setbacks.rearSetback));
    setText("v-sb-water", setbacks.minimumWaterSetback ? formatFt(setbacks.minimumWaterSetback) : "N/A");

    // 6. Capacity Tab
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

  function setBlockedState() {
    if (refreshIcon) refreshIcon.classList.remove("spinning");
    statusPill.className = "status-pill blocked";
    statusLabel.textContent = "Blocked";
    activePanel.classList.add("hidden");
    blockedPanel.classList.remove("hidden");
  }

  // Copy Action
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

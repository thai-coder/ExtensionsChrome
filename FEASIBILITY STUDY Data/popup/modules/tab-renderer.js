/**
 * FEASIBILITY STUDY Data - Tab Renderer Module
 * Quản lý logic đổ dữ liệu vào giao diện của 6 Tab (Overview, Lot, Zoning, Setbacks, Capacity, Civil).
 */

(function () {
  const { setText, formatSqFt, formatFt, parseGarageParking, showToast } = window.FsUiHelpers || {};

  const FsTabRenderer = {
    /**
     * Render toàn bộ Dashboard khi có dữ liệu mới
     */
    renderDashboard(data, context = {}) {
      if (!data) return;

      const { storedApn, inputAddress, btnGetSoil } = context;
      const lot = data.lot || {};
      const zoning = data.zoning || {};
      const setbacks = data.setbacks || {};
      const capacity = data.capacity || {};

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

      const currentAddr = data.address || lot.projectAddress || (inputAddress ? inputAddress.value : "") || "";

      this.renderOverviewTab(lot, zoning, capacity, setbacks, currentApn, currentAddr);
      this.renderLotTab(lot, capacity, currentApn, currentAddr);
      this.renderZoningTab(zoning, currentAddr);
      this.renderSetbacksTab(setbacks);
      this.renderCapacityTab(capacity);
      this.renderCivilTab(data, zoning, btnGetSoil);
    },

    /**
     * 1. Tab Overview
     */
    renderOverviewTab(lot, zoning, capacity, setbacks, currentApn, currentAddr) {
      const detectedCityInfo = window.CountyDetector ? window.CountyDetector.detect(currentAddr) : null;
      const finalZoningDistrict = zoning.zoningDistrict ?? zoning.zoningDistricts ?? zoning.zoningCode ?? detectedCityInfo?.zoningDistrict ?? detectedCityInfo?.zoning ?? "-";

      setText("v-ov-apn", currentApn);
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
    },

    /**
     * 2. Tab Lot
     */
    renderLotTab(lot, capacity, currentApn, currentAddr) {
      setText("v-lot-address", currentAddr || "-");
      setText("v-lot-bldgArea", formatSqFt(lot.existingBuildingArea));
      setText("v-lot-bldgUse", lot.existingBuildingUse);
      setText("v-lot-stories", lot.stories ?? capacity.maximumHeightStories);
      setText("v-lot-parking", lot.parking);

      let garageAreaStr = "-";
      if (lot.garageArea) {
        garageAreaStr = `${Number(lot.garageArea).toLocaleString()} ft²${lot.garageDimension ? ` (${lot.garageDimension})` : ""}`;
      } else if (lot.parking && parseGarageParking) {
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
    },

    /**
     * 3. Tab Zoning
     */
    renderZoningTab(zoning, currentAddr) {
      const detectedCityInfo = window.CountyDetector ? window.CountyDetector.detect(currentAddr) : null;
      const finalZoningDistrict = zoning.zoningDistrict ?? zoning.zoningDistricts ?? zoning.zoningCode ?? detectedCityInfo?.zoningDistrict ?? detectedCityInfo?.zoning ?? "-";
      const finalZoningDesc = zoning.zoneDescription ?? zoning.description ?? zoning.zoningDesc ?? detectedCityInfo?.zoningDesc ?? "-";
      const finalZoningCode = zoning.zoningCode ?? zoning.code ?? detectedCityInfo?.zoningCode ?? detectedCityInfo?.zoning ?? "-";
      const finalZoningUrl = zoning.zoningCodeUrl ?? zoning.codeUrl ?? zoning.zoningUrl ?? detectedCityInfo?.zoningCodeUrl ?? detectedCityInfo?.officialUrl ?? null;

      setText("v-zn-landUse", zoning.existingLandUse ?? zoning.landUse);

      const znCodeEl = document.getElementById("v-zn-code");
      if (znCodeEl) {
        if (finalZoningCode && finalZoningCode !== "-") {
          if (finalZoningUrl) {
            znCodeEl.innerHTML = `<a href="${finalZoningUrl}" target="_blank" style="color: var(--accent-cyan); text-decoration: underline; word-break: break-all;">${finalZoningCode} ↗</a>`;
          } else {
            znCodeEl.textContent = String(finalZoningCode);
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
    },

    /**
     * 4. Tab Setbacks
     */
    renderSetbacksTab(setbacks) {
      setText("v-sb-primary", formatFt(setbacks.minimumPrimaryFrontageSetback ?? setbacks.frontSetback));
      setText("v-sb-secondary", formatFt(setbacks.minimumSecondaryFrontageSetback ?? setbacks.sideStreet));
      setText("v-sb-side", formatFt(setbacks.minimumSideSetback ?? setbacks.sideInterior));
      setText("v-sb-rear", formatFt(setbacks.minimumRearSetback ?? setbacks.rearSetback));
      setText("v-sb-water", setbacks.minimumWaterSetback ? formatFt(setbacks.minimumWaterSetback) : "N/A");
    },

    /**
     * 5. Tab Capacity
     */
    renderCapacityTab(capacity) {
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
    },

    /**
     * 6. Tab Civil
     */
    renderCivilTab(data, zoning, btnGetSoil) {
      const civil = data.civil || {};
      const floodVal = zoning.femaFloodZone ?? zoning.floodZone ?? civil.femaFloodZone ?? "N/A";
      const soilVal = civil.hydrologicSoilGroup ?? civil.soilGroup ?? "-";

      setText("v-cv-flood", floodVal);
      setText("v-cv-soil-group", soilVal);
      setText("v-cv-water", civil.waterService ?? civil.water ?? "-");
      setText("v-cv-sewer", civil.sewerService ?? civil.sewer ?? "-");
      setText("v-cv-drainage", civil.stormDrainage ?? civil.drainage ?? "-");
      setText("v-cv-slope", civil.topography ?? civil.slope ?? "-");
      setText("v-cv-fire", civil.fireHazardSeverity ?? civil.fireZone ?? "-");
      setText("v-cv-notes", civil.notes ?? "Civil data will be updated here.");

      // Reset Soil button loading state nếu đã nhận được data
      if (soilVal !== "-" && btnGetSoil && btnGetSoil.classList.contains("loading")) {
        btnGetSoil.classList.remove("loading");
        btnGetSoil.disabled = false;
        btnGetSoil.textContent = "⚡ Get";
        if (showToast) showToast(`✅ Đã nhận Hydrologic Soil Group: ${soilVal}`);
      }
    }
  };

  window.FsTabRenderer = FsTabRenderer;
})();

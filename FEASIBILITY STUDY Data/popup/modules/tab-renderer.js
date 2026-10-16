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

      this.renderBossAudit(data.bossAudit);
      this.renderOverviewTab(lot, zoning, capacity, setbacks, currentApn, currentAddr);
      this.renderLotTab(lot, capacity, currentApn, currentAddr);
      this.renderZoningTab(zoning, currentAddr);
      this.renderSetbacksTab(setbacks);
      this.renderCapacityTab(capacity);
      this.renderCivilTab(data, zoning, btnGetSoil);
    },

    /**
     * Render Banner Đối soát dữ liệu theo chỉ thị của Sếp
     */
    renderBossAudit(bossAudit) {
      const card = document.getElementById("boss-audit-card");
      if (!card) return;

      // ẨN HOÀN TOÀN: Khi chỉ 1 bên tải được (XUI) hoặc cả 2 bên lỗi, tuyệt đối không show ra UI
      if (!bossAudit || !bossAudit.verdict || bossAudit.verdict === "ONLY_B_LOADED" || bossAudit.verdict === "ONLY_A_LOADED" || bossAudit.verdict === "BOTH_FAILED") {
        card.classList.add("hidden");
        return;
      }

      card.classList.remove("hidden", "matched", "overridden", "fallback", "failed");

      const badge = document.getElementById("boss-audit-badge");
      const timeEl = document.getElementById("boss-audit-time");
      const msgEl = document.getElementById("boss-audit-message");
      const diffEl = document.getElementById("boss-audit-diff");

      if (bossAudit.verdict === "MATCHED") {
        card.classList.add("matched");
        if (badge) badge.textContent = "✅ Dữ liệu đồng bộ";
      } else if (bossAudit.verdict === "OVERRIDDEN_BY_COUNTYOFFICE") {
        card.classList.add("overridden");
        if (badge) badge.textContent = "⚠️ Ưu tiên CountyOffice";
      } else {
        card.classList.add("hidden");
        return;
      }

      if (msgEl) msgEl.textContent = bossAudit.message || "";
      if (timeEl && bossAudit.evaluatedAt) {
        const d = new Date(bossAudit.evaluatedAt);
        timeEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }

      if (diffEl) {
        if (bossAudit.diffDetails && bossAudit.diffDetails.length > 0) {
          diffEl.classList.remove("hidden");
          diffEl.textContent = "Chi tiết sai lệch giữa 2 nguồn:\n• " + bossAudit.diffDetails.join("\n• ");
        } else {
          diffEl.classList.add("hidden");
          diffEl.textContent = "";
        }
      }
    },

    /**
     * 1. Tab Overview
     */
    renderOverviewTab(lot, zoning, capacity, setbacks, currentApn, currentAddr) {
      const detectedCityInfo = window.CountyDetector ? window.CountyDetector.detect(currentAddr) : null;
      const finalZoningDistrict = zoning.zoningDistrict 
        ?? zoning.zoningDistricts 
        ?? zoning.zoningDistrictS 
        ?? (zoning.zoningCode && !zoning.zoningCodeUrl ? zoning.zoningCode : null)
        ?? detectedCityInfo?.zoningDistrict 
        ?? detectedCityInfo?.zoning 
        ?? zoning.zoningCode 
        ?? "-";

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
      const finalZoningDistrict = zoning.zoningDistrict 
        ?? zoning.zoningDistricts 
        ?? zoning.zoningDistrictS 
        ?? (zoning.zoningCode && !zoning.zoningCodeUrl ? zoning.zoningCode : null)
        ?? detectedCityInfo?.zoningDistrict 
        ?? detectedCityInfo?.zoning 
        ?? zoning.zoningCode 
        ?? "-";
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
      setText("v-zn-allowed", zoning.allowedUses ?? zoning.allowedUse ?? zoning.allowedUseS ?? zoning.permittedUses ?? "-");
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
      const femaDetails = civil.femaDetails || civil || {};
      const floodVal = zoning.femaFloodZone ?? zoning.floodZone ?? civil.femaFloodZone ?? civil.fldZone ?? "N/A";
      const soilVal = civil.hydrologicSoilGroup ?? civil.soilGroup ?? "-";

      setText("v-cv-flood", floodVal);
      setText("v-cv-fema-panel", femaDetails.firmPanel ?? femaDetails["FIRM Panels"] ?? civil.firmPanel ?? "-");
      setText("v-cv-fema-eff-date", femaDetails.mapEffectiveDate ?? femaDetails["Map Effective Date"] ?? civil.mapEffectiveDate ?? "-");
      setText("v-cv-fema-cid", femaDetails.cid ?? femaDetails.CID ?? civil.cid ?? "-");
      setText("v-cv-fema-jurisdiction", femaDetails.jurisdiction ?? femaDetails["Political Jurisdictions"] ?? civil.jurisdiction ?? "-");
      setText("v-cv-fema-fld-zone", femaDetails.fldZone ?? femaDetails.FLD_ZONE ?? civil.fldZone ?? civil.femaFloodZone ?? "-");
      setText("v-cv-fema-zone-subty", femaDetails.zoneSubty ?? femaDetails.ZONE_SUBTY ?? civil.floodSubtype ?? civil.zoneSubty ?? "-");

      setText("v-cv-soil-group", soilVal);

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

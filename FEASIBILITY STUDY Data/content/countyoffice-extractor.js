/**
 * FEASIBILITY STUDY Data - CountyOffice.org Content Extractor (Nguồn ***B)
 * Thực thi cào dữ liệu theo 2 bước & Chỉ chạy 1 lần duy nhất trong phiên
 * Website: https://www.countyoffice.org/*
 */

(async function () {
  // 1. Chặn chạy trong iframe/sub-frame
  if (window.self !== window.top) return;

  // 2. Chặn chạy trùng lặp trong bộ nhớ tab hiện tại (In-Memory Guard)
  if (window.__COUNTYOFFICE_EXTRACTOR_LOADED__) return;
  window.__COUNTYOFFICE_EXTRACTOR_LOADED__ = true;

  // Lắng nghe thông báo đối soát từ Background Service Worker
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === "BOSS_AUDIT_NOTIFICATION" && typeof FloatingUI !== "undefined") {
        FloatingUI.showSuccess(msg.title || "Đối soát dữ liệu", msg.message || "", 10000);
      }
    });
  }

  // 3. Kiểm tra xem trang có bị WAF chặn 403 Forbidden / Access Denied không
  const checkForbiddenError = () => {
    const text = (document.body ? document.body.innerText : "") + " " + document.title;
    return text.includes("403 Forbidden") || text.includes("administrative rules") || text.includes("Access Denied");
  };

  if (checkForbiddenError()) {
    console.error("🛑 [CountyOffice] Bị chặn 403 Forbidden (XUI). Dừng ngay lập tức.");
    try {
      chrome.runtime.sendMessage({
        action: "COUNTYOFFICE_EXTRACTION_FAILED",
        error: "403_FORBIDDEN",
        message: "Trang CountyOffice bị 403 Forbidden (XUI)."
      });
    } catch (e) { }
    return;
  }

  const currentPath = window.location.pathname;
  const isHomePage = currentPath === "/" || currentPath === "" || currentPath.endsWith("/index.html");

  // =========================================================================
  // BƯỚC 1: TRÊN TRANG CHỦ -> TÌM KIẾM ĐỊA CHỈ QUA RADAR AUTOCOMPLETE
  // =========================================================================
  if (isHomePage) {
    if (sessionStorage.getItem("__COUNTYOFFICE_SEARCH_DONE__")) {
      console.log("[CountyOffice] Trang chủ đã tìm kiếm 1 lần rồi. Bỏ qua.");
      return;
    }

    const getInputElement = async () => {
      for (let i = 0; i < 20; i++) {
        const el = document.querySelector('.radar-autocomplete-input');
        if (el) return el;
        await new Promise(r => setTimeout(r, 250));
      }
      return null;
    };

    const inputElement = await getInputElement();
    if (!inputElement) {
      sessionStorage.setItem("__COUNTYOFFICE_SEARCH_DONE__", "true");
      console.warn("⚠️ [CountyOffice] Không tìm thấy ô nhập liệu .radar-autocomplete-input.");
      try {
        chrome.runtime.sendMessage({
          action: "COUNTYOFFICE_EXTRACTION_FAILED",
          error: "INPUT_NOT_FOUND",
          message: "Không tìm thấy thanh tìm kiếm CountyOffice."
        });
      } catch (e) { }
      return;
    }

    // Đánh dấu đã bắt đầu tìm kiếm
    sessionStorage.setItem("__COUNTYOFFICE_SEARCH_DONE__", "true");

    inputElement.focus();
    inputElement.value = addressToSearch;
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    inputElement.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));

    console.log(`⏳ [CountyOffice] Đã nhập: "${addressToSearch}". Đang chờ gợi ý...`);

    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      const listItems = document.querySelectorAll('.radar-autocomplete-results-item');

      if (listItems.length > 0) {
        clearInterval(checkInterval);

        const cleanString = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const targetClean = cleanString(addressToSearch);

        let bestMatch = listItems[0];
        for (let item of listItems) {
          const itemTextClean = cleanString(item.textContent);
          if (itemTextClean.includes(targetClean) || targetClean.includes(itemTextClean)) {
            bestMatch = item;
            break;
          }
        }

        console.log(`✅ [CountyOffice] Chọn kết quả: "${bestMatch.textContent.trim()}". Đang điều hướng...`);
        // CHỈ GỬI 1 EVENT CLICK DUY NHẤT để không bị server coi là spam bot
        bestMatch.click();

      } else if (attempts >= 15) {
        clearInterval(checkInterval);
        console.warn("⏹️ [CountyOffice] Hết thời gian chờ gợi ý địa chỉ.");
        try {
          chrome.runtime.sendMessage({
            action: "COUNTYOFFICE_EXTRACTION_FAILED",
            error: "AUTOCOMPLETE_TIMEOUT",
            message: "Hết thời gian chờ gợi ý địa chỉ CountyOffice."
          });
        } catch (e) { }
      }
    }, 500);

    return;
  }

  // =========================================================================
  // BƯỚC 2: TRÊN TRANG KẾT QUẢ / CHI TIẾT BẤT ĐỘNG SẢN -> CÀO NỘI DUNG THEO JSON
  // =========================================================================
  if (sessionStorage.getItem("__COUNTYOFFICE_EXTRACT_DONE__")) {
    console.log("[CountyOffice] Dữ liệu trang này đã được trích xuất.");
    return;
  }

  console.log("🚀 [CountyOffice] Đang bóc tách dữ liệu JSON tài sản (Nguồn ***B)...");

  // Helper bóc tách bảng biểu và danh sách key-value trên trang
  function extractJsonData() {
    const rawDetails = {};

    // 1. Quét các thẻ <tr> có <th> và <td> hoặc 2 <td>
    const rows = document.querySelectorAll("tr");
    rows.forEach(row => {
      const th = row.querySelector("th");
      const td = row.querySelector("td");
      if (th && td) {
        const key = th.innerText.trim().replace(/[:\n\r]/g, " ");
        const val = td.innerText.trim();
        if (key && val) rawDetails[key] = val;
      } else {
        const tds = row.querySelectorAll("td");
        if (tds.length === 2) {
          const key = tds[0].innerText.trim().replace(/[:\n\r]/g, " ");
          const val = tds[1].innerText.trim();
          if (key && val) rawDetails[key] = val;
        }
      }
    });

    // 2. Quét các cặp dt / dd
    const dts = document.querySelectorAll("dt");
    dts.forEach(dt => {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName.toLowerCase() === "dd") {
        const key = dt.innerText.trim().replace(/[:\n\r]/g, " ");
        const val = dd.innerText.trim();
        if (key && val) rawDetails[key] = val;
      }
    });

    // 3. Quét các div dạng list-item, info-row (nhãn in đậm kèm giá trị)
    const listItems = document.querySelectorAll("li, .list-group-item, .info-row, .detail-item");
    listItems.forEach(item => {
      const labelEl = item.querySelector("strong, b, .label, .info-label");
      if (labelEl) {
        const key = labelEl.innerText.trim().replace(/[:\n\r]/g, " ");
        const fullText = item.innerText.trim();
        const val = fullText.replace(labelEl.innerText, "").trim().replace(/^[:\-–]/, "").trim();
        if (key && val && !rawDetails[key]) rawDetails[key] = val;
      }
    });

    // 4. Lấy địa chỉ trang
    let address = "";
    const h1 = document.querySelector("h1");
    if (h1) address = h1.innerText.trim();
    if (!address) {
      const pageTitle = document.querySelector(".property-title, .record-title, .address-header");
      if (pageTitle) address = pageTitle.innerText.trim();
    }

    // Helper tìm giá trị theo regex
    const findValueByRegex = (regex) => {
      for (const [k, v] of Object.entries(rawDetails)) {
        if (regex.test(k)) return v;
      }
      return null;
    };

    // Helper chuyển đổi chuỗi diện tích/kích thước thành số
    const parseNumber = (str) => {
      if (!str) return null;
      const clean = str.replace(/,/g, '').match(/\d+(\.\d+)?/);
      return clean ? parseFloat(clean[0]) : null;
    };

    const rawApn = findValueByRegex(/parcel\s*id|apn|parcel\s*number|tax\s*id|pin|property\s*id/i);
    const rawLotSize = findValueByRegex(/lot\s*size|lot\s*area|land\s*area|acreage/i);
    const rawBldgSize = findValueByRegex(/building\s*size|living\s*area|square\s*feet|sq\s*ft|gross\s*area|finished\s*area/i);
    const rawYearBuilt = findValueByRegex(/year\s*built|built\s*in|construction\s*year/i);
    const rawPropType = findValueByRegex(/property\s*type|property\s*class|land\s*use|use\s*code|zoning/i);
    const rawAssessedVal = findValueByRegex(/assessed\s*value|total\s*assessed|market\s*value/i);
    const rawTax = findValueByRegex(/annual\s*tax|tax\s*amount|property\s*tax/i);

    // Tính toán số sqft nếu lotSize được ghi bằng Acres
    let computedLotSqft = null;
    if (rawLotSize) {
      const num = parseNumber(rawLotSize);
      if (num) {
        if (/acre/i.test(rawLotSize)) {
          computedLotSqft = Math.round(num * 43560);
        } else {
          computedLotSqft = Math.round(num);
        }
      }
    }

    const computedBldgSqft = rawBldgSize ? parseNumber(rawBldgSize) : null;
    const computedYearBuilt = rawYearBuilt ? parseInt(rawYearBuilt.match(/\d{4}/)?.[0] || "0", 10) : null;

    return {
      source: "countyoffice.org",
      address: address,
      apn: rawApn ? rawApn.trim() : null,
      lotSize: computedLotSqft,
      rawLotSize: rawLotSize,
      buildingSize: computedBldgSqft,
      rawBuildingSize: rawBldgSize,
      yearBuilt: computedYearBuilt && computedYearBuilt > 1700 ? computedYearBuilt : null,
      propertyType: rawPropType ? rawPropType.trim() : null,
      assessedValue: rawAssessedVal ? rawAssessedVal.trim() : null,
      taxAmount: rawTax ? rawTax.trim() : null,
      rawDetails: rawDetails,
      extractedAt: new Date().toISOString()
    };
  }

  // Đợi DOM trang kết quả hiển thị nội dung (tối đa 12s)
  let waitCount = 0;
  const pollResultTimer = setInterval(async () => {
    waitCount++;

    if (checkForbiddenError()) {
      clearInterval(pollResultTimer);
      console.error("🛑 [CountyOffice] 403 Forbidden phát hiện trong lúc bóc tách.");
      try {
        chrome.runtime.sendMessage({
          action: "COUNTYOFFICE_EXTRACTION_FAILED",
          error: "403_FORBIDDEN",
          message: "CountyOffice bị 403 Forbidden."
        });
      } catch (e) { }
      return;
    }

    const data = extractJsonData();
    const hasKeyData = data.apn || data.lotSize || data.buildingSize || Object.keys(data.rawDetails).length >= 2;

    if (hasKeyData || waitCount >= 24) {
      clearInterval(pollResultTimer);
      sessionStorage.setItem("__COUNTYOFFICE_EXTRACT_DONE__", "true");

      if (!hasKeyData) {
        console.warn("⚠️ [CountyOffice] Không tìm thấy dữ liệu bất động sản trên trang này (XUI).");
        try {
          chrome.runtime.sendMessage({
            action: "COUNTYOFFICE_EXTRACTION_FAILED",
            error: "NO_DATA_FOUND",
            message: "Không tìm thấy dữ liệu trên CountyOffice (XUI)."
          });
        } catch (e) { }
        return;
      }

      console.log("✅ [CountyOffice] ĐÃ BÓC TÁCH JSON THÀNH CÔNG (Nguồn ***B):", data);

      if (typeof FloatingUI !== "undefined") {
        FloatingUI.showSuccess(
          "CountyOffice (***B)",
          `🏷️ APN: ${data.apn || 'N/A'}\n📐 Lot: ${data.lotSize ? data.lotSize.toLocaleString() + ' sqft' : 'N/A'}\n🏠 Nhà: ${data.buildingSize ? data.buildingSize.toLocaleString() + ' sqft' : 'N/A'}\n📅 Xây dựng: ${data.yearBuilt || 'N/A'}`,
          7000
        );
      }

      try {
        chrome.runtime.sendMessage({
          action: "AUTO_SAVE_COUNTYOFFICE_DATA",
          data: data
        });
      } catch (err) {
        console.error("[CountyOffice] Lỗi gửi dữ liệu về Service Worker:", err);
      }
    }
  }, 500);

})();

/**
 * FEASIBILITY STUDY Data - Google Search Multi-Role Scanner
 * Chạy bất đồng bộ, kiên nhẫn chờ trang load xong hoàn toàn (window load & document complete)
 * Không tranh load với trình duyệt, không gây gián đoạn kết nối.
 */

(function initGoogleExtractor() {
  if (window.__GOOGLE_APN_EXTRACTOR_LOADED__) return;
  window.__GOOGLE_APN_EXTRACTOR_LOADED__ = true;

  // Hàm bất đồng bộ: Chờ đợi trang web tải xong hoàn tất (Sự kiện window load & readyState complete)
  // Cấm tranh load với trình duyệt, chỉ chạy sau khi trình duyệt đã hoàn tất tải tài nguyên
  function waitForWindowLoad() {
    return new Promise((resolve) => {
      if (document.readyState === "complete") {
        // Đã load xong hoàn toàn -> đợi một nhịp nhỏ cho render ổn định
        setTimeout(resolve, 300);
      } else {
        const onComplete = () => {
          if (document.readyState === "complete") {
            window.removeEventListener("load", onComplete);
            document.removeEventListener("readystatechange", onComplete);
            setTimeout(resolve, 300);
          }
        };
        window.addEventListener("load", onComplete, { once: true });
        document.addEventListener("readystatechange", onComplete);
      }
    });
  }

  /**
   * Quy đổi thông số Garage / Driveway sang diện tích chuẩn (Architectural Standards)
   */
  function parseGarageParking(raw) {
    if (!raw || raw === "-" || /^(none|n\/a|0)$/i.test(String(raw).trim())) {
      return {
        garageSpaces: 0,
        drivewaySpaces: 0,
        garageArea: null,
        garageDimension: null,
        drivewayArea: null,
        totalParkingArea: null,
        formattedSummary: "-"
      };
    }

    const str = String(raw).trim();
    let garageSpaces = 0;
    let drivewaySpaces = 0;
    const isAttached = /attached/i.test(str);
    const isDetached = /detached/i.test(str);
    const isCarport = /carport/i.test(str);

    // Bắt số lượng garage: "2-car garage", "1-car attached garage", "có garage liền nhà với 2 chỗ"
    const garageMatch = str.match(/(\d+)\s*[-\s]?car\s*(?:attached|detached)?\s*(?:garage|covered)?/i)
                     || str.match(/(\d+)\s*(?:garage|covered)\s*spaces?/i)
                     || str.match(/garage(?:\s*spaces?)?[\s:\-–—]{1,5}(\d+)/i)
                     || str.match(/garage[^\d]{0,15}(\d+)\s*chỗ/i);

    if (garageMatch && garageMatch[1]) {
      garageSpaces = parseInt(garageMatch[1], 10);
    } else if (/garage/i.test(str)) {
      garageSpaces = 2; // Mặc định 2 chỗ nếu có garage
    }

    // Bắt số lượng driveway: "2-car driveway", "1-car driveway", "2 driveway spaces"
    const driveMatch = str.match(/(\d+)\s*[-\s]?car\s*driveway/i)
                    || str.match(/(\d+)\s*driveway\s*spaces?/i);
    if (driveMatch && driveMatch[1]) {
      drivewaySpaces = parseInt(driveMatch[1], 10);
    }

    if (garageSpaces === 0 && drivewaySpaces === 0) {
      const spMatch = str.match(/(\d+)\s*(?:spaces?|cars?|parking)/i);
      if (spMatch && spMatch[1]) {
        garageSpaces = parseInt(spMatch[1], 10);
      }
    }

    // Quy chuẩn diện tích:
    // 1-Car Garage: 12 × 20 ft = 240 sq ft
    // 2-Car Garage: 22 × 22 ft = 484 sq ft (tối thiểu 20 × 20 ft)
    // 3-Car Garage: 32 × 22 ft = 704 sq ft
    // Driveway 1 xe: 10-12 ft × 20 ft = 240 sq ft (rộng 3.0m - 3.6m)
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

    const typePrefix = isAttached ? "Attached" : (isDetached ? "Detached" : (isCarport ? "Carport" : ""));
    const summaryParts = [];
    if (garageSpaces > 0) {
      const gType = typePrefix ? `${typePrefix} Garage` : "Garage";
      summaryParts.push(`${garageSpaces}-Car ${gType} (~${garageArea} ft²)`);
    }
    if (drivewaySpaces > 0) {
      summaryParts.push(`${drivewaySpaces}-Car Driveway (~${drivewayArea} ft²)`);
    }

    const formattedSummary = summaryParts.length > 0 ? summaryParts.join(" + ") : str;

    return {
      raw: str,
      garageSpaces,
      drivewaySpaces,
      garageArea: garageArea || null,
      garageDimension: garageDimension || null,
      drivewayArea: drivewayArea || null,
      totalParkingArea: totalParkingArea || null,
      formattedSummary
    };
  }

  /**
   * Trích xuất địa chỉ chuẩn hóa đầy đủ từ kết quả Google (Google Knowledge Panel, Snippet Titles, Redfin/Zillow links)
   */
  function extractCanonicalAddress(userQuery = "") {
    const cleanUserQuery = (userQuery || "").trim().toLowerCase();
    const fullText = document.body ? document.body.innerText : "";

    // Mẫu chuẩn US Address: Số nhà + Tên đường + Thành phố + State (CA) + Zipcode 5 số
    // Ví dụ: "8502 Blanche Ave, Garden Grove, CA 92841" hoặc "8502 Blanche Avenue, Garden Grove, CA"
    const canonicalPatterns = [
      /\b(\d{1,6}\s+[A-Za-z0-9\s\.\,\#\-]+(?:AVE|ST|RD|BLVD|DR|LN|CT|WAY|CIR|PL|TER|PKWY|HWY|AVENUE|STREET|ROAD|DRIVE|LANE|COURT|CIRCLE|PLACE|TERRACE|PARKWAY|HIGHWAY)\s*,\s*([A-Za-z\s]{3,30})\s*,\s*(?:CA|California)\s*(\d{5}))\b/i,
      /\b(\d{1,6}\s+[A-Za-z0-9\s\.\,\#\-]+(?:AVE|ST|RD|BLVD|DR|LN|CT|WAY|CIR|PL|TER|PKWY|HWY|AVENUE|STREET|ROAD|DRIVE|LANE|COURT|CIRCLE|PLACE|TERRACE|PARKWAY|HIGHWAY)\s*,\s*([A-Za-z\s]{3,30})\s*,\s*CA\b)/i
    ];

    // 1. Quét các thẻ tiêu đề kết quả (h3, h2, h1, [data-attrid*="title"], [data-attrid*="address"])
    const titleElements = Array.from(document.querySelectorAll('h1, h2, h3, [data-attrid*="title"], [data-attrid*="address"], [data-attrid*="subtitle"], [class*="title"], [class*="address"]'));
    for (const el of titleElements) {
      const text = (el.innerText || '').trim();
      for (const pat of canonicalPatterns) {
        const m = text.match(pat);
        if (m && m[1]) {
          const candidate = m[1].replace(/\s+/g, ' ').trim();
          if (cleanUserQuery) {
            const queryWords = cleanUserQuery.split(/\s+/).filter(w => w.length >= 3);
            const isMatch = queryWords.every(w => candidate.toLowerCase().includes(w));
            if (isMatch) return candidate;
          } else {
            return candidate;
          }
        }
      }
    }

    // 2. Quét toàn bộ body text
    for (const pat of canonicalPatterns) {
      const m = fullText.match(pat);
      if (m && m[1]) {
        const candidate = m[1].replace(/\s+/g, ' ').trim();
        if (cleanUserQuery) {
          const queryWords = cleanUserQuery.split(/\s+/).filter(w => w.length >= 3);
          const isMatch = queryWords.every(w => candidate.toLowerCase().includes(w));
          if (isMatch) return candidate;
        } else {
          return candidate;
        }
      }
    }

    return null;
  }

  /**
   * Bóc tách thông tin từ Google Search (cả Snippets và AI Overview / Property Overview)
   */
  function parseGoogleSpecs() {
    const pageText = document.body ? document.body.innerText : "";
    if (!pageText || pageText.length < 30) return null;

    // 1. Trích xuất APN (Hỗ trợ toàn diện CA: San Bernardino 4-3-2, LA 4-3-3, Orange 3-3-2, Riverside 3-3-3, v.v.)
    const apnPatterns = [
      // Dạng có nhãn APN / Parcel / AIN / Folio với khoảng trắng hoặc gạch nối (vd: "APN 1049 441 21", "APN: 1049-441-21")
      /(?:APN|Parcel(?:\s*(?:Number|ID|#|No\.?))?|AIN|Folio)[\s:\-–—#\.\t]{1,15}(\d{3,5}[\s\-\.]\d{2,4}[\s\-\.]\d{2,4}(?:[\s\-\.]\d{2,4})?|\d{8,12})\b/gi,
      // Dạng San Bernardino 4-3-2: 1049 441 21 hoặc 1049-441-21
      /\bAPN\s*[:#\s]?\s*(\d{4}[\s\-\.]\d{3}[\s\-\.]\d{2})\b/gi,
      // Dạng LA 4-3-3: 3111-005-016
      /\bAPN\s*[:#\s]?\s*(\d{4}[\s\-\.]\d{3}[\s\-\.]\d{3})\b/gi,
      // Dạng Orange / Riverside: 096-382-04 hoặc 123-456-789
      /\bAPN\s*[:#\s]?\s*(\d{3}[\s\-\.]\d{3}[\s\-\.]\d{2,3})\b/gi,
      // Dạng chuỗi số liên tiếp 8-12 số
      /\bAPN\s*[:#\s]?\s*(\d{8,12})\b/gi
    ];

    let foundAPNs = new Set();
    for (const pat of apnPatterns) {
      let matches;
      while ((matches = pat.exec(pageText)) !== null) {
        if (matches[1]) {
          const raw = matches[1].trim();
          const clean = raw.replace(/[\s\-\.]/g, '');
          if (clean.length >= 8 && clean.length <= 12) {
            foundAPNs.add(raw.replace(/\s+/g, '-')); // Chuẩn hóa thành dạng có gạch nối rõ ràng (1049-441-21)
          }
        }
      }
    }

    if (foundAPNs.size === 0) {
      // Fallback tìm kiếm linh hoạt trên toàn text
      const fb = pageText.match(/(?:APN|Parcel)[\s:\-–—#\.\t]{1,15}(\d{4}[\s\-\.]\d{3}[\s\-\.]\d{2}|\d{3,4}[\s\-\.]\d{3}[\s\-\.]\d{2,3}|\d{8,12})\b/i);
      if (fb && fb[1]) {
        foundAPNs.add(fb[1].trim().replace(/\s+/g, '-'));
      }
    }

    const firstAPN = foundAPNs.size > 0 ? [...foundAPNs][0] : null;

    // 2. Trích xuất Property Type / Use & Stories từ AI Overview hoặc Snippets
    let propType = null;
    let stories = null;

    const propTypeMatch = pageText.match(/(?:Property\s*Type|Property\s*Overview|Home\s*Type)[\s:\-–—]{1,10}([^\n\r,\.;•|]{3,60})/i);
    if (propTypeMatch && propTypeMatch[1]) {
      const pTxt = propTypeMatch[1].trim();
      propType = pTxt;

      if (/two[-\s]story|2[-\s]story/i.test(pTxt)) stories = 2;
      else if (/three[-\s]story|3[-\s]story/i.test(pTxt)) stories = 3;
      else if (/single[-\s]story|one[-\s]story|1[-\s]story/i.test(pTxt)) stories = 1;
    }

    if (!propType) {
      const typeFallback = pageText.match(/\b(Single\s*Family(?:\s*Residence|\s*Home)?|Multi\s*Family|Condominium|Condo|Townhouse|Commercial|Duplex|Triplex|Apartment)\b/i);
      if (typeFallback && typeFallback[1]) propType = typeFallback[1].trim();
    }

    if (!stories) {
      const storiesPatterns = [
        /(?:Stories|Story|Levels|Floors)[\s:\-–—]{1,8}(\d+(?:\.\d+)?|\bOne\b|\bTwo\b|\bThree\b|\bSingle\b|\bMulti\b)/i,
        /\b(\d+)\s*(?:story|stories|levels?|floors?)\b/i,
        /\b(Single|Two|Three|Multi)[-\s]Story\b/i
      ];
      for (const pat of storiesPatterns) {
        const m = pageText.match(pat);
        if (m && m[1]) {
          const val = m[1].trim();
          if (/^one$/i.test(val) || /^single$/i.test(val)) stories = 1;
          else if (/^two$/i.test(val)) stories = 2;
          else if (/^three$/i.test(val)) stories = 3;
          else if (!isNaN(Number(val))) stories = Number(val);
          else stories = val;
          break;
        }
      }
    }

    // 3. Trích xuất Parking / Garage & Driveway
    let rawParking = null;
    const parkingPatterns = [
      /(?:Parking|Garage|Carport)(?:\s*(?:Spaces|Features|Type)?)?[\s:\-–—]{1,10}([^\n\r,\.;•|]{2,80})/i,
      /\b(\d+\s*[-\s]?car\s*(?:attached|detached)?\s*(?:garage|carport)?(?:\s*and\s*\d+\s*[-\s]?car\s*driveway(?:\s*spaces?)?)?)\b/i,
      /\b((?:Attached|Detached)\s+Garage(?:\s*with\s*\d+\s*parking\s*spaces?|\s*\(\d+\s*cars?\))?)\b/i,
      /\b(\d+)\s*Car\s*Garage\b/i,
      /\b(\d+)\s*(?:Garage|Parking)\s*Spaces?\b/i
    ];
    for (const pat of parkingPatterns) {
      const m = pageText.match(pat);
      if (m && m[1]) {
        const pVal = m[1].trim();
        if (pVal && !/^(none|n\/a|0)$/i.test(pVal)) {
          rawParking = pVal;
          break;
        }
      }
    }

    const parkingInfo = parseGarageParking(rawParking);

    // 4. Trích xuất Year Built
    let yearBuilt = null;
    const ybMatch = pageText.match(/(?:Year\s*Built|Built\s*in|Built)[\s:\-–—]{1,8}(\b(18|19|20)\d{2}\b)/i);
    if (ybMatch && ybMatch[1]) {
      yearBuilt = Number(ybMatch[1]);
    }

    // 5. Trích xuất Living Area (sq ft)
    let bldgSize = null;
    const bldgMatch = pageText.match(/([\d,]+)\s*(?:sq\s*ft|sqft|square feet|sf)\b(?!\s*lot)/i);
    if (bldgMatch && bldgMatch[1]) {
      const num = Number(bldgMatch[1].replace(/,/g, ''));
      if (num >= 200 && num <= 500000) bldgSize = num;
    }

    // 6. Trích xuất Lot Size (sq ft / acres)
    let lotSize = null;
    const lotMatch = pageText.match(/([\d,]+)\s*(?:sq\s*ft\s*lot|sqft\s*lot|sf\s*lot|sq\s*ft\s*\(lot\))/i);
    if (lotMatch && lotMatch[1]) {
      lotSize = Number(lotMatch[1].replace(/,/g, ''));
    } else {
      const acreMatch = pageText.match(/([\d\.]+)\s*(?:acres|acre|ac)\s*lot/i);
      if (acreMatch && acreMatch[1]) {
        lotSize = Math.round(Number(acreMatch[1]) * 43560);
      }
    }

    // 7. Trích xuất Zoning
    let zoningCode = null;
    const znMatch = pageText.match(/(?:Zoning|Zone\s*Code|Zone\s*District)[\s:\-–—]{1,8}([A-Za-z0-9\-\/]{2,15})/i);
    if (znMatch && znMatch[1]) {
      zoningCode = znMatch[1].trim();
    }

    // 8. Trích xuất địa chỉ tìm kiếm & Địa chỉ chuẩn hóa đầy đủ (Canonical Full Address)
    let searchedAddress = "";
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const q = urlParams.get("q") || "";
      searchedAddress = q.replace(/\s*The Assessor's Parcel Number.*$/i, "")
                         .replace(/\s*properties.*$/i, "")
                         .replace(/\s*APN.*$/i, "")
                         .trim();
    } catch (e) {}

    const canonicalAddress = extractCanonicalAddress(searchedAddress);
    const finalAddress = canonicalAddress || searchedAddress;

    return {
      apn: firstAPN,
      address: finalAddress,
      canonicalAddress: canonicalAddress || null,
      propType,
      stories,
      parking: parkingInfo.formattedSummary !== "-" ? parkingInfo.formattedSummary : rawParking,
      parkingRaw: rawParking,
      garageArea: parkingInfo.garageArea,
      garageDimension: parkingInfo.garageDimension,
      garageSpaces: parkingInfo.garageSpaces,
      drivewaySpaces: parkingInfo.drivewaySpaces,
      totalParkingArea: parkingInfo.totalParkingArea,
      yearBuilt,
      bldgSize,
      lotSize,
      zoningCode
    };
  }

  // =========================================================================
  // KHỞI CHẠY BẤT ĐỒNG BỘ: CHỜ TRANG TẢI XONG RỒI MỚI THỰC HIỆN BÓC TÁCH
  // =========================================================================
  async function startWorkflow() {
    // 1. Chờ trang tải hoàn tất sự kiện load
    await waitForWindowLoad();
    await new Promise(r => setTimeout(r, 600));

    // 2. Hỏi vai trò từ Background Service Worker
    chrome.runtime.sendMessage({ action: "GET_SEARCH_PIPELINE_ROLE" }, async (response) => {
      if (chrome.runtime.lastError || !response || response.role === "NONE") {
        return; // Người dùng duyệt web bình thường -> Không can thiệp
      }

      const role = response.role;
      console.log(`⚡ [Google-Extractor] Trang đã load xong hoàn toàn. Bắt đầu vai trò: "${role}"`);

      // =========================================================================
      // VAI TRÒ 1: APN_SEARCH (Bước 1 - Tìm mã APN)
      // =========================================================================
      if (role === "APN_SEARCH") {
        let isDone = false;

        function checkAPN() {
          if (isDone) return true;
          const data = parseGoogleSpecs();
          if (data && data.apn) {
            isDone = true;
            console.log(`✅ [Step 1 APN Found]: ${data.apn}`, data);
            chrome.runtime.sendMessage({
              action: "STEP1_APN_FOUND",
              apn: data.apn,
              details: data
            });
            return true;
          }
          return false;
        }

        if (!checkAPN()) {
          let attempts = 0;
          const timer = setInterval(() => {
            attempts++;
            if (checkAPN() || attempts >= 20) {
              clearInterval(timer);
            }
          }, 400);

          const observer = new MutationObserver(() => {
            if (checkAPN()) {
              observer.disconnect();
              clearInterval(timer);
            }
          });
          if (document.body) observer.observe(document.body, { childList: true, subtree: true });
        }
      }

      // =========================================================================
      // VAI TRÒ 2: PROPERTY_OVERVIEW_SEARCH (Bước 2 - Đợi AI Overview & Property Overview)
      // =========================================================================
      if (role === "PROPERTY_OVERVIEW_SEARCH") {
        let isDone = false;
        let checkCount = 0;

        // Đợi thêm 1s để AI Overview bắt đầu stream nội dung
        await new Promise(r => setTimeout(r, 1000));

        function checkPropertyOverview() {
          if (isDone) return true;
          checkCount++;

          const data = parseGoogleSpecs();
          const hasKeyData = data && (data.propType || data.parking || data.stories || data.yearBuilt || data.bldgSize);

          // Nếu đã lấy được dữ liệu hoặc đã chờ tối đa 10 giây
          if (hasKeyData || checkCount >= 20) {
            isDone = true;
            console.log(`✅ [Step 2 Property Overview Extracted]:`, data);
            chrome.runtime.sendMessage({
              action: "STEP2_PROPERTY_OVERVIEW_FOUND",
              details: data || {}
            });
            return true;
          }
          return false;
        }

        const propTimer = setInterval(() => {
          if (checkPropertyOverview()) {
            clearInterval(propTimer);
          }
        }, 500);

        const observer = new MutationObserver(() => {
          if (checkPropertyOverview()) {
            observer.disconnect();
            clearInterval(propTimer);
          }
        });
        if (document.body) observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  }

  // Khởi động
  startWorkflow();

  // Lắng nghe lệnh bóc tách thủ công từ Popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "EXTRACT_DATA" || request.action === "FORCE_FRESH_EXTRACT") {
      const data = parseGoogleSpecs();
      if (data) {
        sendResponse({
          success: true,
          domain: window.location.hostname,
          url: window.location.href,
          data: {
            apn: data.apn,
            address: data.address,
            lot: {
              parcelId: data.apn,
              projectAddress: data.address,
              parking: data.parking,
              parkingRaw: data.parkingRaw,
              garageArea: data.garageArea,
              garageDimension: data.garageDimension,
              garageSpaces: data.garageSpaces,
              drivewaySpaces: data.drivewaySpaces,
              totalParkingArea: data.totalParkingArea,
              stories: data.stories,
              yearBuilt: data.yearBuilt,
              existingBuildingArea: data.bldgSize,
              lotAreaTaxRecord: data.lotSize,
              existingBuildingUse: data.propType
            },
            capacity: {
              maximumHeightStories: data.stories
            },
            zoning: {
              zoningDistrict: data.zoningCode
            }
          }
        });
      } else {
        sendResponse({ success: false, message: "No data found." });
      }
      return true;
    }
  });

})();

/**
 * FEASIBILITY STUDY Data - APN to Address Scanner
 * Bóc tách Địa chỉ thực tế và thông số từ Google Search khi tìm kiếm "[mã] APN CA".
 * Xử lý chính xác dữ liệu từ Google AI Overview và Snippets (Zillow, Redfin, v.v.)
 */

(function initApnAddressExtractor() {
  if (window.__APN_ADDRESS_EXTRACTOR_LOADED__) return;
  window.__APN_ADDRESS_EXTRACTOR_LOADED__ = true;

  function waitForWindowLoad() {
    return new Promise((resolve) => {
      if (document.readyState === "complete") {
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
   * Bóc tách Địa chỉ và Thông số (Property Type, Size, Layout, County) từ Google Search
   */
  function extractApnGoogleData() {
    const fullText = document.body ? document.body.innerText : "";
    if (!fullText || fullText.length < 30) return null;

    let address = null;
    let propType = null;
    let bldgSize = null;
    let layout = null;
    let county = null;

    // =========================================================================
    // 1. TRÍCH XUẤT ĐỊA CHỈ (ADDRESS)
    // =========================================================================
    // Mẫu 1: Từ AI Overview ("Address: 12881 Lucille Ave, Garden Grove, CA 92841" hoặc "located at ...")
    const aiAddressMatch = fullText.match(/(?:Address|located at)[\s:\-–—]{1,8}(\d{1,6}\s+[A-Za-z0-9\s\.\,\#\-]+,\s*[A-Za-z\s]{3,30},\s*(?:CA|California)\s*\d{0,5})/i);
    if (aiAddressMatch && aiAddressMatch[1]) {
      address = aiAddressMatch[1].replace(/\s+/g, ' ').trim();
    }

    // Mẫu 2: Từ tiêu đề kết quả (Zillow, Redfin: "12881 Lucille Ave, Garden Grove, CA 92841")
    if (!address) {
      const addressPatterns = [
        /\b(\d{1,6}\s+[A-Za-z0-9\s\.\,\#\-]+(?:AVE|ST|RD|BLVD|DR|LN|CT|WAY|CIR|PL|TER|PKWY|HWY|AVENUE|STREET|ROAD|DRIVE|LANE|COURT|CIRCLE|PLACE|TERRACE|PARKWAY|HIGHWAY)\s*,\s*([A-Za-z\s]{3,30})\s*,\s*(?:CA|California)\s*(\d{5}))\b/i,
        /\b(\d{1,6}\s+[A-Za-z0-9\s\.\,\#\-]+(?:AVE|ST|RD|BLVD|DR|LN|CT|WAY|CIR|PL|TER|PKWY|HWY|AVENUE|STREET|ROAD|DRIVE|LANE|COURT|CIRCLE|PLACE|TERRACE|PARKWAY|HIGHWAY)\s*,\s*([A-Za-z\s]{3,30})\s*,\s*CA\b)/i
      ];

      const titleElements = Array.from(document.querySelectorAll('h1, h2, h3, [data-attrid*="title"], [data-attrid*="address"], [class*="title"], [class*="address"]'));
      for (const el of titleElements) {
        const text = (el.innerText || '').trim();
        for (const pat of addressPatterns) {
          const m = text.match(pat);
          if (m && m[1]) {
            address = m[1].replace(/\s+/g, ' ').trim();
            break;
          }
        }
        if (address) break;
      }

      // Mẫu 3: Quét body text toàn trang
      if (!address) {
        for (const pat of addressPatterns) {
          const m = fullText.match(pat);
          if (m && m[1]) {
            address = m[1].replace(/\s+/g, ' ').trim();
            break;
          }
        }
      }
    }

    if (!address) return null;

    // =========================================================================
    // 2. TRÍCH XUẤT THÔNG SỐ (PROPERTY SPECS TỪ AI OVERVIEW / SNIPPETS)
    // =========================================================================
    // Property Type (vd: "Single Family Home", "Residential Property")
    const propTypeMatch = fullText.match(/Property\s*Type[\s:\-–—]{1,8}([^\n\r,\.;•|]{3,50})/i)
                       || fullText.match(/\b(Single\s*Family(?:\s*Home|\s*Residence)?|Multi\s*Family|Condo|Townhouse|Apartment)\b/i);
    if (propTypeMatch && propTypeMatch[1]) {
      propType = propTypeMatch[1].trim();
    }

    // Size / Living Area (vd: "Size: 1,017 Square Feet" hoặc "1017 Square Feet single family")
    const sizeMatch = fullText.match(/Size[\s:\-–—]{1,8}([\d,]+)\s*(?:Square Feet|sq\s*ft|sqft)/i)
                   || fullText.match(/([\d,]+)\s*(?:Square Feet|sq\s*ft|sqft)\s*(?:single family|home|property)/i);
    if (sizeMatch && sizeMatch[1]) {
      const num = Number(sizeMatch[1].replace(/,/g, ''));
      if (num >= 200 && num <= 500000) bldgSize = num;
    }

    // Layout (vd: "Layout: 2 bedrooms, 1 bathroom" hoặc "2 beds, 1 bath")
    const layoutMatch = fullText.match(/Layout[\s:\-–—]{1,8}([^\n\r,•|]{3,50})/i)
                     || fullText.match(/(\d+\s*(?:beds?|bedrooms?)\s*,\s*\d+\s*(?:baths?|bathrooms?))/i);
    if (layoutMatch && layoutMatch[1]) {
      layout = layoutMatch[1].trim();
    }

    // County (vd: "in Orange County, California")
    const countyMatch = fullText.match(/in\s+([A-Za-z\s]+)\s+County,\s*California/i);
    if (countyMatch && countyMatch[1]) {
      county = `${countyMatch[1].trim()} County`;
    }

    return {
      address,
      propType,
      bldgSize,
      layout,
      county
    };
  }

  // Khởi chạy quy trình bóc tách khi được giao vai trò
  async function startApnWorkflow() {
    await waitForWindowLoad();
    await new Promise((r) => setTimeout(r, 400));

    chrome.runtime.sendMessage({ action: "GET_SEARCH_PIPELINE_ROLE" }, (response) => {
      if (chrome.runtime.lastError || !response || response.role !== "APN_TO_ADDRESS_SEARCH") {
        return; // Người dùng duyệt web bình thường -> Không can thiệp
      }

      const apn = response.apn || "";
      let isDone = false;

      function checkApnData() {
        if (isDone) return true;
        const result = extractApnGoogleData();
        if (result && result.address) {
          isDone = true;
          chrome.runtime.sendMessage({
            action: "APN_ADDRESS_RESOLVED",
            apn: apn,
            address: result.address,
            specs: {
              propType: result.propType,
              bldgSize: result.bldgSize,
              layout: result.layout,
              county: result.county
            }
          });
          return true;
        }
        return false;
      }

      if (!checkApnData()) {
        let attempts = 0;
        const timer = setInterval(() => {
          attempts++;
          if (checkApnData() || attempts >= 20) {
            clearInterval(timer);
            if (!isDone && attempts >= 20) {
              // Timeout sau 10 giây nếu không tìm thấy địa chỉ từ APN
              chrome.runtime.sendMessage({
                action: "APN_ADDRESS_RESOLVE_FAILED",
                apn: apn,
                message: "Address not found for APN: " + apn
              });
            }
          }
        }, 500);

        const observer = new MutationObserver(() => {
          if (checkApnData()) {
            observer.disconnect();
            clearInterval(timer);
          }
        });
        if (document.body) observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  }

  startApnWorkflow();
})();

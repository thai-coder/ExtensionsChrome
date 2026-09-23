/**
 * FEASIBILITY STUDY Data - LA Assessor Portal Map Extractor
 * Tự động nhận địa chỉ từ ZIMAS fallback (qua chrome.storage.local) và điền vào ô tìm kiếm
 */

(function () {
  if (window.__LA_MAP_EXTRACTOR_LOADED__) return;
  window.__LA_MAP_EXTRACTOR_LOADED__ = true;

  // Hàm đợi Element xuất hiện
  const waitForElement = (selector, timeout = 10000) => {
    return new Promise((resolve) => {
      if (document.querySelector(selector)) return resolve(document.querySelector(selector));

      const observer = new MutationObserver(() => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  };

  // Hàm tạm dừng
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Chuẩn hóa chuỗi (Fuzzy Match)
  const normalizeString = (str) => {
    return (str || '')
      .toUpperCase()
      .replace(/[,.]/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  /**
   * BƯỚC 2: Chờ và trích xuất link Parcel Map / Map Index và gắn vào 2 button
   */
  async function executeStep2_ExtractMapLinks(ain) {
    console.log("=== Bắt đầu Bước 2: Chờ và trích xuất link Parcel Map / Map Index ===");

    // Hàm đợi cho đến khi ít nhất một trong hai thẻ link xuất hiện
    const waitForTargetLinks = async (timeout = 15000) => {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        const allLinks = document.querySelectorAll('a');
        for (let a of allLinks) {
          const text = a.textContent.trim();
          if (text === 'Parcel Map' || text === 'Map Index') {
            return true;
          }
        }
        await sleep(500);
      }
      return false;
    };

    console.log("[LA Map Extractor] [Bước 2] Đang chờ giao diện render các thẻ link...");
    const linksAppeared = await waitForTargetLinks(15000);

    if (!linksAppeared) {
      console.error("[LA Map Extractor] [Bước 2 - Lỗi] Hết thời gian chờ (15s). Không tìm thấy thẻ chứa 'Parcel Map' hoặc 'Map Index'.");
      return null;
    }

    await sleep(500);

    const allLinks = document.querySelectorAll('a');
    let parcelMapUrl = null;
    let mapIndexUrl = null;

    for (let a of allLinks) {
      const text = a.textContent.trim();
      if (text === 'Parcel Map') {
        parcelMapUrl = a.href;
      } else if (text === 'Map Index') {
        mapIndexUrl = a.href;
      }
      if (parcelMapUrl && mapIndexUrl) {
        break;
      }
    }

    console.log(`[LA Map Extractor] [Bước 2] 🎉 Đã trích xuất thành công:`);
    console.log(`- Link Parcel Map: ${parcelMapUrl || 'Không tìm thấy'}`);
    console.log(`- Link Map Index:  ${mapIndexUrl || 'Không tìm thấy'}`);

    // Gắn giá trị vào 2 button (Parcels & Tract Map) thông qua storage cho Popup
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const payload = {
        ocgisMapLinks: {
          source: "la-assessor",
          parcels: parcelMapUrl,
          tractMap: mapIndexUrl,
          updatedAt: Date.now()
        }
      };
      if (ain) {
        payload.lastApn = ain;
      }
      await chrome.storage.local.set(payload);
      console.log("[LA Map Extractor] [Bước 2] Đã lưu 2 link Parcels và Tract Map vào storage cho Popup.");
    }

    // Hiển thị thông báo Floating UI
    if (typeof FloatingUI !== 'undefined') {
      FloatingUI.showSuccess(
        "Trích xuất LA Assessor thành công!",
        `Parcels: ${parcelMapUrl ? "Đã sẵn sàng" : "N/A"}\nTract Map: ${mapIndexUrl ? "Đã sẵn sàng" : "N/A"}`
      );
    }

    return {
      parcelMap: parcelMapUrl,
      mapIndex: mapIndexUrl
    };
  }

  /**
   * BƯỚC 1.1: Chờ bảng xuất hiện và chọn hàng tương đồng nhất
   */
  async function executeStep1_1_FindAndSelectSimilarRow(inputAddress) {
    console.log("=== Bắt đầu Bước 1.1: Tìm kiếm dòng dữ liệu tương đối ===");

    const targetAddress = normalizeString(inputAddress);
    console.log(`[LA Map Extractor] [Bước 1.1] Chuỗi tìm kiếm đã chuẩn hóa: "${targetAddress}"`);

    // Đợi bảng kết quả render
    const tableRow = await waitForElement('.MuiTableBody-root .MuiTableRow-root', 15000);
    if (!tableRow) {
      console.error("[LA Map Extractor] [Bước 1.1 - Lỗi] Không tìm thấy dữ liệu bảng. Bảng chưa load hoặc sai Selector.");
      return null;
    }

    // Chờ thêm một chút để React render đầy đủ các hàng
    await sleep(1000);

    const rows = document.querySelectorAll('.MuiTableBody-root .MuiTableRow-root');
    console.log(`[LA Map Extractor] [Bước 1.1] Tìm thấy ${rows.length} kết quả trên bảng. Đang đối chiếu...`);

    let isFound = false;
    let matchedData = null;

    for (let row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) continue;

      const rowAIN = cells[0].textContent.trim();
      const rawRowAddress = cells[1].textContent.trim();
      const normalizedRowAddress = normalizeString(rawRowAddress);

      // So sánh tương đối
      if (normalizedRowAddress.includes(targetAddress) || targetAddress.includes(normalizedRowAddress)) {
        console.log(`[LA Map Extractor] [Bước 1.1] 🎉 ĐÃ TÌM THẤY DÒNG TƯƠNG ĐỐI GIỐNG!`);
        console.log(`- Địa chỉ trên web: ${rawRowAddress}`);
        console.log(`- Mã AIN tương ứng: ${rowAIN}`);

        row.click();
        isFound = true;
        matchedData = { ain: rowAIN, address: rawRowAddress, element: row };
        break;
      }
    }

    // Fallback: Nếu so sánh đầy đủ không khớp, so khớp phần số nhà + tên đường
    if (!isFound) {
      const streetPart = targetAddress.split(/\s+/).slice(0, 3).join(' ');
      if (streetPart) {
        for (let row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length < 2) continue;

          const rowAIN = cells[0].textContent.trim();
          const rawRowAddress = cells[1].textContent.trim();
          const normalizedRowAddress = normalizeString(rawRowAddress);

          if (normalizedRowAddress.includes(streetPart)) {
            console.log(`[LA Map Extractor] [Bước 1.1] 🎉 Khớp theo số nhà/tên đường (${streetPart}): ${rawRowAddress}`);
            row.click();
            isFound = true;
            matchedData = { ain: rowAIN, address: rawRowAddress, element: row };
            break;
          }
        }
      }
    }

    if (!isFound) {
      console.warn(`[LA Map Extractor] [Bước 1.1 - Thất bại] Không tìm thấy dòng nào khớp với nội dung: "${inputAddress}"`);
    }

    return matchedData;
  }

  /**
   * BƯỚC 1: Nhập địa chỉ vào ô input MUI (#outlined-basic) và nhấn Tìm kiếm
   */
  async function executeStep1_InputMUI(addressToInput) {
    if (!addressToInput) return;
    console.log(`[LA Map Extractor] [Bước 1] Bắt đầu nhập địa chỉ: ${addressToInput}`);

    const inputField = await waitForElement('#outlined-basic', 10000);

    if (inputField) {
      // Bộ setter gốc của HTMLInputElement để kích hoạt React state
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(inputField, addressToInput);

      // Bắn sự kiện input/change để React nhận diện
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new Event('change', { bubbles: true }));

      console.log(`[LA Map Extractor] [Bước 1] Đã điền thành công: ${addressToInput}`);

      // Chờ React cập nhật state trước khi search
      await sleep(500);

      // Tìm và click nút Search (title="search-button") hoặc nhấn phím Enter
      const searchButton = document.querySelector('button[title="search-button"]');
      if (searchButton) {
        searchButton.click();
        console.log("[LA Map Extractor] [Bước 1] Đã click nút tìm kiếm (Search Button). Đang đợi kết quả...");
      } else {
        // Fallback: bắn phím Enter vào ô input
        inputField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        inputField.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        inputField.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        console.log("[LA Map Extractor] [Bước 1] Không thấy nút Search, đã kích hoạt phím Enter.");
      }

      // Nối tiếp sang Bước 1.1: Chờ bảng và chọn dòng khớp
      const matched = await executeStep1_1_FindAndSelectSimilarRow(addressToInput);

      if (!matched) {
        console.warn("[LA Map Extractor] [Bước 1.1 - Thất bại] Không tìm thấy kết quả khớp trong bảng. Dừng quy trình, không chạy Bước 2.");
        return;
      }

      console.log("[LA Map Extractor] [Bước 1.1 -> Bước 2] Đã chọn dòng thành công. Đang đợi render trang chi tiết để trích xuất link...");
      await sleep(1500);

      // Nối tiếp sang Bước 2: Chờ và trích xuất link bản đồ
      await executeStep2_ExtractMapLinks(matched.ain);
    } else {
      console.error("[LA Map Extractor] [Bước 1 - Lỗi] Không tìm thấy ô nhập địa chỉ (#outlined-basic).");
    }
  }

  // Khởi động: Kiểm tra dữ liệu chuyển tiếp từ ZIMAS
  function initLaExtractor() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      return;
    }

    chrome.storage.local.get(['laPortalPendingSearch'], async (res) => {
      const pending = res?.laPortalPendingSearch;
      if (!pending) {
        // Nếu người dùng mở trực tiếp trang chi tiết parceldetail thì tự quét link
        if (window.location.href.includes('/parceldetail/')) {
          await executeStep2_ExtractMapLinks();
        }
        return;
      }

      // Kiểm tra timeout (trong vòng 5 phút)
      const isFresh = pending.timestamp && (Date.now() - pending.timestamp < 5 * 60 * 1000);
      if (isFresh) {
        const address = pending.address || pending.addressToSearch;
        // Xóa cờ pending để tránh tự động điền lại khi người dùng F5
        chrome.storage.local.remove('laPortalPendingSearch');
        if (address) {
          await executeStep1_InputMUI(address);
        }
      }
    });
  }

  window.executeStep1_InputMUI = executeStep1_InputMUI;
  window.executeStep1_1_FindAndSelectSimilarRow = executeStep1_1_FindAndSelectSimilarRow;
  window.executeStep2_ExtractMapLinks = executeStep2_ExtractMapLinks;

  initLaExtractor();
})();


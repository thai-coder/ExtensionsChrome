/**
 * FEASIBILITY STUDY Data - ZIMAS Extractor (LA County)
 * B1: Trải nghiệm tại ZIMAS
 * C1: Nếu không tìm thấy, điều hướng tới LA County Assessor Portal
 */

(function () {
  if (window.__ZIMAS_EXTRACTOR_LOADED__) return;
  window.__ZIMAS_EXTRACTOR_LOADED__ = true;

  console.log("[ZIMAS Extractor] Khởi động trình hỗ trợ ZIMAS LA...");

  // Hàm tạm dừng để chờ giao diện (Angular) kịp phản hồi các hiệu ứng chuyển động
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Hàm tiện ích hỗ trợ đợi giao diện Angular load
  const waitForElement = (selector, timeout = 15000) => {
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

  /**
   * BƯỚC 1: Tự động kiểm tra và chấp nhận Modal "Welcome to ZIMAS" & Điều khoản sử dụng
   */
  function step1_acceptWelcomeModal() {
    return new Promise((resolve) => {
      const checkZimasModal = setInterval(() => {
        // 1. Tìm tiêu đề modal xem có chữ "Welcome to ZIMAS" không
        const modalTitles = document.querySelectorAll('h4.modal-title');
        let isModalPresent = false;

        for (let title of modalTitles) {
          if (title.textContent.trim() === 'Welcome to ZIMAS') {
            isModalPresent = true;
            break;
          }
        }

        // Nếu modal đã xuất hiện, tiến hành thao tác
        if (isModalPresent) {
          // 2. Tìm và tick chọn checkbox (bỏ qua các attribute ngẫu nhiên của Angular)
          const checkbox = document.getElementById('checkSaveAcceptTerms');
          if (checkbox && !checkbox.checked) {
            checkbox.click(); // Dùng click() thay vì checked = true để kích hoạt event của Angular
          }

          // 3. Tìm và click nút Accept
          const buttons = document.querySelectorAll('button[data-bs-dismiss="modal"]');
          for (let btn of buttons) {
            if (btn.textContent.trim() === 'Accept') {
              btn.click();
              console.log("[ZIMAS Extractor] Bước 1: Đã tự động xác nhận ZIMAS Terms and Conditions!");

              // 4. Xóa vòng lặp sau khi đã thực hiện thành công để không làm nặng máy
              clearInterval(checkZimasModal);
              resolve(true);
              break;
            }
          }
        }
      }, 1000);

      // Nếu không có modal sau 5s thì hoàn thành bước 1
      setTimeout(() => {
        resolve(false);
      }, 5000);
    });
  }

  /**
   * BƯỚC 2: Tìm kiếm bất động sản theo địa chỉ và chọn kết quả (Search By Address & Select Row)
   */
  async function step2_searchAddress(customAddress) {
    // Xử lý tách chuỗi để lấy phần "Số nhà + Tên đường" và "Zip Code"
    const rawAddress = typeof customAddress === 'string' ? customAddress : '';
    const addressToSearch = rawAddress.split(',')[0].trim().toUpperCase();
    const zipRegex = rawAddress.match(/\b\d{5}\b/);
    const zipToSearch = zipRegex ? zipRegex[0] : '';

    if (!addressToSearch) {
      console.warn('[ZIMAS Extractor] Không có địa chỉ hợp lệ. Dừng thực thi.');
      return;
    }

    console.log(`[ZIMAS Extractor] === BẮT ĐẦU TÌM KIẾM VÀ TRÍCH XUẤT CHO: ${addressToSearch} ===`);

    // ==========================================
    // PHẦN 1: BƯỚC 2 - NHẬP ĐỊA CHỈ & NHẤN GO
    // ==========================================
    console.log("[ZIMAS Extractor] [Bước 2] Kiểm tra chế độ tìm kiếm...");
    let isSearchByAddress = false;
    const searchLabels = document.querySelectorAll('div.text-primary.text-uppercase b');

    for (let label of searchLabels) {
      if (label.textContent.trim() === 'Search By Address:') {
        isSearchByAddress = true;
        break;
      }
    }

    // Chọn lại dropdown nếu sai chế độ
    if (!isSearchByAddress) {
      console.log("[ZIMAS Extractor] [Bước 2] Đang mở menu để chuyển sang 'Search By Address'...");
      const searchDropdownToggles = document.querySelectorAll('a[data-bs-toggle="dropdown"]');
      for (let toggle of searchDropdownToggles) {
        if (toggle.textContent.includes('Search') || toggle.querySelector('.bi-search')) {
          toggle.click();
          await sleep(500);

          const dropdownItems = document.querySelectorAll('.dropdown-menu.show button.dropdown-item span');
          for (let item of dropdownItems) {
            if (item.textContent.trim() === 'Address') {
              item.parentElement.click();
              console.log("[ZIMAS Extractor] [Bước 2] Đã chuyển sang chế độ 'Address'.");
              await sleep(1000); // Chờ form tải lại
              break;
            }
          }
          break;
        }
      }
    }

    // Tìm ô Input -> Điền data -> Trigger event -> Click GO
    const addressInput = await waitForElement('input[name="inputADDR"]', 5000);
    if (addressInput) {
      addressInput.value = addressToSearch;
      // Báo cho Angular biết dữ liệu đã thay đổi
      addressInput.dispatchEvent(new Event('input', { bubbles: true }));
      addressInput.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`[ZIMAS Extractor] [Bước 2] Đã điền địa chỉ: ${addressToSearch}`);

      await sleep(500); // Tránh click quá nhanh

      const goButton = document.querySelector('input[value="GO"][aria-label="Start Search"]');
      if (goButton) {
        goButton.click();
        console.log("[ZIMAS Extractor] [Bước 2] Đã nhấn nút GO. Đang tải kết quả từ server...");
      } else {
        console.error("[ZIMAS Extractor] [Bước 2 - Lỗi] Không tìm thấy nút GO.");
        return; // Dừng nếu lỗi
      }
    } else {
      console.error("[ZIMAS Extractor] [Bước 2 - Lỗi] Không tìm thấy ô nhập địa chỉ (inputADDR).");
      return; // Dừng nếu lỗi
    }

    // ==========================================
    // PHẦN 2: BƯỚC 2.1 - LỌC VÀ CHỌN KẾT QUẢ
    // ==========================================
    console.log("[ZIMAS Extractor] [Bước 2.1] Đang chờ bảng kết quả xuất hiện...");

    // Đợi hàng tr đầu tiên của bảng kết quả (tối đa 15 giây)
    const tableRow = await waitForElement('table tbody tr[role="button"]', 15000);

    if (!tableRow) {
      console.warn('[ZIMAS Extractor] [Bước 2.1 - Cảnh báo] Hết thời gian chờ! Bảng kết quả không xuất hiện. Chuyển tiếp sang LA Assessor Portal.');
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          laPortalPendingSearch: {
            address: rawAddress || addressToSearch,
            addressToSearch: addressToSearch,
            zipToSearch: zipToSearch,
            timestamp: Date.now()
          }
        });
      }
      window.location.href = "https://portal.assessor.lacounty.gov/";
      return;
    }

    // Chờ thêm 1 giây để đảm bảo Angular đã render xong tất cả các hàng
    await sleep(1000);

    const rows = document.querySelectorAll('table tbody tr[role="button"]');
    console.log(`[ZIMAS Extractor] [Bước 2.1] Tìm thấy ${rows.length} kết quả. Đang tiến hành đối chiếu...`);

    let isMatched = false;

    // Duyệt qua từng dòng trong bảng
    for (let row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) continue;

      // Cột 1: Có thể chứa nhiều thẻ div địa chỉ (VD: 114 S MAIN ST, 116 S MAIN ST)
      const addressDivs = cells[0].querySelectorAll('div');
      let addressMatch = false;

      for (let div of addressDivs) {
        if (div.textContent.trim().toUpperCase() === addressToSearch) {
          addressMatch = true;
          break;
        }
      }

      // Cột 2 & Cột 3: Community Plan và Zip Code
      const rowCommunity = cells[1].textContent.trim();
      const rowZipCode = cells[2].textContent.trim();

      // Kiểm tra khớp Địa chỉ VÀ Zip Code (Nếu có truyền Zip)
      if (addressMatch && (zipToSearch === '' || rowZipCode === zipToSearch)) {
        console.log(`[ZIMAS Extractor] [Bước 2.1] 🎉 TRÚNG KHỚP! Click chọn: ${addressToSearch} | ${rowCommunity} | ${rowZipCode}`);
        row.click();
        isMatched = true;
        break;
      }
    }

    if (!isMatched) {
      //  console.warn(`[ZIMAS Extractor] [Bước 2.1 - Thất bại] Không có dòng nào trùng khớp chính xác với: ${addressToSearch} và Zip: ${zipToSearch}. Chuyển sang LA Assessor Portal.`);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          laPortalPendingSearch: {
            address: rawAddress || addressToSearch,
            addressToSearch: addressToSearch,
            zipToSearch: zipToSearch,
            timestamp: Date.now()
          }
        });
      }
      window.location.href = "https://portal.assessor.lacounty.gov/";
      return;
    } else {
      console.log("[ZIMAS Extractor] === HOÀN TẤT TOÀN BỘ BƯỚC 2 & BƯỚC 2.1 ===");
      await step3_extractZimasData();
    }
  }

  /**
   * BƯỚC 3: Trích xuất dữ liệu ZIMAS hàng loạt (APN & Map Sheet)
   * Gắn giá trị vào 2 button Parcels & Tract Map, sau đó gọi FloatingUI thông báo
   */
  async function step3_extractZimasData() {
    console.log("=== Bắt đầu Bước 3: Trích xuất dữ liệu ZIMAS hàng loạt ===");

    await waitForElement('.accordion-item .list-group-item', 10000);
    await sleep(1000); // Đợi bảng tải xong

    const listItems = document.querySelectorAll('.accordion-item .list-group-item');

    // 1. Khai báo danh sách các nhãn cần trích xuất
    const targets = ['Assessor Parcel No. (APN)', 'Map Sheet'];

    // 2. Mảng chứa kết quả trả về
    const extractedData = [];

    // 3. Quét qua DOM đúng 1 lần
    for (let item of listItems) {
      const itemText = item.textContent;

      // Kiểm tra xem dòng hiện tại có chứa từ khóa nào trong danh sách targets không
      const matchedTarget = targets.find(t => itemText.includes(t));

      if (matchedTarget) {
        const links = item.querySelectorAll('a');

        for (let a of links) {
          if (a.getAttribute('target') === '_blank' || a.classList.contains('link-dark')) {
            // Đẩy dữ liệu vào mảng
            extractedData.push({
              label: matchedTarget,
              value: a.textContent.trim(),
              link: a.href
            });
            break;
          }
        }
      }

      // Tối ưu hóa: Nếu đã tìm đủ số lượng các mục cần thiết thì ngắt vòng lặp sớm
      if (extractedData.length === targets.length) {
        break;
      }
    }

    // In kết quả trực quan ra Console
    console.table(extractedData);

    const apnItem = extractedData.find(t => t.label === 'Assessor Parcel No. (APN)');
    const mapSheetItem = extractedData.find(t => t.label === 'Map Sheet');

    const parcelsLink = apnItem ? apnItem.link : null;
    const tractMapLink = mapSheetItem ? mapSheetItem.link : null;

    // Gắn giá trị vào 2 button (Parcels & Tract Map) thông qua storage cho Popup
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({
        ocgisMapLinks: {
          source: "zimas",
          parcels: parcelsLink,
          tractMap: tractMapLink,
          updatedAt: Date.now()
        }
      });
      console.log("[ZIMAS Extractor] [Bước 3] Đã lưu 2 link Parcels và Tract Map vào storage cho Popup.");
    }

    // Button gắn value xong call floating-ui.js để thông báo kèm link Parcels & Tract Map
    if (typeof FloatingUI !== 'undefined') {
      const parcelsVal = apnItem ? apnItem.value : "N/A";
      const tractVal = mapSheetItem ? mapSheetItem.value : "N/A";
      FloatingUI.showSuccess(
        "Trích xuất ZIMAS thành công!",
        `Parcels: ${parcelsVal}\nTract Map: ${tractVal}`,
        8000,
        {
          parcels: parcelsLink,
          tractMap: tractMapLink
        }
      );
    }

    return extractedData;
  }

  // Khởi động quy trình các bước
  async function initZimasPipeline() {
    await step1_acceptWelcomeModal();
  }

  initZimasPipeline();

  chrome.runtime.sendMessage({ action: "GET_MAP_DOWNLOAD_TAB_ROLE" }, async (response) => {
    if (!response || response.role !== "MAP_DOWNLOAD" || response.countyKey !== "losAngeles") {
      return; // Không phải tab đang xử lý Map Download cho LA
    }

    const { address } = response;

    // Tự động chạy Bước 2 sau khi khởi tạo nếu có địa chỉ
    if (address) {
      await step2_searchAddress(address);
    }
  });

})();

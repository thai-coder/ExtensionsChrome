# Kế Hoạch Tối Ưu Hóa Bước 3: Tăng Tốc Tải Trang & Bóc Tách Bản Đồ Gridics PropZone

Tài liệu này phân tích chi tiết nguyên nhân nghẽn/chậm tại **Bước 3 (Bản đồ Gridics PropZone)**, thiết kế các giải pháp kỹ thuật triệt để (Chặn tài nguyên nặng, MutationObserver thời gian thực, Intercept API nội bộ, Auto Accordion an toàn) và đưa ra lộ trình kiểm định toàn diện.

---

## 1. Phân Tích Nguyên Nhân Gốc Rễ (Root Cause Analysis)

Qua rà soát mã nguồn `PropZoneData/content/extractor.js`, `background/service-worker.js` và cơ chế vận hành của trang `propzone.gridics.com`, Bước 3 đang bị vướng 4 vấn đề lớn:

### 1.1. Vướng cơ chế chờ tải `window.onload` & `document.readyState === "complete"`
- **Thực trạng**: `propzone.gridics.com` là ứng dụng SPA WebGL/Mapbox 3D rất nặng. Mapbox liên tục tải các vector tiles, raster tiles, glyphs và telemetry ngầm.
- **Hệ quả**: Sự kiện `window.onload` và `readyState === "complete"` thường bị hoãn lại từ **15 đến 35 giây** (thậm chí không bao giờ đạt complete nếu map tiles tiếp tục stream).
- **Điểm nghẽn trong code**: Hàm `waitForWindowLoad()` và `setTimeout(3500)` trong [extractor.js](file:///c:/Users/thailka/Desktop/SoftWare/Web/ExtensionsChrome/PropZoneData/content/extractor.js#L16-L32) khiến extension đứng im chờ đợi dù dữ liệu thuộc tính (Lot/Zoning) ở sidebar có thể đã tải xong từ sớm.

### 1.2. Tải lãng phí toàn bộ 3D Mapbox, GIS Polygons & Raster Tiles
- Extension chỉ cần lấy các thông số dạng text/bảng biểu ở **Left Overlay Sidebar** (Lot Size, Zoning Code, Setbacks, Max Height, Max Units).
- Trình duyệt lại phải tải hàng chục Megabyte dữ liệu WebGL, 3D building meshes, texture bản đồ vệ tinh không cần thiết cho việc bóc tách dữ liệu.

### 1.3. Xung đột vòng lặp Click Accordion (`ensureGridicsAccordionsExpanded`)
- Cứ mỗi 2 giây, vòng lặp lại quét DOM và gọi `el.click()` trên các nút accordion ZONING, SETBACKS, CAPACITY.
- Trong React SPA, việc spam `click()` khi DOM đang re-render dễ gây ra hiện tượng: Accordion vừa bung ra liền bị click đóng lại, làm mất dữ liệu ở chu kỳ quét kế tiếp và dẫn đến việc phải chờ đến tận timeout 45s.

### 1.4. Thiếu cơ chế đón bắt trực tiếp API Payload (Network / State Interception)
- Khi PropZone mở folio `?leftOverlay=properties&folio={apn}`, ứng dụng gửi request REST API / GraphQL nội bộ lấy trọn vẹn JSON thông số thuộc tính.
- Extension hiện tại chỉ phụ thuộc hoàn toàn vào việc cào DOM sau khi render, thay vì đón bắt trực tiếp JSON response ở tầng mạng hoặc state.

---

## 2. Thảo Luận Các Phương Án Kỹ Thuật (Architecture Discussion)

| Tiêu chí | Phương án 1: Tối ưu DOM Scanner + MutationObserver | Phương án 2: Chặn tài nguyên nặng (Resource Blocking) | Phương án 3: Intercept API Response (Fetch/XHR Sniffing) |
|---|---|---|---|
| **Cơ chế** | Bỏ `waitForWindowLoad`, dùng MutationObserver quét ngay khi có node dữ liệu xuất hiện | Dùng `declarativeNetRequest` chặn tile bản đồ 3D / ảnh vệ tinh không cần thiết | Bắt gói tin JSON từ backend Gridics qua Content Script Injection hoặc `chrome.debugger`/`webRequest` |
| **Tốc độ cải thiện** | Tăng tốc 3x - 5x (từ 30-45s xuống ~4-8s) | Tăng tốc 2x - 3x (giảm băng thông từ 25MB xuống < 3MB) | Tăng tốc tức thì (nhận dữ liệu trong 1-2s) |
| **Độ ổn định** | Rất cao, không phụ thuộc vào cấu trúc API nội bộ | Rất cao, không ảnh hưởng đến logic DOM | Cao, nhưng cần fallback nếu endpoint API đổi tên |
| **Đề xuất** | **BẮT BUỘC ÁP DỤNG** | **BẮT BUỘC ÁP DỤNG** | **KẾT HỢP DẠNG HYBRID (Ưu tiên API, Fallback DOM)** |

---

## 3. Kế Hoạch Triển Khai Kỹ Thuật (Implementation Plan)

### Giai đoạn 1: Tối Ưu Hóa Content Script & DOM Extraction ([extractor.js](file:///c:/Users/thailka/Desktop/SoftWare/Web/ExtensionsChrome/PropZoneData/content/extractor.js))
1. **Loại bỏ `waitForWindowLoad()` & Sleep 3.5s**:
   - Chuyển `extractor.js` sang chế độ **Eager Extraction**: Quét liên tục từ `document_idle` hoặc ngay khi có thay đổi DOM thông qua `MutationObserver`.
2. **Auto Accordion Thông Minh (Idempotent Click)**:
   - Thêm cờ đánh dấu `data-propzone-expanded="true"` sau khi mở một accordion.
   - Chỉ click mở nếu phần tử chưa từng được mở và `aria-expanded === "false"`. Tuyệt đối không click lặp lại.
3. **Phát hiện sớm trạng thái "Không có dữ liệu / Folio Not Found"**:
   - Nhận diện các thông báo "No property found", "Invalid Folio", "City not supported" để trả về kết quả ngay trong vòng 3s, tránh chờ vô ích 45s.

### Giai đoạn 2: Tăng Tốc Tải Trang Bằng Resource Optimization ([manifest.json](file:///c:/Users/thailka/Desktop/SoftWare/Web/ExtensionsChrome/PropZoneData/manifest.json) & [service-worker.js](file:///c:/Users/thailka/Desktop/SoftWare/Web/ExtensionsChrome/PropZoneData/background/service-worker.js))
1. **Cấu hình `declarativeNetRequest`**:
   - Tạo rule chặn tải các tài nguyên vector tile 3D nặng của Mapbox (`*.mapbox.com/v4/*`, `*tiles*`, `*.pbf`) trên tab tự động mở PropZone.
   - Giúp trang web tải xong toàn bộ UI và logic JS trong < 2 giây.
2. **Cắt giảm Timeout**:
   - Hạ mức timeout tối đa từ **45 giây** xuống **15 giây**.
   - Nếu sau 10 giây đã có Lot + Zoning, tiến hành lưu và đóng tab ngay thay vì chờ 18 giây.

### Giai đoạn 3: Tích Hợp API Interceptor / Page Context Sniffer
1. **Inject Script lắng nghe `fetch` / `XMLHttpRequest` trên PropZone**:
   - Bắt các response chứa từ khóa `properties`, `zoning`, `parcel`, `capacity` từ domain API Gridics.
   - Khi có JSON response -> bóc tách trực tiếp và dispatch CustomEvent về cho Content Script.

---

## 4. Kế Hoạch Kiểm Định (Verification & Testing Plan)

### 4.1. Kịch Bản Kiểm Tra Chức Năng (Functional Test Matrix)
- [ ] **Test Case 1 (Orange County - Westminster)**: Địa chỉ mẫu `14131 Magnolia St, Westminster, CA 92683` (Folio: `09638204`). Đo thời gian bóc tách Lot, Zoning, Setbacks, Capacity. (Mục tiêu: < 6 giây).
- [ ] **Test Case 2 (Orange County - Garden Grove)**: Địa chỉ mẫu `11301 Euclid St, Garden Grove, CA 92840`. Đo tốc độ mở tab và đóng tab tự động.
- [ ] **Test Case 3 (Direct Folio URL)**: Mở trực tiếp link PropZone có tham số `?leftOverlay=properties&folio=...` xem extension có tự lấy dữ liệu và đóng tab mượt mà không bị reload/kẹt tab.
- [ ] **Test Case 4 (Trường hợp không có Folio / Không hỗ trợ)**: Kiểm tra khả năng phát hiện lỗi nhanh và tự fallback an toàn không treo extension.

### 4.2. Tiêu Chí Đo Lường Thành Công (Success Metrics)
- **Thời gian hoàn tất Bước 3**: Giảm từ **30 - 45 giây** xuống **dưới 6 giây**.
- **Tỷ lệ đóng tab thành công**: Đạt **100%**, không xảy ra hiện tượng kẹt tab hay đóng tab khi chưa lấy đủ thông số Lot/Zoning.
- **Độ chính xác dữ liệu**: Không suy giảm số lượng trường dữ liệu (Zoning District, Code URL, Setbacks, Maximum Building Area, Stories).

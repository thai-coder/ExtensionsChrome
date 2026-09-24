# Kế Hoạch Kỹ Thuật: Ngăn Chặn Vòng Lặp Vô Hạn Khi Chọn Gợi Ý Trên PropZone Gridics

## 1. Phân Tích Nguyên Nhân Gốc Rễ (Root Cause Analysis)

### Hiện tượng:
- Sau khi `propzone-map-extractor.js` gõ địa chỉ và click vào gợi ý trong Dropdown, trang PropZone sẽ làm mới (Full Reload) hoặc điều hướng (SPA / URL Navigation) sang trang chi tiết lô đất (ví dụ: `/parcel/us/ca/...`).
- Khi trang được tải lại:
  1. Content script `propzone-map-extractor.js` được nạp lại từ đầu.
  2. Tab ID trong Chrome vẫn là Tab ID của quy trình (`pipelineSession.propZoneTabId`), nên Service Worker vẫn phản hồi `role = AUTO_PIPELINE`.
  3. Tại thời điểm trang vừa load, các bảng dữ liệu quy hoạch (`.tables`, `#Zoning`, `#Lot`, v.v.) chưa kịp render từ API React của Gridics -> `hasGridicsTablesDOM()` trả về `false`.
  4. Script thấy `!hasGridicsTablesDOM()` nên tiếp tục nhảy vào `step1_ForceFocusAndTyping()` để gõ lại và click lại -> **Vòng lặp vô hạn (Infinite Loop)**.

---

## 2. Phương Án Xử Lý Triệt Để

### Giải pháp 1: Khóa trạng thái theo phiên duyệt qua `sessionStorage`
- `sessionStorage` có đặc tính: **giữ nguyên giá trị khi trang Reload hoặc Chuyển hướng trong cùng 1 Tab**, nhưng tự hủy khi đóng tab.
- Thiết lập cờ trạng thái `__PROPZONE_SEARCH_STATE__`:
  - `INITIAL`: Chưa thực hiện tìm kiếm.
  - `SEARCH_COMPLETED`: Đã click vào gợi ý Dropdown và đang chờ trang tải dữ liệu lô đất.
  - `EXTRACTED`: Đã bóc tách thành công và lưu kết quả.
- **Quy tắc**: Chỉ chạy `step1_ForceFocusAndTyping()` khi `__PROPZONE_SEARCH_STATE__` chưa từng được kích hoạt (chưa có cờ `SEARCH_COMPLETED`).
- Ngay khi người dùng hoặc script click vào mục Dropdown -> ghi ngay `sessionStorage.setItem('__PROPZONE_SEARCH_STATE__', 'SEARCH_COMPLETED')`.

### Giải pháp 2: Nhận diện URL trang chi tiết (URL Pattern Check)
- Kiểm tra `window.location.pathname`:
  - Nếu URL đã là trang chi tiết lô đất (`/parcel/`, `/property/`, hoặc có query param `apn=`, `folio=`, `id=`), script **TUYỆT ĐỐI KHÔNG** gõ lại ô tìm kiếm, mà đi thẳng vào Bước 3 & 4 (Chờ bảng dữ liệu render & Trích xuất).

### Giải pháp 3: Đếm số lần tìm kiếm tối đa (Search Attempt Counter)
- Giới hạn số lần gõ tìm kiếm tối đa là **1 lần duy nhất** cho mỗi phiên làm việc.
- Nếu sau 1 lần tìm kiếm mà vẫn không ra lô đất sau thời gian chờ (15s), chuyển sang lưu dữ liệu hiện tại / kết thúc, không bao giờ gõ lại lần thứ 2.

---

## 3. Chi Tiết Các Bước Cần Triển Khai Trong Mã Nguồn

| Thành phần | Tập tin | Nội dung chỉnh sửa |
|---|---|---|
| **Content Script** | `FEASIBILITY STUDY Data/content/propzone-map-extractor.js` | 1. Thêm hàm kiểm tra `isParcelDetailPage()` dựa trên URL.<br>2. Bổ sung quản lý `sessionStorage.getItem('__PROPZONE_SEARCH_STATE__')`.<br>3. Bật cờ `SEARCH_COMPLETED` ngay trước khi click Dropdown.<br>4. Bỏ qua `step1_ForceFocusAndTyping` khi trang đã ở trạng thái `SEARCH_COMPLETED` hoặc là trang chi tiết. |
| **Background** | `FEASIBILITY STUDY Data/background/service-worker.js` | Đồng bộ dọn dẹp `pipelineSession.propZoneTabId` khi hoàn tất để đảm bảo an toàn. |

---

## 4. Tiêu Chuẩn Kiểm Thử (Verification Criteria)
- [ ] Khi tab `propzone.gridics.com/state/us/ca` mở lên: Gõ địa chỉ từng chữ -> Click Dropdown -> Trang reload/navigate.
- [ ] Sau khi trang reload: **Không gõ lại ô tìm kiếm**, script kiên nhẫn chờ bảng quy hoạch render -> Bóc tách Lot, Zoning, Setbacks, Capacity -> Lưu storage.
- [ ] **Giữ nguyên Tab PropZone mở** (không tự đóng tab) để người dùng xem trực quan lô đất trên bản đồ.
- [ ] Không xuất hiện bất kỳ chu kỳ lặp lại nào.

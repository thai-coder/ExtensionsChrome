# KẾ HOẠCH DỌN DẸP & ĐỒNG BỘ TOÀN BỘ CODEBASE (CLEANUP & SYNCHRONIZATION)

## 1. Mục Tiêu
- Kiểm tra và đảm bảo toàn bộ mã nguồn tuân thủ 100% nguyên tắc:
  1. Không có mã thừa, biến rác, comment lỗi thời.
  2. Tên hàm, tên Action và biến được chuẩn hoá theo luồng thực tế (tiền trạm APN $\rightarrow$ Bước 1 Google Overview $\rightarrow$ Bước 2 PropZone).
  3. Tuân thủ nguyên tắc SRP và giới hạn độ dài file (`< 600 dòng`).

---

## 2. Kết Quả Kiểm Tra Codebase Sau Khi Thêm Tính Năng APN

### A. Về tính đúng đắn của logic (Rule Adherence)
- [x] **Kích hoạt có chủ đích**: Chỉ khởi động khi người dùng bấm Fetch hoặc nhấn Enter trên Popup.
- [x] **Nhận diện thông minh**:
  - Nhập APN $\rightarrow$ Chạy bước tiền trạm `APN_TO_ADDRESS_SEARCH` $\rightarrow$ Khi có địa chỉ thì tự động nối vào Luồng chính (1\*).
  - Nhập Địa chỉ $\rightarrow$ Chạy thẳng vào Luồng chính (1\*).
- [x] **Luồng chính (1\*) tuần tự**:
  - Bước 1: Google Properties Overview $\rightarrow$ Bóc tách Specs $\rightarrow$ Đóng tab.
  - Bước 2: PropZone Gridics Map $\rightarrow$ Bóc tách Zoning, Lot, Setbacks, Capacity $\rightarrow$ Đóng tab.
- [x] **Bảo vệ người dùng**: Duyệt web Google hay PropZone bình thường hoàn toàn không bị can thiệp.

### B. Các điểm tồn đọng cần dọn dẹp (Cleanup Backlog)

| File | Dòng | Vấn đề tồn đọng | Giải pháp xử lý |
| :--- | :--- | :--- | :--- |
| `service-worker.js` | 1 - 7 | Header comment ghi quy trình 3 bước cũ (Bước 1 tìm APN) | Cập nhật header comment đúng theo 2 luồng (Tiền trạm APN + Luồng chính 2 bước). |
| `service-worker.js` | 65-67, 195-197 | Khối dòng trống thừa do xoá hàm cũ | Xoá bỏ dòng trống thừa. |
| `service-worker.js` | 88, 201 | Tên Action `STEP2_PROPERTY_OVERVIEW_FOUND` và hàm `handleStep2...` | Đồng bộ thành `PROPERTY_OVERVIEW_FOUND` và `handlePropertyOverviewFound`. |
| `service-worker.js` | 95, 276 | Tên hàm `handleStep3SaveAndClose` | Đồng bộ thành `handlePropZoneSaveAndClose`. |
| `google-extractor.js` | 353 | Gửi `STEP2_PROPERTY_OVERVIEW_FOUND` | Đổi sang `PROPERTY_OVERVIEW_FOUND`. |
| `google-extractor.js` | 1 - 5 | Header comment cũ | Chuẩn hoá mô tả chức năng. |

---

## 3. Các Bước Triển Khai (Action Plan)

1. **Bước 1: Chuẩn hoá [google-extractor.js](file:///c:/Users/thailka/Desktop/SoftWare/Web/ExtensionsChrome/FEASIBILITY%20STUDY%20Data/content/google-extractor.js)** - ✅ ĐÃ HOÀN TẤT
   - Đổi action `STEP2_PROPERTY_OVERVIEW_FOUND` $\rightarrow$ `PROPERTY_OVERVIEW_FOUND`.
   - Chuẩn hoá header comment.

2. **Bước 2: Đồng bộ & Dọn dẹp [service-worker.js](file:///c:/Users/thailka/Desktop/SoftWare/Web/ExtensionsChrome/FEASIBILITY%20STUDY%20Data/background/service-worker.js)** - ✅ ĐÃ HOÀN TẤT
   - Cập nhật header comment phản ánh đúng kiến trúc mới.
   - Đồng bộ tên listener và hàm xử lý `PROPERTY_OVERVIEW_FOUND` và `handlePropertyOverviewFound`.
   - Đổi `handleStep3SaveAndClose` $\rightarrow$ `handlePropZoneSaveAndClose`.
   - Xoá các dòng trống thừa.

3. **Bước 3: Xác thực tổng thể** - ✅ ĐÃ HOÀN TẤT
   - Kiểm tra syntax và tính toàn vẹn của cả 4 file: `google-extractor.js`, `apn-address-extractor.js`, `service-worker.js`, `manifest.json`.

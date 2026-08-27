# KẾ HOẠCH PHÁT TRIỂN: HỆ THỐNG DUAL-MODE (FLIPBOOK DOWNLOADER & PRINTFRIENDLY PDF)

## 1. Tầm Nhìn & Mục Tiêu

Nâng cấp bộ công cụ thành một hệ thống **2 trong 1 (Dual-Mode)** đáp ứng trọn vẹn mọi nhu cầu tải tài liệu trên web:

1. **Chế độ 1: 📖 Flipbook & Scanned Book Downloader**
   - Chuyên dụng cho các trang đọc sách scan, sách lật trang (Flipbook/Viewer).
   - Tự động dò URL Pattern, tải đa luồng, hỗ trợ xuất thành **file ZIP** hoặc ghép trực tiếp thành **file PDF**.

2. **Chế độ 2: 📄 Friendly Web-to-PDF & Clean Document Downloader** *(Tương tự PrintFriendly & PDF)*
   - Chuyên dụng cho bài báo, bài viết, tài liệu học tập dạng web, hoặc các trang nhúng PDF bị khóa nút tải.
   - Tự động trích xuất nội dung cốt lõi (loại bỏ quảng cáo, sidebar, thanh điều hướng rác).
   - Cho phép chỉnh sửa nhanh (xóa khối rác, ẩn ảnh, đổi cỡ chữ) và xuất ra file **PDF chuẩn A4**.
   - Tự động nhận diện và tải trực tiếp file `.pdf` gốc nếu trang web nhúng PDF Viewer (PDF.js, Embed, Blob).

---

## 2. Kiến Trúc Module & Phân Tách Trách Nhiệm

Để tuân thủ nghiêm ngặt quy tắc `max-file-length-rule` (< 600 dòng/file):

```
ExtensionsChrome/
├── manifest.json                  # Cấu hình Manifest V3 & Commands
├── background/
│   └── service-worker.js         # Service Worker & Menu Context
├── lib/
│   ├── jszip.min.js              # Thư viện ZIP offline
│   └── jspdf.min.js              # Thư viện xuất PDF client-side
├── content/
│   ├── unblocker.js              # Safe Unblock cơ chế chuột phải & copy
│   ├── detector.js               # Quét Pattern ảnh cho Flipbook
│   ├── pdf-detector.js           # [MỚI] Nhận diện link PDF nhúng & trích xuất Article DOM
│   ├── downloader.js             # Engine tải ảnh đa luồng & Auto-Patch
│   ├── pdf-engine.js             # [MỚI] Engine tạo Clean PDF & gộp ảnh thành PDF
│   ├── ui.js                     # Giao diện Tabbed Shadow DOM (Cố định, Responsive)
│   └── content-main.js           # Điều phối kích hoạt
├── popup/
│   ├── popup.html & popup.css    # Popup chọn chế độ nhanh
│   └── popup.js                  # Logic Popup
└── scripts/
    ├── bookmarklet.js            # Standalone Bookmarklet
    └── tampermonkey.user.js      # Userscript hỗ trợ cả 2 chế độ
```

---

## 3. Chi Tiết Tính Năng Của Từng Chế Độ

### A. Chế độ 1: Flipbook Downloader (Nâng Cấp)
- **Tùy chọn định dạng đầu ra**:
  - `📦 Xuất ZIP`: Giữ nguyên chất lượng ảnh gốc.
  - `📄 Ghép PDF`: Tự động căn chỉnh các trang ảnh vào tài liệu PDF chuẩn, không bị vỡ khung.
- **Cơ chế tải**: Giữ nguyên cơ chế đa luồng, exponential backoff và resume chống rớt file.

### B. Chế độ 2: Friendly PDF (Mới)
1. **Trích xuất nội dung thông minh (Smart Article Parsing)**:
   - Thuật toán xác định vùng nội dung chính (Main Content Area).
   - Tự động loại bỏ: Quảng cáo (`ads`, `sponsor`), Menu điều hướng (`nav`, `header`), Sidebar rác, Bình luận và Chân trang (`footer`).
2. **Bộ tùy biến nhanh trước khi in (PrintFriendly Toolbar)**:
   - Nút **Ẩn/Hiện hình ảnh** (No-images mode để tiết kiệm trang & mực in).
   - Thanh điều chỉnh **Cỡ chữ (Font Size: 80% - 130%)**.
   - Bấm vào bất kỳ đoạn văn/ảnh rác nào để **Xóa ngay lập tức (Click-to-Delete)**.
3. **Trích xuất PDF nhúng (Embedded PDF Sniffer)**:
   - Quét tìm các thẻ `<embed type="application/pdf">`, `<iframe src="...pdf">`, `pdf.worker`, Blob URL để tải trực tiếp file PDF gốc.

---

## 4. Thiết Kế Giao Diện (Tabbed Shadow DOM UI)

Giao diện Floating Panel cố định góc phải, gồm 2 tab chuyển đổi mượt mà:

```
+-------------------------------------------------------------+
| 📖 DOCUMENT & PDF PRO                          [✕ Đóng]    |
| [ 📖 Tải Sách Flipbook ]     [ 📄 In & Tải PDF Sạch ]       |
+-------------------------------------------------------------+
| (Nội dung của Tab được chọn)                                |
| ...                                                         |
+-------------------------------------------------------------+
```

---

## 5. Kế Hoạch Triển Khai (Execution Steps)

1. **Bước 1**: Tích hợp module `jspdf` hoặc module HTML-to-PDF / Image-to-PDF engine siêu nhẹ.
2. **Bước 2**: Tạo module [pdf-detector.js](file:///c:/Users/thailka/Desktop/SoftWare/Web/ExtensionsChrome/content/pdf-detector.js) để bóc tách nội dung chính và quét link PDF nhúng.
3. **Bước 3**: Tạo module [pdf-engine.js](file:///c:/Users/thailka/Desktop/SoftWare/Web/ExtensionsChrome/content/pdf-engine.js) xử lý tạo PDF từ ảnh scan hoặc từ nội dung sạch.
4. **Bước 4**: Cập nhật [ui.js](file:///c:/Users/thailka/Desktop/SoftWare/Web/ExtensionsChrome/content/ui.js) hỗ trợ Tab navigation (Chuyển đổi giữa Flipbook và Friendly PDF).
5. **Bước 5**: Đồng bộ hóa sang [tampermonkey.user.js](file:///c:/Users/thailka/Desktop/SoftWare/Web/ExtensionsChrome/scripts/tampermonkey.user.js).
6. **Bước 6**: Kiểm thử toàn diện và cập nhật tài liệu hướng dẫn [README.md](file:///c:/Users/thailka/Desktop/SoftWare/Web/ExtensionsChrome/README.md).

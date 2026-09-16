# KẾ HOẠCH TRIỂN KHAI: BỘ TIỆN ÍCH TẢI FLIPBOOK & TÀI LIỆU SÁCH TRỰC TUYẾN

## 1. Mục Tiêu
Triển khai trọn bộ công cụ tự động trích xuất và tải toàn bộ ảnh từ các trang đọc sách trực tuyến (Flipbook / Scanned Viewer) về máy tính thành file ZIP tại thư mục `C:\Users\thailka\Desktop\SoftWare\Web\ExtensionsChrome`.

## 2. Các Thành Phần Chính
- **Chrome Extension (Manifest V3)**:
  - `manifest.json`: Cấu hình quyền `activeTab`, `scripting`, `downloads`, `storage`, `<all_urls>`.
  - `background/service-worker.js`: Service worker nền.
  - `lib/jszip.min.js`: Thư viện JSZip độc lập offline.
  - `content/`: Các module Unblocker, Pattern Detector, Downloader Engine, Shadow DOM UI, Entry point.
  - `popup/`: Pop-up kích hoạt trên Chrome toolbar.
  - `icons/`: Bộ icon chuẩn cho Extension.
- **Standalone Scripts**:
  - `scripts/bookmarklet.js`: Bản bookmarklet 1 click.
  - `scripts/tampermonkey.user.js`: Bản userscript.
- **Tài liệu**:
  - `README.md`: Hướng dẫn chi tiết bằng Tiếng Việt.

## 3. Quy Chuẩn Tuân Thủ
- Tuân thủ `max-file-length-rule`: Mỗi file từ 100 - 350 dòng, tối đa 600 dòng.
- Tuân thủ `plan-organization-rule`: Kế hoạch được lưu trong thư mục `.plan/`.

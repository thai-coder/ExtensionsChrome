# 📖 FLIPBOOK & DOCUMENT DOWNLOADER PRO (CHROME EXTENSION V3)

Bộ công cụ tự động trích xuất và tải toàn bộ ảnh từ các trang đọc sách trực tuyến (Flipbook / Scanned Book Viewer / PDF Viewers) về máy tính thành 1 file ZIP duy nhất.

---

## 🚀 TÍNH NĂNG VƯỢT TRỘI

1. **Gỡ bỏ Anti-DevTools & Chặn thao tác**:
   - Vô hiệu hóa mã chặn chuột phải, phím tắt `F12`, `Ctrl+Shift+I`, `contextmenu`, `selectstart`.
   - Bơm CSS tự động cho phép bôi đen và tương tác (`user-select: auto`).
2. **Dò tìm Pattern thông minh**:
   - Tự động quét Performance API và DOM để nhận diện cấu trúc link ảnh và số thứ tự trang.
   - Hỗ trợ số 0 đệm linh hoạt: `{page}` (1, 2...), `{page:2}` (01, 02...), `{page:3}` (001, 002...), `{page:4}` (0001, 0002...).
3. **Cơ chế tải bền vững (100% không rớt file)**:
   - **Đa luồng an toàn (Concurrency Pool)**: 3–5 luồng giúp tải nhanh mà không bị máy chủ chặn.
   - **Exponential Backoff Retry**: Tự động thử lại 5 lần (500ms, 1s, 2s, 4s, 8s) khi gặp lỗi mạng, HTTP 429/503 hoặc file < 1KB.
   - **Audit & Patch**: Quét kiểm tra bù các trang sót trước khi đóng gói.
4. **Tích hợp sẵn thư viện JSZip nội bộ**:
   - Hoạt động ổn định offline mà không phụ thuộc vào CDN bên ngoài.

---

## 🛠️ HƯỚNG DẪN CÀI ĐẶT

### Cách 1: Cài đặt Chrome Extension (Khuyên dùng)
1. Mở trình duyệt Chrome / Edge / Brave / Cốc Cốc.
2. Truy cập vào địa chỉ: `chrome://extensions`
3. Bật công tắc **Developer mode (Chế độ dành cho nhà phát triển)** ở góc trên bên phải.
4. Bấm nút **Load unpacked (Tải tiện ích đã giải nén)**.
5. Chọn thư mục:
   `C:\Users\thailka\Desktop\SoftWare\Web\ExtensionsChrome`
6. Tiện ích đã sẵn sàng! Bạn có thể ghim biểu tượng 📖 lên thanh công cụ.

---

### Cách 2: Sử dụng Bookmarklet (Không cần cài Extension)
1. Mở file `scripts/bookmarklet.js`.
2. Copy đoạn mã 1 dòng bắt đầu bằng `javascript:(function(){...})();`.
3. Tạo 1 Dấu trang (Bookmark) trên thanh trình duyệt (Ctrl + Shift + B) và dán đoạn mã vào ô **URL**.
4. Khi vào trang sách cần tải, chỉ cần bấm vào Bookmark này.

---

### Cách 3: Sử dụng Tampermonkey Userscript
1. Cài extension **Tampermonkey** hoặc **Violentmonkey** trên trình duyệt.
2. Tạo script mới và copy toàn bộ nội dung trong file `scripts/tampermonkey.user.js` vào.
3. Bấm **Save (Lưu)**. Script sẽ tự kích hoạt khi bạn bấm chuột phải hoặc mở menu Tampermonkey.

---

## 💡 HƯỚNG DẪN SỬ DỤNG & CẤU HÌNH PATTERN

1. **Khởi chạy bảng điều khiển**:
   - Bấm vào biểu tượng tiện ích trên thanh Chrome và bấm **🚀 Mở Bảng Điều Khiển**, HOẶC
   - Nhấn tổ hợp phím tắt: <kbd>Alt + D</kbd> trên trang web đọc sách.
2. **Dò URL tự động**:
   - Bấm **🔍 Dò lại** để script quét link trang sách đang mở.
3. **Quy tắc sửa URL Mẫu thủ công (Nếu trang web mã hóa đặc biệt)**:
   - Nhấp chuột phải vào trang sách -> *Inspect/Kiểm tra* hoặc *Copy image address*.
   - Ví dụ link gốc: `https://example.com/files/mobile/1.jpg`
     👉 Đổi thành: `https://example.com/files/mobile/{page}.jpg`
   - Ví dụ link có số 0 đệm: `https://example.com/pages/page_001.webp`
     👉 Đổi thành: `https://example.com/pages/page_{page:3}.webp`
4. **Bắt đầu tải**:
   - Nhập dải trang cần tải (Từ trang - Đến trang).
   - Chọn số luồng (mặc định: 4).
   - Bấm **🚀 Bắt đầu tải**. Quá trình tải, kiểm tra bù và nén ZIP sẽ diễn ra tự động.

---

## 📁 CẤU TRÚC DỰ ÁN
```
ExtensionsChrome/
├── manifest.json                  # Cấu hình Manifest V3
├── background/
│   └── service-worker.js         # Service worker nền
├── lib/
│   └── jszip.min.js              # Thư viện nén ZIP offline
├── content/
│   ├── unblocker.js              # Gỡ bỏ chặn chuột phải & F12
│   ├── detector.js               # Quét DOM & Performance API
│   ├── downloader.js             # Engine tải đa luồng & Auto-Patch
│   ├── ui.js                     # Giao diện Shadow DOM Dark-Glass
│   └── content-main.js           # Điểm khởi chạy
├── popup/
│   ├── popup.html & popup.css    # Giao diện Popup
│   └── popup.js                  # Logic Popup
├── icons/                        # Bộ icon SVG & PNG (16, 48, 128)
├── scripts/
│   ├── bookmarklet.js            # Bản Bookmarklet 1-click
│   └── tampermonkey.user.js      # Bản Userscript
└── README.md
```

# ⚡ DOCUMENT & PDF DOWNLOADER PRO (DUAL-MODE EXTENSION)

Bộ công cụ **2 trong 1** mạnh mẽ, chạy độc lập tại tab (In-Tab Isolation), hỗ trợ:
1. **📖 Tải sách Flipbook & Sách scan**: Tải ảnh đa luồng, xuất tệp ZIP hoặc ghép trực tiếp thành file PDF.
2. **📄 In & Tải PDF Sạch (PrintFriendly Web-to-PDF)**: Tự động trích xuất nội dung bài viết, lọc sạch quảng cáo, tùy chỉnh xóa đoạn thừa, hỗ trợ đa khổ giấy (**A4, A3, A5, Letter, Legal**) và tự động nhận diện nội dung rộng để xoay ngang (**Landscape / Portrait**).

---

## 🚀 2 CHẾ ĐỘ HOẠT ĐỘNG CHUYÊN SÂU

### 1. 📖 Chế độ Sách Flipbook (Scan Book Downloader)
- **Dò tìm Pattern thông minh**: Tự động nhận diện cấu trúc link ảnh `{page}`, `{page:2}`, `{page:3}`, `{page:4}`...
- **Tải đa luồng song song**: 3–5 luồng tải siêu tốc với cơ chế Exponential Backoff Auto-Retry và Resume trang lỗi.
- **Tùy chọn đầu ra**:
  - `📦 Tải ZIP`: Lưu trọn bộ file ảnh gốc chất lượng cao.
  - `📄 Ghép PDF`: Tự động căn chỉnh và ghép tất cả các trang ảnh thành một tài liệu PDF duy nhất theo khổ giấy tùy chọn (**A4, A3, Letter, Khổ gốc ảnh**).

### 2. 📄 Chế độ In & Tải PDF Sạch (PrintFriendly Web-to-PDF)
- **Trích xuất nội dung cốt lõi**: Tự động loại bỏ 100% banner quảng cáo, menu điều hướng (navbars), sidebar rác, chân trang (footer).
- **Nhận diện PDF nhúng gốc**: Quét tìm và cho phép tải trực tiếp file `.pdf` gốc nếu trang web nhúng viewer (PDF.js, Embed, Iframe).
- **Tùy biến bản in**:
  - **Tự động nhận diện xoay khổ giấy**: Tự động phát hiện bảng biểu lớn hoặc khối code rộng để gợi ý xoay sang **Khổ Ngang (Landscape)** tránh bị cắt xén nội dung.
  - **Đa dạng khổ giấy**: Lựa chọn nhanh giữa **A4, A3, A5, Letter, Legal**.
  - **Ẩn hình ảnh**: Nút bật/tắt ẩn toàn bộ ảnh để tiết kiệm giấy và mực in.
  - **Chỉnh cỡ chữ**: Nhỏ (11pt), Vừa (13pt), Lớn (15pt), Rất lớn (17pt).
  - **Click-to-Delete**: Bấm trực tiếp vào bất kỳ đoạn văn hoặc hình ảnh thừa nào trong khung xem trước để xóa trước khi xuất.

---

## 🛠️ HƯỚNG DẪN CÀI ĐẶT

### Cách 1: Cài đặt Chrome Extension
1. Mở trình duyệt Chrome $\rightarrow$ Vào `chrome://extensions`.
2. Bật công tắc **Developer mode (Chế độ dành cho nhà phát triển)** ở góc trên bên phải.
3. Bấm **Load unpacked (Tải tiện ích đã giải nén)** $\rightarrow$ Chọn thư mục:
   `C:\Users\thailka\Desktop\SoftWare\Web\ExtensionsChrome`
4. Ghim biểu tượng tiện ích lên thanh công cụ.

---

### Cách 2: Sử dụng Tampermonkey Userscript (Tự động cập nhật qua GitHub)
1. Cài extension **Tampermonkey** từ Chrome Web Store.
2. Truy cập link cài đặt trực tiếp:
   👉 [Cài đặt Userscript Trực Tiếp](https://raw.githubusercontent.com/thai-coder/ExtensionsChrome/main/scripts/tampermonkey.user.js)
3. Bấm **Install**. Khi có bản cập nhật mới trên GitHub, Tampermonkey sẽ tự động cập nhật.
4. Mở menu Tampermonkey $\rightarrow$ Chọn **`📖 Mở Sách Flipbook`** hoặc **`📄 In & Tải PDF Sạch`**.

---

## 📁 CẤU TRÚC DỰ ÁN
```
ExtensionsChrome/
├── manifest.json                  # Cấu hình Manifest V3
├── background/
│   └── service-worker.js         # Background worker
├── lib/
│   ├── jszip.min.js              # Thư viện ZIP offline
│   └── jspdf.min.js              # Thư viện PDF offline
├── content/
│   ├── unblocker.js              # Safe Unblocker
│   ├── detector.js               # Quét Pattern ảnh Flipbook
│   ├── pdf-detector.js           # Bóc tách bài viết sạch & PDF nhúng
│   ├── downloader.js             # Engine tải đa luồng
│   ├── pdf-engine.js             # Động cơ ghép & in PDF
│   ├── ui.js                     # Giao diện Shadow DOM Dual-Tab
│   └── content-main.js           # Bộ điều phối
├── popup/
│   ├── popup.html & popup.css    # Giao diện Popup
│   └── popup.js                  # Logic Popup
└── scripts/
    └── tampermonkey.user.js      # Userscript Dual-Mode
```

```

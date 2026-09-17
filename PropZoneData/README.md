# PropZone Data - Smart Value Extractor (Chrome Extension)

Chrome Extension chuyên dụng trích xuất chính xác các giá trị dữ liệu từ các website cố định với cơ chế nhận dạng domain an toàn và chống copy đè Clipboard ngoài ý muốn.

---

## 🌟 Tính Năng Nổi Bật

1. **Nhận dạng Website Cố Định (URL Whitelist & Regex Matcher)**:
   - Tự động nhận diện cấu hình riêng cho từng website mục tiêu.
   - Khi ở các website không nằm trong danh sách (ngoài lề), Extension tự động khóa thao tác copy để bảo vệ Clipboard.
2. **Trích xuất đa dạng (Multi-field DOM Extractor)**:
   - Hỗ trợ lấy theo CSS Selector, Attribute (ví dụ `data-id`, `data-phone`), input value, text content.
3. **Xem trước (Preview) & Đa định dạng**:
   - Chế độ **Văn bản mẫu (Formatted Template)**: Tự động điền dữ liệu vào mẫu câu định sẵn.
   - Chế độ **Từng trường (Field List)**: Hiển thị danh sách Key - Value rõ ràng.
   - Chế độ **JSON**: Xuất dữ liệu cấu trúc cho lập trình viên/xử lý tự động.
4. **Tùy biến linh hoạt qua Options Page**:
   - Dễ dàng tự thêm website mới, cấu hình regex URL, đặt selector và mẫu output theo ý muốn.
5. **Phím tắt tiện lợi**:
   - `Alt + Shift + E` để mở nhanh popup trích xuất khi đang duyệt web.

---

## 📁 Cấu Trúc Thư Mục

```
PropZoneData/
├── manifest.json              # Cấu hình Manifest V3
├── config/
│   └── rules.js               # Danh sách cấu hình website mặc định & Matcher Engine
├── content/
│   └── extractor.js           # Content script bóc tách DOM an toàn
├── popup/
│   ├── popup.html             # Giao diện Popup
│   ├── popup.css              # Styling Modern Glassmorphism/Dark UI
│   └── popup.js               # Xử lý tương tác & Clipboard Guard
├── options/
│   ├── options.html           # Quản lý quy tắc tùy biến
│   ├── options.css
│   └── options.js
└── icons/                     # Icons kích thước chuẩn (16, 48, 128)
```

---

## 🚀 Hướng Dẫn Cài Đặt Vào Chrome

1. Mở trình duyệt Chrome / Cốc Cốc / Edge và truy cập: `chrome://extensions/`
2. Bật công tắc **"Developer mode"** (Chế độ dành cho nhà phát triển) ở góc trên bên phải.
3. Nhấn vào nút **"Load unpacked"** (Tải tiện ích đã giải nén).
4. Chọn thư mục:
   `c:\Users\thailka\Desktop\SoftWare\Web\ExtensionsChrome\PropZoneData`
5. Ghim tiện ích **PropZone Data** lên thanh công cụ để sử dụng.

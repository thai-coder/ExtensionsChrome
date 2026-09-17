# Kế Hoạch Triển Khai: Safe Target Value Extractor Chrome Extension

Tài liệu này xác định phương án kỹ thuật, danh mục tính năng và lộ trình xây dựng extension trích xuất dữ liệu chính xác từ các website cố định.

---

## 1. Mục Tiêu Dự Án
- Trích xuất tự động hoặc bán tự động các giá trị mong muốn (ID, mã đơn hàng, auth token, nội dung đặc thù, giá cả...) từ các website mục tiêu xác định.
- Cơ chế bảo vệ Clipboard: Chỉ cho phép bóc tách và copy khi URL khớp với cấu hình Target Domains. Nếu mở ở tab khác, extension sẽ báo không hỗ trợ và ngăn chặn thao tác ghi đè Clipboard.

---

## 2. Gợi Ý Đặt Tên Dự Án
1. **`TargetValueExtractor`** (Đầy đủ, chuẩn kỹ thuật)
2. **`SiteDataExtractor`** (Ngắn gọn, chuyên nghiệp)
3. **`SmartTargetCopy`** (Tập trung vào tính năng copy thông minh đúng trang)
4. **`SafeSitePicker`** (Nhấn mạnh tính an toàn bảo vệ clipboard)

---

## 3. Kiến Trúc Kỹ Thuật (Manifest V3)
```
ExtensionsChrome/
└── TargetValueExtractor/           # Thư mục Extension mới
    ├── manifest.json               # Cấu hình Manifest V3
    ├── config/
    │   ├── default_rules.json      # Danh sách site mặc định & bộ bóc tách DOM
    │   └── rule_engine.js          # Module kiểm tra URL & Domain Pattern
    ├── content/
    │   └── extractor.js            # Content script trích xuất DOM theo rule
    ├── popup/
    │   ├── popup.html              # UI hiển thị trạng thái & nút copy
    │   ├── popup.css               # Giao diện hiện đại (Modern Glass/Dark UI)
    │   └── popup.js                # Xử lý logic hiển thị & tương tác
    ├── options/                    # (Tùy chọn) Giao diện quản lý quy tắc tùy biến
    │   ├── options.html
    │   └── options.js
    └── icons/                      # Bộ icon các kích thước (16, 48, 128)
```

---

## 4. Các Giai Đoạn Triển Khai
1. **Phase 1: Khởi tạo khung dự án & Rule Matcher Core** (Tạo manifest, rule matcher, kiểm tra URL an toàn).
2. **Phase 2: Bộ bóc tách DOM (Extractor Engine)** (Hỗ trợ bóc tách theo CSS Selector, Regex trong HTML, Meta tag, LocalStorage/Cookie nếu cần).
3. **Phase 3: Giao diện Popup & Clipboard Protector** (UI trực quan, Preview giá trị trước khi copy, báo lỗi nếu sai trang).
4. **Phase 4: Tùy biến linh hoạt & Phím tắt nhanh (Options & Shortcuts)**.

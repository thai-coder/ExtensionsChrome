# KẾ HOẠCH XỬ LÝ SỰ CỐ & TỐI ƯU HÓA: FLIPBOOK & DOCUMENT DOWNLOADER PRO

## 1. Tổng Quan Vấn Đề
1. **Lỗi nghiêm trọng**: Extension hiện tại tự động inject code chặn sự kiện (`e.stopPropagation()` ở capture phase trên `mousedown`, `keydown`, `keyup`...) và ép CSS `* { pointer-events: auto !important; }` trên mọi trang web (`<all_urls>`), làm tê liệt hoàn toàn chức năng cuộn trang (scroll) và click chuột của người dùng.
2. **Yêu cầu hành vi Tab**:
   - Tắt hoàn toàn mọi hành vi chuyển tab / mở tab mới. Trang nào tải thì ở yên tại trang đó (In-Tab Execution).
   - Đảm bảo an toàn tuyệt đối khi người dùng kéo tab ra thành một cửa sổ Chrome mới (Tear-off tab to separate window).
   - Đảm bảo độc lập 100% khi mở đồng thời nhiều cửa sổ Chrome với các Chrome Profile / User khác nhau.

---

## 2. Phân Tích Kỹ Thuật & Kịch Bản Hoạt Động

### A. Xử lý kịch bản kéo tab thành 1 Chrome khác (Tear-off Window)
- **Cơ chế trình duyệt**: Khi kéo tab ra cửa sổ riêng, tiến trình DOM & Javascript Runtime của tab đó vẫn giữ nguyên vẹn (`window`, `document`, biến bộ nhớ `DownloadEngine`, `FloatingUI`).
- **Điểm cần xử lý**: Kích thước cửa sổ mới có thể khác cửa sổ cũ. Cần bổ sung listener `window.addEventListener('resize')` để tự động kéo Panel về vùng hiển thị an toàn (Clamping), tránh bị tràn ra ngoài màn hình.

### B. Xử lý kịch bản mở nhiều Chrome đồng thời khác Profile / User
- **Cơ chế trình duyệt**: Các Chrome Profile (User 1, User 2...) hoạt động trong các tiến trình sandbox hoàn toàn riêng biệt về Cookie, Storage, Tab Memory và Service Worker.
- **Tính độc lập**: Extension hoạt động dựa trên instance độc lập trong mỗi Tab (`new FloatingUI()`, `new DownloadEngine()`). Không có biến global chia sẻ giữa các tab hay giữa các Profile -> Đảm bảo an toàn và song song 100%.

### C. Đảm bảo ở lại trang đó (In-Tab Isolation)
- Quá trình quét, tải luồng, giải mã và nén ZIP diễn ra ngầm trong Tab (Shadow DOM).
- Không gọi `chrome.tabs.create`, không gọi `chrome.tabs.update(..., { active: true })`.
- Xuất file ZIP trực tiếp từ memory blob qua download link ngầm trong Shadow DOM hoặc `chrome.downloads`.

---

## 3. Các Thay Đổi Cụ Thể (Proposed Changes)

### 1. `content/unblocker.js` (Sửa đổi cốt lõi)
- **Xóa bỏ toàn bộ**:
  - Xóa vòng lặp chặn `mousedown`, `keydown`, `keyup`, `keypress`, `selectstart`, `dragstart`, `copy`, `cut` với `e.stopPropagation()` ở capture phase.
  - Xóa CSS `* { pointer-events: auto !important; }` và `* { -webkit-user-select: auto !important; }` chèn vào document.head.
- **Thay thế bằng cơ chế Safe Unblock**:
  - Chỉ gỡ bỏ các rào cản inline `oncontextmenu`, `onselectstart`, `oncopy` khi cần thiết.
  - Cho phép chuột phải an toàn mà không can thiệp vào chuỗi truyền sự kiện (Event Propagation) của trang web.

### 2. `content/content-main.js`
- Không tự động kích hoạt `initUnblocker()` lúc vừa mở mọi trang web.
- Chỉ kích hoạt unblocker một cách an toàn khi người dùng bấm mở Floating UI.

### 3. `content/ui.js`
- Bổ sung `window.addEventListener('resize')` để tự động giữ vị trí Panel luôn nằm trong màn hình khi thay đổi kích thước cửa sổ hoặc kéo tab sang cửa sổ mới.
- Đảm bảo thao tác kéo thả Panel (Drag & Drop) không làm gián đoạn tương tác của trang web.

### 4. `scripts/tampermonkey.user.js` & `scripts/bookmarklet.js`
- Cập nhật đồng bộ cơ chế Safe Unblock và In-Tab Isolation.

---

## 4. Kế Hoạch Kiểm Thử (Verification Plan)
1. **Kiểm tra Click & Scroll trên các trang web thông thường**:
   - Truy cập các trang web đa dạng (Google, Youtube, Facebook, Wikipedia, Docs...).
   - Kiểm tra click chuột trái, click link, gõ phím vào ô tìm kiếm, cuộn chuột, cuộn bằng phím Space / Arrow Up / Arrow Down.
2. **Kiểm tra Mở và Tải sách tại chỗ**:
   - Mở giao diện Floating UI trên trang sách tài liệu (qua phím Alt+D hoặc Context Menu / Popup).
   - Kiểm tra Panel hiển thị chuẩn, không chuyển tab.
   - Thử kéo tab ra cửa sổ Chrome riêng biệt -> Kiểm tra tiến trình tải và giao diện vẫn hoạt động bình thường.
   - Thử mở cùng lúc 2 tab / 2 profile -> Đảm bảo tải song song không xung đột.

# Kế Hoạch Refactor Cấu Trúc Popup (`POPUP_MODULAR_REFACTOR_PLAN.md`)

## 1. Mục Tiêu & Vấn Đề Hiện Tại
- **Vấn đề**: File [popup.js](file:///c:/Users/thailka/Desktop/SoftWare/Web/ExtensionsChrome/FEASIBILITY%20STUDY%20Data/popup/popup.js) hiện đã phình to hơn **1.040 dòng**, chứa lẫn lộn:
  - Khởi tạo DOM & Tabs (~80 dòng)
  - Quản lý State & Storage (~150 dòng)
  - Formatters & Regex Parser (~120 dòng)
  - Render 6 tabs dữ liệu (~200 dòng)
  - Pipeline & Realtime Content Injection (~180 dòng)
  - Map Downloader & VPN Modal Router (~160 dòng)
  - Update Banner & Reload Actions (~100 dòng)
- **Hệ quả**: Khó tìm vị trí code khi muốn nâng cấp tính năng, dễ gây bug chéo và vi phạm quy tắc [max-file-length-rule](file:///C:/Users/thailka/.gemini/config/skills/max-file-length-rule/SKILL.md) (> 600 dòng).

---

## 2. Kiến Trúc Phân Rã Module (Target Architecture)

Toàn bộ logic sẽ được chia nhỏ thành các module độc lập đặt trong thư mục `popup/modules/`, mỗi module chỉ giữ từ **100 – 250 dòng code**:

```
popup/
├── popup.html
├── popup.css
├── popup.js                  (~150 dòng)  --> Entry point, khởi tạo và điều phối các module
└── modules/
    ├── ui-helpers.js         (~120 dòng)  --> Toast, Formatter (ft, sqft), setText, Garage Parser
    ├── state-manager.js      (~150 dòng)  --> Lưu/đọc chrome.storage, mergeDeep, reset dữ liệu
    ├── tab-renderer.js       (~250 dòng)  --> Render dữ liệu 6 tabs (Overview, Lot, Zoning, Setbacks, Capacity, Civil)
    ├── pipeline-actions.js   (~180 dòng)  --> Nút Auto Fetch, County Badge, Recheck, Fresh Scan, Civil buttons
    └── map-actions.js        (~160 dòng)  --> Nút Get Map, Modal VPN OCGIS, Link Parcels/Tract Map
```

---

## 3. Bản Đồ Phân Chia Nhiệm Vụ (Where To Find What?)

| Nhiệm Vụ Cần Nâng Cấp | File Phụ Trách | Dòng Dự Kiến | Nội Dung Cốt Lõi |
|---|---|:---:|---|
| **Thay đổi giao diện, thêm trường mới vào các Tab** | `modules/tab-renderer.js` | ~250 dòng | Hàm `renderDashboard()`, `renderOverview()`, `renderCivil()`... |
| **Sửa cách format số, diện tích, garage, toast** | `modules/ui-helpers.js` | ~120 dòng | `formatSqFt()`, `formatFt()`, `showToast()`, `parseGarageParking()` |
| **Sửa logic lưu Cache, Reset session, sync Storage** | `modules/state-manager.js` | ~150 dòng | `mergeDeep()`, `resetSessionData()`, `loadStoredData()` |
| **Nâng cấp Auto Pipeline, Trigger cào dữ liệu, Nút bấm Soil/FEMA** | `modules/pipeline-actions.js` | ~180 dòng | `btnAutoPipeline`, `triggerFreshConsoleExecution`, `updateCountyBadge`, `btnGetSoil`, `btnGetFema` |
| **Nâng cấp Bản đồ PDF, Parcels Map, VPN US** | `modules/map-actions.js` | ~160 dòng | `btnDownloadMap`, `btnVpnRetry`, `updateMapButtonState` |
| **Khởi động popup, kiểm tra version update** | `popup.js` | ~150 dòng | `DOMContentLoaded`, `checkAndDisplayUpdate`, tab switching |

---

## 4. Lộ Trình Triển Khai (3 Giai Đoạn An Toàn)

- [ ] **Giai đoạn 1: Trích xuất `ui-helpers.js` & `state-manager.js`**
  - Tách các hàm dùng chung độc lập (Toast, formatters, storage sync).
  - Đảm bảo popup vẫn chạy ổn định không gián đoạn.
- [ ] **Giai đoạn 2: Trích xuất `tab-renderer.js`**
  - Đóng gói toàn bộ logic điền text vào DOM của 6 tab.
- [ ] **Giai đoạn 3: Trích xuất `pipeline-actions.js` & `map-actions.js`**
  - Tách toàn bộ Event Listeners của các nút bấm và Modal.
  - Tinh gọn `popup.js` còn ~150 dòng làm nhạc trưởng (Orchestrator).
  - Cập nhật `popup.html` để nhúng các script theo đúng thứ tự dependency.

/**
 * FEASIBILITY STUDY Data - Universal Floating UI & Notification Helper
 * Dùng hiển thị thông báo trạng thái / thành công khi trích xuất dữ liệu.
 * Hoạt động độc lập trong tab, không can thiệp điều hướng hay chuyển tab.
 */

class FloatingUI {
  constructor() {
    this.element = null;
    this.timer = null;
  }

  showSuccess(title = "Thành công!", message = "", durationOrLinks = 8000, linksOrDuration = null) {
    this.destroy();

    let duration = 8000;
    let links = null;

    if (typeof title === "object" && title !== null) {
      const opts = title;
      title = opts.title || "Thành công!";
      message = opts.message || "";
      duration = typeof opts.duration === "number" ? opts.duration : 8000;
      links = opts.links || opts.mapLinks || {
        parcels: opts.parcels || opts.parcelsUrl || opts.parcelUrl,
        tractMap: opts.tractMap || opts.tractMapUrl || opts.tractUrl
      };
    } else {
      if (typeof durationOrLinks === "number") {
        duration = durationOrLinks;
        if (typeof linksOrDuration === "object") links = linksOrDuration;
      } else if (typeof durationOrLinks === "object" && durationOrLinks !== null) {
        links = durationOrLinks;
        if (typeof linksOrDuration === "number") duration = linksOrDuration;
      }
    }

    const parcelsUrl = links ? (links.parcels || links.parcelsUrl || links.parcelUrl || null) : null;
    const tractMapUrl = links ? (links.tractMap || links.tractMapUrl || links.tractUrl || null) : null;

    const overlay = document.createElement("div");
    overlay.id = "fs-floating-success-card";
    overlay.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 2147483647;
      background-color: #0b111e; color: #f1f5f9; padding: 14px 16px;
      border-radius: 10px; box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.75), 0 0 15px rgba(16, 185, 129, 0.25);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      width: 320px; border: 1px solid #10b981; transition: all 0.3s ease;
      box-sizing: border-box; backdrop-filter: blur(8px);
    `;

    const header = document.createElement("div");
    header.style.cssText = "font-weight: 700; margin-bottom: 8px; font-size: 13.5px; color: #34d399; display: flex; align-items: center; justify-content: space-between;";

    const titleSpan = document.createElement("span");
    titleSpan.innerText = `🎉 ${title}`;
    header.appendChild(titleSpan);

    const closeBtn = document.createElement("button");
    closeBtn.innerText = "✕";
    closeBtn.title = "Đóng";
    closeBtn.style.cssText = "background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; padding: 2px 6px;";
    closeBtn.onclick = () => this.destroy();
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    if (message) {
      const desc = document.createElement("div");
      desc.style.cssText = "font-size: 12px; color: #cbd5e1; white-space: pre-line; line-height: 1.45; word-break: break-word;";
      desc.innerText = message;
      overlay.appendChild(desc);
    }

    const btnContainer = document.createElement("div");
    btnContainer.style.cssText = "display: flex; gap: 8px; margin-top: 12px;";

    const downloadSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

    const createBtn = (label, url) => {
      const btn = document.createElement("button");
      btn.innerHTML = `${downloadSvg}<span>${label}</span>`;
      const baseStyle = "flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 10px; font-size: 11.5px; font-weight: 600; border-radius: 6px; box-sizing: border-box; transition: all 0.2s ease;";

      if (url && typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
        btn.style.cssText = `${baseStyle} background: rgba(14, 165, 233, 0.12); color: #38bdf8; border: 1px solid #38bdf8; box-shadow: 0 0 8px rgba(56, 189, 248, 0.25); cursor: pointer;`;
        btn.onmouseenter = () => {
          btn.style.background = "rgba(14, 165, 233, 0.28)";
          btn.style.color = "#7dd3fc";
          btn.style.borderColor = "#7dd3fc";
          btn.style.boxShadow = "0 0 12px rgba(56, 189, 248, 0.5)";
          btn.style.transform = "translateY(-1px)";
        };
        btn.onmouseleave = () => {
          btn.style.background = "rgba(14, 165, 233, 0.12)";
          btn.style.color = "#38bdf8";
          btn.style.borderColor = "#38bdf8";
          btn.style.boxShadow = "0 0 8px rgba(56, 189, 248, 0.25)";
          btn.style.transform = "translateY(0)";
        };
        btn.onclick = (e) => {
          e.stopPropagation();
          window.open(url, "_blank");
        };
      } else {
        btn.disabled = true;
        btn.style.cssText = `${baseStyle} background: rgba(30, 41, 59, 0.4); color: #64748b; border: 1px solid #334155; opacity: 0.5; cursor: not-allowed; pointer-events: none;`;
      }
      return btn;
    };

    btnContainer.appendChild(createBtn("Parcels", parcelsUrl));
    btnContainer.appendChild(createBtn("Tract Map", tractMapUrl));
    overlay.appendChild(btnContainer);

    const startTimer = (ms) => {
      if (ms > 0) this.timer = setTimeout(() => this.destroy(), ms);
    };

    overlay.onmouseenter = () => { if (this.timer) clearTimeout(this.timer); };
    overlay.onmouseleave = () => { startTimer(3500); };

    document.body.appendChild(overlay);
    this.element = overlay;
    startTimer(duration);

    return this;
  }

  destroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    const existing = document.getElementById("fs-floating-success-card");
    if (existing) existing.remove();
  }

  /**
   * Phương thức tĩnh gọi nhanh thông báo ở bất kỳ vị trí nào
   */
  static showSuccess(title = "Thành công!", message = "", durationOrLinks = 8000, linksOrDuration = null) {
    const ui = new FloatingUI();
    ui.showSuccess(title, message, durationOrLinks, linksOrDuration);
    return ui;
  }
}

if (typeof window !== "undefined") {
  window.FloatingUI = FloatingUI;
}


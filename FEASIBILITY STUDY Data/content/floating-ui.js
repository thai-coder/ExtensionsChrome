/**
 * FEASIBILITY STUDY Data - Universal Floating UI & Notification Helper
 * Dùng hiển thị thông báo trạng thái / thành công / đối soát dữ liệu của Sếp.
 * Hoạt động độc lập trong tab, không can thiệp điều hướng hay chuyển tab.
 */

class FloatingUI {
  constructor() {
    this.element = null;
    this.timer = null;
  }

  showNotice({ title = "Thông báo", message = "", type = "success", duration = 8000, links = null }) {
    this.destroy();

    const colorConfig = {
      success: {
        border: "#10b981",
        glow: "rgba(16, 185, 129, 0.25)",
        headerColor: "#34d399",
        icon: "🎉"
      },
      warning: {
        border: "#f59e0b",
        glow: "rgba(245, 158, 11, 0.3)",
        headerColor: "#fbbf24",
        icon: "⚠️"
      },
      error: {
        border: "#ef4444",
        glow: "rgba(239, 68, 68, 0.3)",
        headerColor: "#f87171",
        icon: "❌"
      },
      info: {
        border: "#0ea5e9",
        glow: "rgba(14, 165, 233, 0.3)",
        headerColor: "#38bdf8",
        icon: "ℹ️"
      }
    };

    const cfg = colorConfig[type] || colorConfig.success;
    const parcelsUrl = links ? (links.parcels || links.parcelsUrl || links.parcelUrl || null) : null;
    const tractMapUrl = links ? (links.tractMap || links.tractMapUrl || links.tractUrl || null) : null;

    const overlay = document.createElement("div");
    overlay.id = "fs-floating-success-card";
    overlay.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 2147483647;
      background-color: #0b111e; color: #f1f5f9; padding: 14px 16px;
      border-radius: 10px; box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.75), 0 0 18px ${cfg.glow};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      width: 340px; border: 1.5px solid ${cfg.border}; transition: all 0.3s ease;
      box-sizing: border-box; backdrop-filter: blur(8px);
    `;

    const header = document.createElement("div");
    header.style.cssText = `font-weight: 700; margin-bottom: 8px; font-size: 13.5px; color: ${cfg.headerColor}; display: flex; align-items: center; justify-content: space-between;`;

    const titleSpan = document.createElement("span");
    titleSpan.innerText = `${cfg.icon} ${title}`;
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

    if (parcelsUrl || tractMapUrl) {
      const btnContainer = document.createElement("div");
      btnContainer.style.cssText = "display: flex; gap: 8px; margin-top: 12px;";

      const downloadSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

      const createBtn = (label, url) => {
        const btn = document.createElement("button");
        btn.innerHTML = `${downloadSvg}<span>${label}</span>`;
        const baseStyle = "flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 10px; font-size: 11.5px; font-weight: 600; border-radius: 6px; box-sizing: border-box; transition: all 0.2s ease;";

        if (url && typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
          btn.style.cssText = `${baseStyle} background: rgba(14, 165, 233, 0.12); color: #38bdf8; border: 1px solid #38bdf8; box-shadow: 0 0 8px rgba(56, 189, 248, 0.25); cursor: pointer;`;
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
    }

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

  showSuccess(title = "Thành công!", message = "", durationOrLinks = 8000, linksOrDuration = null) {
    let duration = 8000;
    let links = null;
    if (typeof durationOrLinks === "number") {
      duration = durationOrLinks;
      if (typeof linksOrDuration === "object") links = linksOrDuration;
    } else if (typeof durationOrLinks === "object" && durationOrLinks !== null) {
      links = durationOrLinks;
      if (typeof linksOrDuration === "number") duration = linksOrDuration;
    }
    return this.showNotice({ title, message, type: "success", duration, links });
  }

  showWarning(title = "Cảnh báo!", message = "", duration = 10000) {
    return this.showNotice({ title, message, type: "warning", duration });
  }

  showError(title = "Lỗi!", message = "", duration = 10000) {
    return this.showNotice({ title, message, type: "error", duration });
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

  static showSuccess(title = "Thành công!", message = "", durationOrLinks = 8000, linksOrDuration = null) {
    const ui = new FloatingUI();
    ui.showSuccess(title, message, durationOrLinks, linksOrDuration);
    return ui;
  }

  static showWarning(title = "Cảnh báo!", message = "", duration = 10000) {
    const ui = new FloatingUI();
    ui.showWarning(title, message, duration);
    return ui;
  }

  static showError(title = "Lỗi!", message = "", duration = 10000) {
    const ui = new FloatingUI();
    ui.showError(title, message, duration);
    return ui;
  }
}

// Lắng nghe broadcast từ Background để hiển thị thông báo đối soát của Sếp tức thì
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.action === "BOSS_AUDIT_NOTIFICATION") {
        if (msg.verdict === "OVERRIDDEN_BY_COUNTYOFFICE") {
          FloatingUI.showWarning(msg.title || "Lệnh của Sếp!", msg.message || "", 12000);
        } else if (msg.verdict === "MATCHED") {
          FloatingUI.showSuccess(msg.title || "Đối soát thành công!", msg.message || "", 10000);
        } else {
          FloatingUI.showWarning(msg.title || "Đối soát dữ liệu", msg.message || "", 10000);
        }
      }
    });
  } catch (e) { }
}

if (typeof window !== "undefined") {
  window.FloatingUI = FloatingUI;
}

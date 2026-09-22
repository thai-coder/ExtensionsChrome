/**
 * FEASIBILITY STUDY Data - Universal Floating UI & Notification Helper
 * Dùng hiển thị thông báo trạng thái / thành công khi trích xuất dữ liệu.
 * Hoạt động độc lập trong tab, không can thiệp điều hướng hay chuyển tab.
 */

class FloatingUI {
  constructor() {
    this.element = null;
  }

  /**
   * Hiển thị thông báo thành công
   */
  showSuccess(title = "Thành công!", message = "", duration = 6000) {
    this.destroy();

    const overlay = document.createElement("div");
    overlay.id = "fs-floating-success-card";
    overlay.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 999999;
      background-color: #064e3b; color: #ffffff; padding: 14px 18px;
      border-radius: 8px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      font-family: system-ui, -apple-system, sans-serif; width: 320px;
      border: 1px solid #10b981; transition: all 0.3s ease;
    `;

    const header = document.createElement("div");
    header.style.cssText = "font-weight: bold; margin-bottom: 6px; font-size: 14px; color: #34d399; display: flex; align-items: center; justify-content: space-between;";
    
    const titleSpan = document.createElement("span");
    titleSpan.innerText = `🎉 ${title}`;
    header.appendChild(titleSpan);

    const closeBtn = document.createElement("button");
    closeBtn.innerText = "✕";
    closeBtn.style.cssText = "background: none; border: none; color: #a7f3d0; cursor: pointer; font-size: 14px; padding: 0 4px;";
    closeBtn.onclick = () => this.destroy();
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    if (message) {
      const desc = document.createElement("div");
      desc.style.cssText = "font-size: 12px; color: #d1fae5; white-space: pre-line; line-height: 1.4;";
      desc.innerText = message;
      overlay.appendChild(desc);
    }

    document.body.appendChild(overlay);
    this.element = overlay;

    if (duration > 0) {
      setTimeout(() => this.destroy(), duration);
    }

    return this;
  }

  destroy() {
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
  static showSuccess(title = "Thành công!", message = "", duration = 6000) {
    const ui = new FloatingUI();
    ui.showSuccess(title, message, duration);
    return ui;
  }
}

if (typeof window !== "undefined") {
  window.FloatingUI = FloatingUI;
}


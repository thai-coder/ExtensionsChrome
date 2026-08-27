/**
 * friendly-preview.js - Giao diện Full-screen Reader & Trình xuất PDF trực tiếp chuyên nghiệp như PrintFriendly
 */
(function (global) {
  'use strict';

  class PrintFriendlyWorkspace {
    constructor(articleData, options = {}) {
      this.articleData = articleData || {
        title: 'Tai_Lieu',
        displayTitle: document.title || 'Tai_Lieu',
        htmlContent: '<p>Không có nội dung</p>',
        hasWideContent: false,
        recommendedOrientation: 'portrait'
      };

      this.paperSize = options.paperSize || 'a4';
      this.orientation = options.orientation || (this.articleData.hasWideContent ? 'landscape' : 'portrait');
      this.fontSizePercent = 100;
      this.hideImages = false;
      this.undoStack = [];
      this.modalId = '__print_friendly_fullscreen_modal__';

      this.paperDimensions = {
        a4: { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 }, maxPx: 820 },
        a3: { portrait: { w: 297, h: 420 }, landscape: { w: 420, h: 297 }, maxPx: 1050 },
        a5: { portrait: { w: 148, h: 210 }, landscape: { w: 210, h: 148 }, maxPx: 650 },
        letter: { portrait: { w: 215.9, h: 279.4 }, landscape: { w: 279.4, h: 215.9 }, maxPx: 840 },
        legal: { portrait: { w: 215.9, h: 355.6 }, landscape: { w: 355.6, h: 215.9 }, maxPx: 840 }
      };

      this.init();
    }

    init() {
      const existing = document.getElementById(this.modalId);
      if (existing) existing.remove();

      this.container = document.createElement('div');
      this.container.id = this.modalId;
      document.body.appendChild(this.container);
      this.shadow = this.container.attachShadow({ mode: 'open' });

      this.injectStyles();
      this.render();
      this.bindEvents();
    }

    injectStyles() {
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after { box-sizing: border-box !important; }
        
        .overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: #e2e8f0;
          z-index: 2147483647;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #1e293b;
          overflow: hidden;
          animation: fadeIn 0.18s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.99); }
          to { opacity: 1; transform: scale(1); }
        }

        /* Top Toolbar - PrintFriendly Style */
        .toolbar {
          height: 56px;
          background: #ffffff;
          border-bottom: 1px solid #cbd5e1;
          box-shadow: 0 2px 10px rgba(0,0,0,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          gap: 12px;
          flex-shrink: 0;
          z-index: 10;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
          font-size: 15px;
          color: #0f172a;
        }
        .brand-icon {
          width: 28px; height: 28px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 14px;
        }

        .tool-group {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .tool-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 12.5px;
          font-weight: 600;
          color: #334155;
          cursor: pointer;
          transition: all 0.15s;
          user-select: none;
        }
        .tool-btn:hover { background: #f1f5f9; border-color: #94a3b8; color: #0f172a; }
        .tool-btn.active { background: #e0e7ff; border-color: #6366f1; color: #4338ca; }
        .tool-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .btn-download-pdf {
          background: linear-gradient(135deg, #2563eb, #4f46e5);
          color: #ffffff;
          border: none;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
        }
        .btn-download-pdf:hover:not(:disabled) {
          background: linear-gradient(135deg, #1d4ed8, #4338ca);
          color: #ffffff;
        }

        .tool-select {
          padding: 6px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #ffffff;
          font-size: 12px;
          font-weight: 600;
          color: #334155;
          outline: none;
          cursor: pointer;
        }

        .btn-close {
          background: #fee2e2;
          border: 1px solid #fca5a5;
          color: #dc2626;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-close:hover { background: #fecaca; }

        /* Document Viewport & Paper */
        .workspace-body {
          flex: 1;
          overflow-y: auto;
          padding: 30px 16px 60px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .workspace-body::-webkit-scrollbar { width: 8px; }
        .workspace-body::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 4px; }

        .paper-sheet {
          background: #ffffff;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04);
          border-radius: 4px;
          padding: 48px 56px;
          width: 100%;
          max-width: 820px;
          min-height: 1000px;
          position: relative;
          color: #111827;
          line-height: 1.7;
          font-size: 14px;
          transition: max-width 0.2s, font-size 0.15s;
        }

        .doc-header {
          margin-bottom: 24px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 16px;
        }
        .doc-title-input {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.35;
          margin-bottom: 8px;
          border: 1px solid transparent;
          background: transparent;
          width: 100%;
          padding: 4px 0;
          outline: none;
          border-radius: 4px;
        }
        .doc-title-input:hover, .doc-title-input:focus {
          border-color: #cbd5e1;
          background: #f8fafc;
          padding: 4px 8px;
        }
        .doc-meta {
          font-size: 12px;
          color: #64748b;
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        /* Clean Content Typography & Elements */
        .content-area {
          color: #1e293b;
        }
        .content-area h1, .content-area h2, .content-area h3, .content-area h4 {
          color: #0f172a;
          margin-top: 20px;
          margin-bottom: 10px;
          font-weight: 700;
          line-height: 1.4;
        }
        .content-area p { margin-bottom: 14px; }
        .content-area img {
          max-width: 100% !important;
          height: auto !important;
          margin: 14px auto;
          display: block;
          border-radius: 4px;
        }
        .content-area table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 13px;
        }
        .content-area th, .content-area td {
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
          text-align: left;
        }
        .content-area th { background: #f8fafc; font-weight: 600; }
        .content-area pre, .content-area code {
          background: #f1f5f9;
          border-radius: 4px;
          font-family: Consolas, monospace;
          font-size: 13px;
        }
        .content-area pre { padding: 12px; overflow-x: auto; white-space: pre-wrap; }
        .content-area blockquote {
          border-left: 4px solid #6366f1;
          padding-left: 14px;
          margin-left: 0;
          color: #475569;
          font-style: italic;
        }

        /* PrintFriendly Hover-to-Delete Effect */
        .content-area > * {
          position: relative;
          transition: background 0.12s;
          border-radius: 3px;
        }
        .content-area > *:hover {
          background: #fee2e2 !important;
          cursor: pointer;
          outline: 1px dashed #ef4444;
        }
        .content-area > *:hover::after {
          content: '🗑️ Bấm để xóa đoạn này';
          position: absolute;
          top: -10px;
          right: 8px;
          background: #dc2626;
          color: #ffffff;
          font-size: 10.5px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 4px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          pointer-events: none;
          z-index: 5;
        }

        .status-toast {
          position: fixed;
          bottom: 24px;
          background: #0f172a;
          color: #ffffff;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          z-index: 100;
          display: none;
          animation: slideUp 0.2s ease;
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `;
      this.shadow.appendChild(style);
    }

    render() {
      const isLandscape = this.orientation === 'landscape';
      const maxW = this.paperDimensions[this.paperSize]?.maxPx || (isLandscape ? 1050 : 820);

      this.overlay = document.createElement('div');
      this.overlay.className = 'overlay';
      this.overlay.innerHTML = `
        <div class="toolbar">
          <div class="brand">
            <div class="brand-icon">📄</div>
            <span>PrintFriendly Preview</span>
          </div>

          <div class="tool-group">
            <button class="tool-btn btn-download-pdf" id="btnDownloadPdf">
              <span>📥 Tải PDF Ngay</span>
            </button>
            <button class="tool-btn" id="btnDirectPrint">
              <span>🖨️ In</span>
            </button>

            <div style="height:20px; width:1px; background:#cbd5e1; margin:0 4px;"></div>

            <select class="tool-select" id="selectPaper">
              <option value="a4" ${this.paperSize === 'a4' ? 'selected' : ''}>Khổ A4 (Chuẩn)</option>
              <option value="a3" ${this.paperSize === 'a3' ? 'selected' : ''}>Khổ A3 (Bản rộng)</option>
              <option value="a5" ${this.paperSize === 'a5' ? 'selected' : ''}>Khổ A5 (Nhỏ gọn)</option>
              <option value="letter" ${this.paperSize === 'letter' ? 'selected' : ''}>Khổ Letter (Mỹ)</option>
              <option value="legal" ${this.paperSize === 'legal' ? 'selected' : ''}>Khổ Legal</option>
            </select>

            <select class="tool-select" id="selectOrient">
              <option value="portrait" ${!isLandscape ? 'selected' : ''}>Dọc (Portrait)</option>
              <option value="landscape" ${isLandscape ? 'selected' : ''}>Ngang (Landscape) ${this.articleData.hasWideContent ? '🔥' : ''}</option>
            </select>

            <button class="tool-btn" id="btnDecFont" title="Giảm cỡ chữ">A-</button>
            <span id="fontPercentLabel" style="font-size:12px; font-weight:700; color:#475569; min-width:38px; text-align:center;">100%</span>
            <button class="tool-btn" id="btnIncFont" title="Tăng cỡ chữ">A+</button>

            <button class="tool-btn" id="btnToggleImages">
              <span>🖼️ ${this.hideImages ? 'Hiện ảnh' : 'Ẩn ảnh'}</span>
            </button>

            <button class="tool-btn" id="btnUndo" disabled title="Khôi phục đoạn vừa xóa">
              <span>↩️ Hoàn tác (0)</span>
            </button>
          </div>

          <div>
            <button class="btn-close" id="btnClose">✕ Đóng</button>
          </div>
        </div>

        <div class="workspace-body" id="workspaceBody">
          <div class="paper-sheet" id="paperSheet" style="max-width: ${isLandscape ? '1050px' : maxW + 'px'};">
            <div class="doc-header">
              <input type="text" class="doc-title-input" id="docTitleInput" value="${this.articleData.displayTitle}">
              <div class="doc-meta">
                <span>🔗 Nguồn: <strong>${window.location.hostname}</strong></span>
                <span>📅 Ngày: ${new Date().toLocaleDateString('vi-VN')}</span>
                <span style="color:#059669;">💡 Click vào bất kỳ đoạn nào để xóa</span>
              </div>
            </div>
            <div class="content-area" id="contentArea">${this.articleData.htmlContent}</div>
          </div>
        </div>

        <div class="status-toast" id="statusToast"></div>
      `;

      this.shadow.appendChild(this.overlay);
    }

    bindEvents() {
      const btnClose = this.shadow.getElementById('btnClose');
      const btnDownloadPdf = this.shadow.getElementById('btnDownloadPdf');
      const btnDirectPrint = this.shadow.getElementById('btnDirectPrint');
      const selectPaper = this.shadow.getElementById('selectPaper');
      const selectOrient = this.shadow.getElementById('selectOrient');
      const btnDecFont = this.shadow.getElementById('btnDecFont');
      const btnIncFont = this.shadow.getElementById('btnIncFont');
      const fontPercentLabel = this.shadow.getElementById('fontPercentLabel');
      const btnToggleImages = this.shadow.getElementById('btnToggleImages');
      const btnUndo = this.shadow.getElementById('btnUndo');
      const paperSheet = this.shadow.getElementById('paperSheet');
      const contentArea = this.shadow.getElementById('contentArea');
      const docTitleInput = this.shadow.getElementById('docTitleInput');

      btnClose.addEventListener('click', () => this.container.remove());

      // 1. CLICK-TO-DELETE & UNDO STACK
      contentArea.addEventListener('click', (e) => {
        let target = e.target;
        while (target && target.parentElement !== contentArea) {
          target = target.parentElement;
        }
        if (target && target.parentElement === contentArea) {
          const nextSibling = target.nextSibling;
          const parent = target.parentElement;
          this.undoStack.push({
            node: target,
            parent: parent,
            nextSibling: nextSibling
          });
          target.remove();
          btnUndo.disabled = false;
          btnUndo.innerHTML = `<span>↩️ Hoàn tác (${this.undoStack.length})</span>`;
          this.showToast('🗑️ Đã xóa 1 đoạn. Bấm "Hoàn tác" nếu muốn khôi phục.');
        }
      });

      btnUndo.addEventListener('click', () => {
        if (this.undoStack.length > 0) {
          const item = this.undoStack.pop();
          if (item.nextSibling && item.nextSibling.parentElement === item.parent) {
            item.parent.insertBefore(item.node, item.nextSibling);
          } else {
            item.parent.appendChild(item.node);
          }
          btnUndo.disabled = this.undoStack.length === 0;
          btnUndo.innerHTML = `<span>↩️ Hoàn tác (${this.undoStack.length})</span>`;
          this.showToast('↩️ Đã hoàn tác khôi phục đoạn vừa xóa.');
        }
      });

      // 2. CỠ CHỮ
      btnDecFont.addEventListener('click', () => {
        if (this.fontSizePercent > 70) {
          this.fontSizePercent -= 10;
          paperSheet.style.fontSize = `${(14 * this.fontSizePercent) / 100}px`;
          fontPercentLabel.textContent = `${this.fontSizePercent}%`;
        }
      });
      btnIncFont.addEventListener('click', () => {
        if (this.fontSizePercent < 160) {
          this.fontSizePercent += 10;
          paperSheet.style.fontSize = `${(14 * this.fontSizePercent) / 100}px`;
          fontPercentLabel.textContent = `${this.fontSizePercent}%`;
        }
      });

      // 3. ẨN/HIỆN ẢNH
      btnToggleImages.addEventListener('click', () => {
        this.hideImages = !this.hideImages;
        contentArea.querySelectorAll('img').forEach((img) => {
          img.style.display = this.hideImages ? 'none' : 'block';
        });
        btnToggleImages.innerHTML = `<span>🖼️ ${this.hideImages ? 'Hiện ảnh' : 'Ẩn ảnh'}</span>`;
        btnToggleImages.classList.toggle('active', this.hideImages);
      });

      // 4. KHỔ GIẤY & HƯỚNG IN
      selectPaper.addEventListener('change', () => {
        this.paperSize = selectPaper.value;
        this.updatePaperDimensions();
      });
      selectOrient.addEventListener('change', () => {
        this.orientation = selectOrient.value;
        this.updatePaperDimensions();
      });

      // 5. TẢI PDF TRỰC TIẾP (KHÔNG DÙNG HỘP THOẠI PRINT CỦA CHROME)
      btnDownloadPdf.addEventListener('click', async () => {
        const title = docTitleInput.value.trim() || 'Tai_Lieu';
        btnDownloadPdf.disabled = true;
        btnDownloadPdf.innerHTML = '<span>⏳ Đang tạo PDF...</span>';

        try {
          await this.generateAndDownloadDirectPdf(title);
          this.showToast(`🎉 Đã tải xong: ${title}.pdf`);
        } catch (err) {
          console.error(err);
          alert(`Lỗi xuất PDF: ${err.message}`);
        } finally {
          btnDownloadPdf.disabled = false;
          btnDownloadPdf.innerHTML = '<span>📥 Tải PDF Ngay</span>';
        }
      });

      // 6. NÚT IN (TÙY CHỌN NẾU MUỐN IN RA MÁY IN VẬT LÝ)
      btnDirectPrint.addEventListener('click', () => {
        window.print();
      });
    }

    updatePaperDimensions() {
      const paperSheet = this.shadow.getElementById('paperSheet');
      const isLandscape = this.orientation === 'landscape';
      const dim = this.paperDimensions[this.paperSize] || this.paperDimensions.a4;
      paperSheet.style.maxWidth = isLandscape ? (dim.maxPx * 1.3) + 'px' : dim.maxPx + 'px';
    }

    showToast(msg) {
      const toast = this.shadow.getElementById('statusToast');
      if (toast) {
        toast.textContent = msg;
        toast.style.display = 'block';
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 2600);
      }
    }

    async getJsPDF() {
      if (global.jspdf && global.jspdf.jsPDF) return global.jspdf.jsPDF;
      if (global.jsPDF) return global.jsPDF;
      if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
      throw new Error('Chưa nạp thư viện jsPDF');
    }

    async getHtml2Canvas() {
      if (window.html2canvas) return window.html2canvas;
      if (global.html2canvas) return global.html2canvas;
      throw new Error('Chưa nạp thư viện html2canvas');
    }

    /**
     * TẠO & TẢI FILE PDF TRỰC TIẾP TỪ NỘI DUNG GIẤY (ĐỘ PHÂN GIẢI CAO 2X, PHÂN TRANG CHUẨN)
     */
    async generateAndDownloadDirectPdf(filename) {
      const paperSheet = this.shadow.getElementById('paperSheet');
      const jsPDFClass = await this.getJsPDF();
      const html2canvasFunc = await this.getHtml2Canvas();

      this.showToast('🚀 Đang chụp văn bản với độ nét cao 2X...');

      // Render nội dung giấy sang Canvas Retina siêu nét
      const canvas = await html2canvasFunc(paperSheet, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const isLandscape = this.orientation === 'landscape';
      const dim = this.paperDimensions[this.paperSize] || this.paperDimensions.a4;
      const targetW = isLandscape ? dim.landscape.w : dim.portrait.w;
      const targetH = isLandscape ? dim.landscape.h : dim.portrait.h;

      const pdf = new jsPDFClass({
        orientation: isLandscape ? 'l' : 'p',
        unit: 'mm',
        format: [targetW, targetH]
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgWidth = targetW;
      const imgHeight = (canvas.height * targetW) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Trang 1
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= targetH;

      // Thêm các trang tiếp theo nếu nội dung dài
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage([targetW, targetH], isLandscape ? 'l' : 'p');
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= targetH;
      }

      // Tải file trực tiếp về máy
      const pdfBlob = pdf.output('blob');
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const dl = document.createElement('a');
      dl.href = downloadUrl;
      dl.download = `${filename}.pdf`;
      document.body.appendChild(dl);
      dl.click();
      setTimeout(() => {
        dl.remove();
        URL.revokeObjectURL(downloadUrl);
      }, 2000);

      return true;
    }
  }

  global.__PrintFriendlyWorkspace = PrintFriendlyWorkspace;
})(window);

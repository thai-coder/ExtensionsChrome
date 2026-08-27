/**
 * friendly-preview.js - Giao diện Full-screen Reader & Trình xuất PDF Vector Chữ Thật + PDF Nhanh
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
        a4: { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 }, maxPx: 840 },
        a3: { portrait: { w: 297, h: 420 }, landscape: { w: 420, h: 297 }, maxPx: 1080 },
        a5: { portrait: { w: 148, h: 210 }, landscape: { w: 210, h: 148 }, maxPx: 680 },
        letter: { portrait: { w: 215.9, h: 279.4 }, landscape: { w: 279.4, h: 215.9 }, maxPx: 850 },
        legal: { portrait: { w: 215.9, h: 355.6 }, landscape: { w: 355.6, h: 215.9 }, maxPx: 850 }
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
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: #e2e8f0; z-index: 2147483647;
          display: flex; flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #1e293b; overflow: hidden; animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .toolbar {
          height: 56px; background: #ffffff; border-bottom: 1px solid #cbd5e1;
          box-shadow: 0 2px 10px rgba(0,0,0,0.06); display: flex; align-items: center;
          justify-content: space-between; padding: 0 16px; gap: 8px; flex-shrink: 0; z-index: 10;
        }
        .brand { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 14.5px; color: #0f172a; }
        .brand-icon {
          width: 28px; height: 28px; background: linear-gradient(135deg, #4f46e5, #7c3aed);
          border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px;
        }

        .tool-group { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
        .tool-btn {
          display: inline-flex; align-items: center; gap: 5px; padding: 7px 11px;
          background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px;
          font-size: 12px; font-weight: 600; color: #334155; cursor: pointer; transition: all 0.15s; user-select: none;
        }
        .tool-btn:hover { background: #f1f5f9; border-color: #94a3b8; color: #0f172a; }
        .tool-btn.active { background: #e0e7ff; border-color: #6366f1; color: #4338ca; }
        .tool-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .btn-vector-pdf {
          background: linear-gradient(135deg, #059669, #10b981); color: #fff; border: none;
          font-weight: 700; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35); padding: 7px 14px;
        }
        .btn-vector-pdf:hover { background: linear-gradient(135deg, #047857, #059669); color: #fff; }

        .btn-download-pdf {
          background: #f8fafc; color: #2563eb; border: 1px solid #93c5fd; font-weight: 700;
        }
        .btn-download-pdf:hover { background: #eff6ff; }

        .tool-select {
          padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px;
          background: #ffffff; font-size: 12px; font-weight: 600; color: #334155; outline: none; cursor: pointer;
        }
        .btn-close {
          background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 6px 12px;
          border-radius: 6px; font-size: 12.5px; font-weight: 700; cursor: pointer;
        }
        .btn-close:hover { background: #fecaca; }

        .workspace-body { flex: 1; overflow-y: auto; padding: 24px 16px 80px 16px; display: block; }
        .workspace-body::-webkit-scrollbar { width: 8px; }
        .workspace-body::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 4px; }

        .paper-sheet {
          background: #ffffff; box-shadow: 0 8px 35px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05);
          border-radius: 4px; padding: 48px 56px 60px 56px; width: 100%; max-width: 840px; margin: 0 auto 60px auto;
          display: flow-root; overflow: hidden; min-height: 800px; height: auto !important; position: relative;
          color: #111827; line-height: 1.7; font-size: 14px; transition: max-width 0.2s, font-size 0.15s;
        }

        .doc-header { margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; }
        .doc-title {
          font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.4; margin: 0 0 10px 0;
          word-break: break-word; overflow-wrap: break-word; white-space: normal; outline: none;
          border-radius: 4px; padding: 4px 6px; border: 1px dashed transparent; transition: all 0.15s;
        }
        .doc-title:hover, .doc-title:focus { background: #f8fafc; border-color: #cbd5e1; }
        .doc-meta { font-size: 12px; color: #64748b; display: flex; gap: 16px; flex-wrap: wrap; }

        .content-area { color: #1e293b; display: flow-root; overflow: visible; }
        .content-area h1, .content-area h2, .content-area h3, .content-area h4 {
          color: #0f172a; margin-top: 22px; margin-bottom: 10px; font-weight: 700; line-height: 1.4; word-break: break-word;
        }
        .content-area p { margin-bottom: 14px; word-break: break-word; }
        .content-area img { max-width: 100% !important; height: auto !important; margin: 14px auto; display: block; border-radius: 4px; }
        .content-area table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
        .content-area th, .content-area td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
        .content-area th { background: #f8fafc; font-weight: 600; }
        .content-area pre, .content-area code { background: #f1f5f9; border-radius: 4px; font-family: Consolas, monospace; font-size: 13px; }
        .content-area pre { padding: 12px; overflow-x: auto; white-space: pre-wrap; }
        .content-area blockquote { border-left: 4px solid #6366f1; padding-left: 14px; margin-left: 0; color: #475569; font-style: italic; }

        .content-area > * { position: relative; transition: background 0.12s; border-radius: 3px; }
        .content-area > *:hover { background: #fee2e2 !important; cursor: pointer; outline: 1px dashed #ef4444; }
        .content-area > *:hover::after {
          content: '🗑️ Bấm để xóa đoạn này'; position: absolute; top: -10px; right: 8px; background: #dc2626;
          color: #ffffff; font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 4px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2); pointer-events: none; z-index: 5;
        }

        .doc-footer {
          margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 11.5px;
          color: #94a3b8; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;
        }
        .status-toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #0f172a;
          color: #ffffff; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index: 100; display: none; animation: slideUp 0.2s ease;
        }
        @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `;
      this.shadow.appendChild(style);
    }

    render() {
      const isLandscape = this.orientation === 'landscape';
      const maxW = this.paperDimensions[this.paperSize]?.maxPx || (isLandscape ? 1080 : 840);

      this.overlay = document.createElement('div');
      this.overlay.className = 'overlay';
      this.overlay.innerHTML = `
        <div class="toolbar">
          <div class="brand">
            <div class="brand-icon">📄</div>
            <span>PrintFriendly Preview</span>
          </div>

          <div class="tool-group">
            <button class="tool-btn btn-vector-pdf" id="btnVectorPdf" title="Xuất file PDF giữ nguyên 100% chữ thật có thể bôi đen, copy và tìm kiếm Ctrl+F">
              <span>📄 Xuất PDF</span>
            </button>
            <button class="tool-btn btn-download-pdf" id="btnDownloadPdf" title="Tải file PDF nhanh trực tiếp">
              <span>📥 Tải PDF Nhanh</span>
            </button>

            <div style="height:20px; width:1px; background:#cbd5e1; margin:0 2px;"></div>

            <select class="tool-select" id="selectPaper">
              <option value="a4" ${this.paperSize === 'a4' ? 'selected' : ''}>Khổ A4</option>
              <option value="a3" ${this.paperSize === 'a3' ? 'selected' : ''}>Khổ A3</option>
              <option value="a5" ${this.paperSize === 'a5' ? 'selected' : ''}>Khổ A5</option>
              <option value="letter" ${this.paperSize === 'letter' ? 'selected' : ''}>Letter</option>
              <option value="legal" ${this.paperSize === 'legal' ? 'selected' : ''}>Legal</option>
            </select>

            <select class="tool-select" id="selectOrient">
              <option value="portrait" ${!isLandscape ? 'selected' : ''}>Dọc</option>
              <option value="landscape" ${isLandscape ? 'selected' : ''}>Ngang ${this.articleData.hasWideContent ? '🔥' : ''}</option>
            </select>

            <button class="tool-btn" id="btnDecFont" title="Giảm cỡ chữ">A-</button>
            <span id="fontPercentLabel" style="font-size:12px; font-weight:700; color:#475569; min-width:36px; text-align:center;">100%</span>
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
          <div class="paper-sheet" id="paperSheet" style="max-width: ${isLandscape ? '1080px' : maxW + 'px'};">
            <div class="doc-header">
              <div class="doc-title" id="docTitleHeading" contenteditable="true" spellcheck="false" title="Click để chỉnh sửa tiêu đề">${this.articleData.displayTitle}</div>
              <div class="doc-meta">
                <span>🌐 Nguồn: <strong>${window.location.hostname}</strong></span>
                <span>📅 Ngày: ${new Date().toLocaleDateString('vi-VN')}</span>
                <span style="color:#059669;">💡 Bấm vào đoạn thừa để xóa</span>
              </div>
            </div>
            <div class="content-area" id="contentArea">${this.articleData.htmlContent}</div>
            <div class="doc-footer">
              <span>📄 ${window.location.hostname}</span>
              <span>Tài liệu xuất bản sạch - 100% Vector Text</span>
            </div>
          </div>
        </div>

        <div class="status-toast" id="statusToast"></div>
      `;

      this.shadow.appendChild(this.overlay);
    }

    bindEvents() {
      const btnClose = this.shadow.getElementById('btnClose');
      const btnVectorPdf = this.shadow.getElementById('btnVectorPdf');
      const btnDownloadPdf = this.shadow.getElementById('btnDownloadPdf');
      const selectPaper = this.shadow.getElementById('selectPaper');
      const selectOrient = this.shadow.getElementById('selectOrient');
      const btnDecFont = this.shadow.getElementById('btnDecFont');
      const btnIncFont = this.shadow.getElementById('btnIncFont');
      const fontPercentLabel = this.shadow.getElementById('fontPercentLabel');
      const btnToggleImages = this.shadow.getElementById('btnToggleImages');
      const btnUndo = this.shadow.getElementById('btnUndo');
      const paperSheet = this.shadow.getElementById('paperSheet');
      const contentArea = this.shadow.getElementById('contentArea');
      const docTitleHeading = this.shadow.getElementById('docTitleHeading');

      btnClose.addEventListener('click', () => this.container.remove());

      // 1. CLICK-TO-DELETE & UNDO
      contentArea.addEventListener('click', (e) => {
        let target = e.target;
        while (target && target.parentElement !== contentArea) target = target.parentElement;
        if (target && target.parentElement === contentArea) {
          const nextSibling = target.nextSibling;
          const parent = target.parentElement;
          this.undoStack.push({ node: target, parent, nextSibling });
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

      // 5. XUẤT PDF CHỮ THẬT VECTOR 100%
      btnVectorPdf.addEventListener('click', () => {
        const titleText = (docTitleHeading.innerText || docTitleHeading.textContent || 'Tai_Lieu').trim().replace(/[\\/:*?"<>|]/g, '_');
        this.exportVectorPdf(titleText);
      });

      // 6. TẢI PDF NHANH TRỰC TIẾP
      btnDownloadPdf.addEventListener('click', async () => {
        const titleText = (docTitleHeading.innerText || docTitleHeading.textContent || 'Tai_Lieu').trim().replace(/[\\/:*?"<>|]/g, '_');
        btnDownloadPdf.disabled = true;
        btnDownloadPdf.innerHTML = '<span>⏳ Đang tạo...</span>';
        try {
          await this.generateAndDownloadDirectPdf(titleText);
          this.showToast(`🎉 Đã tải xong: ${titleText}.pdf`);
        } catch (err) {
          console.error(err);
          alert(`Lỗi xuất PDF: ${err.message}`);
        } finally {
          btnDownloadPdf.disabled = false;
          btnDownloadPdf.innerHTML = '<span>📥 Tải PDF Nhanh</span>';
        }
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

    /**
     * Xuất PDF Vector Chữ Thật 100% bằng Isolated Clean Print Engine
     */
    exportVectorPdf(title) {
      const contentArea = this.shadow.getElementById('contentArea');
      const htmlContent = contentArea.innerHTML;
      const fontSizePx = (14 * this.fontSizePercent) / 100;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            @page {
              size: ${this.paperSize} ${this.orientation};
              margin: 15mm 12mm 15mm 12mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
              font-size: ${fontSizePx}px;
              line-height: 1.65;
              color: #111827;
              background: #ffffff;
              margin: 0;
              padding: 0;
            }
            h1.doc-title {
              font-size: 22px;
              font-weight: 800;
              color: #0f172a;
              line-height: 1.35;
              margin: 0 0 10px 0;
              word-break: break-word;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 8px;
            }
            .doc-meta { font-size: 11px; color: #64748b; margin-bottom: 22px; display: flex; gap: 16px; }
            p, li { word-break: break-word; line-height: 1.7; margin-bottom: 12px; }
            h1, h2, h3, h4 { color: #0f172a; page-break-after: avoid; }
            img {
              max-width: 100% !important; height: auto !important; margin: 14px auto;
              display: ${this.hideImages ? 'none !important' : 'block'};
              border-radius: 4px; page-break-inside: avoid;
            }
            table { width: 100% !important; border-collapse: collapse; margin: 16px 0; page-break-inside: avoid; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; }
            th { background: #f8fafc; font-weight: 600; }
            pre, code { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; font-family: Consolas, monospace; font-size: 12.5px; page-break-inside: avoid; }
            pre { padding: 10px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; }
            blockquote { border-left: 4px solid #6366f1; padding-left: 12px; margin-left: 0; color: #475569; font-style: italic; }
            .doc-footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 10.5px; color: #94a3b8; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <h1 class="doc-title">${title}</h1>
          <div class="doc-meta">
            <span>🌐 Nguồn: ${window.location.hostname}</span>
            <span>📅 Ngày: ${new Date().toLocaleDateString('vi-VN')}</span>
          </div>
          <div class="content">${htmlContent}</div>
          <div class="doc-footer">
            <span>📄 ${window.location.hostname}</span>
            <span>Tài liệu xuất bản sạch - 100% Vector Text</span>
          </div>
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => iframe.remove(), 2500);
      }, 350);
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

    async generateAndDownloadDirectPdf(filename) {
      const paperSheet = this.shadow.getElementById('paperSheet');
      const jsPDFClass = await this.getJsPDF();
      const html2canvasFunc = await this.getHtml2Canvas();

      this.showToast('🚀 Đang kết xuất PDF...');

      const canvas = await html2canvasFunc(paperSheet, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          const paper = clonedDoc.getElementById('paperSheet') || clonedDoc.querySelector('.paper-sheet') || clonedDoc.getElementById('paper');
          if (!paper) return;
          const dummyCtx = document.createElement('canvas').getContext('2d');
          const cleanColor = (c) => {
            if (!c || typeof c !== 'string') return c;
            if (!c.includes('oklch') && !c.includes('oklab') && !c.includes('color-mix') && !c.includes('lch') && !c.includes('lab')) return c;
            try { dummyCtx.fillStyle = '#000000'; dummyCtx.fillStyle = c; return dummyCtx.fillStyle; } catch (e) { return '#1e293b'; }
          };
          paper.querySelectorAll('*').forEach((el) => {
            if (el.style) {
              ['color', 'backgroundColor', 'borderColor', 'outlineColor', 'fill', 'stroke'].forEach((p) => {
                if (el.style[p]) el.style[p] = cleanColor(el.style[p]);
              });
            }
          });
        }
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

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= targetH;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage([targetW, targetH], isLandscape ? 'l' : 'p');
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= targetH;
      }

      const pdfBlob = pdf.output('blob');
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const dl = document.createElement('a');
      dl.href = downloadUrl;
      dl.download = `${filename}.pdf`;
      document.body.appendChild(dl);
      dl.click();
      setTimeout(() => { dl.remove(); URL.revokeObjectURL(downloadUrl); }, 2000);
      return true;
    }
  }

  global.__PrintFriendlyWorkspace = PrintFriendlyWorkspace;
})(window);

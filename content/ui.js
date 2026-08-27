/**
 * ui.js - Giao diện Shadow DOM Dual-Mode (Cố định, Responsive, Chống crash)
 */
(function (global) {
  'use strict';

  class FloatingUI {
    constructor() {
      this.hostId = '__flipbook_downloader_host__';
      this.downloadEngine = global.__FlipbookDownloaderEngine ? new global.__FlipbookDownloaderEngine() : null;
      this.pdfEngine = global.__PDFEngine ? new global.__PDFEngine() : null;
      this.cleanArticleData = null;
      this.init();
    }

    init() {
      try {
        const existing = document.getElementById(this.hostId);
        if (existing) existing.remove();

        this.host = document.createElement('div');
        this.host.id = this.hostId;
        document.body.appendChild(this.host);
        this.shadow = this.host.attachShadow({ mode: 'open' });

        this.injectStyles();
        this.render();
        this.bindEvents();
      } catch (e) {
        console.error('Lỗi khởi tạo UI:', e);
      }
    }

    injectStyles() {
      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          box-sizing: border-box !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }
        .panel {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 420px;
          max-width: calc(100vw - 32px);
          max-height: calc(100vh - 40px);
          background: rgba(15, 23, 42, 0.97);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 14px;
          box-shadow: 0 20px 45px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.08);
          color: #F3F4F6;
          z-index: 2147483647;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-size: 13px;
          animation: slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .header {
          padding: 10px 14px;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25));
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          user-select: none;
          flex-shrink: 0;
        }
        .title {
          font-weight: 700;
          font-size: 13.5px;
          background: linear-gradient(90deg, #818cf8, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .close-btn {
          background: transparent;
          border: none;
          color: #9CA3AF;
          font-size: 18px;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 6px;
          line-height: 1;
        }
        .close-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.15); }
        
        .tab-bar {
          display: flex;
          background: rgba(0, 0, 0, 0.35);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }
        .tab-btn {
          flex: 1;
          padding: 9px 4px;
          background: transparent;
          border: none;
          color: #94A3B8;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          border-bottom: 2px solid transparent;
        }
        .tab-btn:hover { color: #F1F5F9; background: rgba(255, 255, 255, 0.05); }
        .tab-btn.active {
          color: #A5B4FC;
          background: rgba(99, 102, 241, 0.15);
          border-bottom-color: #6366f1;
        }

        .body {
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 9px;
          overflow-y: auto;
          overflow-x: hidden;
          flex: 1;
        }
        .body::-webkit-scrollbar, .log-box::-webkit-scrollbar, .preview-box::-webkit-scrollbar { width: 5px; height: 5px; }
        .body::-webkit-scrollbar-thumb, .log-box::-webkit-scrollbar-thumb, .preview-box::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
        
        .form-group { display: flex; flex-direction: column; gap: 3px; width: 100%; }
        label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #94A3B8; }
        input[type="text"], input[type="number"], select, textarea {
          width: 100% !important;
          min-width: 0 !important;
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 7px;
          padding: 6px 9px;
          color: #F8FAFC;
          font-size: 12px;
          outline: none;
        }
        select option { background: #1e293b; color: #f8fafc; }
        textarea { resize: vertical; min-height: 44px; word-break: break-all; }
        input:focus, select:focus, textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25); }
        .row { display: flex; gap: 6px; width: 100%; }
        .row > .form-group { flex: 1 1 0; min-width: 0; }
        
        .btn-group { display: flex; gap: 5px; width: 100%; margin-top: 2px; }
        button.btn {
          flex: 1 1 0;
          min-width: 0;
          padding: 8px 6px;
          border-radius: 7px;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          white-space: nowrap;
        }
        .btn-primary { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; }
        .btn-primary:hover:not(:disabled) { background: linear-gradient(135deg, #4338ca, #6d28d9); }
        .btn-secondary { background: rgba(255, 255, 255, 0.1); color: #E2E8F0; }
        .btn-secondary:hover:not(:disabled) { background: rgba(255, 255, 255, 0.18); }
        .btn-success { background: rgba(16, 185, 129, 0.25); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); }
        .btn-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); }
        button:disabled { opacity: 0.45; cursor: not-allowed; }

        .progress-container { background: rgba(0, 0, 0, 0.4); border-radius: 7px; padding: 8px 10px; border: 1px solid rgba(255, 255, 255, 0.08); width: 100%; }
        .progress-bar-bg { height: 5px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; overflow: hidden; margin-top: 4px; }
        .progress-bar-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899); transition: width 0.2s; }
        .log-box { font-family: monospace; font-size: 10.5px; height: 65px; background: rgba(0, 0, 0, 0.55); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; padding: 6px 8px; overflow-y: auto; color: #A7F3D0; white-space: pre-wrap; width: 100%; }
        .badge { display: inline-block; padding: 2px 5px; border-radius: 4px; font-size: 9.5px; font-weight: 700; background: rgba(99, 102, 241, 0.25); color: #a5b4fc; }

        .preview-box {
          max-height: 110px;
          overflow-y: auto;
          background: rgba(255, 255, 255, 0.04);
          border: 1px dashed rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          padding: 8px;
          font-size: 11.5px;
          color: #cbd5e1;
          line-height: 1.4;
        }
        .preview-box * { cursor: pointer; }
        .preview-box *:hover { background: rgba(239, 68, 68, 0.25) !important; color: #fca5a5 !important; border-radius: 3px; }
        .hint-text { font-size: 10px; color: #94a3b8; font-style: italic; }
      `;
      this.shadow.appendChild(style);
    }

    render() {
      const flipScan = global.__FlipbookDetector ? global.__FlipbookDetector.analyze() : {};
      const embeddedPdfs = global.__PDFDetector ? global.__PDFDetector.findEmbeddedPdfUrls() : [];

      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.innerHTML = `
        <div class="header">
          <div class="title"><span>⚡</span> Document & PDF Downloader Pro</div>
          <button class="close-btn" id="closeBtn">✕</button>
        </div>

        <div class="tab-bar">
          <button class="tab-btn active" id="tabFlipbookBtn">📖 Sách Flipbook (Scan)</button>
          <button class="tab-btn" id="tabPdfBtn">📄 In & Tải PDF Sạch</button>
        </div>

        <!-- TAB 1: FLIPBOOK DOWNLOADER -->
        <div class="body" id="tabFlipbookBody">
          <div class="form-group">
            <label>Tên tài liệu</label>
            <input type="text" id="docTitle" value="${flipScan.title || 'Tai_Lieu_Sach'}">
          </div>
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label>URL Mẫu (Pattern)</label>
              <span class="badge">{page} hoặc {page:3}</span>
            </div>
            <textarea id="urlPattern" rows="2" placeholder="https://site.com/pages/{page:3}.jpg">${flipScan.pattern || ''}</textarea>
          </div>
          <div class="row">
            <div class="form-group"><label>Từ</label><input type="number" id="startPage" value="${flipScan.startPage || 1}" min="0"></div>
            <div class="form-group"><label>Đến</label><input type="number" id="endPage" value="${flipScan.maxPage || 50}" min="1"></div>
            <div class="form-group"><label>Luồng</label><input type="number" id="concurrency" value="4" min="1" max="10"></div>
          </div>
          <div class="row">
            <div class="form-group">
              <label>Khổ giấy PDF</label>
              <select id="flipbookPaperSize">
                <option value="a4" selected>A4 (210 x 297 mm)</option>
                <option value="a3">A3 (297 x 420 mm)</option>
                <option value="a5">A5 (148 x 210 mm)</option>
                <option value="letter">Letter (8.5 x 11 in)</option>
                <option value="auto">Khổ gốc ảnh (Auto)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Hướng giấy</label>
              <select id="flipbookOrientation">
                <option value="auto" selected>Tự động theo ảnh</option>
                <option value="portrait">Dọc (Portrait)</option>
                <option value="landscape">Ngang (Landscape)</option>
              </select>
            </div>
          </div>
          <div class="btn-group">
            <button class="btn btn-secondary" id="reScanBtn">🔍 Dò lại</button>
            <button class="btn btn-primary" id="startZipBtn">📦 Tải ZIP</button>
            <button class="btn btn-success" id="startPdfBtn">📄 Ghép PDF</button>
            <button class="btn btn-danger" id="cancelBtn" disabled>🛑 Hủy</button>
          </div>
          <div class="progress-container">
            <div style="display:flex; justify-content:space-between; font-size:11px;">
              <span id="statusText">Sẵn sàng</span>
              <span id="percentText">0%</span>
            </div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" id="progressBar"></div></div>
          </div>
          <div class="log-box" id="logBox">⚡ Sẵn sàng tải Flipbook. Chọn Tải ZIP hoặc Ghép PDF.</div>
        </div>

        <!-- TAB 2: FRIENDLY PDF & CLEAN WEB-TO-PDF -->
        <div class="body" id="tabPdfBody" style="display:none;">
          <div class="form-group">
            <label>Tiêu đề bài viết</label>
            <input type="text" id="pdfArticleTitle" value="${document.title || 'Tai_Lieu_In'}">
          </div>

          <div id="embeddedPdfList" style="${embeddedPdfs.length > 0 ? '' : 'display:none;'} background:rgba(16, 185, 129, 0.15); border:1px solid rgba(16, 185, 129, 0.35); border-radius:7px; padding:8px 10px;">
            <div style="font-weight:700; color:#6ee7b7; font-size:11px; margin-bottom:4px;">🎯 File PDF gốc phát hiện được trong trang:</div>
            <div id="embeddedPdfsContainer"></div>
          </div>

          <div class="row">
            <div class="form-group">
              <label>Khổ giấy</label>
              <select id="articlePaperSize">
                <option value="a4" selected>A4 (210 x 297 mm)</option>
                <option value="a3">A3 (297 x 420 mm)</option>
                <option value="a5">A5 (148 x 210 mm)</option>
                <option value="letter">Letter (8.5 x 11 in)</option>
                <option value="legal">Legal (8.5 x 14 in)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Hướng in</label>
              <select id="articleOrientation">
                <option value="portrait" selected>Dọc (Portrait)</option>
                <option value="landscape">Ngang (Landscape)</option>
              </select>
            </div>
          </div>

          <div style="background:rgba(99, 102, 241, 0.12); border:1px solid rgba(99, 102, 241, 0.3); border-radius:8px; padding:12px 14px; margin-top:4px;">
            <div style="font-weight:700; color:#c7d2fe; font-size:12px; margin-bottom:4px;">✨ Trình xem trước PrintFriendly toàn màn hình:</div>
            <div style="font-size:11.5px; color:#94a3b8; line-height:1.5;">
              • Xem bản giấy A4/A3 màu trắng sạch sẽ trên nền xám.<br>
              • Di chuột & click để xóa đoạn thừa hoặc ảnh rác.<br>
              • Bấm <strong>"📥 Tải PDF Ngay"</strong> để tải file PDF trực tiếp (không qua hộp thoại in Chrome).
            </div>
          </div>

          <div class="btn-group" style="margin-top:8px;">
            <button class="btn btn-primary" id="openPreviewBtn" style="padding:11px 16px; font-size:13px; font-weight:700; box-shadow:0 4px 14px rgba(79, 70, 229, 0.4);">
              <span>👁️ Mở Trình Xem Trước & Tải PDF</span>
            </button>
          </div>
        </div>
      `;
      this.shadow.appendChild(panel);
    }

    bindEvents() {
      const closeBtn = this.shadow.getElementById('closeBtn');
      const tabFlipbookBtn = this.shadow.getElementById('tabFlipbookBtn');
      const tabPdfBtn = this.shadow.getElementById('tabPdfBtn');
      const tabFlipbookBody = this.shadow.getElementById('tabFlipbookBody');
      const tabPdfBody = this.shadow.getElementById('tabPdfBody');

      // TAB NAVIGATION
      tabFlipbookBtn.addEventListener('click', () => {
        tabFlipbookBtn.classList.add('active');
        tabPdfBtn.classList.remove('active');
        tabFlipbookBody.style.display = 'flex';
        tabPdfBody.style.display = 'none';
      });

      tabPdfBtn.addEventListener('click', () => {
        tabPdfBtn.classList.add('active');
        tabFlipbookBtn.classList.remove('active');
        tabPdfBody.style.display = 'flex';
        tabFlipbookBody.style.display = 'none';
        if (!this.cleanArticleData) {
          this.loadCleanArticle();
        }
      });

      closeBtn.addEventListener('click', () => this.host.remove());

      // TAB 1: FLIPBOOK EVENTS
      const docTitle = this.shadow.getElementById('docTitle');
      const urlPattern = this.shadow.getElementById('urlPattern');
      const startPage = this.shadow.getElementById('startPage');
      const endPage = this.shadow.getElementById('endPage');
      const concurrency = this.shadow.getElementById('concurrency');
      const flipbookPaperSize = this.shadow.getElementById('flipbookPaperSize');
      const flipbookOrientation = this.shadow.getElementById('flipbookOrientation');
      const reScanBtn = this.shadow.getElementById('reScanBtn');
      const startZipBtn = this.shadow.getElementById('startZipBtn');
      const startPdfBtn = this.shadow.getElementById('startPdfBtn');
      const cancelBtn = this.shadow.getElementById('cancelBtn');
      const statusText = this.shadow.getElementById('statusText');
      const percentText = this.shadow.getElementById('percentText');
      const progressBar = this.shadow.getElementById('progressBar');
      const logBox = this.shadow.getElementById('logBox');

      const appendLog = (msg) => {
        const time = new Date().toLocaleTimeString('vi-VN');
        logBox.textContent += `\n[${time}] ${msg}`;
        logBox.scrollTop = logBox.scrollHeight;
      };

      reScanBtn.addEventListener('click', () => {
        if (global.__FlipbookDetector) {
          const scan = global.__FlipbookDetector.analyze();
          urlPattern.value = scan.pattern;
          startPage.value = scan.startPage || 1;
          endPage.value = scan.maxPage;
          appendLog(`🔍 Dò lại thành công: ${scan.startPage || 1} ➔ ${scan.maxPage}`);
        }
      });

      cancelBtn.addEventListener('click', () => {
        if (this.downloadEngine) this.downloadEngine.abort();
        appendLog('🛑 Đã nhận lệnh hủy!');
        statusText.textContent = 'Đã hủy';
        this.setFlipbookRunningState(false);
      });

      const executeDownloadFlow = async (exportType = 'zip') => {
        if (!this.downloadEngine) return alert('Engine tải chưa sẵn sàng');
        const pattern = urlPattern.value.trim();
        const start = parseInt(startPage.value, 10);
        const end = parseInt(endPage.value, 10);
        const threads = Math.max(1, Math.min(10, parseInt(concurrency.value, 10) || 4));
        const title = docTitle.value.trim() || 'Tai_Lieu';

        if (!pattern) return alert('Chưa nhập URL Mẫu!');

        this.setFlipbookRunningState(true);
        statusText.textContent = 'Đang tải...';

        try {
          const result = await this.downloadEngine.startDownload({
            pattern,
            startPage: start,
            endPage: end,
            concurrency: threads,
            onProgress: (p) => {
              progressBar.style.width = `${p.percent}%`;
              percentText.textContent = `${p.percent}%`;
              statusText.textContent = `Đã có: ${p.completed}/${p.total} trang`;
            },
            onLog: appendLog
          });

          if (result.aborted) return;

          if (result.completedCount > 0) {
            if (exportType === 'zip') {
              statusText.textContent = 'Đang nén ZIP...';
              appendLog(`📦 Đang nén ${result.completedCount} trang vào ${title}.zip...`);
              await this.downloadEngine.packageAndSaveZip(title, (pct) => {
                statusText.textContent = `Đang nén: ${pct}%`;
              });
              appendLog(`🎉 XUẤT THÀNH CÔNG: ${title}.zip`);
            } else {
              statusText.textContent = 'Đang ghép PDF...';
              appendLog(`📄 Đang ghép ${result.completedCount} trang vào ${title}.pdf...`);
              await this.pdfEngine.convertImagesToPdf(this.downloadEngine.downloadedMap, {
                title,
                paperSize: flipbookPaperSize.value,
                orientation: flipbookOrientation.value,
                onProgress: (pct, cur, tot) => {
                  statusText.textContent = `Ghép PDF: ${cur}/${tot} (${pct}%)`;
                }
              });
              appendLog(`🎉 GHÉP XONG PDF: ${title}.pdf`);
            }
            statusText.textContent = 'Hoàn tất 100%';
          }
        } catch (err) {
          appendLog(`❌ Lỗi: ${err.message}`);
          statusText.textContent = 'Lỗi';
        } finally {
          this.setFlipbookRunningState(false);
        }
      };

      startZipBtn.addEventListener('click', () => executeDownloadFlow('zip'));
      startPdfBtn.addEventListener('click', () => executeDownloadFlow('pdf'));

      // TAB 2: FRIENDLY PDF EVENTS
      const openPreviewBtn = this.shadow.getElementById('openPreviewBtn');
      const articlePaperSize = this.shadow.getElementById('articlePaperSize');
      const articleOrientation = this.shadow.getElementById('articleOrientation');
      const pdfArticleTitle = this.shadow.getElementById('pdfArticleTitle');

      openPreviewBtn.addEventListener('click', () => {
        if (!this.cleanArticleData) {
          this.loadCleanArticle();
        }
        if (!this.cleanArticleData) return alert('Không thể trích xuất bài viết từ trang này.');

        if (pdfArticleTitle && pdfArticleTitle.value.trim()) {
          this.cleanArticleData.displayTitle = pdfArticleTitle.value.trim();
        }

        if (global.__PrintFriendlyWorkspace) {
          new global.__PrintFriendlyWorkspace(this.cleanArticleData, {
            paperSize: articlePaperSize.value,
            orientation: articleOrientation.value
          });
        }
      });
    }

    loadCleanArticle() {
      try {
        if (!global.__PDFDetector) return;
        const scan = global.__PDFDetector.extractCleanArticle();
        this.cleanArticleData = scan;
        const pdfArticleTitle = this.shadow.getElementById('pdfArticleTitle');
        const articleOrientation = this.shadow.getElementById('articleOrientation');

        if (pdfArticleTitle) pdfArticleTitle.value = scan.displayTitle;
        if (scan.hasWideContent && articleOrientation) {
          articleOrientation.value = 'landscape';
        }

        const embeddedPdfs = global.__PDFDetector.findEmbeddedPdfUrls();
        const embeddedList = this.shadow.getElementById('embeddedPdfList');
        const embeddedContainer = this.shadow.getElementById('embeddedPdfsContainer');
        if (embeddedList && embeddedContainer) {
          if (embeddedPdfs.length > 0) {
            embeddedList.style.display = 'block';
            embeddedContainer.innerHTML = embeddedPdfs.map((url, idx) => `
              <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-top:3px;">
                <span style="font-size:10px; color:#cbd5e1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">📄 ${url.split('/').pop().split('?')[0] || 'Tài liệu ' + (idx + 1)}</span>
                <a href="${url}" download class="btn btn-success" style="padding:2px 8px; font-size:10px; text-decoration:none;">⬇ Tải</a>
              </div>
            `).join('');
          } else {
            embeddedList.style.display = 'none';
          }
        }
      } catch (e) {
        console.error('Lỗi trích xuất article:', e);
      }
    }

    setFlipbookRunningState(isRunning) {
      const zipBtn = this.shadow.getElementById('startZipBtn');
      const pdfBtn = this.shadow.getElementById('startPdfBtn');
      const cancelBtn = this.shadow.getElementById('cancelBtn');
      const reScanBtn = this.shadow.getElementById('reScanBtn');
      if (zipBtn) zipBtn.disabled = isRunning;
      if (pdfBtn) pdfBtn.disabled = isRunning;
      if (cancelBtn) cancelBtn.disabled = !isRunning;
      if (reScanBtn) reScanBtn.disabled = isRunning;
    }
  }

  global.__FlipbookFloatingUI = FloatingUI;
})(window);

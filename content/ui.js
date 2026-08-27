/**
 * ui.js - Giao diện Shadow DOM Floating Panel (Responsive, Chống tràn, Tự căn chỉnh viewport)
 */
(function (global) {
  'use strict';

  class FloatingUI {
    constructor() {
      this.hostId = '__flipbook_downloader_host__';
      this.engine = new global.__FlipbookDownloaderEngine();
      this.init();
    }

    init() {
      const existing = document.getElementById(this.hostId);
      if (existing) existing.remove();

      this.host = document.createElement('div');
      this.host.id = this.hostId;
      document.body.appendChild(this.host);
      this.shadow = this.host.attachShadow({ mode: 'open' });

      this.injectStyles();
      this.render();
      this.bindEvents();
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
          width: 410px;
          max-width: calc(100vw - 32px);
          max-height: calc(100vh - 40px);
          background: rgba(17, 24, 39, 0.96);
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
          animation: slideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .header {
          padding: 12px 16px;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3));
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: grab;
          user-select: none;
          flex-shrink: 0;
        }
        .header:active { cursor: grabbing; }
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
          padding: 3px 7px;
          border-radius: 6px;
          line-height: 1;
        }
        .close-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.15); }
        .body {
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
          overflow-x: hidden;
          flex: 1;
        }
        /* Custom sleek scrollbar */
        .body::-webkit-scrollbar, .log-box::-webkit-scrollbar, .failed-tags::-webkit-scrollbar { width: 5px; height: 5px; }
        .body::-webkit-scrollbar-thumb, .log-box::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
        .body::-webkit-scrollbar-track { background: transparent; }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
          width: 100%;
        }
        label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #9CA3AF;
        }
        input[type="text"], input[type="number"], textarea {
          width: 100% !important;
          min-width: 0 !important;
          background: rgba(0, 0, 0, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 8px;
          padding: 7px 10px;
          color: #F9FAFB;
          font-size: 12px;
          outline: none;
          transition: all 0.2s;
        }
        textarea {
          resize: vertical;
          word-break: break-all;
          white-space: pre-wrap;
          line-height: 1.4;
          min-height: 48px;
        }
        input:focus, textarea:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
          background: rgba(0, 0, 0, 0.6);
        }
        .row {
          display: flex;
          gap: 8px;
          width: 100%;
        }
        .row > .form-group {
          flex: 1 1 0;
          min-width: 0;
        }
        .btn-group {
          display: flex;
          gap: 6px;
          margin-top: 2px;
          width: 100%;
        }
        button.btn {
          flex: 1 1 0;
          min-width: 0;
          padding: 9px 8px;
          border-radius: 8px;
          font-size: 12px;
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
        .btn-secondary { background: rgba(255, 255, 255, 0.1); color: #E5E7EB; }
        .btn-secondary:hover:not(:disabled) { background: rgba(255, 255, 255, 0.18); }
        .btn-warning { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); }
        .btn-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); }
        .btn-success { background: rgba(16, 185, 129, 0.25); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); }
        button:disabled { opacity: 0.45; cursor: not-allowed; filter: grayscale(0.7); }

        .progress-container {
          background: rgba(0, 0, 0, 0.4);
          border-radius: 8px;
          padding: 9px 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          width: 100%;
        }
        .progress-bar-bg {
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 5px;
        }
        .progress-bar-fill {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899);
          border-radius: 3px;
          transition: width 0.2s ease;
        }
        .failed-box {
          display: none;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.35);
          border-radius: 8px;
          padding: 10px;
          font-size: 11.5px;
          width: 100%;
        }
        .failed-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 6px;
          max-height: 50px;
          overflow-y: auto;
        }
        .failed-tag {
          background: rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 10.5px;
        }
        .log-box {
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
          font-size: 11px;
          height: 75px;
          background: rgba(0, 0, 0, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          padding: 7px 10px;
          overflow-y: auto;
          color: #A7F3D0;
          white-space: pre-wrap;
          word-break: break-all;
          line-height: 1.4;
          width: 100%;
        }
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          background: rgba(99, 102, 241, 0.25);
          color: #a5b4fc;
        }
      `;
      this.shadow.appendChild(style);
    }

    render() {
      const scan = global.__FlipbookDetector ? global.__FlipbookDetector.analyze() : {};

      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.id = 'mainPanel';
      panel.innerHTML = `
        <div class="header" id="dragHeader">
          <div class="title"><span>📖</span> Flipbook Downloader Pro</div>
          <button class="close-btn" id="closeBtn">✕</button>
        </div>
        <div class="body">
          <div class="form-group">
            <label>Tên tài liệu (.ZIP)</label>
            <input type="text" id="docTitle" value="${scan.title || 'Tai_Lieu_Sach'}">
          </div>
          <div class="form-group">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label>URL Mẫu (Pattern)</label>
              <span class="badge">{page} hoặc {page:3}</span>
            </div>
            <textarea id="urlPattern" rows="2" placeholder="https://site.com/pages/{page:3}.jpg">${scan.pattern || ''}</textarea>
          </div>
          <div class="row">
            <div class="form-group"><label>Từ trang</label><input type="number" id="startPage" value="1" min="0"></div>
            <div class="form-group"><label>Đến trang</label><input type="number" id="endPage" value="${scan.maxPage || 50}" min="1"></div>
            <div class="form-group"><label>Số luồng</label><input type="number" id="concurrency" value="4" min="1" max="10"></div>
          </div>
          <div class="btn-group">
            <button class="btn btn-secondary" id="reScanBtn">🔍 Dò lại</button>
            <button class="btn btn-primary" id="startBtn">🚀 Tải toàn bộ</button>
            <button class="btn btn-warning" id="pauseBtn" disabled>⏸ Tạm dừng</button>
            <button class="btn btn-danger" id="cancelBtn" disabled>🛑 Hủy</button>
          </div>

          <div class="failed-box" id="failedBox">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong id="failedCountTitle" style="color:#fca5a5;">⚠️ Bị sót trang ảnh</strong>
              <button class="btn btn-secondary" id="clearCacheBtn" style="padding:2px 6px; font-size:10px;">🗑 Xóa cache</button>
            </div>
            <div class="failed-tags" id="failedTags"></div>
            <div class="btn-group" style="margin-top:8px;">
              <button class="btn btn-primary" id="resumeFailedBtn">🔄 Tải lại trang lỗi (Resume)</button>
              <button class="btn btn-success" id="exportPartialZipBtn">📦 Xuất ZIP hiện có</button>
            </div>
          </div>

          <div class="progress-container">
            <div style="display:flex; justify-content:space-between; font-size:11px;">
              <span id="statusText">Sẵn sàng</span>
              <span id="percentText">0%</span>
            </div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" id="progressBar"></div></div>
          </div>
          <div class="log-box" id="logBox">⚡ Sẵn sàng tải với cơ chế Resume & Auto-Fallback URLs.</div>
        </div>
      `;
      this.shadow.appendChild(panel);
    }

    bindEvents() {
      const panel = this.shadow.getElementById('mainPanel');
      const dragHeader = this.shadow.getElementById('dragHeader');
      const closeBtn = this.shadow.getElementById('closeBtn');
      const startBtn = this.shadow.getElementById('startBtn');
      const pauseBtn = this.shadow.getElementById('pauseBtn');
      const cancelBtn = this.shadow.getElementById('cancelBtn');
      const reScanBtn = this.shadow.getElementById('reScanBtn');

      const failedBox = this.shadow.getElementById('failedBox');
      const failedCountTitle = this.shadow.getElementById('failedCountTitle');
      const failedTags = this.shadow.getElementById('failedTags');
      const resumeFailedBtn = this.shadow.getElementById('resumeFailedBtn');
      const exportPartialZipBtn = this.shadow.getElementById('exportPartialZipBtn');
      const clearCacheBtn = this.shadow.getElementById('clearCacheBtn');

      const docTitle = this.shadow.getElementById('docTitle');
      const urlPattern = this.shadow.getElementById('urlPattern');
      const startPage = this.shadow.getElementById('startPage');
      const endPage = this.shadow.getElementById('endPage');
      const concurrency = this.shadow.getElementById('concurrency');

      const statusText = this.shadow.getElementById('statusText');
      const percentText = this.shadow.getElementById('percentText');
      const progressBar = this.shadow.getElementById('progressBar');
      const logBox = this.shadow.getElementById('logBox');

      const appendLog = (msg) => {
        const time = new Date().toLocaleTimeString('vi-VN');
        logBox.textContent += `\n[${time}] ${msg}`;
        logBox.scrollTop = logBox.scrollHeight;
      };

      // Kéo thả Panel có giới hạn (Clamping) trong màn hình, không bao giờ bị khuất ra ngoài
      let isDragging = false, offX = 0, offY = 0;
      dragHeader.addEventListener('mousedown', (e) => {
        isDragging = true;
        offX = e.clientX - panel.getBoundingClientRect().left;
        offY = e.clientY - panel.getBoundingClientRect().top;
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const panelW = panel.offsetWidth || 410;
        const panelH = panel.offsetHeight || 400;
        const maxLeft = Math.max(10, window.innerWidth - panelW - 10);
        const maxTop = Math.max(10, window.innerHeight - panelH - 10);

        const clampedX = Math.min(Math.max(10, e.clientX - offX), maxLeft);
        const clampedY = Math.min(Math.max(10, e.clientY - offY), maxTop);

        panel.style.left = `${clampedX}px`;
        panel.style.top = `${clampedY}px`;
        panel.style.right = 'auto';
      });

      window.addEventListener('mouseup', () => { isDragging = false; });
      closeBtn.addEventListener('click', () => this.host.remove());

      reScanBtn.addEventListener('click', () => {
        const scan = global.__FlipbookDetector.analyze();
        urlPattern.value = scan.pattern;
        startPage.value = scan.startPage || 1;
        endPage.value = scan.maxPage;
        appendLog(`🔍 Dò lại thành công! Tìm thấy dải trang: ${scan.startPage || 1} ➔ ${scan.maxPage}`);
      });

      clearCacheBtn.addEventListener('click', () => {
        this.engine.resetCache();
        failedBox.style.display = 'none';
        progressBar.style.width = '0%';
        percentText.textContent = '0%';
        statusText.textContent = 'Đã dọn dẹp cache';
        appendLog('🗑 Đã xóa toàn bộ bộ nhớ tạm.');
      });

      pauseBtn.addEventListener('click', () => {
        const isPaused = this.engine.togglePause();
        pauseBtn.textContent = isPaused ? '▶ Tiếp tục' : '⏸ Tạm dừng';
        statusText.textContent = isPaused ? 'Đã tạm dừng' : 'Đang tải...';
      });

      cancelBtn.addEventListener('click', () => {
        this.engine.abort();
        appendLog('🛑 Đã nhận lệnh hủy!');
        statusText.textContent = 'Đã hủy';
        this.setUIState(false);
      });

      exportPartialZipBtn.addEventListener('click', async () => {
        const title = docTitle.value.trim() || 'Tai_Lieu';
        try {
          statusText.textContent = 'Đang nén ZIP...';
          await this.engine.packageAndSaveZip(title, (pct) => {
            statusText.textContent = `Đang nén: ${pct}%`;
          });
          appendLog(`🎉 Đã xuất thành công ZIP chứa ${this.engine.downloadedMap.size} trang!`);
        } catch (e) {
          appendLog(`❌ Lỗi xuất ZIP: ${e.message}`);
        }
      });

      const originalPageTitle = document.title;
      const onBeforeUnloadHandler = (e) => {
        e.preventDefault();
        e.returnValue = 'Tiến trình tải sách đang diễn ra, bạn có chắc muốn rời đi?';
        return e.returnValue;
      };

      const runDownloadProcess = async (onlyPagesList = null) => {
        const pattern = urlPattern.value.trim();
        const start = parseInt(startPage.value, 10);
        const end = parseInt(endPage.value, 10);
        const threads = Math.max(1, Math.min(10, parseInt(concurrency.value, 10) || 4));
        const title = docTitle.value.trim() || 'Tai_Lieu';

        if (!pattern) return alert('Chưa nhập URL Mẫu!');

        this.setUIState(true);
        statusText.textContent = 'Đang tải...';
        window.addEventListener('beforeunload', onBeforeUnloadHandler);

        try {
          const result = await this.engine.startDownload({
            pattern,
            startPage: start,
            endPage: end,
            concurrency: threads,
            onlyPages: onlyPagesList,
            onProgress: (p) => {
              progressBar.style.width = `${p.percent}%`;
              percentText.textContent = `${p.percent}%`;
              statusText.textContent = `Đã có: ${p.completed}/${p.total} trang`;
              document.title = `[${p.percent}%] 📖 ${originalPageTitle}`;
            },
            onLog: appendLog
          });

          if (result.aborted) return;

          if (result.failedPages.length > 0) {
            failedBox.style.display = 'block';
            failedCountTitle.textContent = `⚠️ Có ${result.failedPages.length} trang tải lỗi / không tìm thấy:`;
            failedTags.innerHTML = result.failedPages.map(p => `<span class="failed-tag">Trang ${p}</span>`).join('');
            resumeFailedBtn.textContent = `🔄 Tải lại ${result.failedPages.length} trang lỗi (Resume)`;
            appendLog(`⚠️ Còn ${result.failedPages.length} trang lỗi. Bạn có thể bấm "Tải lại trang lỗi" hoặc "Xuất ZIP hiện có".`);
            document.title = `[⚠️ Có lỗi] ${originalPageTitle}`;
          } else {
            failedBox.style.display = 'none';
          }

          if (result.failedPages.length === 0 && result.completedCount > 0) {
            statusText.textContent = 'Đang nén ZIP...';
            document.title = `[Đang nén ZIP...] ${originalPageTitle}`;
            appendLog(`📦 Đang tự động nén toàn bộ ${result.completedCount} trang vào ${title}.zip...`);
            await this.engine.packageAndSaveZip(title, (pct) => {
              statusText.textContent = `Đang nén: ${pct}%`;
              document.title = `[Nén ${pct}%] ${originalPageTitle}`;
            });
            appendLog(`🎉 HOÀN THÀNH 100%! Đã lưu: ${title}.zip`);
            statusText.textContent = 'Hoàn tất 100%';
            document.title = `[✅ TẢI XONG!] ${originalPageTitle}`;
          }
        } catch (err) {
          appendLog(`❌ Lỗi: ${err.message}`);
          statusText.textContent = 'Lỗi tiến trình';
          document.title = `[❌ Lỗi] ${originalPageTitle}`;
        } finally {
          window.removeEventListener('beforeunload', onBeforeUnloadHandler);
          this.setUIState(false);
        }
      };

      startBtn.addEventListener('click', () => runDownloadProcess(null));
      resumeFailedBtn.addEventListener('click', () => {
        const failedArr = Array.from(this.engine.failedMap.keys());
        if (failedArr.length > 0) {
          runDownloadProcess(failedArr);
        }
      });
    }

    setUIState(isRunning) {
      this.shadow.getElementById('startBtn').disabled = isRunning;
      this.shadow.getElementById('pauseBtn').disabled = !isRunning;
      this.shadow.getElementById('cancelBtn').disabled = !isRunning;
      this.shadow.getElementById('reScanBtn').disabled = isRunning;
      const resumeBtn = this.shadow.getElementById('resumeFailedBtn');
      if (resumeBtn) resumeBtn.disabled = isRunning;
    }
  }

  global.__FlipbookFloatingUI = FloatingUI;
})(window);

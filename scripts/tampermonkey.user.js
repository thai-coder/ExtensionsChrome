// ==UserScript==
// @name         Flipbook & Document Downloader Pro (Dual-Mode)
// @namespace    https://github.com/thai-coder/ExtensionsChrome
// @version      2.5.0
// @description  Hệ thống 2-trong-1: Tải sách Flipbook (ZIP/PDF) & In/Tải trang web thành PDF sạch sẽ (PrintFriendly) đa khổ giấy A3/A4/Letter & xoay ngang/dọc
// @author       Thai Coder
// @match        *://*/*
// @updateURL    https://raw.githubusercontent.com/thai-coder/ExtensionsChrome/main/scripts/tampermonkey.user.js
// @downloadURL  https://raw.githubusercontent.com/thai-coder/ExtensionsChrome/main/scripts/tampermonkey.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  function safeUnblock() {
    try {
      if (document.body) {
        document.body.oncontextmenu = null;
        document.body.onselectstart = null;
        document.body.oncopy = null;
      }
      document.oncontextmenu = null;
      document.onselectstart = null;
      document.oncopy = null;
    } catch (e) {}
  }

  const PatternDetector = {
    cleanFilename(name) {
      return (name || 'Tai_Lieu_Sach').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').substring(0, 80);
    },
    detectTotalPages() {
      try {
        const inputs = document.querySelectorAll('input');
        for (const input of inputs) {
          const val = (input.value || input.placeholder || '').trim();
          const matchSlash = val.match(/^(\d{1,4})\s*[\/|\\]\s*(\d{1,4})$/);
          if (matchSlash && parseInt(matchSlash[2], 10) > 1) return parseInt(matchSlash[2], 10);
          const max = parseInt(input.getAttribute('max'), 10);
          if (max > 1 && max < 5000) return max;
        }
      } catch (e) {}
      return 50;
    },
    analyze() {
      const candidates = new Set();
      try {
        if (window.performance?.getEntriesByType) {
          performance.getEntriesByType('resource').forEach((r) => {
            if (/\.(jpg|jpeg|png|webp|svg|gif)(\?.*)?$/i.test(r.name)) candidates.add(r.name);
          });
        }
        document.querySelectorAll('img').forEach((img) => {
          const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original');
          if (src && src.startsWith('http')) candidates.add(src);
        });
      } catch (e) {}

      let bestPattern = '', detectedPadding = 1;
      const urlList = Array.from(candidates);
      for (let url of urlList) {
        const cleanPath = url.split('?')[0];
        const lastSlash = cleanPath.lastIndexOf('/');
        if (lastSlash === -1) continue;
        const dir = cleanPath.substring(0, lastSlash + 1);
        const filename = cleanPath.substring(lastSlash + 1);
        const match = filename.match(/^(.*?)(\d+)(\.[a-zA-Z0-9]+)$/i);
        if (match) {
          const prefix = match[1], numStr = match[2], ext = match[3];
          bestPattern = numStr.length > 1 ? `${dir}${prefix}{page:${numStr.length}}${ext}` : `${dir}${prefix}{page}${ext}`;
          detectedPadding = numStr.length;
          break;
        }
      }
      return {
        title: this.cleanFilename(document.title),
        pattern: bestPattern || urlList[0] || '',
        padding: detectedPadding,
        maxPage: this.detectTotalPages()
      };
    }
  };

  const PDFDetector = {
    findEmbeddedPdfUrls() {
      const urls = new Set();
      try {
        document.querySelectorAll('embed[type*="pdf"], embed[src*=".pdf"], object[data*=".pdf"], iframe[src*=".pdf"], a[href*=".pdf"]').forEach((el) => {
          const src = el.getAttribute('src') || el.getAttribute('data') || el.getAttribute('href') || el.src || el.data || el.href;
          if (src && /\.pdf(\?.*)?$/i.test(src)) urls.add(new URL(src, window.location.href).href);
        });
      } catch (e) {}
      return Array.from(urls);
    },
    extractCleanArticle() {
      try {
        const title = document.querySelector('meta[property="og:title"]')?.content || document.querySelector('h1')?.innerText?.trim() || document.title || 'Tai_Lieu';
        const contentCandidates = ['article', 'main', '[role="main"]', '.post-content', '.article-content', '.entry-content', '.content-body', '#content'];
        let bestElement = null;
        for (const sel of contentCandidates) {
          const el = document.querySelector(sel);
          if (el && el.querySelectorAll('p').length >= 1) { bestElement = el; break; }
        }
        const sourceEl = bestElement || document.body || document.documentElement;
        const clone = sourceEl.cloneNode(true);
        const junk = [
          'script', 'style', 'noscript', 'iframe', 'object', 'embed', 'nav', 'aside', 'header', 'footer',
          'button', 'input', 'select', 'textarea', 'form', '[role="button"]', '[role="dialog"]',
          '.ad', '.ads', '.sidebar', '.comment', '.social-share', '.share-buttons', '.btn', '.button',
          '[class*="btn-"]', '[class*="button-"]', '[class*="share-"]', '#__flipbook_downloader_host__'
        ];
        junk.forEach((sel) => { clone.querySelectorAll(sel).forEach((el) => el.remove()); });

        let hasWideContent = false;
        clone.querySelectorAll('table').forEach((table) => {
          if (table.querySelectorAll('tr:first-child th, tr:first-child td').length >= 4 || table.scrollWidth > 700) hasWideContent = true;
          table.style.width = '100%'; table.style.borderCollapse = 'collapse';
          table.querySelectorAll('th, td').forEach((c) => { c.style.border = '1px solid #cbd5e1'; c.style.padding = '6px 8px'; });
        });
        clone.querySelectorAll('pre, code').forEach((code) => { if (code.scrollWidth > 700) hasWideContent = true; });

        return {
          title: title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 80),
          displayTitle: title,
          htmlContent: clone.innerHTML || '<p>Không có nội dung văn bản.</p>',
          hasWideContent,
          recommendedOrientation: hasWideContent ? 'landscape' : 'portrait'
        };
      } catch (e) {
        return { title: 'Tai_Lieu', displayTitle: document.title || 'Tai_Lieu', htmlContent: '<p>Tài liệu</p>', hasWideContent: false, recommendedOrientation: 'portrait' };
      }
    }
  };

  function loadScript(url, checkGlobal) {
    return new Promise((resolve, reject) => {
      if (checkGlobal()) return resolve(checkGlobal());
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => resolve(checkGlobal());
      s.onerror = () => reject(new Error('Lỗi nạp ' + url));
      document.head.appendChild(s);
    });
  }

  const loadJSZip = () => loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', () => window.JSZip);
  const loadJsPDF = () => loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', () => window.jspdf?.jsPDF || window.jsPDF);
  const loadHtml2Canvas = () => loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', () => window.html2canvas);

  async function fetchArrayBuffer(url, maxRetries = 3, onRetry = null) {
    let delay = 500;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (typeof GM_xmlhttpRequest === 'function') {
          return await new Promise((res, rej) => {
            GM_xmlhttpRequest({
              method: 'GET', url, responseType: 'arraybuffer', timeout: 20000,
              onload: (r) => (r.status >= 200 && r.status < 300 && r.response?.byteLength > 500) ? res(r.response) : rej(new Error(`HTTP ${r.status}`)),
              onerror: () => rej(new Error('Lỗi mạng')), ontimeout: () => rej(new Error('Timeout'))
            });
          });
        }
        const resp = await fetch(url, { mode: 'cors', cache: 'force-cache' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = await resp.arrayBuffer();
        if (!buf || buf.byteLength < 500) throw new Error('Dữ liệu rỗng');
        return buf;
      } catch (err) {
        if (attempt === maxRetries) throw err;
        if (onRetry) onRetry(attempt, delay, err.message);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      }
    }
  }

  const downloadedCache = new Map();

  function toggleUI(defaultTab = 'flipbook') {
    const hostId = '__flipbook_downloader_host__';
    const existing = document.getElementById(hostId);
    if (existing) return existing.remove();

    safeUnblock();
    const host = document.createElement('div');
    host.id = hostId;
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after { box-sizing: border-box !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .panel { position: fixed; top: 20px; right: 20px; width: 420px; max-width: calc(100vw - 32px); background: rgba(15, 23, 42, 0.97); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 14px; box-shadow: 0 20px 45px rgba(0,0,0,0.65); color: #F3F4F6; z-index: 2147483647; display: flex; flex-direction: column; overflow: hidden; font-size: 13px; }
      .header { padding: 10px 14px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25)); border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center; }
      .title { font-weight: 700; font-size: 13.5px; background: linear-gradient(90deg, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .close-btn { background: transparent; border: none; color: #9CA3AF; font-size: 18px; cursor: pointer; padding: 2px 6px; }
      .tab-bar { display: flex; background: rgba(0, 0, 0, 0.35); border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
      .tab-btn { flex: 1; padding: 9px 4px; background: transparent; border: none; color: #94A3B8; font-size: 12px; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; }
      .tab-btn.active { color: #A5B4FC; background: rgba(99, 102, 241, 0.15); border-bottom-color: #6366f1; }
      .body { padding: 12px 14px; display: flex; flex-direction: column; gap: 9px; overflow-y: auto; flex: 1; }
      .form-group { display: flex; flex-direction: column; gap: 3px; width: 100%; }
      label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; color: #94A3B8; }
      input, select, textarea { width: 100% !important; background: rgba(0, 0, 0, 0.45); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 7px; padding: 6px 9px; color: #F8FAFC; font-size: 12px; outline: none; }
      select option { background: #1e293b; color: #f8fafc; }
      .row { display: flex; gap: 6px; width: 100%; }
      .row > .form-group { flex: 1 1 0; }
      .btn-group { display: flex; gap: 5px; width: 100%; }
      button.btn { flex: 1 1 0; padding: 8px 6px; border-radius: 7px; font-size: 11.5px; font-weight: 600; cursor: pointer; border: none; white-space: nowrap; }
      .btn-primary { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; }
      .btn-secondary { background: rgba(255, 255, 255, 0.1); color: #E2E8F0; }
      .btn-success { background: rgba(16, 185, 129, 0.25); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); }
      .btn-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); }
      button:disabled { opacity: 0.45; cursor: not-allowed; }
      .progress-container { background: rgba(0, 0, 0, 0.4); border-radius: 7px; padding: 8px 10px; border: 1px solid rgba(255, 255, 255, 0.08); }
      .progress-bar-bg { height: 5px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; overflow: hidden; margin-top: 4px; }
      .progress-bar-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899); transition: width 0.2s; }
      .log-box { font-family: monospace; font-size: 10.5px; height: 65px; background: rgba(0, 0, 0, 0.55); border-radius: 6px; padding: 6px 8px; overflow-y: auto; color: #A7F3D0; white-space: pre-wrap; }
    `;
    shadow.appendChild(style);

    const flipScan = PatternDetector.analyze();
    const embeddedPdfs = PDFDetector.findEmbeddedPdfUrls();

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="header"><div class="title">⚡ Document & PDF Pro</div><button class="close-btn" id="closeBtn">✕</button></div>
      <div class="tab-bar">
        <button class="tab-btn ${defaultTab === 'flipbook' ? 'active' : ''}" id="tabFlipBtn">📖 Sách Flipbook</button>
        <button class="tab-btn ${defaultTab === 'pdf' ? 'active' : ''}" id="tabPdfBtn">📄 In & Tải PDF Sạch</button>
      </div>
      <div class="body" id="flipBody" style="${defaultTab === 'flipbook' ? '' : 'display:none;'}">
        <div class="form-group"><label>Tên tài liệu</label><input type="text" id="docTitle" value="${flipScan.title}"></div>
        <div class="form-group"><label>URL Mẫu (Pattern)</label><textarea id="urlPattern" rows="2">${flipScan.pattern}</textarea></div>
        <div class="row">
          <div class="form-group"><label>Từ</label><input type="number" id="startPage" value="1" min="0"></div>
          <div class="form-group"><label>Đến</label><input type="number" id="endPage" value="${flipScan.maxPage}" min="1"></div>
          <div class="form-group"><label>Luồng</label><input type="number" id="concurrency" value="4" min="1" max="10"></div>
        </div>
        <div class="row">
          <div class="form-group"><label>Khổ giấy</label><select id="flipPaper"><option value="a4">A4</option><option value="a3">A3</option><option value="letter">Letter</option><option value="auto">Khổ gốc</option></select></div>
          <div class="form-group"><label>Hướng</label><select id="flipOrient"><option value="auto">Tự động</option><option value="p">Dọc</option><option value="l">Ngang</option></select></div>
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" id="startZipBtn">📦 Tải ZIP</button>
          <button class="btn btn-success" id="startPdfBtn">📄 Ghép PDF</button>
          <button class="btn btn-danger" id="cancelBtn" disabled>🛑 Hủy</button>
        </div>
        <div class="progress-container">
          <div style="display:flex; justify-content:space-between; font-size:11px;"><span id="statusText">Sẵn sàng</span><span id="percentText">0%</span></div>
          <div class="progress-bar-bg"><div class="progress-bar-fill" id="progressBar"></div></div>
        </div>
        <div class="log-box" id="logBox">⚡ Sẵn sàng tải Flipbook.</div>
      </div>
      <div class="body" id="pdfBody" style="${defaultTab === 'pdf' ? '' : 'display:none;'}">
        <div class="form-group"><label>Tiêu đề</label><input type="text" id="pdfTitle" value="${document.title || 'Tai_Lieu'}"></div>
        <div id="embedPdfBox" style="${embeddedPdfs.length > 0 ? '' : 'display:none;'} background:rgba(16, 185, 129, 0.15); border-radius:7px; padding:6px 8px; font-size:10.5px;">
          <div style="color:#6ee7b7; font-weight:700;">🎯 File PDF gốc phát hiện được:</div>
          <div id="embedPdfContainer"></div>
        </div>
        <div class="row">
          <div class="form-group"><label>Khổ giấy</label><select id="artPaper"><option value="a4">A4</option><option value="a3">A3</option><option value="a5">A5</option><option value="letter">Letter</option></select></div>
          <div class="form-group"><label>Hướng in</label><select id="artOrient"><option value="portrait">Dọc</option><option value="landscape">Ngang</option></select></div>
        </div>
        <div style="background:rgba(99, 102, 241, 0.15); border-radius:7px; padding:10px 12px; margin-top:4px;">
          <div style="font-weight:700; color:#c7d2fe; font-size:11.5px; margin-bottom:3px;">✨ Trình xem trước PrintFriendly toàn màn hình:</div>
          <div style="font-size:11px; color:#94a3b8; line-height:1.4;">• Xem bản giấy A4/A3 trên nền xám.<br>• Click xóa đoạn thừa.<br>• Tải PDF trực tiếp (không qua Chrome print).</div>
        </div>
        <div class="btn-group" style="margin-top:8px;">
          <button class="btn btn-primary" id="openPreviewBtn" style="padding:10px 14px; font-weight:700;">👁️ Mở Trình Xem Trước & Tải PDF</button>
        </div>
      </div>
    `;
    shadow.appendChild(panel);

    shadow.getElementById('closeBtn').addEventListener('click', () => host.remove());
    const flipBtn = shadow.getElementById('tabFlipBtn'), pdfBtn = shadow.getElementById('tabPdfBtn');
    const flipBody = shadow.getElementById('flipBody'), pdfBody = shadow.getElementById('pdfBody');

    let cleanArticleData = null;
    function loadArticle() {
      try {
        const scan = PDFDetector.extractCleanArticle();
        cleanArticleData = scan;
        const pdfTitle = shadow.getElementById('pdfTitle'), artOrient = shadow.getElementById('artOrient');
        if (pdfTitle) pdfTitle.value = scan.displayTitle;
        if (scan.hasWideContent && artOrient) artOrient.value = 'landscape';
        const embedBox = shadow.getElementById('embedPdfBox'), embedContainer = shadow.getElementById('embedPdfContainer');
        const pList = PDFDetector.findEmbeddedPdfUrls();
        if (embedBox && embedContainer && pList.length > 0) {
          embedBox.style.display = 'block';
          embedContainer.innerHTML = pList.map(url => `<div style="display:flex; justify-content:space-between; margin-top:3px;"><span style="font-size:10px;">${url.split('/').pop().split('?')[0]}</span><a href="${url}" download class="btn btn-success" style="padding:1px 6px; font-size:9.5px; text-decoration:none;">⬇ Tải</a></div>`).join('');
        }
      } catch (e) {}
    }

    flipBtn.addEventListener('click', () => { flipBtn.classList.add('active'); pdfBtn.classList.remove('active'); flipBody.style.display = 'flex'; pdfBody.style.display = 'none'; });
    pdfBtn.addEventListener('click', () => { pdfBtn.classList.add('active'); flipBtn.classList.remove('active'); pdfBody.style.display = 'flex'; flipBody.style.display = 'none'; if (!cleanArticleData) loadArticle(); });

    const docTitle = shadow.getElementById('docTitle'), urlPattern = shadow.getElementById('urlPattern');
    const startPage = shadow.getElementById('startPage'), endPage = shadow.getElementById('endPage'), concurrency = shadow.getElementById('concurrency');
    const flipPaper = shadow.getElementById('flipPaper'), flipOrient = shadow.getElementById('flipOrient');
    const startZipBtn = shadow.getElementById('startZipBtn'), startPdfBtn = shadow.getElementById('startPdfBtn'), cancelBtn = shadow.getElementById('cancelBtn');
    const statusText = shadow.getElementById('statusText'), percentText = shadow.getElementById('percentText'), progressBar = shadow.getElementById('progressBar'), logBox = shadow.getElementById('logBox');

    const appendLog = (msg) => { logBox.textContent += `\n[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`; logBox.scrollTop = logBox.scrollHeight; };
    let isAborted = false;
    cancelBtn.addEventListener('click', () => { isAborted = true; appendLog('🛑 Đã hủy!'); statusText.textContent = 'Đã hủy'; startZipBtn.disabled = false; startPdfBtn.disabled = false; cancelBtn.disabled = true; });

    const executeFlipbookDownload = async (exportType) => {
      const pattern = urlPattern.value.trim(), start = parseInt(startPage.value, 10), end = parseInt(endPage.value, 10);
      const threads = Math.max(1, Math.min(10, parseInt(concurrency.value, 10) || 4)), title = docTitle.value.trim() || 'Tai_Lieu';
      if (!pattern) return alert('Chưa nhập URL Pattern!');

      isAborted = false; startZipBtn.disabled = true; startPdfBtn.disabled = true; cancelBtn.disabled = false; statusText.textContent = 'Đang tải...';
      const total = end - start + 1, pagesQueue = [];
      for (let p = start; p <= end; p++) { if (!downloadedCache.has(p)) pagesQueue.push(p); }
      let completed = downloadedCache.size;

      const worker = async () => {
        while (pagesQueue.length > 0) {
          if (isAborted) return;
          const page = pagesQueue.shift();
          const targetUrl = pattern.replace(/\{page(?::(\d+))?\}/g, (_, pad) => pad ? String(page).padStart(parseInt(pad, 10), '0') : String(page));
          try {
            const buf = await fetchArrayBuffer(targetUrl, 3, (att, d, msg) => appendLog(`⚠️ [Trang ${page}] Thử lại ${att}: ${msg}`));
            downloadedCache.set(page, buf); completed++;
            const pct = Math.round((completed / total) * 100);
            progressBar.style.width = `${pct}%`; percentText.textContent = `${pct}%`; statusText.textContent = `Đã nạp: ${completed}/${total}`;
          } catch (e) {}
        }
      };

      const workers = [];
      for (let i = 0; i < threads; i++) workers.push(worker());
      await Promise.all(workers);
      if (isAborted) return;

      if (downloadedCache.size > 0) {
        if (exportType === 'zip') {
          statusText.textContent = 'Đang nén ZIP...';
          const JSZip = await loadJSZip(), zip = new JSZip();
          for (let p of Array.from(downloadedCache.keys()).sort((a, b) => a - b)) zip.file(`page_${String(p).padStart(4, '0')}.jpg`, downloadedCache.get(p));
          const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${title}.zip`; a.click();
          appendLog(`🎉 Đã xuất: ${title}.zip`);
        } else {
          statusText.textContent = 'Đang ghép PDF...';
          const jsPDFClass = await loadJsPDF();
          const sorted = Array.from(downloadedCache.keys()).sort((a, b) => a - b);
          let doc = null;
          for (let i = 0; i < sorted.length; i++) {
            const p = sorted[i];
            const blobUrl = URL.createObjectURL(new Blob([downloadedCache.get(p)]));
            const imgInfo = await new Promise((res, rej) => {
              const m = new Image();
              m.onload = () => {
                const c = document.createElement('canvas');
                c.width = m.naturalWidth || 800; c.height = m.naturalHeight || 1100;
                c.getContext('2d').drawImage(m, 0, 0);
                const dUrl = c.toDataURL('image/jpeg', 0.95);
                URL.revokeObjectURL(blobUrl);
                res({ dataUrl: dUrl, width: c.width, height: c.height });
              };
              m.onerror = () => { URL.revokeObjectURL(blobUrl); rej(new Error('Lỗi ảnh ' + p)); };
              m.src = blobUrl;
            });
            const orient = flipOrient.value === 'auto' ? (imgInfo.width > imgInfo.height ? 'l' : 'p') : flipOrient.value;
            const pW = (imgInfo.width * 25.4) / 96, pH = (imgInfo.height * 25.4) / 96;
            const fmt = flipPaper.value === 'auto' ? [pW, pH] : flipPaper.value;
            if (i === 0) doc = new jsPDFClass({ orientation: orient, unit: 'mm', format: fmt });
            else doc.addPage(fmt, orient);
            doc.addImage(imgInfo.dataUrl, 'JPEG', 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), undefined, 'FAST');
          }
          const pdfBlob = doc.output('blob');
          const dlUrl = URL.createObjectURL(pdfBlob);
          const dlLink = document.createElement('a');
          dlLink.href = dlUrl; dlLink.download = `${title}.pdf`;
          document.body.appendChild(dlLink);
          dlLink.click();
          setTimeout(() => { dlLink.remove(); URL.revokeObjectURL(dlUrl); }, 2000);
          appendLog(`🎉 Đã xuất PDF: ${title}.pdf`);
        }
        statusText.textContent = 'Hoàn tất 100%';
      }
      startZipBtn.disabled = false; startPdfBtn.disabled = false; cancelBtn.disabled = true;
    };

    startZipBtn.addEventListener('click', () => executeFlipbookDownload('zip'));
    startPdfBtn.addEventListener('click', () => executeFlipbookDownload('pdf'));

    const openPreviewBtn = shadow.getElementById('openPreviewBtn');
    openPreviewBtn.addEventListener('click', () => {
      if (!cleanArticleData) loadArticle();
      if (!cleanArticleData) return alert('Không thể quét bài viết!');
      const pTitle = shadow.getElementById('pdfTitle').value.trim() || 'Tai_Lieu';
      const pPaper = shadow.getElementById('artPaper').value;
      const pOrient = shadow.getElementById('artOrient').value;
      cleanArticleData.displayTitle = pTitle;
      openPrintFriendlyWorkspace(cleanArticleData, { paperSize: pPaper, orientation: pOrient });
    });
  }

  function openPrintFriendlyWorkspace(articleData, opts = {}) {
    const existing = document.getElementById('__tm_printfriendly_modal__');
    if (existing) existing.remove();
    const host = document.createElement('div');
    host.id = '__tm_printfriendly_modal__';
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const isLandscape = opts.orientation === 'landscape';

    shadow.innerHTML = `
      <style>
        .overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:#e2e8f0; z-index:2147483647; display:flex; flex-direction:column; font-family:sans-serif; }
        .toolbar { height:54px; background:#fff; border-bottom:1px solid #cbd5e1; display:flex; align-items:center; justify-content:space-between; padding:0 16px; gap:10px; z-index:10; }
        .btn { padding:7px 12px; border-radius:6px; border:1px solid #cbd5e1; background:#f8fafc; font-size:12px; font-weight:700; cursor:pointer; }
        .btn-primary { background:#2563eb; color:#fff; border:none; }
        .btn-danger { background:#fee2e2; color:#dc2626; border-color:#fca5a5; }
        .body { flex:1; overflow-y:auto; padding:30px 16px 60px 16px; display:flex; flex-direction:column; align-items:center; }
        .paper { background:#fff; box-shadow:0 8px 30px rgba(0,0,0,0.12); padding:48px 56px; width:100%; max-width:${isLandscape ? '1050px' : '820px'}; min-height:900px; color:#1e293b; line-height:1.7; font-size:14px; }
        .paper > *:hover { background:#fee2e2!important; cursor:pointer; outline:1px dashed #ef4444; }
      </style>
      <div class="overlay">
        <div class="toolbar">
          <div style="font-weight:800; font-size:15px; color:#0f172a;">📄 PrintFriendly Preview</div>
          <div style="display:flex; gap:8px; align-items:center;">
            <button class="btn btn-primary" id="btnDlPdf">📥 Tải PDF Ngay</button>
            <button class="btn" id="btnHideImg">🖼️ Ẩn/Hiện ảnh</button>
            <button class="btn" id="btnUndo" disabled>↩️ Hoàn tác</button>
          </div>
          <div><button class="btn btn-danger" id="btnClose">✕ Đóng</button></div>
        </div>
        <div class="body">
          <div class="paper" id="paper">
            <h1 style="font-size:24px; font-weight:800; margin-bottom:12px; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">${articleData.displayTitle}</h1>
            <div id="cnt">${articleData.htmlContent}</div>
          </div>
        </div>
      </div>
    `;

    shadow.getElementById('btnClose').addEventListener('click', () => host.remove());
    const cnt = shadow.getElementById('cnt'), undoStack = [], btnUndo = shadow.getElementById('btnUndo');

    cnt.addEventListener('click', (e) => {
      let t = e.target;
      while (t && t.parentElement !== cnt) t = t.parentElement;
      if (t && t.parentElement === cnt) {
        undoStack.push({ node: t, parent: t.parentElement, next: t.nextSibling });
        t.remove(); btnUndo.disabled = false;
      }
    });

    btnUndo.addEventListener('click', () => {
      if (undoStack.length > 0) {
        const it = undoStack.pop();
        if (it.next && it.next.parentElement === it.parent) it.parent.insertBefore(it.node, it.next);
        else it.parent.appendChild(it.node);
        btnUndo.disabled = undoStack.length === 0;
      }
    });

    let hide = false;
    shadow.getElementById('btnHideImg').addEventListener('click', () => {
      hide = !hide; cnt.querySelectorAll('img').forEach((img) => (img.style.display = hide ? 'none' : 'block'));
    });

    shadow.getElementById('btnDlPdf').addEventListener('click', async () => {
      const btn = shadow.getElementById('btnDlPdf');
      btn.disabled = true; btn.textContent = '⏳ Đang tạo PDF...';
      try {
        const h2c = await loadHtml2Canvas(), jsPDFClass = await loadJsPDF();
        const paper = shadow.getElementById('paper');
        const canvas = await h2c(paper, { scale: 2, backgroundColor: '#ffffff' });
        const isL = opts.orientation === 'landscape', tw = isL ? 297 : 210, th = isL ? 210 : 297;
        const pdf = new jsPDFClass({ orientation: isL ? 'l' : 'p', unit: 'mm', format: [tw, th] });
        const imgH = (canvas.height * tw) / canvas.width;
        let hl = imgH, pos = 0, dUrl = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(dUrl, 'JPEG', 0, pos, tw, imgH, undefined, 'FAST');
        hl -= th;
        while (hl > 0) {
          pos = hl - imgH;
          pdf.addPage([tw, th], isL ? 'l' : 'p');
          pdf.addImage(dUrl, 'JPEG', 0, pos, tw, imgH, undefined, 'FAST');
          hl -= th;
        }
        const b = pdf.output('blob'), u = URL.createObjectURL(b), a = document.createElement('a');
        a.href = u; a.download = `${articleData.displayTitle}.pdf`;
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 2000);
      } catch (err) {
        alert('Lỗi tạo PDF: ' + err.message);
      } finally {
        btn.disabled = false; btn.textContent = '📥 Tải PDF Ngay';
      }
    });
  }

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('📖 Mở Sách Flipbook (Scan)', () => toggleUI('flipbook'));
    GM_registerMenuCommand('📄 In & Tải PDF Sạch (PrintFriendly)', () => toggleUI('pdf'));
  }
})();

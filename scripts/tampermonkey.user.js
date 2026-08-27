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

  function safeUnblockInteractions() {
    try {
      if (document.body) {
        document.body.oncontextmenu = null;
        document.body.onselectstart = null;
        document.body.oncopy = null;
      }
      document.oncontextmenu = null;
      document.onselectstart = null;
      document.oncopy = null;
      window.oncontextmenu = null;
    } catch (e) {}
  }

  const PatternDetector = {
    cleanFilename(name) {
      return (name || 'Tai_Lieu_Sach').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').substring(0, 80);
    },
    detectTotalPagesFromDOM() {
      try {
        const inputs = document.querySelectorAll('input');
        for (const input of inputs) {
          const val = (input.value || input.placeholder || '').trim();
          const maxAttr = input.getAttribute('max');
          const matchSlash = val.match(/^(\d{1,4})\s*[\/|\\]\s*(\d{1,4})$/);
          if (matchSlash) {
            const cur = parseInt(matchSlash[1], 10), tot = parseInt(matchSlash[2], 10);
            if (tot > 1 && tot < 5000) return { current: cur, total: tot };
          }
          if (maxAttr) {
            const parsedMax = parseInt(maxAttr, 10);
            if (parsedMax > 1 && parsedMax < 5000) return { current: 1, total: parsedMax };
          }
        }
        const candidates = document.querySelectorAll('[class*="page"], [id*="page"], [class*="nav"], [id*="nav"], span, div');
        const pageRegex = /\b(\d{1,4})\s*(?:\/|of|trên)\s*(\d{1,4})\b/i;
        for (const el of candidates) {
          const text = el.innerText || el.textContent || '';
          if (text.length > 0 && text.length < 25) {
            const match = text.trim().match(pageRegex);
            if (match) {
              const cur = parseInt(match[1], 10), tot = parseInt(match[2], 10);
              if (tot > 1 && tot < 5000 && cur <= tot) return { current: cur, total: tot };
            }
          }
        }
      } catch (e) {}
      return { current: 1, total: 50 };
    },
    analyze() {
      const candidates = new Set();
      try {
        if (window.performance && performance.getEntriesByType) {
          performance.getEntriesByType('resource').forEach((r) => {
            if (/\.(jpg|jpeg|png|webp|svg|gif)(\?.*)?$/i.test(r.name)) candidates.add(r.name);
          });
        }
        document.querySelectorAll('img').forEach((img) => {
          const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original');
          if (src && src.startsWith('http')) candidates.add(src);
        });
      } catch (e) {}

      const domPageInfo = this.detectTotalPagesFromDOM();
      let bestPattern = '', detectedPadding = 1, detectedMaxPage = domPageInfo.total;
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
          const padLength = numStr.length;
          const parsed = parseInt(numStr, 10);
          if (parsed >= 1990 && parsed <= 2099 && !prefix.toLowerCase().includes('page')) continue;
          bestPattern = padLength > 1 ? `${dir}${prefix}{page:${padLength}}${ext}` : `${dir}${prefix}{page}${ext}`;
          detectedPadding = padLength;
          break;
        }
      }
      return {
        title: this.cleanFilename(document.title),
        pattern: bestPattern || urlList[0] || '',
        padding: detectedPadding,
        maxPage: detectedMaxPage,
        totalFound: urlList.length
      };
    }
  };

  const PDFDetector = {
    findEmbeddedPdfUrls() {
      const urls = new Set();
      try {
        document.querySelectorAll('embed[type*="pdf"], embed[src*=".pdf"], object[data*=".pdf"]').forEach((el) => {
          const src = el.getAttribute('src') || el.getAttribute('data') || el.src || el.data;
          if (src && !src.startsWith('blob:') && !src.startsWith('about:')) urls.add(new URL(src, window.location.href).href);
        });
        document.querySelectorAll('iframe').forEach((iframe) => {
          const src = iframe.src || iframe.getAttribute('src') || '';
          if (src && /\.pdf(\?.*)?$/i.test(src)) urls.add(new URL(src, window.location.href).href);
        });
        document.querySelectorAll('a[href*=".pdf"]').forEach((a) => {
          const href = a.getAttribute('href');
          if (href && /\.pdf(\?.*)?$/i.test(href)) urls.add(new URL(href, window.location.href).href);
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
        ['script', 'style', 'noscript', 'iframe', 'nav', 'aside', 'header', 'footer', '.ad', '.ads', '.sidebar', '.comment', '#__flipbook_downloader_host__'].forEach((sel) => {
          clone.querySelectorAll(sel).forEach((el) => el.remove());
        });

        let hasWideContent = false;
        clone.querySelectorAll('table').forEach((table) => {
          if (table.querySelectorAll('tr:first-child th, tr:first-child td').length >= 4 || table.scrollWidth > 700) hasWideContent = true;
          table.style.width = '100%';
          table.style.borderCollapse = 'collapse';
          table.querySelectorAll('th, td').forEach(c => { c.style.border = '1px solid #ccc'; c.style.padding = '6px'; });
        });
        clone.querySelectorAll('pre, code').forEach((code) => {
          if (code.scrollWidth > 700) hasWideContent = true;
        });

        return {
          title: title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 80),
          displayTitle: title,
          htmlContent: clone.innerHTML || '<p>Không có nội dung văn bản.</p>',
          hasWideContent: hasWideContent,
          recommendedOrientation: hasWideContent ? 'landscape' : 'portrait'
        };
      } catch (e) {
        return {
          title: 'Tai_Lieu',
          displayTitle: document.title || 'Tai_Lieu',
          htmlContent: '<p>Tài liệu</p>',
          hasWideContent: false,
          recommendedOrientation: 'portrait'
        };
      }
    }
  };

  function loadJSZip() {
    return new Promise((resolve, reject) => {
      if (window.JSZip) return resolve(window.JSZip);
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => resolve(window.JSZip);
      script.onerror = () => reject(new Error('Lỗi tải JSZip'));
      document.head.appendChild(script);
    });
  }

  function loadJsPDF() {
    return new Promise((resolve, reject) => {
      if (window.jspdf && window.jspdf.jsPDF) return resolve(window.jspdf.jsPDF);
      if (window.jsPDF) return resolve(window.jsPDF);
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = () => resolve(window.jspdf.jsPDF);
      script.onerror = () => reject(new Error('Lỗi tải jsPDF'));
      document.head.appendChild(script);
    });
  }

  function generateCandidateUrls(primaryUrl) {
    const candidates = [primaryUrl];
    const matchExt = primaryUrl.match(/\.(jpg|jpeg|png|webp|svg|gif)(\?.*)?$/i);
    if (matchExt) {
      const currentExt = matchExt[1];
      const queryParams = matchExt[2] || '';
      const base = primaryUrl.substring(0, primaryUrl.lastIndexOf('.' + currentExt));
      const fallbacks = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.JPG', '.PNG'];
      for (const ext of fallbacks) {
        if (ext.toLowerCase() !== '.' + currentExt.toLowerCase()) candidates.push(`${base}${ext}${queryParams}`);
      }
    }
    return candidates;
  }

  async function fetchArrayBuffer(url, maxRetries = 3, onRetry = null) {
    let delay = 500;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (typeof GM_xmlhttpRequest === 'function') {
          const buffer = await new Promise((res, rej) => {
            GM_xmlhttpRequest({
              method: 'GET',
              url: url,
              responseType: 'arraybuffer',
              timeout: 20000,
              onload: (r) => {
                if (r.status >= 200 && r.status < 300 && r.response && r.response.byteLength > 500) res(r.response);
                else rej(new Error(`HTTP ${r.status}`));
              },
              onerror: () => rej(new Error('Lỗi mạng')),
              ontimeout: () => rej(new Error('Hết thời gian chờ'))
            });
          });
          return buffer;
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

  async function downloadPageWithCandidates(primaryUrl, pageNum, onLog) {
    const candidates = generateCandidateUrls(primaryUrl);
    let lastErr = null;
    for (let i = 0; i < candidates.length; i++) {
      const targetUrl = candidates[i];
      try {
        const buffer = await fetchArrayBuffer(targetUrl, 3, (att, d, msg) => {
          onLog(`⚠️ [Trang ${pageNum}] Thử lại ${att} (${d}ms): ${msg}`);
        });
        return buffer;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Không thể tải');
  }

  const downloadedCache = new Map();
  const failedCache = new Map();

  function toggleUI(defaultTab = 'flipbook') {
    const hostId = '__flipbook_downloader_host__';
    const existing = document.getElementById(hostId);
    if (existing) {
      existing.remove();
      return;
    }

    safeUnblockInteractions();

    const host = document.createElement('div');
    host.id = hostId;
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after { box-sizing: border-box !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .panel { position: fixed; top: 20px; right: 20px; width: 420px; max-width: calc(100vw - 32px); max-height: calc(100vh - 40px); background: rgba(15, 23, 42, 0.97); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 14px; box-shadow: 0 20px 45px rgba(0,0,0,0.65); color: #F3F4F6; z-index: 2147483647; display: flex; flex-direction: column; overflow: hidden; font-size: 13px; }
      .header { padding: 10px 14px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25)); border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center; user-select: none; flex-shrink: 0; }
      .title { font-weight: 700; font-size: 13.5px; background: linear-gradient(90deg, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .close-btn { background: transparent; border: none; color: #9CA3AF; font-size: 18px; cursor: pointer; border-radius: 6px; padding: 2px 6px; }
      .close-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.15); }
      .tab-bar { display: flex; background: rgba(0, 0, 0, 0.35); border-bottom: 1px solid rgba(255, 255, 255, 0.08); flex-shrink: 0; }
      .tab-btn { flex: 1; padding: 9px 4px; background: transparent; border: none; color: #94A3B8; font-size: 12px; font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; }
      .tab-btn.active { color: #A5B4FC; background: rgba(99, 102, 241, 0.15); border-bottom-color: #6366f1; }
      .body { padding: 12px 14px; display: flex; flex-direction: column; gap: 9px; overflow-y: auto; overflow-x: hidden; flex: 1; }
      .form-group { display: flex; flex-direction: column; gap: 3px; width: 100%; }
      label { font-size: 10.5px; font-weight: 600; text-transform: uppercase; color: #94A3B8; }
      input[type="text"], input[type="number"], select, textarea { width: 100% !important; background: rgba(0, 0, 0, 0.45); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 7px; padding: 6px 9px; color: #F8FAFC; font-size: 12px; outline: none; }
      select option { background: #1e293b; color: #f8fafc; }
      textarea { resize: vertical; min-height: 44px; word-break: break-all; }
      .row { display: flex; gap: 6px; width: 100%; }
      .row > .form-group { flex: 1 1 0; min-width: 0; }
      .btn-group { display: flex; gap: 5px; width: 100%; }
      button.btn { flex: 1 1 0; padding: 8px 6px; border-radius: 7px; font-size: 11.5px; font-weight: 600; cursor: pointer; border: none; white-space: nowrap; }
      .btn-primary { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; }
      .btn-secondary { background: rgba(255, 255, 255, 0.1); color: #E2E8F0; }
      .btn-success { background: rgba(16, 185, 129, 0.25); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); }
      .btn-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); }
      button:disabled { opacity: 0.45; cursor: not-allowed; }
      .progress-container { background: rgba(0, 0, 0, 0.4); border-radius: 7px; padding: 8px 10px; border: 1px solid rgba(255, 255, 255, 0.08); width: 100%; }
      .progress-bar-bg { height: 5px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; overflow: hidden; margin-top: 4px; }
      .progress-bar-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899); transition: width 0.2s; }
      .log-box { font-family: monospace; font-size: 10.5px; height: 65px; background: rgba(0, 0, 0, 0.55); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; padding: 6px 8px; overflow-y: auto; color: #A7F3D0; white-space: pre-wrap; width: 100%; }
      .preview-box { max-height: 110px; overflow-y: auto; background: rgba(255, 255, 255, 0.04); border: 1px dashed rgba(255, 255, 255, 0.2); border-radius: 6px; padding: 8px; font-size: 11.5px; color: #cbd5e1; }
      .preview-box * { cursor: pointer; }
      .preview-box *:hover { background: rgba(239, 68, 68, 0.25) !important; color: #fca5a5 !important; }
    `;
    shadow.appendChild(style);

    const flipScan = PatternDetector.analyze();
    const embeddedPdfs = PDFDetector.findEmbeddedPdfUrls();

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="header">
        <div class="title">⚡ Document & PDF Pro (Userscript)</div>
        <button class="close-btn" id="closeBtn">✕</button>
      </div>
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
          <button class="btn btn-secondary" id="reScanBtn">🔍 Dò lại</button>
          <button class="btn btn-primary" id="startZipBtn">📦 Tải ZIP</button>
          <button class="btn btn-success" id="startPdfBtn">📄 Ghép PDF</button>
          <button class="btn btn-danger" id="cancelBtn" disabled>🛑 Hủy</button>
        </div>
        <div class="progress-container">
          <div style="display:flex; justify-content:space-between; font-size:11px;"><span id="statusText">Sẵn sàng</span><span id="percentText">0%</span></div>
          <div class="progress-bar-bg"><div class="progress-bar-fill" id="progressBar"></div></div>
        </div>
        <div class="log-box" id="logBox">⚡ Sẵn sàng hoạt động (In-Tab Isolation OK)!</div>
      </div>

      <div class="body" id="pdfBody" style="${defaultTab === 'pdf' ? '' : 'display:none;'}">
        <div class="form-group"><label>Tiêu đề</label><input type="text" id="pdfTitle" value="${document.title || 'Tai_Lieu'}"></div>
        <div id="embedPdfBox" style="${embeddedPdfs.length > 0 ? '' : 'display:none;'} background:rgba(16, 185, 129, 0.15); border:1px solid rgba(16, 185, 129, 0.35); border-radius:7px; padding:6px 8px; font-size:10.5px;">
          <div style="color:#6ee7b7; font-weight:700;">🎯 File PDF gốc phát hiện được:</div>
          <div id="embedPdfContainer"></div>
        </div>
        <div class="row">
          <div class="form-group"><label>Khổ giấy</label><select id="artPaper"><option value="a4">A4</option><option value="a3">A3</option><option value="a5">A5</option><option value="letter">Letter</option></select></div>
          <div class="form-group"><label>Hướng in</label><select id="artOrient"><option value="portrait">Dọc</option><option value="landscape">Ngang</option></select></div>
        </div>
        <div class="row">
          <div class="form-group"><label>Cỡ chữ</label><select id="artFont"><option value="11pt">Nhỏ</option><option value="13pt" selected>Vừa</option><option value="15pt">Lớn</option></select></div>
          <div class="form-group" style="justify-content:flex-end;"><label style="display:flex; gap:5px; cursor:pointer; text-transform:none; font-size:11px; padding-top:14px;"><input type="checkbox" id="hideImg"> Ẩn hình ảnh</label></div>
        </div>
        <div class="form-group">
          <label>Xem trước (Click để xóa đoạn thừa)</label>
          <div class="preview-box" id="prevBox">Đang quét bài viết...</div>
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" id="printBtn" style="flex:2;">🖨️ In & Xuất PDF Sạch</button>
        </div>
      </div>
    `;
    shadow.appendChild(panel);

    shadow.getElementById('closeBtn').addEventListener('click', () => host.remove());

    const flipBtn = shadow.getElementById('tabFlipBtn');
    const pdfBtn = shadow.getElementById('tabPdfBtn');
    const flipBody = shadow.getElementById('flipBody');
    const pdfBody = shadow.getElementById('pdfBody');

    let cleanArticleData = null;
    function loadArticle() {
      try {
        const scan = PDFDetector.extractCleanArticle();
        cleanArticleData = scan;
        const pdfTitle = shadow.getElementById('pdfTitle');
        const artOrient = shadow.getElementById('artOrient');
        const prevBox = shadow.getElementById('prevBox');
        if (pdfTitle) pdfTitle.value = scan.displayTitle;
        if (prevBox) prevBox.innerHTML = scan.htmlContent;
        if (scan.hasWideContent && artOrient) artOrient.value = 'landscape';

        const embedBox = shadow.getElementById('embedPdfBox');
        const embedContainer = shadow.getElementById('embedPdfContainer');
        const pList = PDFDetector.findEmbeddedPdfUrls();
        if (embedBox && embedContainer && pList.length > 0) {
          embedBox.style.display = 'block';
          embedContainer.innerHTML = pList.map(url => `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:3px;"><span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:10px;">${url.split('/').pop().split('?')[0]}</span><a href="${url}" download class="btn btn-success" style="padding:1px 6px; font-size:9.5px; text-decoration:none;">⬇ Tải</a></div>`).join('');
        }
      } catch (e) {}
    }

    flipBtn.addEventListener('click', () => {
      flipBtn.classList.add('active'); pdfBtn.classList.remove('active');
      flipBody.style.display = 'flex'; pdfBody.style.display = 'none';
    });
    pdfBtn.addEventListener('click', () => {
      pdfBtn.classList.add('active'); flipBtn.classList.remove('active');
      pdfBody.style.display = 'flex'; flipBody.style.display = 'none';
      if (!cleanArticleData) loadArticle();
    });

    const docTitle = shadow.getElementById('docTitle');
    const urlPattern = shadow.getElementById('urlPattern');
    const startPage = shadow.getElementById('startPage');
    const endPage = shadow.getElementById('endPage');
    const concurrency = shadow.getElementById('concurrency');
    const flipPaper = shadow.getElementById('flipPaper');
    const flipOrient = shadow.getElementById('flipOrient');
    const startZipBtn = shadow.getElementById('startZipBtn');
    const startPdfBtn = shadow.getElementById('startPdfBtn');
    const cancelBtn = shadow.getElementById('cancelBtn');
    const statusText = shadow.getElementById('statusText');
    const percentText = shadow.getElementById('percentText');
    const progressBar = shadow.getElementById('progressBar');
    const logBox = shadow.getElementById('logBox');

    const appendLog = (msg) => {
      logBox.textContent += `\n[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`;
      logBox.scrollTop = logBox.scrollHeight;
    };

    let isAborted = false;
    cancelBtn.addEventListener('click', () => {
      isAborted = true;
      appendLog('🛑 Đã hủy!');
      statusText.textContent = 'Đã hủy';
      startZipBtn.disabled = false; startPdfBtn.disabled = false; cancelBtn.disabled = true;
    });

    const executeFlipbookDownload = async (exportType) => {
      const pattern = urlPattern.value.trim();
      const start = parseInt(startPage.value, 10);
      const end = parseInt(endPage.value, 10);
      const threads = Math.max(1, Math.min(10, parseInt(concurrency.value, 10) || 4));
      const title = docTitle.value.trim() || 'Tai_Lieu';
      if (!pattern) return alert('Chưa nhập URL Pattern!');

      isAborted = false;
      startZipBtn.disabled = true; startPdfBtn.disabled = true; cancelBtn.disabled = false;
      statusText.textContent = 'Đang tải...';

      const total = end - start + 1;
      const pagesQueue = [];
      for (let p = start; p <= end; p++) {
        if (!downloadedCache.has(p)) pagesQueue.push(p);
      }

      let completed = downloadedCache.size;
      const worker = async () => {
        while (pagesQueue.length > 0) {
          if (isAborted) return;
          const page = pagesQueue.shift();
          const targetUrl = pattern.replace(/\{page(?::(\d+))?\}/g, (_, pad) => pad ? String(page).padStart(parseInt(pad, 10), '0') : String(page));
          try {
            const buf = await downloadPageWithCandidates(targetUrl, page, appendLog);
            downloadedCache.set(page, buf);
            completed++;
            const pct = Math.round((completed / total) * 100);
            progressBar.style.width = `${pct}%`;
            percentText.textContent = `${pct}%`;
            statusText.textContent = `Đã nạp: ${completed}/${total}`;
          } catch (e) {
            failedCache.set(page, true);
          }
        }
      };

      const workers = [];
      for (let i = 0; i < threads; i++) workers.push(worker());
      await Promise.all(workers);
      if (isAborted) return;

      if (downloadedCache.size > 0) {
        if (exportType === 'zip') {
          statusText.textContent = 'Đang nén ZIP...';
          const JSZip = await loadJSZip();
          const zip = new JSZip();
          for (let p of Array.from(downloadedCache.keys()).sort((a, b) => a - b)) {
            zip.file(`page_${String(p).padStart(4, '0')}.jpg`, downloadedCache.get(p));
          }
          const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${title}.zip`;
          a.click();
          appendLog(`🎉 Đã xuất: ${title}.zip`);
        } else {
          statusText.textContent = 'Đang ghép PDF...';
          const jsPDFClass = await loadJsPDF();
          const sorted = Array.from(downloadedCache.keys()).sort((a, b) => a - b);
          let doc = null;
          for (let i = 0; i < sorted.length; i++) {
            const p = sorted[i];
            const imgBlob = new Blob([downloadedCache.get(p)]);
            const imgUrl = URL.createObjectURL(imgBlob);
            const meta = await new Promise(r => { const m = new Image(); m.onload = () => r(m); m.onerror = () => r({ naturalWidth: 800, naturalHeight: 1100 }); m.src = imgUrl; });
            const orient = flipOrient.value === 'auto' ? (meta.naturalWidth > meta.naturalHeight ? 'l' : 'p') : flipOrient.value;
            if (i === 0) doc = new jsPDFClass({ orientation: orient, unit: 'mm', format: flipPaper.value === 'auto' ? [meta.naturalWidth * 0.264, meta.naturalHeight * 0.264] : flipPaper.value });
            else doc.addPage(flipPaper.value === 'auto' ? [meta.naturalWidth * 0.264, meta.naturalHeight * 0.264] : flipPaper.value, orient);
            doc.addImage(imgUrl, 'JPEG', 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight());
            URL.revokeObjectURL(imgUrl);
          }
          doc.save(`${title}.pdf`);
          appendLog(`🎉 Đã xuất PDF: ${title}.pdf`);
        }
        statusText.textContent = 'Hoàn tất 100%';
      }
      startZipBtn.disabled = false; startPdfBtn.disabled = false; cancelBtn.disabled = true;
    };

    startZipBtn.addEventListener('click', () => executeFlipbookDownload('zip'));
    startPdfBtn.addEventListener('click', () => executeFlipbookDownload('pdf'));

    const prevBox = shadow.getElementById('prevBox');
    prevBox.addEventListener('click', (e) => {
      if (e.target !== prevBox) e.target.remove();
    });

    shadow.getElementById('printBtn').addEventListener('click', () => {
      const pTitle = shadow.getElementById('pdfTitle').value.trim() || 'Tai_Lieu';
      const pPaper = shadow.getElementById('artPaper').value;
      const pOrient = shadow.getElementById('artOrient').value;
      const pFont = shadow.getElementById('artFont').value;
      const hideImg = shadow.getElementById('hideImg').checked;

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed'; iframe.style.right = '0'; iframe.style.bottom = '0'; iframe.style.width = '0'; iframe.style.height = '0';
      document.body.appendChild(iframe);
      const d = iframe.contentWindow.document;
      d.open();
      d.write(`<!DOCTYPE html><html><head><title>${pTitle}</title><style>@page{size:${pPaper} ${pOrient};margin:15mm 12mm;}body{font-family:sans-serif;font-size:${pFont};line-height:1.6;}img{max-width:100%!important;display:${hideImg ? 'none!important' : 'block'};}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ccc;padding:6px;}</style></head><body><h1>${pTitle}</h1>${prevBox.innerHTML}</body></html>`);
      d.close();
      setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => iframe.remove(), 2000); }, 500);
    });
  }

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('📖 Mở Sách Flipbook (Scan)', () => toggleUI('flipbook'));
    GM_registerMenuCommand('📄 In & Tải PDF Sạch (PrintFriendly)', () => toggleUI('pdf'));
  }
})();

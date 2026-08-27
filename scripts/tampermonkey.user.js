// ==UserScript==
// @name         Flipbook & Scanned Document Downloader Pro
// @namespace    https://github.com/thai-coder/ExtensionsChrome
// @version      2.2.0
// @description  Tự động trích xuất và tải toàn bộ ảnh từ các trang Flipbook/Sách trực tuyến thành file ZIP (Auto-Retry, Resume & In-Tab Isolation)
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
      const candidates = document.querySelectorAll('[class*="page"], [id*="page"], [class*="nav"], [id*="nav"], [class*="control"], span, div');
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
      return { current: 1, total: 50 };
    },
    analyze() {
      const candidates = new Set();
      if (window.performance && performance.getEntriesByType) {
        performance.getEntriesByType('resource').forEach((r) => {
          if (/\.(jpg|jpeg|png|webp|svg|gif)(\?.*)?$/i.test(r.name)) candidates.add(r.name);
        });
      }
      document.querySelectorAll('img').forEach((img) => {
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original');
        if (src && src.startsWith('http')) candidates.add(src);
      });
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

  function loadJSZip() {
    return new Promise((resolve, reject) => {
      if (window.JSZip) return resolve(window.JSZip);
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve(window.JSZip);
      script.onerror = () => reject(new Error('Không thể tải thư viện JSZip từ CDN.'));
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
        if (ext.toLowerCase() !== '.' + currentExt.toLowerCase()) {
          candidates.push(`${base}${ext}${queryParams}`);
        }
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
                if (r.status >= 200 && r.status < 300 && r.response && r.response.byteLength > 500) {
                  res(r.response);
                } else {
                  rej(new Error(`HTTP ${r.status}`));
                }
              },
              onerror: () => rej(new Error('Lỗi mạng GM_xhr')),
              ontimeout: () => rej(new Error('Hết thời gian chờ GM_xhr'))
            });
          });
          return buffer;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        const resp = await fetch(url, { signal: controller.signal, mode: 'cors', cache: 'force-cache' });
        clearTimeout(timer);
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
      if (i > 0) onLog(`🔍 [Trang ${pageNum}] Dò URL dự phòng: ${targetUrl.split('/').pop()}`);
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

  function toggleUI() {
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
      .panel { position: fixed; top: 20px; right: 20px; width: 410px; max-width: calc(100vw - 32px); max-height: calc(100vh - 40px); background: rgba(17, 24, 39, 0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 14px; box-shadow: 0 20px 45px rgba(0,0,0,0.65); color: #F3F4F6; z-index: 2147483647; display: flex; flex-direction: column; overflow: hidden; font-size: 13px; }
      .header { padding: 12px 16px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3)); border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center; user-select: none; flex-shrink: 0; }
      .title { font-weight: 700; font-size: 13.5px; background: linear-gradient(90deg, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .close-btn { background: transparent; border: none; color: #9CA3AF; font-size: 18px; cursor: pointer; border-radius: 6px; padding: 2px 6px; }
      .close-btn:hover { color: #fff; background: rgba(255, 255, 255, 0.15); }
      .body { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; overflow-x: hidden; flex: 1; }
      .body::-webkit-scrollbar, .log-box::-webkit-scrollbar { width: 5px; height: 5px; }
      .body::-webkit-scrollbar-thumb, .log-box::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
      .form-group { display: flex; flex-direction: column; gap: 4px; width: 100%; }
      label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #9CA3AF; }
      input[type="text"], input[type="number"], textarea { width: 100% !important; min-width: 0 !important; background: rgba(0, 0, 0, 0.45); border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 8px; padding: 7px 10px; color: #F9FAFB; font-size: 12px; outline: none; }
      textarea { resize: vertical; min-height: 48px; }
      .row { display: flex; gap: 8px; width: 100%; }
      .row > .form-group { flex: 1 1 0; min-width: 0; }
      .btn-group { display: flex; gap: 6px; width: 100%; }
      button.btn { flex: 1 1 0; min-width: 0; padding: 9px 8px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; white-space: nowrap; }
      .btn-primary { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; }
      .btn-secondary { background: rgba(255, 255, 255, 0.1); color: #E5E7EB; }
      .btn-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); }
      .btn-success { background: rgba(16, 185, 129, 0.25); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); }
      button:disabled { opacity: 0.45; cursor: not-allowed; }
      .progress-container { background: rgba(0, 0, 0, 0.4); border-radius: 8px; padding: 9px 12px; border: 1px solid rgba(255, 255, 255, 0.08); width: 100%; }
      .progress-bar-bg { height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; overflow: hidden; margin-top: 5px; }
      .progress-bar-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899); transition: width 0.2s; }
      .failed-box { display: none; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px; padding: 10px; font-size: 11.5px; width: 100%; }
      .failed-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; max-height: 50px; overflow-y: auto; }
      .failed-tag { background: rgba(239, 68, 68, 0.3); color: #fca5a5; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10.5px; }
      .log-box { font-family: Consolas, monospace; font-size: 11px; height: 75px; background: rgba(0, 0, 0, 0.55); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 6px; padding: 7px 10px; overflow-y: auto; color: #A7F3D0; white-space: pre-wrap; width: 100%; }
      .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; background: rgba(99, 102, 241, 0.25); color: #a5b4fc; }
    `;
    shadow.appendChild(style);

    const scan = PatternDetector.analyze();
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="header" id="panelHeader">
        <div class="title">📖 Flipbook Downloader Pro (Userscript)</div>
        <button class="close-btn" id="closeBtn">✕</button>
      </div>
      <div class="body">
        <div class="form-group"><label>Tên tài liệu (.ZIP)</label><input type="text" id="docTitle" value="${scan.title}"></div>
        <div class="form-group"><div style="display:flex; justify-content:space-between;"><label>URL Mẫu (Pattern)</label><span class="badge">{page} hoặc {page:3}</span></div><textarea id="urlPattern" rows="2">${scan.pattern}</textarea></div>
        <div class="row">
          <div class="form-group"><label>Từ trang</label><input type="number" id="startPage" value="1" min="0"></div>
          <div class="form-group"><label>Đến trang</label><input type="number" id="endPage" value="${scan.maxPage}" min="1"></div>
          <div class="form-group"><label>Số luồng</label><input type="number" id="concurrency" value="4" min="1" max="10"></div>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary" id="reScanBtn">🔍 Dò lại</button>
          <button class="btn btn-primary" id="startBtn">🚀 Tải toàn bộ</button>
          <button class="btn btn-danger" id="cancelBtn" disabled>🛑 Hủy</button>
        </div>
        <div class="failed-box" id="failedBox">
          <div style="display:flex; justify-content:space-between; align-items:center;"><strong id="failedCountTitle" style="color:#fca5a5;">⚠️ Trang bị lỗi</strong></div>
          <div class="failed-tags" id="failedTags"></div>
          <div class="btn-group" style="margin-top:8px;">
            <button class="btn btn-primary" id="resumeFailedBtn">🔄 Tải lại trang lỗi (Resume)</button>
            <button class="btn btn-success" id="exportPartialZipBtn">📦 Xuất ZIP hiện có</button>
          </div>
        </div>
        <div class="progress-container">
          <div style="display:flex; justify-content:space-between; font-size:11px;"><span id="statusText">Sẵn sàng</span><span id="percentText">0%</span></div>
          <div class="progress-bar-bg"><div class="progress-bar-fill" id="progressBar"></div></div>
        </div>
        <div class="log-box" id="logBox">⚡ Sẵn sàng hoạt động (In-Tab Isolation OK)!</div>
      </div>
    `;
    shadow.appendChild(panel);

    shadow.getElementById('closeBtn').addEventListener('click', () => {
      host.remove();
    });

    const docTitleInput = shadow.getElementById('docTitle');
    const urlPatternInput = shadow.getElementById('urlPattern');
    const startPageInput = shadow.getElementById('startPage');
    const endPageInput = shadow.getElementById('endPage');
    const concurrencyInput = shadow.getElementById('concurrency');
    const startBtn = shadow.getElementById('startBtn');
    const cancelBtn = shadow.getElementById('cancelBtn');
    const reScanBtn = shadow.getElementById('reScanBtn');
    const failedBox = shadow.getElementById('failedBox');
    const failedCountTitle = shadow.getElementById('failedCountTitle');
    const failedTags = shadow.getElementById('failedTags');
    const resumeFailedBtn = shadow.getElementById('resumeFailedBtn');
    const exportPartialZipBtn = shadow.getElementById('exportPartialZipBtn');
    const statusText = shadow.getElementById('statusText');
    const percentText = shadow.getElementById('percentText');
    const progressBar = shadow.getElementById('progressBar');
    const logBox = shadow.getElementById('logBox');

    let isAborted = false;
    function appendLog(msg) {
      logBox.textContent += `\n[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`;
      logBox.scrollTop = logBox.scrollHeight;
    }

    reScanBtn.addEventListener('click', () => {
      const res = PatternDetector.analyze();
      urlPatternInput.value = res.pattern;
      endPageInput.value = res.maxPage;
      appendLog(`🔍 Dò lại thành công: ${res.pattern}`);
    });

    cancelBtn.addEventListener('click', () => {
      isAborted = true;
      appendLog('🛑 Đã nhận lệnh hủy!');
      statusText.textContent = 'Đã hủy';
      startBtn.disabled = false;
      cancelBtn.disabled = true;
    });

    async function buildAndSaveZip(title) {
      let JSZipInstance = await loadJSZip();
      const zip = new JSZipInstance();
      const sorted = Array.from(downloadedCache.keys()).sort((a, b) => a - b);
      for (const p of sorted) zip.file(`page_${String(p).padStart(4, '0')}.jpg`, downloadedCache.get(p));
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${title}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      appendLog(`🎉 Đã tải về tệp ZIP: ${title}.zip (${sorted.length} trang)`);
    }

    exportPartialZipBtn.addEventListener('click', async () => {
      const title = PatternDetector.cleanFilename(docTitleInput.value.trim()) || 'Tai_Lieu';
      try { await buildAndSaveZip(title); } catch (e) { appendLog(`❌ Lỗi xuất ZIP: ${e.message}`); }
    });

    async function executeDownload(onlyPages = null) {
      const pattern = urlPatternInput.value.trim();
      const start = parseInt(startPageInput.value, 10);
      const end = parseInt(endPageInput.value, 10);
      const concurrency = Math.max(1, Math.min(10, parseInt(concurrencyInput.value, 10) || 4));
      const title = PatternDetector.cleanFilename(docTitleInput.value.trim()) || 'Tai_Lieu';

      if (!pattern) return alert('Chưa nhập URL Mẫu!');
      isAborted = false;
      startBtn.disabled = true;
      cancelBtn.disabled = false;
      reScanBtn.disabled = true;
      if (resumeFailedBtn) resumeFailedBtn.disabled = true;

      let targetPages = onlyPages ? [...onlyPages] : [];
      if (!onlyPages) { for (let p = start; p <= end; p++) targetPages.push(p); }
      const queue = targetPages.filter(p => !downloadedCache.has(p));
      queue.forEach(p => failedCache.delete(p));

      appendLog(`📦 Bắt đầu tiến trình tải ${queue.length} trang cần lấy...`);
      const totalScope = end - start + 1;

      async function worker() {
        while (queue.length > 0) {
          if (isAborted) return;
          const pageNum = queue.shift();
          const url = pattern.replace(/\{page(?::(\d+))?\}/g, (m, pad) => pad ? String(pageNum).padStart(parseInt(pad, 10), '0') : String(pageNum));
          try {
            const buffer = await downloadPageWithCandidates(url, pageNum, appendLog);
            downloadedCache.set(pageNum, buffer);
            failedCache.delete(pageNum);
            const pct = Math.round((downloadedCache.size / totalScope) * 100);
            percentText.textContent = `${pct}%`;
            progressBar.style.width = `${pct}%`;
            statusText.textContent = `Đã có: ${downloadedCache.size}/${totalScope}`;
          } catch (err) {
            failedCache.set(pageNum, err.message);
            appendLog(`❌ Trang ${pageNum} lỗi: ${err.message}`);
          }
        }
      }

      const workers = [];
      for (let i = 0; i < Math.min(concurrency, queue.length || 1); i++) workers.push(worker());
      await Promise.all(workers);

      if (isAborted) return;

      if (failedCache.size > 0) {
        failedBox.style.display = 'block';
        const failedArr = Array.from(failedCache.keys());
        failedCountTitle.textContent = `⚠️ Có ${failedArr.length} trang bị lỗi:`;
        failedTags.innerHTML = failedArr.map(p => `<span class="failed-tag">Trang ${p}</span>`).join('');
        resumeFailedBtn.textContent = `🔄 Tải lại ${failedArr.length} trang lỗi (Resume)`;
      } else {
        failedBox.style.display = 'none';
        if (downloadedCache.size > 0) {
          statusText.textContent = 'Đang nén ZIP...';
          await buildAndSaveZip(title);
          statusText.textContent = 'Hoàn tất 100%';
        }
      }

      startBtn.disabled = false;
      cancelBtn.disabled = true;
      reScanBtn.disabled = false;
      if (resumeFailedBtn) resumeFailedBtn.disabled = false;
    }

    startBtn.addEventListener('click', () => executeDownload(null));
    resumeFailedBtn.addEventListener('click', () => executeDownload(Array.from(failedCache.keys())));
  }

  // Đăng ký nút mở trong Tampermonkey Popup Menu
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('📖 Mở Flipbook Downloader Pro', toggleUI);
  }
})();

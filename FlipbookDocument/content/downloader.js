/**
 * downloader.js - Bộ máy tải dữ liệu đa luồng, Resume, Fallback Extensions & Audit & Patch
 */
(function (global) {
  'use strict';

  class DownloadEngine {
    constructor() {
      this.isAborted = false;
      this.isPaused = false;
      this.downloadedMap = new Map(); // pageNum -> ArrayBuffer (Lưu bộ nhớ đệm phục vụ Resume)
      this.failedMap = new Map();     // pageNum -> Error message
      this.fallbackExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.JPG', '.PNG'];
    }

    /**
     * Định dạng URL với số trang và padding tương ứng ({page}, {page:2}, {page:3},...)
     */
    static formatPageUrl(pattern, pageNum) {
      return pattern.replace(/\{page(?::(\d+))?\}/g, (match, pad) => {
        if (pad) {
          return String(pageNum).padStart(parseInt(pad, 10), '0');
        }
        return String(pageNum);
      });
    }

    /**
     * Tạo danh sách URL dự phòng khi trang bị 404 (thử đổi đuôi mở rộng .jpg -> .png -> .webp)
     */
    generateCandidateUrls(primaryUrl) {
      const candidates = [primaryUrl];
      const matchExt = primaryUrl.match(/\.(jpg|jpeg|png|webp|svg|gif)(\?.*)?$/i);
      if (matchExt) {
        const currentExt = matchExt[1];
        const queryParams = matchExt[2] || '';
        const base = primaryUrl.substring(0, primaryUrl.lastIndexOf('.' + currentExt));

        for (const ext of this.fallbackExtensions) {
          if (ext.toLowerCase() !== '.' + currentExt.toLowerCase()) {
            candidates.push(`${base}${ext}${queryParams}`);
          }
        }
      }
      return candidates;
    }

    /**
     * Tải ArrayBuffer với cơ chế thử lại theo Exponential Backoff
     */
    async fetchSingleUrlWithRetry(url, maxRetries = 4, onRetry = null) {
      let delayMs = 500;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (this.isAborted) throw new Error('Đã hủy bởi người dùng');

        while (this.isPaused) {
          await new Promise((r) => setTimeout(r, 200));
          if (this.isAborted) throw new Error('Đã hủy bởi người dùng');
        }

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 20000);

          const response = await fetch(url, {
            signal: controller.signal,
            mode: 'cors',
            cache: 'force-cache'
          });

          clearTimeout(timer);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status} (${response.statusText})`);
          }

          const buffer = await response.arrayBuffer();

          if (!buffer || buffer.byteLength < 500) {
            throw new Error(`Ảnh rỗng hoặc quá nhỏ (${buffer ? buffer.byteLength : 0} bytes)`);
          }

          return buffer;
        } catch (err) {
          if (attempt === maxRetries) {
            throw err;
          }
          if (onRetry) {
            onRetry(attempt, delayMs, err.message);
          }
          await new Promise((r) => setTimeout(r, delayMs));
          delayMs *= 2; // Tăng dần thời gian chờ
        }
      }
    }

    /**
     * Tải 1 trang với cơ chế Dò Tìm Mở Rộng (Auto-Fallback candidate URLs)
     */
    async downloadPageWithCandidates(primaryUrl, pageNum, onLog) {
      const candidates = this.generateCandidateUrls(primaryUrl);
      let lastError = null;

      for (let i = 0; i < candidates.length; i++) {
        const targetUrl = candidates[i];
        if (i > 0) {
          onLog(`🔍 [Trang ${pageNum}] Đang dò thử URL dự phòng: ${targetUrl.split('/').pop()}`);
        }

        try {
          const buffer = await this.fetchSingleUrlWithRetry(targetUrl, 3, (attempt, delay, errMsg) => {
            onLog(`⚠️ [Trang ${pageNum}] Thử lại lần ${attempt} (${delay}ms): ${errMsg}`);
          });
          return buffer; // Tải thành công
        } catch (err) {
          lastError = err;
        }
      }

      throw lastError || new Error('Không thể tải sau khi thử tất cả URL dự phòng');
    }

    /**
     * Bắt đầu tiến trình tải danh sách trang (Có Resume - bỏ qua các trang đã có)
     */
    async startDownload(options) {
      const {
        pattern,
        startPage,
        endPage,
        concurrency = 4,
        onlyPages = null, // Nếu truyền mảng trang, chỉ tải các trang này (Resume Mode)
        onProgress = () => {},
        onLog = () => {}
      } = options;

      this.isAborted = false;
      this.isPaused = false;

      // Xây dựng danh sách trang cần xử lý
      let targetPages = [];
      if (Array.isArray(onlyPages) && onlyPages.length > 0) {
        targetPages = [...onlyPages];
        onLog(`🔄 Chế độ Resume: Đang xử lý lại ${targetPages.length} trang được chỉ định...`);
      } else {
        for (let p = startPage; p <= endPage; p++) {
          targetPages.push(p);
        }
      }

      // Lọc các trang đã tải thành công trước đó (Giữ nguyên trạng thái)
      const queue = targetPages.filter((p) => !this.downloadedMap.has(p));
      const alreadyDone = targetPages.length - queue.length;
      if (alreadyDone > 0) {
        onLog(`⚡ Tận dụng lại ${alreadyDone} trang đã có trong bộ nhớ tạm.`);
      }

      const totalRequired = targetPages.length;
      let completedInBatch = alreadyDone;

      // Xóa khỏi failedMap các trang chuẩn bị thử lại
      for (const p of queue) {
        this.failedMap.delete(p);
      }

      // Báo tiến độ ban đầu
      onProgress({
        completed: this.downloadedMap.size,
        total: (endPage - startPage + 1),
        percent: Math.round((this.downloadedMap.size / (endPage - startPage + 1)) * 100),
        failedCount: this.failedMap.size
      });

      // Worker Function
      const worker = async () => {
        while (queue.length > 0) {
          if (this.isAborted) return;
          const pageNum = queue.shift();
          const primaryUrl = DownloadEngine.formatPageUrl(pattern, pageNum);

          try {
            const buffer = await this.downloadPageWithCandidates(primaryUrl, pageNum, onLog);
            this.downloadedMap.set(pageNum, buffer);
            this.failedMap.delete(pageNum);
            completedInBatch++;

            const totalScope = endPage - startPage + 1;
            onProgress({
              completed: this.downloadedMap.size,
              total: totalScope,
              percent: Math.round((this.downloadedMap.size / totalScope) * 100),
              failedCount: this.failedMap.size,
              currentPage: pageNum
            });
          } catch (err) {
            this.failedMap.set(pageNum, err.message);
            onLog(`❌ [Trang ${pageNum}] Thất bại hoàn toàn: ${err.message}`);
          }
        }
      };

      const workers = [];
      const actualThreads = Math.min(concurrency, queue.length || 1);
      for (let i = 0; i < actualThreads; i++) {
        workers.push(worker());
      }
      await Promise.all(workers);

      // Audit & Patch tự động cho các trang còn thiếu trong targetPages
      if (!this.isAborted && this.failedMap.size > 0) {
        const stillMissing = Array.from(this.failedMap.keys());
        onLog(`🔍 [Auto-Patch] Còn ${stillMissing.length} trang chưa xong. Đang thử quét bù 1 lượt an toàn (1 luồng)...`);
        
        for (const p of stillMissing) {
          if (this.isAborted) break;
          const primaryUrl = DownloadEngine.formatPageUrl(pattern, p);
          try {
            await new Promise((r) => setTimeout(r, 800)); // Nghỉ 800ms để tránh rate-limit
            const buffer = await this.downloadPageWithCandidates(primaryUrl, p, onLog);
            this.downloadedMap.set(p, buffer);
            this.failedMap.delete(p);
            onLog(`✅ Tải bù thành công trang ${p}!`);
          } catch (e) {
            // Giữ lại trong failedMap
          }
        }
      }

      const totalScope = endPage - startPage + 1;
      return {
        success: this.downloadedMap.size > 0,
        aborted: this.isAborted,
        completedCount: this.downloadedMap.size,
        totalScope: totalScope,
        failedPages: Array.from(this.failedMap.keys()),
        downloadedMap: this.downloadedMap
      };
    }

    /**
     * Nén tất cả các trang ảnh trong downloadedMap thành file ZIP
     */
    async packageAndSaveZip(title, onZipProgress = () => {}) {
      if (!global.JSZip) {
        throw new Error('Thư viện JSZip chưa được nạp!');
      }
      if (this.downloadedMap.size === 0) {
        throw new Error('Chưa có trang ảnh nào để nén!');
      }

      const zip = new global.JSZip();
      const sortedPages = Array.from(this.downloadedMap.keys()).sort((a, b) => a - b);

      for (const p of sortedPages) {
        const paddedName = `page_${String(p).padStart(4, '0')}.jpg`;
        zip.file(paddedName, this.downloadedMap.get(p));
      }

      const zipBlob = await zip.generateAsync(
        {
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        },
        (metadata) => {
          onZipProgress(Math.round(metadata.percent));
        }
      );

      const blobUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${title}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      return true;
    }

    resetCache() {
      this.downloadedMap.clear();
      this.failedMap.clear();
    }

    abort() {
      this.isAborted = true;
    }

    togglePause() {
      this.isPaused = !this.isPaused;
      return this.isPaused;
    }
  }

  global.__FlipbookDownloaderEngine = DownloadEngine;
})(window);

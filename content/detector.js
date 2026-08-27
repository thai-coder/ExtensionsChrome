/**
 * detector.js - Tự động dò tìm URL Pattern & Tổng số trang từ Viewer DOM và Network
 */
(function (global) {
  'use strict';

  const PatternDetector = {
    /**
     * Làm sạch tiêu đề để đặt tên file an toàn
     */
    sanitizeFilename(name) {
      return (name || 'Tai_Lieu_Sach')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 80);
    },

    /**
     * Dò tìm tổng số trang và trang hiện tại từ thanh điều hướng (Viewer Toolbar / DOM)
     * Nhận diện các dạng: "1/523", "1 / 523", "1 of 523", "Trang 1 / 523", input max="523"
     */
    detectTotalPagesFromDOM() {
      let detectedTotal = null;
      let detectedCurrent = 1;

      // 1. Quét các thẻ input (ví dụ: ô hiển thị "1/523" hoặc input max="523")
      const inputs = document.querySelectorAll('input');
      for (const input of inputs) {
        const val = (input.value || input.placeholder || '').trim();
        const maxAttr = input.getAttribute('max');

        // Khớp dạng "1/523" hoặc "1 / 523"
        const matchSlash = val.match(/^(\d{1,4})\s*[\/|\\]\s*(\d{1,4})$/);
        if (matchSlash) {
          const cur = parseInt(matchSlash[1], 10);
          const tot = parseInt(matchSlash[2], 10);
          if (tot > 1 && tot < 5000) {
            return { current: cur, total: tot };
          }
        }

        if (maxAttr) {
          const parsedMax = parseInt(maxAttr, 10);
          if (parsedMax > 1 && parsedMax < 5000) {
            detectedTotal = parsedMax;
          }
        }
      }

      // 2. Quét các thẻ văn bản trên giao diện thanh điều hướng (Toolbar / Pagination)
      const candidates = document.querySelectorAll(
        '[class*="page"], [id*="page"], [class*="nav"], [id*="nav"], [class*="control"], [id*="control"], [class*="tool"], [id*="tool"], span, div, p'
      );

      const pageRegex = /\b(\d{1,4})\s*(?:\/|of|trên)\s*(\d{1,4})\b/i;

      for (const el of candidates) {
        // Chỉ xét các phần tử có nội dung ngắn (dưới 25 ký tự) để tránh nhầm với đoạn văn
        const text = el.innerText || el.textContent || '';
        if (text.length > 0 && text.length < 25) {
          const match = text.trim().match(pageRegex);
          if (match) {
            const cur = parseInt(match[1], 10);
            const tot = parseInt(match[2], 10);
            // Loại trừ các năm như 2024, 2025 nếu cur = 2024
            if (tot > 1 && tot < 5000 && cur <= tot) {
              return { current: cur, total: tot };
            }
          }
        }
      }

      return { current: detectedCurrent, total: detectedTotal || 50 };
    },

    /**
     * Quét toàn bộ tài nguyên hình ảnh đang nạp trên trang web
     */
    collectImageUrls() {
      const urls = new Set();

      // 1. Quét Performance Resource Timing
      if (window.performance && typeof performance.getEntriesByType === 'function') {
        const resources = performance.getEntriesByType('resource');
        resources.forEach((r) => {
          if (
            r.initiatorType === 'img' ||
            r.initiatorType === 'xmlhttprequest' ||
            r.initiatorType === 'fetch' ||
            r.initiatorType === 'other'
          ) {
            if (/\.(jpg|jpeg|png|webp|svg|gif|avif)(\?.*)?$/i.test(r.name)) {
              urls.add(r.name);
            }
          }
        });
      }

      // 2. Quét thẻ <img> trong DOM
      document.querySelectorAll('img').forEach((img) => {
        const srcCandidates = [
          img.src,
          img.getAttribute('data-src'),
          img.getAttribute('data-original'),
          img.getAttribute('data-url'),
          img.getAttribute('data-large-img')
        ];
        srcCandidates.forEach((src) => {
          if (src && src.startsWith('http')) urls.add(src);
        });
      });

      // 3. Quét background-image CSS
      document.querySelectorAll('*').forEach((el) => {
        const bg = window.getComputedStyle(el).backgroundImage;
        if (bg && bg.startsWith('url(')) {
          const clean = bg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
          if (clean.startsWith('http') && /\.(jpg|jpeg|png|webp|svg|gif)(\?.*)?$/i.test(clean)) {
            urls.add(clean);
          }
        }
      });

      return Array.from(urls);
    },

    /**
     * Phân tích danh sách URL và suy luận Pattern thông minh (Chỉ lấy số ở tên file cuối)
     */
    analyze() {
      const urlList = this.collectImageUrls();
      const domPageInfo = this.detectTotalPagesFromDOM();

      let bestPattern = '';
      let detectedPadding = 1;
      let detectedMaxPage = domPageInfo.total || 50;

      for (const url of urlList) {
        // Tách query string ra khỏi URL
        const urlParts = url.split('?');
        const cleanPath = urlParts[0];
        const queryString = urlParts[1] ? `?${urlParts[1]}` : '';

        // Tách lấy thư mục cha và tên file cuối cùng
        const lastSlashIndex = cleanPath.lastIndexOf('/');
        if (lastSlashIndex === -1) continue;

        const dirPath = cleanPath.substring(0, lastSlashIndex + 1);
        const filename = cleanPath.substring(lastSlashIndex + 1);

        // Khớp số thứ tự trang CHÍNH XÁC trong tên file (VD: 1.jpg, page_001.webp, large-05.png)
        // Tuyệt đối KHÔNG khớp các số năm trong thư mục cha (như /2024/05/...)
        const match = filename.match(/^(.*?)(\d+)(\.[a-zA-Z0-9]+)$/i);
        if (match) {
          const prefix = match[1];
          const numStr = match[2];
          const ext = match[3];
          const padLength = numStr.length;

          // Nếu số trang này là số năm (1990 - 2099) và không có tiền tố trang, bỏ qua
          const parsedNum = parseInt(numStr, 10);
          if (parsedNum >= 1990 && parsedNum <= 2099 && !prefix.toLowerCase().includes('page') && !prefix.toLowerCase().includes('p')) {
            continue;
          }

          if (padLength > 1) {
            bestPattern = `${dirPath}${prefix}{page:${padLength}}${ext}${queryString}`;
          } else {
            bestPattern = `${dirPath}${prefix}{page}${ext}${queryString}`;
          }

          detectedPadding = padLength;

          // Nếu chưa tìm thấy tổng trang từ DOM thì mới lấy từ URL
          if (!domPageInfo.total && parsedNum > detectedMaxPage) {
            detectedMaxPage = parsedNum;
          }
          break;
        }
      }

      if (!bestPattern && urlList.length > 0) {
        bestPattern = urlList[0];
      }

      return {
        title: this.sanitizeFilename(document.title),
        pattern: bestPattern,
        padding: detectedPadding,
        startPage: domPageInfo.current || 1,
        maxPage: domPageInfo.total || detectedMaxPage,
        totalFoundUrls: urlList.length
      };
    }
  };

  global.__FlipbookDetector = PatternDetector;
})(window);

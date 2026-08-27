/**
 * pdf-detector.js - Bóc tách nội dung bài viết sạch (PrintFriendly) & Nhận diện PDF nhúng, Khổ giấy & Hướng in
 */
(function (global) {
  'use strict';

  const PDFDetector = {
    /**
     * Làm sạch tên file tài liệu
     */
    sanitizeFilename(name) {
      return (name || 'Tai_Lieu_In')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 80);
    },

    /**
     * Dò tìm các file PDF nhúng trong trang (iframe, embed, object, link PDF)
     */
    findEmbeddedPdfUrls() {
      const urls = new Set();

      // 1. Quét thẻ embed & object
      document.querySelectorAll('embed[type*="pdf"], embed[src*=".pdf"], object[data*=".pdf"]').forEach((el) => {
        const src = el.getAttribute('src') || el.getAttribute('data') || el.src || el.data;
        if (src && !src.startsWith('blob:') && !src.startsWith('about:')) {
          urls.add(new URL(src, window.location.href).href);
        }
      });

      // 2. Quét thẻ iframe nhúng viewer hoặc file PDF
      document.querySelectorAll('iframe').forEach((iframe) => {
        const src = iframe.src || iframe.getAttribute('src') || '';
        if (src) {
          if (/\.pdf(\?.*)?$/i.test(src)) {
            urls.add(new URL(src, window.location.href).href);
          } else if (src.includes('pdfjs') || src.includes('viewer.html?file=')) {
            const match = src.match(/[?&]file=([^&]+)/i);
            if (match) {
              try {
                const decoded = decodeURIComponent(match[1]);
                urls.add(new URL(decoded, window.location.href).href);
              } catch (e) {}
            }
          }
        }
      });

      // 3. Quét các thẻ liên kết tải file PDF nổi bật
      document.querySelectorAll('a[href*=".pdf"]').forEach((a) => {
        const href = a.getAttribute('href');
        if (href && /\.pdf(\?.*)?$/i.test(href)) {
          urls.add(new URL(href, window.location.href).href);
        }
      });

      return Array.from(urls);
    },

    /**
     * Phân tích và trích xuất nội dung bài viết sạch (Loại bỏ Ads, Navbars, Sidebars, Footers)
     */
    extractCleanArticle() {
      const title =
        document.querySelector('meta[property="og:title"]')?.content ||
        document.querySelector('h1')?.innerText?.trim() ||
        document.title ||
        'Tai_Lieu';

      // Danh sách các selector thường chứa nội dung chính
      const contentCandidates = [
        'article',
        'main',
        '[role="main"]',
        '.post-content',
        '.article-content',
        '.entry-content',
        '.content-body',
        '.story-body',
        '.detail-content',
        '#content',
        '#main-content'
      ];

      let bestElement = null;
      let maxParagraphs = 0;

      for (const sel of contentCandidates) {
        const el = document.querySelector(sel);
        if (el) {
          const pCount = el.querySelectorAll('p').length;
          if (pCount > maxParagraphs) {
            maxParagraphs = pCount;
            bestElement = el;
          }
        }
      }

      // Nếu không tìm thấy bằng class chuẩn, quét các thẻ div có nhiều thẻ p nhất
      if (!bestElement || maxParagraphs < 2) {
        let maxScore = 0;
        document.querySelectorAll('div, section').forEach((el) => {
          // Bỏ qua header, footer, nav, aside
          const tag = el.tagName.toLowerCase();
          if (tag === 'header' || tag === 'footer' || tag === 'nav' || tag === 'aside') return;
          const pTags = el.querySelectorAll('p');
          let score = pTags.length * 10;
          const textLen = (el.innerText || '').length;
          if (textLen > 400) score += Math.min(100, Math.floor(textLen / 100));

          if (score > maxScore) {
            maxScore = score;
            bestElement = el;
          }
        });
      }

      const sourceEl = bestElement || document.body || document.documentElement;
      const clone = sourceEl.cloneNode(true);

      // Loại bỏ các thẻ rác, quảng cáo, script
      const junkSelectors = [
        'script',
        'style',
        'noscript',
        'iframe',
        'nav',
        'aside',
        'header',
        'footer',
        '.ad',
        '.ads',
        '.advertisement',
        '.sidebar',
        '.comment',
        '.comments',
        '.social-share',
        '.share-buttons',
        '.cookie-banner',
        '.popup',
        '.banner',
        '[aria-hidden="true"]',
        '#__flipbook_downloader_host__'
      ];

      junkSelectors.forEach((sel) => {
        clone.querySelectorAll(sel).forEach((el) => el.remove());
      });

      // Chuyển đổi tất cả link ảnh tương đối thành tuyệt đối và làm sạch
      let hasWideContent = false;
      clone.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original');
        if (src) {
          try {
            img.src = new URL(src, window.location.href).href;
            img.removeAttribute('data-src');
            img.removeAttribute('data-original');
            img.removeAttribute('loading');
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
          } catch (e) {}
        }
      });

      // 4. DÒ TÌM NỘI DUNG RỘNG ĐỂ TỰ ĐỘNG GỢI Ý KHỔ NGANG (LANDSCAPE)
      // Kiểm tra xem trang có bảng biểu lớn, khối code pre rộng, hoặc bảng tính không
      const tables = clone.querySelectorAll('table');
      const codeBlocks = clone.querySelectorAll('pre, code');
      let wideElementsCount = 0;

      tables.forEach((table) => {
        const cols = table.querySelectorAll('tr:first-child th, tr:first-child td').length;
        if (cols >= 4 || table.scrollWidth > 700) {
          hasWideContent = true;
          wideElementsCount++;
        }
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.querySelectorAll('th, td').forEach((cell) => {
          cell.style.border = '1px solid #ccc';
          cell.style.padding = '6px 8px';
        });
      });

      codeBlocks.forEach((code) => {
        if (code.scrollWidth > 750 || (code.innerText || '').split('\n').some((line) => line.length > 80)) {
          hasWideContent = true;
          wideElementsCount++;
        }
      });

      return {
        title: this.sanitizeFilename(title),
        displayTitle: title,
        htmlContent: clone.innerHTML,
        hasWideContent: hasWideContent,
        recommendedOrientation: hasWideContent ? 'landscape' : 'portrait',
        wideReason: hasWideContent
          ? `Phát hiện ${wideElementsCount} bảng/khối code lớn -> Khuyên dùng khổ Ngang`
          : 'Nội dung văn bản chuẩn -> Dùng khổ Dọc'
      };
    }
  };

  global.__PDFDetector = PDFDetector;
})(window);

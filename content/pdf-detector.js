/**
 * pdf-detector.js - Bóc tách nội dung bài viết sạch (PrintFriendly) & Nhận diện PDF nhúng & Khổ giấy tối ưu
 */
(function (global) {
  'use strict';

  const PDFDetector = {
    sanitizeFilename(name) {
      return (name || 'Tai_Lieu_In')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 80);
    },

    findEmbeddedPdfUrls() {
      const urls = new Set();
      try {
        document.querySelectorAll('embed[type*="pdf"], embed[src*=".pdf"], object[data*=".pdf"]').forEach((el) => {
          const src = el.getAttribute('src') || el.getAttribute('data') || el.src || el.data;
          if (src && !src.startsWith('blob:') && !src.startsWith('about:')) {
            urls.add(new URL(src, window.location.href).href);
          }
        });

        document.querySelectorAll('iframe').forEach((iframe) => {
          const src = iframe.src || iframe.getAttribute('src') || '';
          if (src) {
            if (/\.pdf(\?.*)?$/i.test(src)) {
              urls.add(new URL(src, window.location.href).href);
            } else if (src.includes('pdfjs') || src.includes('viewer.html?file=')) {
              const match = src.match(/[?&]file=([^&]+)/i);
              if (match) {
                try {
                  urls.add(new URL(decodeURIComponent(match[1]), window.location.href).href);
                } catch (e) {}
              }
            }
          }
        });

        document.querySelectorAll('a[href*=".pdf"]').forEach((a) => {
          const href = a.getAttribute('href');
          if (href && /\.pdf(\?.*)?$/i.test(href)) {
            urls.add(new URL(href, window.location.href).href);
          }
        });
      } catch (e) {}
      return Array.from(urls);
    },

    extractCleanArticle() {
      try {
        const title =
          document.querySelector('meta[property="og:title"]')?.content ||
          document.querySelector('h1')?.innerText?.trim() ||
          document.title ||
          'Tai_Lieu';

        const contentCandidates = [
          'article',
          'main',
          '[role="main"]',
          '.post-content',
          '.article-content',
          '.entry-content',
          '.content-body',
          '.story-body',
          '#content',
          '#main-content'
        ];

        let bestElement = null;
        for (const sel of contentCandidates) {
          const el = document.querySelector(sel);
          if (el && el.querySelectorAll('p').length >= 1) {
            bestElement = el;
            break;
          }
        }

        if (!bestElement) {
          let maxParagraphs = 0;
          document.querySelectorAll('div, section').forEach((el) => {
            const tag = el.tagName.toLowerCase();
            if (tag === 'header' || tag === 'footer' || tag === 'nav' || tag === 'aside') return;
            const pCount = el.querySelectorAll('p').length;
            if (pCount > maxParagraphs) {
              maxParagraphs = pCount;
              bestElement = el;
            }
          });
        }

        const sourceEl = bestElement || document.body || document.documentElement;
        const clone = sourceEl.cloneNode(true);

        const junkSelectors = [
          'script', 'style', 'noscript', 'iframe', 'nav', 'aside', 'header', 'footer',
          '.ad', '.ads', '.advertisement', '.sidebar', '.comment', '.comments',
          '.social-share', '.cookie-banner', '#__flipbook_downloader_host__'
        ];

        junkSelectors.forEach((sel) => {
          clone.querySelectorAll(sel).forEach((el) => el.remove());
        });

        let hasWideContent = false;
        clone.querySelectorAll('img').forEach((img) => {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original');
          if (src) {
            try {
              img.src = new URL(src, window.location.href).href;
              img.removeAttribute('data-src');
              img.removeAttribute('data-original');
              img.style.maxWidth = '100%';
              img.style.height = 'auto';
            } catch (e) {}
          }
        });

        const tables = clone.querySelectorAll('table');
        const codeBlocks = clone.querySelectorAll('pre, code');

        if (tables.length > 0) {
          tables.forEach((t) => {
            const cols = t.querySelectorAll('tr:first-child th, tr:first-child td').length;
            if (cols >= 4 || t.scrollWidth > 700) hasWideContent = true;
            t.style.width = '100%';
            t.style.borderCollapse = 'collapse';
            t.querySelectorAll('th, td').forEach((cell) => {
              cell.style.border = '1px solid #ccc';
              cell.style.padding = '6px';
            });
          });
        }

        if (codeBlocks.length > 0) {
          codeBlocks.forEach((code) => {
            if (code.scrollWidth > 700) hasWideContent = true;
          });
        }

        return {
          title: this.sanitizeFilename(title),
          displayTitle: title,
          htmlContent: clone.innerHTML || '<p>Không tìm thấy nội dung văn bản.</p>',
          hasWideContent: hasWideContent,
          recommendedOrientation: hasWideContent ? 'landscape' : 'portrait'
        };
      } catch (err) {
        return {
          title: 'Tai_Lieu',
          displayTitle: document.title || 'Tai_Lieu',
          htmlContent: '<p>' + (document.body ? document.body.innerText.substring(0, 1000) : 'Tài liệu') + '</p>',
          hasWideContent: false,
          recommendedOrientation: 'portrait'
        };
      }
    }
  };

  global.__PDFDetector = PDFDetector;
})(window);

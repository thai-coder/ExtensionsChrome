/**
 * pdf-engine.js - Động cơ xuất PDF chuẩn cho cả 2 chế độ:
 * 1. Ghép danh sách ảnh Flipbook scan thành file PDF chất lượng cao đa khổ giấy (A4, A3, Letter...)
 * 2. In & Xuất nội dung web sạch (PrintFriendly) với tùy biến khổ giấy, xoay ngang/dọc, ẩn ảnh & xóa khối rác
 */
(function (global) {
  'use strict';

  class PDFEngine {
    constructor() {
      this.paperSizes = {
        a4: { width: 210, height: 297, name: 'A4 (210 x 297 mm)' },
        a3: { width: 297, height: 420, name: 'A3 (297 x 420 mm)' },
        a5: { width: 148, height: 210, name: 'A5 (148 x 210 mm)' },
        letter: { width: 215.9, height: 279.4, name: 'Letter (8.5 x 11 in)' },
        legal: { width: 215.9, height: 355.6, name: 'Legal (8.5 x 14 in)' }
      };
    }

    /**
     * Nạp thư viện jsPDF an toàn
     */
    async getJsPDF() {
      if (global.jspdf && global.jspdf.jsPDF) return global.jspdf.jsPDF;
      if (global.jsPDF) return global.jsPDF;
      if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
      throw new Error('Thư viện jsPDF chưa được nạp');
    }

    /**
     * CHẾ ĐỘ 1: Ghép mảng ảnh scan Flipbook thành file PDF chuẩn
     */
    async convertImagesToPdf(downloadedMap, options = {}) {
      const {
        title = 'Tai_Lieu_Sach',
        paperSize = 'a4', // 'a4', 'a3', 'a5', 'letter', 'legal', 'auto'
        orientation = 'auto', // 'auto', 'portrait', 'landscape'
        onProgress = null
      } = options;

      const jsPDFClass = await this.getJsPDF();
      const sortedPages = Array.from(downloadedMap.keys()).sort((a, b) => a - b);
      if (sortedPages.length === 0) throw new Error('Không có dữ liệu ảnh để xuất PDF');

      let pdfDoc = null;
      const total = sortedPages.length;

      for (let i = 0; i < total; i++) {
        const pageNum = sortedPages[i];
        const buffer = downloadedMap.get(pageNum);
        const blob = new Blob([buffer]);
        const blobUrl = URL.createObjectURL(blob);

        const imgInfo = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || 800;
              canvas.height = img.naturalHeight || 1100;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
              URL.revokeObjectURL(blobUrl);
              resolve({
                dataUrl,
                width: canvas.width,
                height: canvas.height
              });
            } catch (err) {
              URL.revokeObjectURL(blobUrl);
              reject(err);
            }
          };
          img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error(`Không thể giải mã ảnh trang ${pageNum}`));
          };
          img.src = blobUrl;
        });

        // Xác định hướng trang: Dọc hay Ngang
        let pageOrientation = 'p';
        if (orientation === 'landscape') {
          pageOrientation = 'l';
        } else if (orientation === 'portrait') {
          pageOrientation = 'p';
        } else {
          pageOrientation = imgInfo.width > imgInfo.height ? 'l' : 'p';
        }

        // Kích thước trang PDF
        const targetPaper = this.paperSizes[paperSize] || this.paperSizes.a4;
        let pWidth = 210;
        let pHeight = 297;

        if (paperSize === 'auto') {
          pWidth = (imgInfo.width * 25.4) / 96;
          pHeight = (imgInfo.height * 25.4) / 96;
          pageOrientation = imgInfo.width > imgInfo.height ? 'l' : 'p';
        } else {
          pWidth = pageOrientation === 'l' ? targetPaper.height : targetPaper.width;
          pHeight = pageOrientation === 'l' ? targetPaper.width : targetPaper.height;
        }

        const format = paperSize === 'auto' ? [pWidth, pHeight] : [targetPaper.width, targetPaper.height];

        if (i === 0) {
          pdfDoc = new jsPDFClass({
            orientation: pageOrientation,
            unit: 'mm',
            format: format
          });
        } else {
          pdfDoc.addPage(format, pageOrientation);
        }

        // Tính toán căn giữa và co dãn ảnh không bị méo tỷ lệ
        const ratio = Math.min(pWidth / imgInfo.width, pHeight / imgInfo.height);
        const renderW = imgInfo.width * ratio;
        const renderH = imgInfo.height * ratio;
        const posX = (pWidth - renderW) / 2;
        const posY = (pHeight - renderH) / 2;

        pdfDoc.addImage(imgInfo.dataUrl, 'JPEG', posX, posY, renderW, renderH, undefined, 'FAST');

        if (onProgress) {
          const pct = Math.round(((i + 1) / total) * 100);
          onProgress(pct, i + 1, total);
        }
      }

      // Lưu file PDF về máy an toàn qua Blob
      const pdfBlob = pdfDoc.output('blob');
      const downloadUrl = URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = `${title}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      setTimeout(() => {
        downloadLink.remove();
        URL.revokeObjectURL(downloadUrl);
      }, 2000);

      return true;
    }

    /**
     * CHẾ ĐỘ 2: In & Xuất nội dung web sạch (PrintFriendly Clean Web-to-PDF)
     * Sử dụng Isolated Print Engine chất lượng cao (Vector Text, Đầy đủ font tiếng Việt, Cực nét)
     */
    printCleanArticle(articleData, options = {}) {
      const {
        hideImages = false,
        fontSize = '13pt',
        paperSize = 'a4', // 'a4', 'a3', 'a5', 'letter', 'legal'
        orientation = 'portrait', // 'portrait', 'landscape'
        customTitle = ''
      } = options;

      const title = customTitle || articleData.displayTitle || 'Tai_Lieu';

      // Tạo một iframe ẩn độc lập để chứa bản in sạch
      const printIframe = document.createElement('iframe');
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = 'none';
      document.body.appendChild(printIframe);

      const doc = printIframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            @page {
              size: ${paperSize} ${orientation};
              margin: 15mm 12mm 15mm 12mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              font-size: ${fontSize};
              line-height: 1.65;
              color: #111827;
              background: #ffffff;
              padding: 0;
              margin: 0;
            }
            h1.doc-title {
              font-size: 1.7em;
              font-weight: 700;
              margin-bottom: 8px;
              color: #0f172a;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 8px;
            }
            .doc-meta {
              font-size: 0.85em;
              color: #64748b;
              margin-bottom: 20px;
            }
            img {
              max-width: 100% !important;
              height: auto !important;
              margin: 12px auto;
              display: ${hideImages ? 'none !important' : 'block'};
              border-radius: 4px;
              page-break-inside: avoid;
            }
            table {
              width: 100% !important;
              border-collapse: collapse;
              margin: 14px 0;
              page-break-inside: avoid;
              font-size: 0.9em;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 6px 10px;
              text-align: left;
            }
            th {
              background: #f1f5f9;
              font-weight: 600;
            }
            pre, code {
              font-family: Consolas, monospace;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 4px;
              padding: 4px 8px;
              font-size: 0.9em;
              word-break: break-all;
              white-space: pre-wrap;
              page-break-inside: avoid;
            }
            blockquote {
              border-left: 4px solid #6366f1;
              padding-left: 12px;
              margin-left: 0;
              color: #475569;
              font-style: italic;
            }
            a {
              color: #2563eb;
              text-decoration: none;
            }
            button, input, select, textarea, form, [role="button"], [role="dialog"],
            .btn, .button, .share-buttons, .social-share, .ad, .ads, .sidebar, .widget {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <h1 class="doc-title">${title}</h1>
          <div class="doc-meta">📅 Ngày in: ${new Date().toLocaleDateString('vi-VN')} | 🔗 Nguồn: ${window.location.hostname}</div>
          <div class="clean-content">${articleData.htmlContent}</div>
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        printIframe.contentWindow.focus();
        printIframe.contentWindow.print();
        setTimeout(() => printIframe.remove(), 2000);
      }, 500);
    }
  }

  global.__PDFEngine = PDFEngine;
})(window);

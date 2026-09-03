/**
 * service-worker.js - Background Service Worker cho Chrome Extension Manifest V3
 */

// 1. Đăng ký Context Menu an toàn khi cài đặt hoặc cập nhật extension
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.contextMenus) {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create(
        {
          id: 'toggle_flipbook_downloader',
          title: '📖 Mở Flipbook Downloader',
          contexts: ['page', 'image', 'frame']
        },
        () => {
          if (chrome.runtime.lastError) {
            // Đã được đăng ký trước đó
          }
        }
      );
    });
  }
});

// Hàm kích hoạt mở panel tải trên tab mục tiêu
async function triggerToggleUI(tab) {
  if (!tab || !tab.id) return;
  const url = tab.url || '';
  if (
    url.startsWith('chrome://') ||
    url.startsWith('edge://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.includes('chrome.google.com/webstore')
  ) {
    return;
  }

  chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_DOWNLOADER_UI' }, async (res) => {
    if (!chrome.runtime.lastError && res && res.status === 'ok') {
      return;
    }

    // Nạp script trực tiếp nếu tab chưa nạp trước đó
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [
          'lib/jszip.min.js',
          'lib/jspdf.min.js',
          'lib/html2canvas.min.js',
          'content/unblocker.js',
          'content/detector.js',
          'content/pdf-detector.js',
          'content/downloader.js',
          'content/pdf-engine.js',
          'content/friendly-preview.js',
          'content/ui.js',
          'content/content-main.js'
        ]
      });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (typeof window.__toggleFlipbookDownloader === 'function') {
            window.__toggleFlipbookDownloader();
          } else if (window.__FlipbookFloatingUI) {
            new window.__FlipbookFloatingUI();
          }
        }
      });
    } catch (err) {
      console.warn('Không thể inject script vào tab:', err);
    }
  });
}

// 2. Xử lý khi click vào Context Menu
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'toggle_flipbook_downloader') {
      await triggerToggleUI(tab);
    }
  });
}

// 3. Xử lý khi bấm phím tắt Commands (Alt+Shift+D)
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle_downloader') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await triggerToggleUI(tab);
      }
    }
  });
}

// 4. Xử lý xuất file Vector PDF 100% Text Thật tự động qua Chrome DevTools Protocol (CDP)
const PAPER_DIMENSIONS_INCHES = {
  a4: { width: 8.27, height: 11.69 },
  a3: { width: 11.69, height: 16.54 },
  a5: { width: 5.83, height: 8.27 },
  letter: { width: 8.5, height: 11.0 },
  legal: { width: 8.5, height: 14.0 }
};

async function handleExportVectorPdf(data, sender) {
  const { filename = 'Tai_Lieu', paperSize = 'a4', orientation = 'portrait' } = data;
  if (!sender || !sender.tab || !sender.tab.id) {
    throw new Error('Không tìm thấy tab nguồn để kết xuất PDF');
  }

  const tabId = sender.tab.id;
  const target = { tabId };
  const isLandscape = orientation === 'landscape';
  const dim = PAPER_DIMENSIONS_INCHES[paperSize] || PAPER_DIMENSIONS_INCHES.a4;

  try {
    // 1. Gắn Debugger trực tiếp vào tab nguồn (luôn được Chrome cho phép)
    await chrome.debugger.attach(target, '1.3');

    // 2. Kích hoạt Page domain
    await chrome.debugger.sendCommand(target, 'Page.enable');

    // 3. Ra lệnh Chromium kết xuất Vector PDF 100% chữ thật chuẩn xác
    const printOptions = {
      landscape: isLandscape,
      displayHeaderFooter: false,
      printBackground: true,
      preferCSSPageSize: true,
      paperWidth: isLandscape ? dim.height : dim.width,
      paperHeight: isLandscape ? dim.width : dim.height,
      marginTop: 0.35,
      marginBottom: 0.35,
      marginLeft: 0.35,
      marginRight: 0.35,
      transferMode: 'ReturnAsBase64'
    };

    const result = await chrome.debugger.sendCommand(target, 'Page.printToPDF', printOptions);

    // 4. Tháo gỡ Debugger ngay lập tức
    try {
      await chrome.debugger.detach(target);
    } catch (e) { /* ignore */ }

    if (!result || !result.data) {
      throw new Error('Không nhận được dữ liệu PDF từ Chromium engine');
    }

    // 5. Tự động tải file PDF Vector về máy qua chrome.downloads
    const cleanName = filename.replace(/[\\/:*?"<>|]/g, '_');
    const finalFilename = cleanName.endsWith('.pdf') ? cleanName : `${cleanName}.pdf`;
    const dataUrl = `data:application/pdf;base64,${result.data}`;

    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: finalFilename,
      saveAs: false
    });

    return { success: true, downloadId, filename: finalFilename };
  } catch (err) {
    try {
      await chrome.debugger.detach(target);
    } catch (e) { /* ignore */ }
    throw err;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'EXPORT_VECTOR_PDF') {
    handleExportVectorPdf(message, sender)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message || String(err) }));
    return true; // Bắt buộc return true để xử lý bất đồng bộ
  }
});


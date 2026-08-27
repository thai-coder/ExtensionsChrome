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


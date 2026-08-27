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

// 2. Xử lý khi click vào Context Menu
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== 'toggle_flipbook_downloader' || !tab || !tab.id) return;

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

      // Nạp script trực tiếp nếu tab chưa nạp
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            'lib/jszip.min.js',
            'content/unblocker.js',
            'content/detector.js',
            'content/downloader.js',
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
  });
}

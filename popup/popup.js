/**
 * popup.js - Kích hoạt mở panel tải trên tab đang hoạt động
 */
document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openPanelBtn');
  const statusMsg = document.getElementById('statusMessage');

  function showMessage(text, type = 'error') {
    statusMsg.textContent = text;
    statusMsg.className = `status-msg ${type}`;
    statusMsg.style.display = 'block';
  }

  openBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        showMessage('Không tìm thấy tab trình duyệt hợp lệ.');
        return;
      }

      const url = tab.url || '';

      // Kiểm tra các URL hệ thống mà Chrome cấm can thiệp
      if (
        url.startsWith('chrome://') ||
        url.startsWith('edge://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('devtools://') ||
        url.startsWith('view-source:') ||
        url.startsWith('about:') ||
        url.includes('chromewebstore.google.com') ||
        url.includes('chrome.google.com/webstore')
      ) {
        showMessage('⚠️ Tiện ích không thể chạy trên các trang hệ thống (chrome://...). Hãy mở một trang đọc sách bất kỳ!');
        return;
      }

      openBtn.disabled = true;
      openBtn.textContent = '⏳ Đang kích hoạt...';

      // 1. Thử gửi thông điệp tới Content Script đã có sẵn
      chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_DOWNLOADER_UI' }, async (response) => {
        if (!chrome.runtime.lastError && response && response.status === 'ok') {
          showMessage('✅ Đã mở bảng điều khiển!', 'success');
          setTimeout(() => window.close(), 300);
          return;
        }

        // 2. Nếu Content Script chưa nạp (do trang mở trước khi load extension), nạp trực tiếp
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

          // Gọi hàm mở giao diện trực tiếp
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

          showMessage('✅ Đã mở bảng điều khiển!', 'success');
          setTimeout(() => window.close(), 300);
        } catch (err) {
          console.error(err);
          showMessage(`❌ Không thể nạp script: ${err.message || 'Lỗi không xác định'}`);
          openBtn.disabled = false;
          openBtn.textContent = '🚀 Mở Bảng Điều Khiển';
        }
      });
    } catch (err) {
      console.error(err);
      showMessage(`❌ Lỗi: ${err.message}`);
      openBtn.disabled = false;
      openBtn.textContent = '🚀 Mở Bảng Điều Khiển';
    }
  });
});

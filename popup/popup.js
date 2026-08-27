/**
 * popup.js - Kích hoạt mở panel tải trên tab đang hoạt động & kiểm tra trạng thái mở
 */
document.addEventListener('DOMContentLoaded', async () => {
  const openBtn = document.getElementById('openPanelBtn');
  const statusMsg = document.getElementById('statusMessage');

  function showMessage(text, type = 'error') {
    statusMsg.textContent = text;
    statusMsg.className = `status-msg ${type}`;
    statusMsg.style.display = 'block';
  }

  function setButtonBlocked() {
    openBtn.disabled = true;
    openBtn.style.opacity = '0.55';
    openBtn.style.cursor = 'not-allowed';
    openBtn.style.background = '#374151';
    openBtn.innerHTML = '<span>🔒 Bảng điều khiển đang mở</span>';
    showMessage('✅ Bảng điều khiển đang được mở trên trang web của bạn.', 'success');
  }

  // 1. Lấy thông tin tab hiện tại
  let currentTab = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
  } catch (e) {}

  if (!currentTab || !currentTab.id) {
    showMessage('Không tìm thấy tab trình duyệt hợp lệ.');
    return;
  }

  const url = currentTab.url || '';

  // 2. Kiểm tra các URL hệ thống mà Chrome cấm can thiệp
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
    showMessage('⚠️ Tiện ích không thể chạy trên các trang hệ thống (chrome://...). Hãy mở một trang web đọc sách bất kỳ!');
    openBtn.disabled = true;
    openBtn.style.opacity = '0.5';
    openBtn.style.cursor = 'not-allowed';
    return;
  }

  // 3. Kiểm tra xem bảng menu đã mở sẵn trên trang chưa
  try {
    chrome.tabs.sendMessage(currentTab.id, { action: 'CHECK_UI_STATUS' }, (res) => {
      if (!chrome.runtime.lastError && res && res.isOpen) {
        setButtonBlocked();
      }
    });
  } catch (e) {}

  // 4. Xử lý khi bấm nút mở bảng điều khiển
  openBtn.addEventListener('click', async () => {
    if (openBtn.disabled) return;

    openBtn.disabled = true;
    openBtn.textContent = '⏳ Đang kích hoạt...';

    try {
      // Gửi lệnh mở UI tới Content Script
      chrome.tabs.sendMessage(currentTab.id, { action: 'OPEN_DOWNLOADER_UI' }, async (response) => {
        if (!chrome.runtime.lastError && response && response.status === 'ok') {
          setButtonBlocked();
          setTimeout(() => window.close(), 350);
          return;
        }

        if (!chrome.runtime.lastError && response && response.status === 'already_open') {
          setButtonBlocked();
          return;
        }

        // Nếu Content Script chưa nạp, nạp trực tiếp toàn bộ module
        try {
          await chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
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
            target: { tabId: currentTab.id },
            func: () => {
              if (typeof window.__openFlipbookDownloader === 'function') {
                window.__openFlipbookDownloader();
              } else if (typeof window.__toggleFlipbookDownloader === 'function') {
                window.__toggleFlipbookDownloader();
              }
            }
          });

          setButtonBlocked();
          setTimeout(() => window.close(), 350);
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

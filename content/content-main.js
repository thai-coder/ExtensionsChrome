/**
 * content-main.js - Điểm khởi chạy chính của Extension trên trang web
 */
(function (global) {
  'use strict';

  // 1. Tự động gỡ bỏ các rào cản chuột phải & F12 ngay khi nạp trang
  if (global.__FlipbookUnblocker) {
    global.__FlipbookUnblocker.init();
  }

  // 2. Hàm mở Floating UI
  function toggleUI() {
    const existing = document.getElementById('__flipbook_downloader_host__');
    if (existing) {
      existing.remove();
    } else {
      if (global.__FlipbookFloatingUI) {
        new global.__FlipbookFloatingUI();
      }
    }
  }

  // 3. Lắng nghe thông điệp từ Extension Popup hoặc Background Worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'TOGGLE_DOWNLOADER_UI') {
        toggleUI();
        sendResponse({ status: 'ok' });
      }
    });
  }

  // Phím tắt nhanh: Alt + D để mở/đóng Panel tải sách
  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      toggleUI();
    }
  });

  global.__toggleFlipbookDownloader = toggleUI;
})(window);

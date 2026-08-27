/**
 * content-main.js - Điểm khởi chạy chính của Extension trên trang web
 */
(function (global) {
  'use strict';

  // 1. Hàm mở Floating UI (Tải trực tiếp tại tab hiện tại - In-Tab Isolation)
  function toggleUI() {
    const existing = document.getElementById('__flipbook_downloader_host__');
    if (existing) {
      existing.remove();
    } else {
      // Chỉ gỡ rào cản chuột phải/copy khi người dùng chủ động mở giao diện tải
      if (global.__FlipbookUnblocker) {
        global.__FlipbookUnblocker.init();
      }
      if (global.__FlipbookFloatingUI) {
        new global.__FlipbookFloatingUI();
      }
    }
  }

  // 2. Lắng nghe thông điệp từ Extension Popup hoặc Background Worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'TOGGLE_DOWNLOADER_UI') {
        toggleUI();
        sendResponse({ status: 'ok' });
      }
    });
  }

  // Phím tắt nhanh: Alt + D để mở/đóng Panel tải sách tại tab hiện tại
  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      toggleUI();
    }
  });

  global.__toggleFlipbookDownloader = toggleUI;
})(window);


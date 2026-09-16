/**
 * content-main.js - Điểm khởi chạy chính của Extension trên trang web
 */
(function (global) {
  'use strict';

  // 1. Hàm mở Floating UI
  function openUI() {
    const existing = document.getElementById('__flipbook_downloader_host__');
    if (existing) {
      // Bảng đã mở -> Làm nổi bật viền
      try {
        const shadow = existing.shadowRoot;
        const panel = shadow?.querySelector('.panel');
        if (panel) {
          panel.style.transition = 'transform 0.15s ease, box-shadow 0.15s ease';
          panel.style.transform = 'scale(1.02)';
          panel.style.boxShadow = '0 0 0 3px #6366f1, 0 20px 45px rgba(0,0,0,0.8)';
          setTimeout(() => {
            panel.style.transform = 'scale(1)';
            panel.style.boxShadow = '0 20px 45px rgba(0,0,0,0.65)';
          }, 300);
        }
      } catch (e) {}
      return false; // Đã mở sẵn
    }

    if (global.__FlipbookUnblocker) {
      global.__FlipbookUnblocker.init();
    }
    if (global.__FlipbookFloatingUI) {
      new global.__FlipbookFloatingUI();
    }
    return true; // Vừa mở mới
  }

  function toggleUI() {
    const existing = document.getElementById('__flipbook_downloader_host__');
    if (existing) {
      existing.remove();
      return false;
    }
    return openUI();
  }

  // 2. Lắng nghe thông điệp từ Extension Popup hoặc Background Worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      const isCurrentlyOpen = !!document.getElementById('__flipbook_downloader_host__');

      if (request.action === 'CHECK_UI_STATUS') {
        sendResponse({ status: 'ok', isOpen: isCurrentlyOpen });
        return true;
      }

      if (request.action === 'OPEN_DOWNLOADER_UI') {
        if (isCurrentlyOpen) {
          openUI(); // highlight panel
          sendResponse({ status: 'already_open', isOpen: true });
        } else {
          openUI();
          sendResponse({ status: 'ok', isOpen: true });
        }
        return true;
      }

      if (request.action === 'TOGGLE_DOWNLOADER_UI') {
        const opened = toggleUI();
        sendResponse({ status: 'ok', isOpen: opened });
        return true;
      }
    });
  }

  global.__toggleFlipbookDownloader = toggleUI;
  global.__openFlipbookDownloader = openUI;
})(window);



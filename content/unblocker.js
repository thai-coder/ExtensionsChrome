/**
 * unblocker.js - Gỡ bỏ các cơ chế chống chuột phải, chống F12 và chặn bôi đen
 */
(function (global) {
  'use strict';

  function initUnblocker() {
    // 1. Chặn các event listener cố tình ngăn chặn thao tác người dùng (Capture Phase)
    const restrictedEvents = [
      'contextmenu',
      'keydown',
      'keyup',
      'keypress',
      'selectstart',
      'dragstart',
      'copy',
      'cut',
      'mousedown'
    ];

    restrictedEvents.forEach((eventType) => {
      window.addEventListener(
        eventType,
        (e) => {
          // Ngăn không cho trang web gọi stopPropagation hoặc preventDefault với chuột phải / phím tắt
          e.stopPropagation();
        },
        true // Capture Phase
      );

      document.addEventListener(
        eventType,
        (e) => {
          e.stopPropagation();
        },
        true
      );
    });

    // 2. Override CSS vô hiệu hóa user-select
    const styleId = '__flipbook_unblocker_style__';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        * {
          -webkit-user-select: auto !important;
          -moz-user-select: auto !important;
          -ms-user-select: auto !important;
          user-select: auto !important;
          pointer-events: auto !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }
  }

  global.__FlipbookUnblocker = {
    init: initUnblocker
  };
})(window);

/**
 * unblocker.js - Gỡ bỏ an toàn các cơ chế chặn chuột phải và bôi đen (Không phá vỡ sự kiện chuột/phím của web)
 */
(function (global) {
  'use strict';

  function safeUnblock() {
    // 1. Chỉ gỡ bỏ các rào cản inline chặn chuột phải và copy trên các thẻ DOM
    try {
      if (document.body) {
        document.body.oncontextmenu = null;
        document.body.onselectstart = null;
        document.body.ondragstart = null;
        document.body.oncopy = null;
      }
      document.oncontextmenu = null;
      document.onselectstart = null;
      document.oncopy = null;
      window.oncontextmenu = null;
    } catch (e) {
      // Bỏ qua lỗi truy cập nếu có sandbox
    }

    // 2. Chỉ cho phép contextmenu mở bình thường mà KHÔNG nuốt chửng hay chặn đứng mousedown/keydown/scroll
    window.addEventListener(
      'contextmenu',
      (e) => {
        // Cho phép menu ngữ cảnh hoạt động mà không gọi stopPropagation làm hỏng các event khác
        e.stopImmediatePropagation ? e.stopImmediatePropagation() : null;
      },
      false
    );
  }

  global.__FlipbookUnblocker = {
    init: safeUnblock
  };
})(window);


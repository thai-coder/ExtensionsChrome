/**
 * FEASIBILITY STUDY Data - Exact Single-Execution APN Scanner
 */

(function findAPN() {
  if (window.__GOOGLE_APN_EXTRACTOR_LOADED__) return;
  window.__GOOGLE_APN_EXTRACTOR_LOADED__ = true;

  let hasExtracted = false;

  function executeScan() {
    if (hasExtracted || window.__APN_ALREADY_EXTRACTED__) return true;

    // Quét toàn bộ văn bản đang hiển thị trên trang web
    const pageText = document.body ? document.body.innerText : "";
    if (!pageText || pageText.length < 30) return false;

    // Định dạng Regex: Tìm các dãy số kiểu XXX-XXX-XX hoặc XXXXXXXX (Đặc trưng APN ở Orange County)
    // Bao gồm cả trường hợp có chữ "APN:" phía trước
    const apnRegex = /(?:APN|Parcel(?: Number)?)[^\d]{0,10}?(\d{3}[-\s]?\d{3}[-\s]?\d{2,3}|\d{8,9})\b/gi;

    let matches;
    let foundAPNs = new Set();

    while ((matches = apnRegex.exec(pageText)) !== null) {
      if (matches[1]) {
        foundAPNs.add(matches[1].replace(/\s/g, ''));
      }
    }

    // Fallback nếu chưa có APN theo định dạng 4-3-3 của LA
    if (foundAPNs.size === 0) {
      const fb = pageText.match(/(?:APN|Parcel)[^\d]{0,15}?(\d{4}[-\s]?\d{3}[-\s]?\d{3}|\d{3}[-\s]?\d{3}[-\s]?\d{2,3}|\d{8,10})\b/i);
      if (fb && fb[1]) foundAPNs.add(fb[1].replace(/\s/g, ''));
    }

    // Kết quả
    if (foundAPNs.size > 0) {
      hasExtracted = true;
      window.__APN_ALREADY_EXTRACTED__ = true;

      const firstAPN = [...foundAPNs][0];
      console.log("%c🔥 ĐÃ TÌM THẤY MÃ APN:", "color: green; font-weight: bold; font-size: 14px;");
      console.table([...foundAPNs]);

      // Tự động copy giá trị đầu tiên vào Clipboard
      try {
        navigator.clipboard.writeText(firstAPN).then(() => {
          console.log(`Đã copy APN [${firstAPN}] vào bộ nhớ tạm (Clipboard)!`);
        }).catch(() => {});
      } catch (e) {}

      // Trích xuất địa chỉ tìm kiếm ban đầu từ thanh tìm kiếm Google
      let searchedAddress = "";
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const q = urlParams.get("q") || "";
        searchedAddress = q.replace(/\s*The Assessor's Parcel Number.*$/i, "")
                           .replace(/\s*APN.*$/i, "")
                           .replace(/\s*Parcel ID.*$/i, "")
                           .trim();
      } catch (e) {}

      if (!searchedAddress) {
        const qInput = document.querySelector('textarea[name="q"], input[name="q"]');
        if (qInput && qInput.value) {
          searchedAddress = qInput.value.replace(/\s*The Assessor's Parcel Number.*$/i, "")
                                        .replace(/\s*APN.*$/i, "")
                                        .replace(/\s*Parcel ID.*$/i, "")
                                        .trim();
        }
      }

      // Tự động điền vào ô APN & Address của Extension qua Chrome Storage
      chrome.storage.local.get(["lastPipelineResult", "lastSearchQuery"], (res) => {
        const prev = res.lastPipelineResult || {};
        const finalAddr = res.lastSearchQuery || searchedAddress || prev.address || "";
        chrome.storage.local.set({
          lastApn: firstAPN,
          lastSearchQuery: finalAddr,
          lastPipelineResult: {
            ...prev,
            apn: firstAPN,
            address: finalAddr,
            source: "Google Search",
            updatedAt: new Date().toISOString()
          }
        });
      });

      chrome.runtime.sendMessage({
        action: "APN_AUTO_FOUND_CLOSE",
        apn: firstAPN,
        details: { address: searchedAddress }
      });

      return true;
    }

    return false;
  }

  // Chạy ngay
  if (!executeScan()) {
    let count = 0;
    const timer = setInterval(() => {
      count++;
      if (executeScan() || count >= 25) {
        clearInterval(timer);
      }
    }, 350);

    const observer = new MutationObserver(() => {
      if (executeScan()) {
        observer.disconnect();
        clearInterval(timer);
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        if (!executeScan() && document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        }
      });
    }
  }
})();

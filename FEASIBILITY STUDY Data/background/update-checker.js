/**
 * FEASIBILITY STUDY Data - GitHub Private Repo Update Checker
 * Kiểm tra định kỳ phiên bản mới từ GitHub API và bật huy hiệu (Badge) trên icon Extension.
 */

// Hàm so sánh 2 chuỗi version semver (ví dụ: "1.6.1" vs "1.6.0")
// Trả về: 1 nếu v1 > v2, -1 nếu v1 < v2, 0 nếu bằng nhau
function compareSemver(v1, v2) {
  if (!v1 || !v2) return 0;
  const p1 = v1.toString().trim().replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = v2.toString().trim().replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const maxLen = Math.max(p1.length, p2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

// Hàm chính kiểm tra cập nhật từ GitHub
async function checkForExtensionUpdates() {
  try {
    if (typeof UPDATE_CONFIG === "undefined") {
      return;
    }

    const apiUrl = `https://api.github.com/repos/${UPDATE_CONFIG.GITHUB_REPO}/contents/${encodeURIComponent(UPDATE_CONFIG.VERSION_FILE_PATH)}?ref=${UPDATE_CONFIG.BRANCH || 'main'}`;

    const headers = {
      "Accept": "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };

    if (UPDATE_CONFIG.GITHUB_TOKEN && UPDATE_CONFIG.GITHUB_TOKEN !== "YOUR_GITHUB_TOKEN_HERE" && UPDATE_CONFIG.GITHUB_TOKEN.trim() !== "") {
      headers["Authorization"] = `Bearer ${UPDATE_CONFIG.GITHUB_TOKEN.trim()}`;
    }

    let response = await fetch(apiUrl, {
      method: "GET",
      headers: headers,
      cache: "no-store"
    });

    // Nếu có token nhưng bị lỗi 401 (token bị thu hồi hoặc hết hạn), thử lại không kèm token (dành cho repo Public)
    if (response.status === 401 && headers["Authorization"]) {
      delete headers["Authorization"];
      response = await fetch(apiUrl, {
        method: "GET",
        headers: headers,
        cache: "no-store"
      });
    }

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const currentVersion = chrome.runtime.getManifest().version;
    const serverVersion = data.version;

    if (compareSemver(serverVersion, currentVersion) > 0) {
      // 1. Bật huy hiệu NEW màu đỏ trên icon Extension
      chrome.action.setBadgeText({ text: "NEW" });
      chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
      chrome.action.setTitle({ 
        title: `Đã có bản cập nhật v${serverVersion}! Vui lòng chạy FS.exe trên server để cập nhật.` 
      });

      // 2. Lưu thông tin vào storage để popup hiển thị thông báo chi tiết
      await chrome.storage.local.set({
        fs_update_info: {
          hasUpdate: true,
          serverVersion: serverVersion,
          currentVersion: currentVersion,
          releaseDate: data.releaseDate || "",
          installerPath: UPDATE_CONFIG.SERVER_INSTALLER_PATH
        }
      });
    } else {
      // Đang ở phiên bản mới nhất -> Xóa badge
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setTitle({ title: chrome.runtime.getManifest().name });
      await chrome.storage.local.remove("fs_update_info");
    }
  } catch (error) {
    // Bỏ qua lỗi ngầm, tránh log rác vào console
  }
}

// Lắng nghe yêu cầu kiểm tra thủ công từ Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "MANUAL_CHECK_UPDATE") {
    checkForExtensionUpdates().then(() => {
      chrome.storage.local.get("fs_update_info", (result) => {
        sendResponse(result.fs_update_info || { hasUpdate: false });
      });
    });
    return true; // Async response
  }
});

// Thiết lập lịch kiểm tra định kỳ bằng chrome.alarms
const UPDATE_ALARM_NAME = "fs_update_check_alarm";

chrome.alarms.get(UPDATE_ALARM_NAME, (alarm) => {
  const interval = (typeof UPDATE_CONFIG !== "undefined" && UPDATE_CONFIG.CHECK_INTERVAL_MINUTES) 
    ? UPDATE_CONFIG.CHECK_INTERVAL_MINUTES 
    : 30;

  if (!alarm) {
    chrome.alarms.create(UPDATE_ALARM_NAME, { periodInMinutes: interval });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM_NAME) {
    checkForExtensionUpdates();
  }
});

// Chạy kiểm tra ngay khi khởi động trình duyệt
chrome.runtime.onStartup.addListener(() => {
  checkForExtensionUpdates();
});

// Chạy kiểm tra khi extension được cài hoặc reload
checkForExtensionUpdates();

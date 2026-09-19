/**
 * CẤU HÌNH KIỂM TRA PHIÊN BẢN TỰ ĐỘNG TỪ GITHUB PRIVATE REPOSITORY
 * Repository: https://github.com/thai-coder/ExtensionsChrome
 */
const UPDATE_CONFIG = {
  // Đường dẫn repository trên GitHub (owner/repo)
  GITHUB_REPO: "thai-coder/ExtensionsChrome",

  // Đường dẫn file kiểm tra phiên bản trên GitHub (đọc thẳng từ manifest.json rất tiện lợi)
  VERSION_FILE_PATH: "FEASIBILITY STUDY Data/manifest.json",

  // Nhánh Git chứa bản phát hành mới nhất
  BRANCH: "main",

  // =========================================================================
  // BẠN HÃY DÁN TOKEN GITHUB FINE-GRAINED (CHẾ ĐỘ READ-ONLY) VÀO DÒNG DƯỚI ĐÂY:
  // (Tạo tại: GitHub > Settings > Developer Settings > Fine-grained tokens > Contents: Read-only)
  // =========================================================================
  GITHUB_TOKEN: "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",

  // Chu kỳ tự động kiểm tra bản mới (phút)
  CHECK_INTERVAL_MINUTES: 30,

  // Đường dẫn bộ cài đặt trên Server nội bộ mạng LAN công ty
  SERVER_INSTALLER_PATH: "\\\\192.168.11.250\\Sharing\\THAILE\\Tools\\Extensions\\FS.exe"
};

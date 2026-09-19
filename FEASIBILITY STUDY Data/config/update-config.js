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

  // BẠN CÓ THỂ DÁN TOKEN GITHUB FINE-GRAINED (READ-ONLY) NẾU REPO LÀ PRIVATE:
  // (Với repo Public thì để trống "", Extension vẫn tự động kiểm tra bình thường)
  GITHUB_TOKEN: "",

  // Chu kỳ tự động kiểm tra bản mới (phút)
  CHECK_INTERVAL_MINUTES: 30,

  // Đường dẫn bộ cài đặt trên Server nội bộ mạng LAN công ty
  SERVER_INSTALLER_PATH: "\\\\192.168.11.250\\Sharing\\THAILE\\Tools\\Extensions\\FS.exe"
};

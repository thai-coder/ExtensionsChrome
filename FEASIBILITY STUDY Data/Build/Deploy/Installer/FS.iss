; =====================================================================
; INNO SETUP SCRIPT CHO CHROME EXTENSION: FEASIBILITY STUDY DATA
; Triển khai trực tiếp vào thư mục Documents của người dùng:
; - Thư mục cài đặt: %USERPROFILE%\Documents\FEASIBILITY STUDY Data
; - BỎ QUA mọi can thiệp Chrome: KHÔNG tắt Chrome, KHÔNG sửa shortcut
; - Người dùng chỉ cần vào chrome://extensions bấm "Load unpacked" trỏ vào thư mục này 1 lần duy nhất
; - Khi cập nhật: Chạy FS.exe sẽ tự động làm mới mã nguồn trong thư mục Documents
; - Hỗ trợ Gỡ cài đặt sạch sẽ trong Windows Settings / Control Panel
; =====================================================================

#define MyAppName "FEASIBILITY STUDY Data"
#ifndef MyAppVersion
#define MyAppVersion "1.6.5"
#endif
#define MyAppPublisher "TIC, Inc."
#define MyAppURL "http://www.tectonicsgroup.com/"

[Setup]
AppId={{C8E649F2-A59B-4D8E-B1F7-3F72B581729A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
VersionInfoVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}

; Cài đặt trực tiếp vào C:\Users\[user]\Documents\FEASIBILITY STUDY Data
DefaultDirName={userdocs}\{#MyAppName}
DisableDirPage=yes
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; Quyền hạn: User thông thường, 1-click cài đặt không cần Admin (không hiện UAC)
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=commandline

; Xuất file cài đặt FS.exe ra thư mục Deploy
OutputDir=..\
OutputBaseFilename=FS
SetupIconFile=FS.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
DisableReadyPage=yes
DisableFinishedPage=no

; Cấu hình GỠ CÀI ĐẶT trong Windows Settings / Control Panel
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\FS.ico
CreateUninstallRegKey=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
; 1. Đóng gói các thành phần cốt lõi của Chrome Extension vào thư mục Documents
Source: "..\..\..\manifest.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\..\background\*"; DestDir: "{app}\background"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\..\config\*"; DestDir: "{app}\config"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\..\content\*"; DestDir: "{app}\content"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\..\icons\*"; DestDir: "{app}\icons"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\..\options\*"; DestDir: "{app}\options"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\..\..\popup\*"; DestDir: "{app}\popup"; Flags: ignoreversion recursesubdirs createallsubdirs

; 2. Copy icon ứng dụng & file cập nhật
Source: "FS.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\..\update.bat"; DestDir: "{app}"; Flags: ignoreversion

[Registry]
; Đăng ký Custom URL Protocol: fs-update://run để Chrome Extension có thể kích hoạt file cài đặt từ xa
Root: HKCU; Subkey: "Software\Classes\fs-update"; ValueType: string; ValueName: ""; ValueData: "URL:FS Update Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\fs-update"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\fs-update\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\FS.ico,0"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\fs-update\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\update.bat"" ""%1"""; Flags: uninsdeletekey

[Run]
; Mở sẵn thư mục Documents\FEASIBILITY STUDY Data để người dùng dễ dàng bấm Load unpacked trong Chrome
Filename: "explorer.exe"; Parameters: """{app}"""; Description: "Mở thư mục Extension trong File Explorer"; Flags: postinstall nowait skipifsilent

[Code]
// =====================================================================
// DỌN SẠCH FILE CŨ TRƯỚC KHI GIẢI NÉN BẢN MỚI VÀO DOCUMENTS
// =====================================================================
procedure CurStepChanged(CurStep: TSetupStep);
var
  AppDir: String;
begin
  if CurStep = ssInstall then
  begin
    AppDir := ExpandConstant('{app}');
    // Nếu thư mục đã tồn tại từ bản trước: Xóa sạch file cũ để không bị sót file rác
    if DirExists(AppDir) then
    begin
      DelTree(AppDir + '\*', False, True, True);
    end;
  end;
end;

// =====================================================================
// SỰ KIỆN GỠ CÀI ĐẶT (UNINSTALL)
// =====================================================================
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    // Xóa sạch toàn bộ thư mục trong Documents khi người dùng chọn Gỡ cài đặt
    DelTree(ExpandConstant('{app}'), True, True, True);
  end;
end;

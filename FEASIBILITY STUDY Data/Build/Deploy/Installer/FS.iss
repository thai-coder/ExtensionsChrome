; Script generated for DropboxCP Installer
; Inno Setup Compiler configuration

#define MyAppName "DropboxCP"
#define MyAppVersion "26.09.18.00"
#define MyAppPublisher "TIC, Inc."
#define MyAppURL "http://www.tectonicsgroup.com/"
#define FileVersion "26.09.18.00"

[Setup]
AppId={{9FF96D55-A852-4746-B772-3A9D403D77F8}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
VersionInfoVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autoappdata}\DropboxCP
DisableDirPage=yes
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
VersionInfoOriginalFileName="Dropbox-CP.exe"
VersionInfoCopyright="Copyright (C) 2026 TIC, Inc."
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=commandline
OutputDir=..\
OutputBaseFilename=DropboxCP
SetupIconFile=DropboxCP.ico
Compression=lzma
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName={#MyAppName}
Uninstallable=True
UninstallDisplayIcon={app}\DropboxCP.ico
UninstallLogMode=append

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\..\bin\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs restartreplace
Source: "DropboxCP.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\Dropbox-CP.exe"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\Dropbox-CP.exe"; WorkingDir: "{app}"; IconFilename: "{app}\DropboxCP.ico"

[Run]
Filename: "{app}\Dropbox-CP.exe"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
// SỰ KIỆN AN TOÀN: Xóa sạch các file cũ trong thư mục {app} trước khi giải nén phiên bản mới
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    // Xóa sạch toàn bộ file và thư mục con cũ bên trong {app} để đảm bảo không bị sót file thừa của bản cũ
    if DirExists(ExpandConstant('{app}')) then
    begin
      DelTree(ExpandConstant('{app}\*'), False, True, True);
    end;
  end
  else if CurStep = ssPostInstall then
  begin
    // Nếu có tham số /AUTOSTART=1 hoặc trong chế độ silent từ app, tự động khởi chạy lại app
    if (ExpandConstant('{param:AUTOSTART|0}') = '1') or WizardSilent then
    begin
      Exec(ExpandConstant('{app}\Dropbox-CP.exe'), '', '', SW_SHOWNORMAL, ewNoWait, ResultCode);
    end;
  end;
end;

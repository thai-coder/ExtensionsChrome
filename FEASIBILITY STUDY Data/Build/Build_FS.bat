@echo off
setlocal

set "BuildRoot=%~dp0"
set "InstallerScript=%BuildRoot%Deploy\Installer\FS.iss"
set "DeployDir=%BuildRoot%Deploy\"
set "ManifestFile=%BuildRoot%..\manifest.json"

echo ================================================================
echo       FEASIBILITY STUDY DATA - EXTENSION INSTALLER BUILDER
echo ================================================================

:: 1. TIM TRINH BIEN DICH INNO SETUP (ISCC.EXE)
set "InnoCompiler=C:\Users\%USERNAME%\AppData\Local\Programs\Inno Setup 7\ISCC.exe"
if not exist "%InnoCompiler%" (
    if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" (
        set "InnoCompiler=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
    ) else if exist "C:\Program Files\Inno Setup 6\ISCC.exe" (
        set "InnoCompiler=C:\Program Files\Inno Setup 6\ISCC.exe"
    )
)

if not exist "%InnoCompiler%" (
    echo [LOI] Khong tim thay Inno Setup Compiler ISCC.exe
    echo Vui long kiem tra lai duong dan cai dat Inno Setup.
    if not "%~1"=="--no-pause" pause
    exit /b 1
)

echo [1/4] Trinh bien dich: %InnoCompiler%

:: 2. DOC VERSION TU MANIFEST.JSON
set "ExtVersion=1.6.0"
if exist "%ManifestFile%" (
    for /f "tokens=2 delims=:, " %%a in ('findstr /i "\"version\"" "%ManifestFile%"') do (
        set "ExtVersion=%%~a"
    )
)
echo [2/4] Phien ban Extension: v%ExtVersion%

:: 3. BIEN DICH BO CAI DAT FS.EXE
echo.
echo [3/4] Dang bien dich bo cai dat FS.exe...
"%InnoCompiler%" /DMyAppVersion="%ExtVersion%" "%InstallerScript%"
if errorlevel 1 (
    echo.
    echo [LOI] Bien dich Inno Setup that bai. Ma loi: %ERRORLEVEL%
    if not "%~1"=="--no-pause" pause
    exit /b %ERRORLEVEL%
)

:: 4. TAO FILE VERSION.JSON
(
    echo {
    echo   "version": "%ExtVersion%",
    echo   "releaseDate": "%date% %time%",
    echo   "installerFile": "FS.exe"
    echo }
) > "%DeployDir%version.json"

set "ServerTarget=\\192.168.11.250\Sharing\THAILE\Tools\Extensions\"

:: 5. DAY BO CAI DAT VA METADATA LEN SERVER
echo.
echo [4/4] Dang day bo cai dat len Server: %ServerTarget%...
if exist "%DeployDir%FS.exe" (
    if not exist "%ServerTarget%" mkdir "%ServerTarget%" 2>nul
    copy /Y "%DeployDir%FS.exe" "%ServerTarget%FS.exe" > nul
    if not errorlevel 1 (
        copy /Y "%DeployDir%version.json" "%ServerTarget%version.json" > nul
        echo   [DA COPY] %ServerTarget%FS.exe
        echo   [DA COPY] %ServerTarget%version.json
        echo.
        echo ================================================================
        echo [THANH CONG] DA PHAT HANH BO CAI DAT LEN SERVER THANH CONG
        echo ================================================================
    ) else (
        echo   [CANH BAO] Khong the ghi file len Server.
        echo   Vui long kiem tra lai ket noi mang LAN toi 192.168.11.250.
    )
)

echo.
echo ================================================================
echo [HOAN TAT] QUA TRINH DONG GOI DA KET THUC
echo   - File cai dat cuc bo: %DeployDir%FS.exe
echo   - File metadata phien ban: %DeployDir%version.json
echo ================================================================
echo.
if not "%~1"=="--no-pause" pause
endlocal

@echo off
setlocal enabledelayedexpansion

set "BuildRoot=%~dp0"
set "BinDir=%BuildRoot%bin\"
set "ProtectDir=%BuildRoot%Protect\"
set "DeployDir=%BuildRoot%Deploy\"
set "LogFile=%BuildRoot%msbuild.log"
set "InnoCompiler=C:\Users\thailka\AppData\Local\Programs\Inno Setup 7\ISCC.exe"
set "ServerTarget=\\192.168.11.250\Sharing\THAILE\Tools\DropboxCP\"

:: Tu dong phat hien duong dan MSBuild tu Visual Studio qua vswhere
set "MSBuildExe="
for /f "usebackq tokens=*" %%i in (`"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -requires Microsoft.Component.MSBuild -find MSBuild\**\Bin\MSBuild.exe 2^>nul`) do (
    set "MSBuildExe=%%i"
)
if "%MSBuildExe%"=="" (
    if exist "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe" (
        set "MSBuildExe=C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Current\Bin\MSBuild.exe"
    ) else if exist "C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe" (
        set "MSBuildExe=C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe"
    )
)

echo ================================================================
echo        DROPBOX-CP MASTER RELEASE PIPELINE
echo ================================================================
echo MSBuild: %MSBuildExe%
echo Output : %DeployDir%DropboxCP.exe
echo Server : %ServerTarget%DropboxCP.exe
echo ================================================================

if exist "%LogFile%" del /f /q "%LogFile%"

:: KIEM TRA NEU DUOC GOI TU POSTBUILDEVENT DE TRANH LAP DE QUY
if /i "%~1"=="--no-build" (
    echo [THONG BAO] Chay tu PostBuildEvent, bo qua buoc bien dich MSBuild.
    goto :StepProtect
)

:: BUOC 0: DON SACH THU MUC BIN DE LAM MOI 100%
echo.
echo [BUOC 0/5] Don sach thu muc Build\bin de lam moi 100 percent...
if exist "%BinDir%" rmdir /s /q "%BinDir%"
mkdir "%BinDir%"

:: BUOC 1: BIEN DICH MSBUILD VA BAT LOG
echo.
echo [BUOC 1/5] Dang bien dich Dropbox-CP Release...
"%MSBuildExe%" "%BuildRoot%..\Dropbox-CP.csproj" /restore /p:Configuration=Release /t:Rebuild /verbosity:minimal /flp:logfile="%LogFile%";verbosity=normal
if !ERRORLEVEL! NEQ 0 (
    echo.
    echo [LOI NGHIEP TRONG] Dropbox-CP build THAT BAI! Ma loi: !ERRORLEVEL!
    goto :BuildFailure
)

:: KIEM TRA BAT LOG NGHIEM NGAT
findstr /C:"Build FAILED." "%LogFile%" > nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [LOI] Phat hien chuoi Build FAILED trong log!
    goto :BuildFailure
)

findstr /R /C:"[1-9][0-9]* Error(s)" "%LogFile%" > nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [LOI] Phat hien so luong Error lon hon 0 trong log!
    goto :BuildFailure
)

findstr /R /C:"[1-9][0-9]* failed" "%LogFile%" > nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [LOI] Phat hien co project bi failed trong log!
    goto :BuildFailure
)

echo.
echo ================================================================
echo == XAC MINH MSBUILD: 100 PERCENT THANH CONG 0 ERROR 0 FAILED ==
echo ================================================================
echo.

:StepProtect
:: BUOC 2: MA HOA .NET REACTOR
echo [BUOC 2/5] Chay ma hoa .NET Reactor...
if exist "%ProtectDir%Run.bat" (
    call "%ProtectDir%Run.bat"
) else (
    echo [CANH BAO] Khong tim thay Protect\Run.bat!
)

:: BUOC 3: DON DEP FILE RAC
echo.
echo [BUOC 3/5] Don dep file tam va file pdb...
if exist "%BinDir%*.pdb" del /f /q "%BinDir%*.pdb" > nul
if exist "%BinDir%Dropbox-CP_Secure" rmdir /s /q "%BinDir%Dropbox-CP_Secure" > nul

:: BUOC 4: DONG GOI INNO SETUP
echo.
echo [BUOC 4/5] Bien dich Inno Setup ISCC.exe...
if exist "%InnoCompiler%" (
    call "%InnoCompiler%" "%DeployDir%Installer\DropboxCP.iss"
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo [LOI] Bien dich Inno Setup that bai! Ma loi: !ERRORLEVEL!
        exit /b 1
    )
) else (
    echo.
    echo [LOI] Khong tim thay trinh bien dich Inno Setup tai: %InnoCompiler%
    exit /b 1
)

:: BUOC 5: COPY LEN SERVER DROPBOXCP
echo.
echo [BUOC 5/5] Phat hanh bo cai dat len Server DropboxCP...
if exist "%DeployDir%DropboxCP.exe" (
    if not exist "%ServerTarget%" mkdir "%ServerTarget%"
    copy /Y "%DeployDir%DropboxCP.exe" "%ServerTarget%DropboxCP.exe" > nul
    if exist "%DeployDir%WhatsNew.json" (
        copy /Y "%DeployDir%WhatsNew.json" "%ServerTarget%WhatsNew.json" > nul
        echo   [DA COPY] %ServerTarget%WhatsNew.json
    )
    echo.
    echo ================================================================
    echo [THANH CONG] DA PHAT HANH DROPBOXCP LEN SERVER:
    echo   %ServerTarget%DropboxCP.exe
    echo ================================================================
) else (
    echo.
    echo [LOI] Khong tim thay tap tin %DeployDir%DropboxCP.exe sau khi bien dich!
    exit /b 1
)

goto :End

:BuildFailure
echo ================================================================
echo [DA DUNG] TIEN TRINH RELEASE BI HUY DO CO LOI BIEN DICH MSBUILD!
echo Xem chi tiet loi trong file log: %LogFile%
echo ================================================================
exit /b 1

:End
endlocal

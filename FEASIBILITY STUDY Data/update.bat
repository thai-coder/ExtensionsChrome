@echo off
setlocal
title Cap nhat FEASIBILITY STUDY Data

set "ServerInstaller=\\192.168.11.250\Sharing\THAILE\Tools\Extensions\FS.exe"
set "ServerFolder=\\192.168.11.250\Sharing\THAILE\Tools\Extensions"
set "LocalInstaller=%TEMP%\FS_Setup.exe"

echo ================================================================
echo    FEASIBILITY STUDY DATA - KHOI DONG BO CAI DAT PHIEN BAN MOI
echo ================================================================
echo.

if exist "%ServerInstaller%" (
    echo [OK] Dang lay bo cai dat moi nhat tu Server...
    copy /Y "%ServerInstaller%" "%LocalInstaller%" > nul
    if exist "%LocalInstaller%" (
        echo [OK] Khoi chay bo cai dat...
        start "" "%LocalInstaller%"
        exit /b 0
    ) else (
        start "" "%ServerInstaller%"
        exit /b 0
    )
) else (
    echo [CANH BAO] Khong the truy cap Server LAN: %ServerFolder%
    echo Dang mo thu muc de ban kiem tra...
    explorer.exe "%ServerFolder%"
)
endlocal

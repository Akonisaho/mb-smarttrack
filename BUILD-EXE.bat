@echo off
title MB SmartTrack - Building Installer
color 0A
echo.
echo  ========================================
echo   MB SmartTrack - Building .exe Installer
echo   Motsoeneng Bill Attorneys
echo  ========================================
echo.

cd /d "%~dp0"

echo [1/3] Installing dependencies...
call npm install
if errorlevel 1 goto error

echo.
echo [2/3] Installing Electron and builder...
call npm install electron@28 --save-dev --legacy-peer-deps
call npm install electron-builder@24 --save-dev --legacy-peer-deps
if errorlevel 1 goto error

echo.
echo [3/3] Building Windows installer...
call npx electron-builder --win --x64
if errorlevel 1 goto error

echo.
echo  ========================================
echo   SUCCESS!
echo   Installer: dist\MB SmartTrack Setup 1.0.0.exe
echo   
echo   Share this .exe file with attorneys.
echo   They double-click it to install.
echo  ========================================
echo.
pause
goto end

:error
echo.
echo  ERROR: Build failed. See messages above.
pause

:end

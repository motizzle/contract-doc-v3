@echo off
echo ========================================
echo  Refresh Word Add-in (Deployed Version)
echo ========================================
echo.

echo [1/5] Closing Word...
taskkill /F /IM WINWORD.EXE >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   - Word closed
    timeout /t 2 /nobreak >nul
) else (
    echo   - Word was not running
)

echo.
echo [2/5] Clearing Word add-in cache...
powershell -Command "Remove-Item -Path '$env:LOCALAPPDATA\Microsoft\Office\16.0\Wef\*' -Recurse -Force -ErrorAction SilentlyContinue"
echo   - Cache cleared

echo.
echo [3/5] Stopping old sideloads...
npx office-addin-debugging stop server/public/manifest.xml >nul 2>&1
echo   - Stopped

echo.
echo [4/5] Re-downloading production manifest...
powershell -Command "Invoke-WebRequest -Uri 'https://wordftw.onrender.com/manifest.xml' -OutFile 'manifest.production.xml' -UseBasicParsing"
if %ERRORLEVEL% EQU 0 (
    echo   - Downloaded successfully
) else (
    echo   - [ERROR] Failed to download manifest
    pause
    exit /b 1
)

echo.
echo [5/5] Sideloading fresh production manifest...
npx office-addin-debugging start manifest.production.xml

echo.
echo ========================================
echo  Done!
echo ========================================
echo.
echo The Word add-in should now:
echo   - Load documents correctly
echo   - Use the latest code (v=session-link-auto-refresh)
echo   - Auto-refresh browser after linking
echo.
echo If it still doesn't work, check Word console for errors.
echo.
pause


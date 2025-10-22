@echo off
echo ========================================
echo  Redlined ^& Signed - Word Add-in Installer
echo ========================================
echo.
echo This will install the Word add-in...
echo.

REM Close Word if it's running (MUST be closed before registry changes)
echo Closing Word if running...
taskkill /F /IM WINWORD.EXE >nul 2>&1
timeout /t 2 /nobreak >nul

REM Register the HTTPS catalog with Word (via registry)
echo Registering add-in catalog...
set CATALOG_URL=https://wordftw.onrender.com

REM Office 2016/2019/2021/365 (16.0)
reg add "HKCU\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{B3F4C9C1-7B3D-4F3E-8F3E-3E3E3E3E3E3E}" /v "Id" /t REG_SZ /d "{B3F4C9C1-7B3D-4F3E-8F3E-3E3E3E3E3E3E}" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{B3F4C9C1-7B3D-4F3E-8F3E-3E3E3E3E3E3E}" /v "Url" /t REG_SZ /d "%CATALOG_URL%" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{B3F4C9C1-7B3D-4F3E-8F3E-3E3E3E3E3E3E}" /v "Flags" /t REG_DWORD /d 1 /f >nul 2>&1

REM Office 2013 (15.0) - fallback
reg add "HKCU\Software\Microsoft\Office\15.0\WEF\TrustedCatalogs\{B3F4C9C1-7B3D-4F3E-8F3E-3E3E3E3E3E3E}" /v "Id" /t REG_SZ /d "{B3F4C9C1-7B3D-4F3E-8F3E-3E3E3E3E3E3E}" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Office\15.0\WEF\TrustedCatalogs\{B3F4C9C1-7B3D-4F3E-8F3E-3E3E3E3E3E3E}" /v "Url" /t REG_SZ /d "%CATALOG_URL%" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Office\15.0\WEF\TrustedCatalogs\{B3F4C9C1-7B3D-4F3E-8F3E-3E3E3E3E3E3E}" /v "Flags" /t REG_DWORD /d 1 /f >nul 2>&1

echo.
echo ========================================
echo  Installation Complete!
echo ========================================
echo.
echo The catalog has been registered:
echo %CATALOG_URL%
echo.
echo Word will now open. To use the add-in:
echo.
echo 1. Click the "Insert" tab
echo 2. Click "My Add-ins"
echo 3. Click "SHARED FOLDER" at the top
echo 4. Click "Redlined ^& Signed"
echo.
echo Press any key to open Word now...
pause >nul

REM Open Word
start winword.exe

exit /b 0


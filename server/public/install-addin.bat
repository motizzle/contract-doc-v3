@echo off
echo ========================================
echo  Redlined ^& Signed - Word Add-in Installer
echo ========================================
echo.
echo This will install the Word add-in...
echo.

REM Create the catalog folder if it doesn't exist
set CATALOG_DIR=%USERPROFILE%\Documents\WordAddins
if not exist "%CATALOG_DIR%" mkdir "%CATALOG_DIR%"

REM Download the manifest
echo Downloading manifest...
powershell -Command "Invoke-WebRequest -Uri 'https://wordftw.onrender.com/manifest.xml' -OutFile '%CATALOG_DIR%\manifest.xml'"

if errorlevel 1 (
    echo.
    echo ERROR: Failed to download manifest.
    echo Please check your internet connection and try again.
    pause
    exit /b 1
)

REM Close Word if it's running
echo Closing Word if running...
taskkill /F /IM WINWORD.EXE >nul 2>&1

REM Register the catalog with Word (via registry) - try multiple Office versions
echo Registering add-in catalog...
REM Office 2016/2019/2021/365 (16.0)
reg add "HKCU\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{00000000-0000-0000-0000-000000000001}" /v "Id" /t REG_SZ /d "{00000000-0000-0000-0000-000000000001}" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{00000000-0000-0000-0000-000000000001}" /v "Url" /t REG_SZ /d "file:///%USERPROFILE:\=/%/Documents/WordAddins" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{00000000-0000-0000-0000-000000000001}" /v "Flags" /t REG_DWORD /d 1 /f >nul 2>&1

REM Office 2013 (15.0) - fallback
reg add "HKCU\Software\Microsoft\Office\15.0\WEF\TrustedCatalogs\{00000000-0000-0000-0000-000000000001}" /v "Id" /t REG_SZ /d "{00000000-0000-0000-0000-000000000001}" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Office\15.0\WEF\TrustedCatalogs\{00000000-0000-0000-0000-000000000001}" /v "Url" /t REG_SZ /d "file:///%USERPROFILE:\=/%/Documents/WordAddins" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Office\15.0\WEF\TrustedCatalogs\{00000000-0000-0000-0000-000000000001}" /v "Flags" /t REG_DWORD /d 1 /f >nul 2>&1

echo.
echo ========================================
echo  Installation Complete!
echo ========================================
echo.
echo The add-in has been installed to:
echo %CATALOG_DIR%
echo.
echo Next steps:
echo 1. Word will open in a moment
echo 2. Click the "Insert" tab
echo 3. Click "Get Add-ins" or "My Add-ins"
echo 4. Look for "SHARED FOLDER" at the top
echo 5. Click "Redlined ^& Signed"
echo.
echo NOTE: If you don't see "SHARED FOLDER":
echo - Close and restart Word
echo - Or go to File ^> Options ^> Trust Center ^> 
echo   Trust Center Settings ^> Trusted Add-in Catalogs
echo   and verify the catalog is listed
echo.
echo Press any key to open Word now...
pause >nul

REM Open Word
start winword.exe

REM Also open the instructions page in browser
timeout /t 2 /nobreak >nul
start https://wordftw.onrender.com/install-instructions.html

exit /b 0


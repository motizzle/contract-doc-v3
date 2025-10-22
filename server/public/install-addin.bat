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

REM Register the catalog with Word (via registry)
echo Registering add-in catalog...
reg add "HKCU\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{00000000-0000-0000-0000-000000000001}" /v "Id" /t REG_SZ /d "{00000000-0000-0000-0000-000000000001}" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{00000000-0000-0000-0000-000000000001}" /v "Url" /t REG_SZ /d "file:///%USERPROFILE:\=/%/Documents/WordAddins" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\{00000000-0000-0000-0000-000000000001}" /v "Flags" /t REG_DWORD /d 1 /f >nul 2>&1

echo.
echo ========================================
echo  Installation Complete!
echo ========================================
echo.
echo The add-in has been installed.
echo.
echo Next steps:
echo 1. Open Microsoft Word
echo 2. Go to: Insert ^> My Add-ins ^> Shared Folder
echo 3. Click "Redlined ^& Signed"
echo.
echo Press any key to open Word now...
pause >nul

REM Open Word
start winword.exe

exit /b 0


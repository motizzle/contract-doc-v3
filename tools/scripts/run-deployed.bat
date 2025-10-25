@echo off
echo ========================================
echo  WordFTW - Switch to Deployed Version
echo ========================================
echo.

REM Close Word first
echo [1/4] Closing Word (if running)...
tasklist /FI "IMAGENAME eq WINWORD.EXE" 2>NUL | find /I /N "WINWORD.EXE">NUL
if %ERRORLEVEL% EQU 0 (
  echo   - Word is running. Closing...
  taskkill /F /IM WINWORD.EXE >nul 2>&1
  timeout /t 2 /nobreak >nul
  echo   - Word closed
) else (
  echo   - Word is not running
)
echo.

REM Stop local sideload
echo [2/4] Stopping local add-in...
set SCRIPT_DIR=%~dp0
cd "%SCRIPT_DIR%..\..\addin"
npx office-addin-debugging stop manifest.xml >nul 2>&1
echo   - Local add-in stopped
echo.

REM Clear cache
echo [3/4] Clearing Word cache...
powershell -Command "Remove-Item -Path '$env:LOCALAPPDATA\Microsoft\Office\16.0\Wef\*' -Recurse -Force -ErrorAction SilentlyContinue" >nul 2>&1
echo   - Cache cleared
echo.

REM Stop servers (optional - user might want to keep them running)
echo [4/4] Stopping local servers...
cd "%SCRIPT_DIR%..\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\scripts\servers.ps1" -Action stop >nul 2>&1
echo   - Servers stopped
echo.

REM Instructions
echo ========================================
echo  ✅ Ready to Use Deployed Version
echo ========================================
echo.
echo Next steps:
echo.
echo 1. Go to: https://wordftw.onrender.com
echo.
echo 2. Click: "Install Word Add-in" (3-dot menu)
echo.
echo 3. Follow the installation instructions:
echo    - Download installer
echo    - Run install-addin.bat
echo    - Enter link code in Word
echo.
echo 4. Open Word and you'll see the deployed add-in!
echo.
echo To switch back to local development:
echo    Run: run-local.bat
echo.
pause


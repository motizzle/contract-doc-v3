@echo off
echo ========================================
echo  WordFTW - Local Development Launcher
echo ========================================
echo.

REM Close Word first to ensure clean sideload
echo [1/8] Closing Word (if running)...
tasklist /FI "IMAGENAME eq WINWORD.EXE" 2>NUL | find /I /N "WINWORD.EXE">NUL
if %ERRORLEVEL% EQU 0 (
  echo   - Word is running. Closing for clean sideload...
  taskkill /F /IM WINWORD.EXE >nul 2>&1
  timeout /t 2 /nobreak >nul
  echo   - Word closed
) else (
  echo   - Word is not running
)
echo.

REM Check if deployed add-in is installed
echo [2/8] Checking for deployed add-in...
reg query "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "wordftw-addin-prod" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo   - Deployed add-in found. Removing...
  
  REM Close Word
  tasklist /FI "IMAGENAME eq WINWORD.EXE" 2>NUL | find /I /N "WINWORD.EXE">NUL
  if %ERRORLEVEL% EQU 0 (
    echo   - Closing Word...
    taskkill /F /IM WINWORD.EXE >nul 2>&1
    timeout /t 2 /nobreak >nul
  )
  
  REM Remove registry
  reg delete "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "wordftw-addin-prod" /f >nul 2>&1
  
  REM Clear cache
  powershell -Command "Remove-Item -Path '$env:LOCALAPPDATA\Microsoft\Office\16.0\Wef\*' -Recurse -Force -ErrorAction SilentlyContinue" >nul 2>&1
  
  echo   - Deployed add-in removed
) else (
  echo   - No deployed add-in found
)
echo.

REM Stop any existing sideloads
echo [3/8] Stopping any existing local sideloads...
set ROOT_DIR=%~dp0..\..
cd /d "%ROOT_DIR%"
REM Skipping office-addin-debugging stop as it can hang
REM Word was already closed in step 1, which stops sideloads
echo   - Skipped (Word already closed in step 1)
echo.

REM Set up environment
echo [4/8] Setting up environment...
set LLM_PROVIDER=ollama
set OLLAMA_MODEL=gemma3:1b
set OLLAMA_BASE_URL=http://localhost:11434
echo   - Environment configured
echo.

REM Check if main server is already running
echo [5/8] Checking main server...
set SCRIPT_DIR=%~dp0
netstat -ano | findstr :4001 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo   - Server already running on port 4001
) else (
  echo   - Starting main server...
  start /MIN powershell -NoProfile -ExecutionPolicy Bypass -Command "cd '%SCRIPT_DIR%..\..\server'; npm start"
  echo   - Main server starting on https://localhost:4001
  echo   - (Server will open in minimized window)
  echo   - Waiting for server to be ready...
  timeout /t 5 /nobreak >nul
)
echo.

REM Check if add-in dev server is running
echo [6/8] Checking add-in dev server...
netstat -ano | findstr :4000 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo   - Add-in dev server already running on port 4000
) else (
  echo   - Starting add-in dev server...
  start /MIN powershell -NoProfile -ExecutionPolicy Bypass -Command "cd '%SCRIPT_DIR%..\..\addin'; npm run dev-server"
  echo   - Add-in dev server starting on https://localhost:4000
  echo   - (Server will open in minimized window)
  echo   - Waiting for dev server to be ready...
  timeout /t 5 /nobreak >nul
)
echo.

REM Clear browser session data automatically
echo [7/8] Preparing browser session...
echo   - Opening browser to clear old session data...
start https://localhost:4001/clear-session.html
timeout /t 2 /nobreak >nul
echo   - Session cleared (browser will auto-redirect)
echo.

REM Sideload local add-in
echo [8/8] Sideloading local add-in...
cd /d "%ROOT_DIR%\addin"
echo   - Working directory: %CD%
echo   - Running: npx office-addin-debugging start manifest.xml
npx office-addin-debugging start manifest.xml
set SIDELOAD_EXIT=%ERRORLEVEL%
if %SIDELOAD_EXIT% EQU 0 (
  echo.
  echo ========================================
  echo  ✅ Local Development Ready!
  echo ========================================
  echo.
  echo 🌐 Browser: https://localhost:4001 (auto-opened)
  echo 📦 Add-in: Sideloaded (localhost:4000)
  echo 📝 Manifest: addin/manifest.xml
  echo.
  echo ✅ Both browser and Word use 'default' session
  echo ✅ Changes sync automatically!
  echo.
  echo Word should open automatically with add-in loaded.
  echo.
  echo To stop:
  echo   1. Run: run-deployed.bat (to switch to deployed)
  echo   2. Or manually: npx office-addin-debugging stop addin/manifest.xml
  echo.
) else (
  echo.
  echo ========================================
  echo  ⚠ Sideload Failed (Exit code: %SIDELOAD_EXIT%)
  echo ========================================
  echo.
  echo Possible issues:
  echo   1. office-addin-debugging not installed
  echo      Fix: npm install -g office-addin-debugging
  echo.
  echo   2. Word already has an add-in sideloaded
  echo      Fix: Close Word and try again
  echo.
  echo   3. manifest.xml has errors
  echo      Fix: cd addin ^&^& npm run validate
  echo.
  echo Try manual sideload:
  echo   cd addin
  echo   npx office-addin-debugging start manifest.xml
  echo.
)
echo.
echo (Press any key to close this window)
pause >nul


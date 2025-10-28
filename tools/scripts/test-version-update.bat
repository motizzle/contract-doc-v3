@echo off
REM Test Version Update Detection Feature
REM This script simulates a deployment by changing the version and restarting the server

echo.
echo ========================================
echo Test Version Update Detection
echo ========================================
echo.

REM Get the script directory
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%..\.."

echo [Step 1/5] Starting server with version 1.0.0...
echo.

REM Make sure package.json has version 1.0.0
cd server
powershell -Command "(Get-Content package.json) -replace '\"version\": \".*\"', '\"version\": \"1.0.0\"' | Set-Content package.json"
echo   Current version: 1.0.0
echo.

REM Start server in background
echo   Starting server on https://localhost:4001
start /MIN powershell -NoProfile -ExecutionPolicy Bypass -Command "npm start"
timeout /t 3 /nobreak >nul
echo   Server started!
echo.

echo [Step 2/5] Open browser and load the app...
echo.
echo   1. Open: https://localhost:4001
echo   2. Accept the self-signed certificate warning
echo   3. Wait for the app to fully load
echo   4. Check the console - you should see:
echo      "Connected to server"
echo.
echo   Press any key when the app is loaded...
pause >nul
echo.

echo [Step 3/5] Simulating deployment: Updating version to 1.0.1...
echo.

REM Change version to 1.0.1
powershell -Command "(Get-Content package.json) -replace '\"version\": \"1.0.0\"', '\"version\": \"1.0.1\"' | Set-Content package.json"
echo   Version changed: 1.0.0 -> 1.0.1
echo.

echo [Step 4/5] Restarting server (simulating Render auto-deploy)...
echo.

REM Kill the server
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 4001 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul
echo   Old server stopped
echo.

REM Start server again
echo   Starting new server with version 1.0.1
start /MIN powershell -NoProfile -ExecutionPolicy Bypass -Command "npm start"
timeout /t 3 /nobreak >nul
echo   New server started!
echo.

echo [Step 5/5] CHECK YOUR BROWSER NOW!
echo ========================================
echo.
echo You should see:
echo.
echo   [Purple Banner]
echo   * Icon: "🔄 App Update Available"
echo   * Message: "Version 1.0.0 -> 1.0.1. Refresh to update."
echo   * Button: "Refresh Now"
echo   * Button: "×" (dismiss)
echo.
echo Try these:
echo   1. Click "Refresh Now" - page reloads, banner disappears
echo   2. Or click "×" - banner dismisses for 5 minutes
echo   3. Or wait 5 minutes - banner reappears if dismissed
echo.
echo Console should show:
echo   "🔄 [Version] Update detected via SSE: 1.0.0 → 1.0.1"
echo.
echo ========================================
echo.
echo Press any key to clean up (restore version 1.0.0)...
pause >nul
echo.

echo [Cleanup] Restoring version 1.0.0...
powershell -Command "(Get-Content package.json) -replace '\"version\": \"1.0.1\"', '\"version\": \"1.0.0\"' | Set-Content package.json"
echo   Version restored to 1.0.0
echo.

echo [Cleanup] Restarting server...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 4001 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul
start /MIN powershell -NoProfile -ExecutionPolicy Bypass -Command "npm start"
timeout /t 3 /nobreak >nul
echo   Server restarted with version 1.0.0
echo.

echo ========================================
echo Test Complete!
echo.
echo The banner should disappear after you refresh (versions match again)
echo ========================================
echo.
cd ..


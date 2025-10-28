@echo off
REM Test Version Update Detection Feature

echo.
echo ========================================
echo Test Version Update Detection (WEB ONLY)
echo ========================================
echo.
echo NOTE: This tests port 4001 only (web interface)
echo       Port 4000 (add-in) is NOT started
echo.
echo To test with Word add-in:
echo   1. Open another terminal
echo   2. Run: cd addin
echo   3. Run: npm run dev-server
echo   4. Wait for port 4000 to start
echo.

REM Navigate to project root
cd /d "%~dp0..\.."

echo Step 1: Set version to 1.0.0
cd server
powershell -NoProfile -ExecutionPolicy Bypass -Command "$json = Get-Content package.json -Raw | ConvertFrom-Json; $json.version = '1.0.0'; $json | ConvertTo-Json -Depth 10 | Set-Content package.json"
echo Version set to 1.0.0
echo.

echo Step 2: Kill any existing servers and start fresh...
echo Killing all node processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul
echo All servers stopped
echo.

echo Starting server on https://localhost:4001...
start /B cmd /c "npm start"
timeout /t 5 /nobreak >nul
echo Server started
echo.

echo Step 3: Open your browser
echo   URL: https://localhost:4001
echo   Accept certificate warning
echo   Wait for app to load
echo.
echo Press any key when app is loaded...
pause >nul
echo.

echo Step 4: Changing version to 1.0.1 (simulating deploy)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$json = Get-Content package.json -Raw | ConvertFrom-Json; $json.version = '1.0.1'; $json | ConvertTo-Json -Depth 10 | Set-Content package.json"
echo Version changed to 1.0.1
echo.

echo Step 5: Restarting server...
echo Killing server...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul
echo Starting server with version 1.0.1...
start /B cmd /c "npm start"
timeout /t 5 /nobreak >nul
echo Server restarted
echo.

echo ========================================
echo CHECK YOUR BROWSER NOW
echo ========================================
echo.
echo You should see a PURPLE BANNER:
echo   "App Update Available"
echo   "Version 1.0.0 -^> 1.0.1. Refresh to update."
echo   [Refresh Now] [X]
echo.
echo Test these actions:
echo   1. Click "Refresh Now" - page reloads
echo   2. Click "X" - banner dismisses
echo.
echo ========================================
echo.
echo Press any key to clean up...
pause >nul
echo.

echo Cleanup: Restoring version 1.0.0...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$json = Get-Content package.json -Raw | ConvertFrom-Json; $json.version = '1.0.0'; $json | ConvertTo-Json -Depth 10 | Set-Content package.json"
echo Version restored
echo.

echo Cleanup: Stopping server...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul
echo Server stopped
echo.

echo Test complete!
cd ..


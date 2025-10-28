@echo off
REM Test Version Update Detection Feature

echo.
echo ========================================
echo Test Version Update Detection
echo ========================================
echo.

REM Navigate to project root
cd /d "%~dp0..\.."

echo Step 1: Set version to 1.0.0
cd server
powershell -NoProfile -ExecutionPolicy Bypass -Command "$json = Get-Content package.json -Raw | ConvertFrom-Json; $json.version = '1.0.0'; $json | ConvertTo-Json -Depth 10 | Set-Content package.json"
echo Version set to 1.0.0
echo.

echo Step 2: Starting server...
start /B cmd /c "npm start"
timeout /t 5 /nobreak >nul
echo Server started on https://localhost:4001
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
taskkill /F /FI "WindowTitle eq Administrator:*npm start*" /T >nul 2>&1
powershell -NoProfile -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object {$_.Path -like '*wordFTW*'} | Stop-Process -Force"
timeout /t 2 /nobreak >nul
start /B cmd /c "npm start"
timeout /t 5 /nobreak >nul
echo Server restarted with version 1.0.1
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
taskkill /F /FI "WindowTitle eq Administrator:*npm start*" /T >nul 2>&1
powershell -NoProfile -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object {$_.Path -like '*wordFTW*'} | Stop-Process -Force"
echo Server stopped
echo.

echo Test complete!
cd ..


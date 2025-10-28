@echo off
REM Test Version Update Detection Feature

echo.
echo ========================================
echo Test Version Update Detection
echo ========================================
echo.
echo This script will:
echo   1. Start both servers (4000 and 4001)
echo   2. Set version to 1.0.0
echo   3. Wait for you to open web + Word
echo   4. Change version to 1.0.1
echo   5. Restart backend
echo   6. You should see purple banner in BOTH
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

echo Step 2a: Starting add-in dev server (port 4000)...
cd ..\addin
start /MIN powershell -NoProfile -ExecutionPolicy Bypass -Command "npm run dev-server"
echo Add-in dev server starting on https://localhost:4000
timeout /t 3 /nobreak >nul
echo.

echo Step 2b: Starting backend server (port 4001)...
cd ..\server
start /B cmd /c "npm start"
timeout /t 5 /nobreak >nul
echo Backend server started on https://localhost:4001
echo.

echo Step 3: Open BOTH web and Word
echo.
echo   A. Web Browser:
echo      - URL: https://localhost:4001
echo      - Accept certificate warning
echo      - Wait for sidebar to load
echo.
echo   B. Word Add-in:
echo      - Open Word
echo      - Open any document
echo      - If add-in doesn't appear, sideload:
echo        cd addin
echo        npx office-addin-debugging start manifest.xml
echo.
echo Press any key when BOTH are loaded...
pause >nul
echo.

echo Step 4: Changing version to 1.0.1 (simulating deploy)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$json = Get-Content package.json -Raw | ConvertFrom-Json; $json.version = '1.0.1'; $json | ConvertTo-Json -Depth 10 | Set-Content package.json"
echo Version changed to 1.0.1
echo.

echo Step 5: Restarting both servers...
echo Killing all servers...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul
echo.
echo Restarting add-in dev server (port 4000)...
cd ..\addin
start /MIN powershell -NoProfile -ExecutionPolicy Bypass -Command "npm run dev-server"
timeout /t 3 /nobreak >nul
echo.
echo Restarting backend server (port 4001) with version 1.0.1...
cd ..\server
start /B cmd /c "npm start"
timeout /t 5 /nobreak >nul
echo Both servers restarted
echo.

echo ========================================
echo CHECK BOTH BROWSER AND WORD NOW
echo ========================================
echo.
echo You should see a PURPLE BANNER in BOTH:
echo   "App Update Available"
echo   "Version 1.0.0 -^> 1.0.1. Refresh to update."
echo   [Refresh Now] [X]
echo.
echo The banner appears at the TOP of the sidebar.
echo.
echo Test these actions:
echo   1. Click "Refresh Now" - page reloads, banner gone
echo   2. Click "X" - banner dismisses for 5 min
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


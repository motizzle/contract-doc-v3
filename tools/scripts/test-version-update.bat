@echo off
REM Test Version Update Detection Feature

echo.
echo ========================================
echo Test Version Update Detection + Release Notes
echo ========================================
echo.
echo This script will:
echo   1. Start both servers (4000 and 4001)
echo   2. Set version to 1.0.0 (no release notes)
echo   3. Wait for you to open web + Word
echo   4. Add release notes and change version to 1.0.1
echo   5. Restart backend
echo   6. You should see purple banner WITH release notes in BOTH
echo.

REM Navigate to project root
cd /d "%~dp0..\.."

echo Step 1: Set version to 1.0.0 and clear release notes
cd server
powershell -NoProfile -ExecutionPolicy Bypass -Command "$json = Get-Content package.json -Raw | ConvertFrom-Json; $json.version = '1.0.0'; $json | ConvertTo-Json -Depth 10 | Set-Content package.json"
if exist RELEASE_NOTES.txt del RELEASE_NOTES.txt
echo Version set to 1.0.0
echo Release notes cleared (testing empty state)
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

echo Step 4: Adding release notes and changing version to 1.0.1
echo Fixed critical bug where vendors couldn't access version 1 after being unshared. > RELEASE_NOTES.txt
echo. >> RELEASE_NOTES.txt
echo Improvements: >> RELEASE_NOTES.txt
echo - Version sharing now correctly handles vendor permissions >> RELEASE_NOTES.txt
echo - Auto-switch to accessible version when unshared >> RELEASE_NOTES.txt
echo - Updated app branding to "OpenGov Contracting" >> RELEASE_NOTES.txt
powershell -NoProfile -ExecutionPolicy Bypass -Command "$json = Get-Content package.json -Raw | ConvertFrom-Json; $json.version = '1.0.1'; $json | ConvertTo-Json -Depth 10 | Set-Content package.json"
echo Version changed to 1.0.1
echo Release notes added
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
echo You should see a PURPLE BANNER in BOTH with RELEASE NOTES:
echo.
echo   "App Update Available"
echo   "Version 1.0.0 -^> 1.0.1. Refresh to update."
echo.
echo   "Fixed critical bug where vendors couldn't access..."
echo   "Improvements:"
echo   "- Version sharing now correctly handles..."
echo   "- Auto-switch to accessible version..."
echo   "- Updated app branding..."
echo.
echo   [Refresh Now] [X]
echo.
echo The banner appears at the TOP of the sidebar.
echo The release notes should make the banner TALLER.
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

echo Cleanup: Restoring version 1.0.0 and removing test release notes...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$json = Get-Content package.json -Raw | ConvertFrom-Json; $json.version = '1.0.0'; $json | ConvertTo-Json -Depth 10 | Set-Content package.json"
if exist RELEASE_NOTES.txt del RELEASE_NOTES.txt
echo Version restored, release notes removed
echo.

echo Cleanup: Stopping server...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul
echo Server stopped
echo.

echo Test complete!
cd ..


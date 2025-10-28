@echo off
REM Test Version Update Detection Feature

echo.
echo ================================================================
echo Test Version Update Detection + Release Notes
echo ================================================================
echo.
echo This script tests the "App Update Available" banner that appears
echo when a new version is deployed.
echo.
echo WHAT THIS SCRIPT DOES:
echo   1. Starts servers at version 1.0.0 (no release notes)
echo   2. You open browser - verify NO banner appears
echo   3. Script bumps version to 1.0.1 and adds release notes
echo   4. Script restarts backend server
echo   5. You HARD REFRESH browser - purple banner appears
echo   6. You test banner buttons (dismiss, refresh)
echo   7. You close/reopen Word - banner appears in add-in too
echo.
echo ESTIMATED TIME: 5 minutes
echo.
echo Press any key to start...
pause >nul
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

echo ========================================
echo Step 3: OPEN BROWSER (DO NOT OPEN WORD YET)
echo ========================================
echo.
echo 1. Open browser: https://localhost:4001
echo 2. Accept certificate warning
echo 3. Wait for sidebar to fully load
echo 4. VERIFY: No banner should appear yet (versions match)
echo.
echo Press any key when browser is loaded and working...
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
echo CRITICAL: YOU MUST HARD REFRESH NOW
echo ========================================
echo.
echo WHY? Browser has cached the old HTML file.
echo      You need to force it to reload the page.
echo.
echo ----------------------------------------
echo ACTION 1: HARD REFRESH THE BROWSER
echo ----------------------------------------
echo.
echo   Windows: Press Ctrl+Shift+R (or Ctrl+F5)
echo   Mac: Press Cmd+Shift+R
echo.
echo   Wait 3-5 seconds for page to fully reload.
echo.
echo ----------------------------------------
echo WHAT YOU SHOULD SEE: PURPLE BANNER
echo ----------------------------------------
echo.
echo   Banner at TOP of sidebar:
echo.
echo   App Update Available
echo   Version 1.0.0 -^> 1.0.1. Refresh to update.
echo.
echo   Fixed critical bug where vendors couldn't
echo   access version 1 after being unshared.
echo.
echo   Improvements:
echo   - Version sharing now correctly handles...
echo   - Auto-switch to accessible version...
echo   - Updated app branding...
echo.
echo   [Refresh Now] [X]
echo.
echo ----------------------------------------
echo TEST THE BANNER BUTTONS
echo ----------------------------------------
echo.
echo   1. Click [X] - banner dismisses
echo   2. Hard refresh again (Ctrl+Shift+R)
echo   3. Banner reappears (good!)
echo   4. Click [Refresh Now] - page reloads, banner gone
echo.
echo Press any key when you've tested the BROWSER...
pause >nul
echo.
echo.
echo ========================================
echo NOW TEST THE WORD ADD-IN
echo ========================================
echo.
echo IMPORTANT: You must CLOSE and REOPEN Word
echo            Office caches add-in files aggressively.
echo.
echo ----------------------------------------
echo ACTION 2: CLOSE WORD COMPLETELY
echo ----------------------------------------
echo.
echo   1. Close ALL Word windows
echo   2. Check Task Manager - make sure WINWORD.EXE is gone
echo   3. Wait 3 seconds
echo.
echo Press any key when Word is FULLY CLOSED...
pause >nul
echo.
echo ----------------------------------------
echo ACTION 3: REOPEN WORD WITH ADD-IN
echo ----------------------------------------
echo.
echo   1. Open Word
echo   2. Open any document
echo   3. Add-in should load automatically
echo   4. If not, sideload: npx office-addin-debugging start manifest.xml
echo.
echo You should see the SAME PURPLE BANNER at the top.
echo.
echo Press any key when you've tested WORD...
pause >nul
echo.
echo ========================================
echo TEST COMPLETE - RESULTS
echo ========================================
echo.
echo If you saw the purple banner in BOTH browser and Word,
echo the feature is working correctly!
echo.
echo The banner should have shown:
echo   - Version change (1.0.0 -^> 1.0.1)
echo   - Release notes (bug fix + improvements)
echo   - [Refresh Now] and [X] buttons
echo.
echo ========================================
echo TROUBLESHOOTING
echo ========================================
echo.
echo BANNER DIDN'T APPEAR IN BROWSER?
echo   - Did you do Ctrl+Shift+R (hard refresh)?
echo   - Check console: Should see "Update detected via SSE"
echo   - Type in console: window.APP_VERSION (should be "1.0.0")
echo.
echo BANNER DIDN'T APPEAR IN WORD?
echo   - Did you fully close Word and reopen?
echo   - Check Task Manager: WINWORD.EXE should be gone
echo   - Try uninstalling/reinstalling add-in
echo.
echo BANNER APPEARED BUT NO RELEASE NOTES?
echo   - Check server/RELEASE_NOTES.txt exists
echo   - Check server console for file read errors
echo   - Check network tab: /api/v1/health should have releaseNotes
echo.
echo ========================================
echo.
echo Press any key to clean up and restore original state...
pause >nul
echo.

echo Cleanup: Restoring version 1.0.0 and removing test release notes...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$json = Get-Content package.json -Raw | ConvertFrom-Json; $json.version = '1.0.0'; $json | ConvertTo-Json -Depth 10 | Set-Content package.json"
if exist RELEASE_NOTES.txt del RELEASE_NOTES.txt
echo Version restored, release notes removed
echo.

echo Cleanup: Stopping all servers...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo All servers stopped
echo.

echo ================================================================
echo Test complete! Everything cleaned up.
echo ================================================================
cd ..


@echo off
setlocal enabledelayedexpansion

echo ========================================
echo WordFTW - Automated Test Suite
echo ========================================
echo.

:: Kill any existing node processes
echo Stopping any existing servers...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo.

:: Start backend server in background (TEST MODE)
echo Starting backend server (port 4001) in test mode...
cd "%~dp0..\..\server"
start /MIN cmd /c "set NODE_ENV=test&& npm start"
echo.

:: Wait for server to be ready (check health endpoint)
echo Waiting for server to start...
set RETRY=0
:WAIT_LOOP
timeout /t 2 /nobreak >nul
curl -k -s https://localhost:4001/api/v1/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Server is ready!
    goto SERVER_READY
)
set /A RETRY+=1
if %RETRY% LSS 15 (
    echo Retry %RETRY%/15...
    goto WAIT_LOOP
)
echo ERROR: Server failed to start after 30 seconds
echo.
echo Press any key to exit...
pause >nul
goto CLEANUP

:SERVER_READY
echo.
echo ========================================
echo Running Automated Tests
echo ========================================
echo.

:: Run API tests
echo [1/2] Running API tests (Jest)...
npm test
set API_RESULT=%ERRORLEVEL%
echo.

:: Run UI tests
echo [2/2] Running UI tests (Playwright)...
npm run test:ui
set UI_RESULT=%ERRORLEVEL%
echo.

:: Show results
echo ========================================
echo Test Results Summary
echo ========================================
if %API_RESULT% EQU 0 (
    echo API Tests: PASS
) else (
    echo API Tests: FAIL
)
if %UI_RESULT% EQU 0 (
    echo UI Tests: PASS
) else (
    echo UI Tests: FAIL
)
echo ========================================
echo.

:: Always pause to show results before cleanup
echo Press any key to cleanup and exit...
pause >nul

:CLEANUP
echo.
echo Cleaning up...
taskkill /F /IM node.exe >nul 2>&1
echo Done!
echo.
pause

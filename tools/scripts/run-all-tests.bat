@echo off
setlocal enabledelayedexpansion

echo ================================
echo  Running ALL Tests (Clean State)
echo ================================
echo.

set SCRIPT_DIR=%~dp0
set SERVER_DIR=%SCRIPT_DIR%..\..\server
set API_BASE=https://localhost:4001

echo [Step 0/4] Enabling Test Mode - Disconnecting SSE clients...
echo.

REM Enable test mode to prevent SSE broadcast conflicts with open browser tabs
curl -X POST %API_BASE%/api/v1/test-mode -H "Content-Type: application/json" -d "{\"enabled\":true}" -k --silent --show-error --fail >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo [OK] Test mode enabled - SSE broadcasts disabled
) else (
    echo [WARNING] Failed to enable test mode - server may not be running
)

echo.
timeout /t 1 /nobreak >nul
echo.

echo [Step 1/4] Factory Reset - Cleaning state...
echo.

REM Call factory reset endpoint
curl -X POST %API_BASE%/api/v1/factory-reset -H "Content-Type: application/json" -d "{\"userId\":\"test\"}" -k --silent --show-error --fail
set RESET_EXIT=!ERRORLEVEL!

if !RESET_EXIT! EQU 0 (
    echo [OK] Factory reset completed successfully
) else (
    echo [WARNING] Factory reset failed or server not running
    echo [INFO] Starting server may be required
    echo [INFO] Run: tools\scripts\start-servers.bat
    echo.
    echo Continue anyway? Tests may fail if state is not clean.
    pause
)

echo.
echo Waiting for state to stabilize...
timeout /t 2 /nobreak >nul

echo.
echo --------------------------------
echo.

REM Change to server directory
cd /d "%SERVER_DIR%"

echo [Step 2/4] Running Jest unit tests...
echo.
call npm test
set JEST_EXIT=!ERRORLEVEL!

echo.
echo --------------------------------
echo.

if !JEST_EXIT! EQU 0 (
    echo [PASS] Jest unit tests completed successfully
) else (
    echo [FAIL] Jest unit tests failed with exit code !JEST_EXIT!
    goto :END_SUMMARY
)

echo.
echo --------------------------------
echo.
echo [Step 3/4] Running Playwright E2E tests...
echo.

REM Check if Playwright is installed
if not exist "node_modules\@playwright" (
    echo Installing Playwright browsers...
    call npm run e2e:install
    echo.
)

call npm run e2e
set E2E_EXIT=!ERRORLEVEL!

echo.
echo --------------------------------
echo.

if !E2E_EXIT! EQU 0 (
    echo [PASS] Playwright E2E tests completed successfully
) else (
    echo [FAIL] Playwright E2E tests failed with exit code !E2E_EXIT!
)

:END_SUMMARY
echo.
echo ================================
echo   TEST SUMMARY
echo ================================
echo.

if !JEST_EXIT! EQU 0 if !E2E_EXIT! EQU 0 (
    echo Status: ALL TESTS PASSED
    echo.
    echo - Factory Reset: OK
    echo - Jest Tests: PASS ^(!JEST_EXIT!^)
    echo - Playwright Tests: PASS ^(!E2E_EXIT!^)
    echo.
    echo ================================
    echo   READY TO COMMIT/MERGE!
    echo ================================
) else (
    echo Status: SOME TESTS FAILED
    echo.
    if !JEST_EXIT! NEQ 0 (
        echo - Jest Tests: FAIL ^(Exit Code: !JEST_EXIT!^)
    ) else (
        echo - Jest Tests: PASS
    )
    if !E2E_EXIT! NEQ 0 (
        echo - Playwright Tests: FAIL ^(Exit Code: !E2E_EXIT!^)
    ) else (
        echo - Playwright Tests: PASS
    )
    echo.
    echo ================================
    echo   DO NOT MERGE
    echo ================================
    echo.
    echo To debug, run with report:
    echo   tools\scripts\run-tests-report.bat
)

echo.
echo --------------------------------
echo.
echo [Final Step] Disabling Test Mode - Re-enabling SSE broadcasts...
curl -X POST %API_BASE%/api/v1/test-mode -H "Content-Type: application/json" -d "{\"enabled\":false}" -k --silent --show-error --fail >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo [OK] Test mode disabled - SSE broadcasts re-enabled
) else (
    echo [WARNING] Failed to disable test mode
)

echo.
echo (Press any key to close this window)
pause >nul

REM Exit with failure code if any tests failed
if !JEST_EXIT! NEQ 0 exit /b 1
if !E2E_EXIT! NEQ 0 exit /b 1
exit /b 0


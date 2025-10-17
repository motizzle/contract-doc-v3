@echo off
setlocal enabledelayedexpansion

echo ================================
echo  Running Tests with Report
echo ================================
echo.

set SCRIPT_DIR=%~dp0
set SERVER_DIR=%SCRIPT_DIR%..\..\server
set REPORT_DIR=%SCRIPT_DIR%..\..\test-results

REM Create report directory
if not exist "%REPORT_DIR%" mkdir "%REPORT_DIR%"

REM Generate timestamp for report filename
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%-%datetime:~8,6%
set REPORT_FILE=%REPORT_DIR%\test-report-%TIMESTAMP%.md

echo Creating test report: %REPORT_FILE%
echo.

REM Factory reset first
set API_BASE=https://localhost:4001
echo [Pre-Test] Factory Reset - Cleaning state...
curl -X POST %API_BASE%/api/v1/factory-reset -H "Content-Type: application/json" -d "{\"userId\":\"test\"}" -k --silent --show-error --fail >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo [OK] Factory reset completed
) else (
    echo [WARNING] Factory reset failed - server may not be running
)
timeout /t 2 /nobreak >nul
echo.

REM Initialize report
(
echo # Test Report
echo.
echo **Date:** %date% %time%
echo **Branch:** 
git rev-parse --abbrev-ref HEAD 2^>nul
echo **Commit:** 
git rev-parse --short HEAD 2^>nul
echo.
echo ---
echo.
) > "%REPORT_FILE%"

REM Change to server directory
cd /d "%SERVER_DIR%"

echo [1/2] Running Jest unit tests...
echo.

REM Run Jest and capture output
call npm test > "%REPORT_DIR%\jest-output.txt" 2>&1
set JEST_EXIT=!ERRORLEVEL!

REM Append Jest results to report
(
echo ## Jest Unit Tests
echo.
if !JEST_EXIT! EQU 0 (
    echo ### ✅ PASSED
) else (
    echo ### ❌ FAILED ^(Exit Code: !JEST_EXIT!^)
)
echo.
echo ^`^`^`
type "%REPORT_DIR%\jest-output.txt"
echo ^`^`^`
echo.
echo ---
echo.
) >> "%REPORT_FILE%"

if !JEST_EXIT! EQU 0 (
    echo [PASS] Jest tests completed successfully
) else (
    echo [FAIL] Jest tests failed
)

echo.
echo --------------------------------
echo.
echo [2/2] Running Playwright E2E tests...
echo.

REM Check if Playwright is installed
if not exist "node_modules\@playwright" (
    echo Installing Playwright browsers...
    call npm run e2e:install > "%REPORT_DIR%\playwright-install.txt" 2>&1
    echo.
)

REM Run Playwright and capture output
call npm run e2e > "%REPORT_DIR%\playwright-output.txt" 2>&1
set E2E_EXIT=!ERRORLEVEL!

REM Append Playwright results to report
(
echo ## Playwright E2E Tests
echo.
if !E2E_EXIT! EQU 0 (
    echo ### ✅ PASSED
) else (
    echo ### ❌ FAILED ^(Exit Code: !E2E_EXIT!^)
)
echo.
echo ^`^`^`
type "%REPORT_DIR%\playwright-output.txt"
echo ^`^`^`
echo.
echo ---
echo.
) >> "%REPORT_FILE%"

if !E2E_EXIT! EQU 0 (
    echo [PASS] Playwright E2E tests completed successfully
) else (
    echo [FAIL] Playwright E2E tests failed
)

echo.
echo --------------------------------
echo.

REM Summary
if !JEST_EXIT! EQU 0 if !E2E_EXIT! EQU 0 (
    (
    echo ## Summary
    echo.
    echo ### 🎉 ALL TESTS PASSED!
    echo.
    echo - Jest Unit Tests: ✅ PASSED
    echo - Playwright E2E Tests: ✅ PASSED
    ) >> "%REPORT_FILE%"
    
    echo ================================
    echo   ALL TESTS PASSED!
    echo ================================
) else (
    (
    echo ## Summary
    echo.
    echo ### ⚠️ SOME TESTS FAILED
    echo.
    if !JEST_EXIT! NEQ 0 (
        echo - Jest Unit Tests: ❌ FAILED
    ) else (
        echo - Jest Unit Tests: ✅ PASSED
    )
    if !E2E_EXIT! NEQ 0 (
        echo - Playwright E2E Tests: ❌ FAILED
    ) else (
        echo - Playwright E2E Tests: ✅ PASSED
    )
    echo.
    echo ### Next Steps
    echo.
    echo 1. Review the test output above
    echo 2. Share this report with the team: `%REPORT_FILE%`
    echo 3. Fix failing tests
    echo 4. Re-run tests
    ) >> "%REPORT_FILE%"
    
    echo ================================
    echo   SOME TESTS FAILED
    echo ================================
)

echo.
echo Report saved to:
echo %REPORT_FILE%
echo.
echo You can share this file with the team for debugging.
echo.

REM Clean up temp files
del "%REPORT_DIR%\jest-output.txt" 2>nul
del "%REPORT_DIR%\playwright-output.txt" 2>nul
del "%REPORT_DIR%\playwright-install.txt" 2>nul

echo (Press any key to close this window)
pause >nul


@echo off
setlocal

echo ================================
echo  Running Automated Test Suite
echo ================================
echo.

set SCRIPT_DIR=%~dp0
set SERVER_DIR=%SCRIPT_DIR%..\..\server

REM Change to server directory
cd /d "%SERVER_DIR%"

echo [1/2] Running Jest unit tests...
echo.
call npm test
set JEST_EXIT=%ERRORLEVEL%

echo.
echo --------------------------------
echo.

if %JEST_EXIT% EQU 0 (
    echo [PASS] Jest unit tests completed successfully
) else (
    echo [FAIL] Jest unit tests failed with exit code %JEST_EXIT%
    echo.
    echo To see detailed output, run: cd server ^&^& npm test
    goto :END
)

echo.
echo --------------------------------
echo.
echo [2/2] Running Playwright E2E tests...
echo.

REM Check if Playwright is installed
if not exist "node_modules\@playwright" (
    echo Playwright not installed. Installing browsers...
    call npm run e2e:install
    echo.
)

call npm run e2e
set E2E_EXIT=%ERRORLEVEL%

echo.
echo --------------------------------
echo.

if %E2E_EXIT% EQU 0 (
    echo [PASS] Playwright E2E tests completed successfully
) else (
    echo [FAIL] Playwright E2E tests failed with exit code %E2E_EXIT%
    echo.
    echo To see detailed output, run: cd server ^&^& npm run e2e
    goto :END
)

echo.
echo ================================
echo   ALL TESTS PASSED!
echo ================================
echo.

:END
echo.
echo (Press any key to close this window)
pause >nul


@echo off
setlocal

echo ================================
echo  Quick Test (Jest Only)
echo ================================
echo.

set SCRIPT_DIR=%~dp0
set SERVER_DIR=%SCRIPT_DIR%..\..\server

REM Change to server directory
cd /d "%SERVER_DIR%"

echo Running Jest unit tests...
echo.
call npm test

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================
    echo   TESTS PASSED!
    echo ================================
) else (
    echo.
    echo ================================
    echo   TESTS FAILED!
    echo ================================
    echo.
    echo Exit code: %ERRORLEVEL%
)

echo.
echo (Press any key to close this window)
pause >nul


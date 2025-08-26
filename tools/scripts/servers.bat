@echo off
setlocal ENABLEEXTENSIONS ENABLEDELAYEDEXPANSION
set SCRIPT_DIR=%~dp0

:menu
echo.
echo === Servers ===
echo 1^) start
echo 2^) stop
echo 3^) status
echo 4^) exit
set /p choice=Select 1-4: 

if "%choice%"=="1" set ACTION=start
if "%choice%"=="2" set ACTION=stop
if "%choice%"=="3" set ACTION=status
if "%choice%"=="4" goto :end

if not defined ACTION (
  echo Invalid choice.
  set "choice="
  goto :menu
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%servers.ps1" -Action !ACTION!
set "ACTION="
set "choice="
goto :menu

:end
endlocal
exit /b 0



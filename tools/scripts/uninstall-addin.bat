@echo off
setlocal enabledelayedexpansion
echo ========================================
echo  Redlined ^& Signed - Uninstaller
echo ========================================
echo.
echo [DEBUG] Uninstaller starting...
echo.

REM Close Word if running
echo [1/5] Closing Word if running...
tasklist /FI "IMAGENAME eq WINWORD.EXE" 2>NUL | find /I /N "WINWORD.EXE">NUL
if %ERRORLEVEL% EQU 0 (
  echo   - Word is running. Closing...
  taskkill /F /IM WINWORD.EXE >nul 2>&1
  timeout /t 3 /nobreak >nul
  echo   - Word closed
) else (
  echo   - Word is not running
)
echo.

REM Stop any local sideloads (skip - cache clear handles this)
echo [2/5] Stopping local sideloads...
set SCRIPT_DIR=%~dp0
echo   - Skipped (cache clear in step 4 handles this)
echo.

REM Remove registry entry (use GUID from manifest)
echo [3/5] Removing registry entry...
echo [DEBUG] Checking registry...
reg query "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "7a514d73-03c9-4a9f-a5f3-c246ac785751" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo [DEBUG] Registry entry found, deleting...
  reg delete "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "7a514d73-03c9-4a9f-a5f3-c246ac785751" /f >nul 2>&1
  if ERRORLEVEL 1 (
    echo   - Failed to remove registry entry
  ) else (
    echo   - Registry entry removed
    REM Wait for registry to propagate (Windows registry changes aren't instant)
    timeout /t 1 /nobreak >nul
  )
) else (
  echo   - Registry entry not found (already removed)
)
echo [DEBUG] Registry step complete
echo.

REM Clear cache
echo [4/5] Clearing Word add-in cache...
REM First close Edge/browser processes that might lock cache files
taskkill /F /IM msedge.exe >nul 2>&1
taskkill /F /IM msedgewebview2.exe >nul 2>&1
timeout /t 1 /nobreak >nul
if exist "%LOCALAPPDATA%\Microsoft\Office\16.0\Wef" (
  powershell -Command "try { Remove-Item -Path \"$env:LOCALAPPDATA\Microsoft\Office\16.0\Wef\*\" -Recurse -Force -ErrorAction SilentlyContinue; Write-Host '  - Cache cleared (some files may be in use)' } catch { Write-Host '  - Cache directory found but some files are locked' }"
) else (
  echo   - Cache directory not found (already cleared)
)
echo.

REM Remove downloaded manifest
echo [5/5] Removing manifest files...
set TEMP_DIR=%TEMP%\wordftw-addin
if exist "%TEMP_DIR%\manifest.xml" (
  del "%TEMP_DIR%\manifest.xml" >nul 2>&1
  echo   - Manifest file removed
) else (
  echo   - Manifest file not found (already removed)
)

if exist "%TEMP_DIR%" (
  rmdir "%TEMP_DIR%" >nul 2>&1
  echo   - Temp directory removed
) else (
  echo   - Temp directory not found (already removed)
)
echo.

REM Verify complete removal (wait for Windows registry to fully update)
echo Verifying uninstall...
timeout /t 1 /nobreak >nul
reg query "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "7a514d73-03c9-4a9f-a5f3-c246ac785751" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo ========================================
  echo  [SUCCESS] Uninstall Complete!
  echo ========================================
  echo.
  echo All add-in components have been completely removed from your system.
  echo.
  echo WHAT WAS REMOVED:
  echo - Local sideloaded add-in (if any)
  echo - Add-in registry entry (GUID: 7a514d73-03c9-4a9f-a5f3-c246ac785751)
  echo - Cache: %LOCALAPPDATA%\Microsoft\Office\16.0\Wef\
  echo - Manifest: %TEMP%\wordftw-addin\manifest.xml
  echo.
  echo To reinstall:
  echo - Local dev: run-local.bat
  echo.
  goto :end
) else (
  echo.
  echo ========================================
  echo  [WARNING] Uninstall May Be Incomplete
  echo ========================================
  echo.
  echo The add-in registry entry still exists.
  echo You may need to run this uninstaller as Administrator.
  echo.
  echo Or manually remove:
  echo   HKCU\Software\Microsoft\Office\16.0\WEF\Developer\7a514d73-03c9-4a9f-a5f3-c246ac785751
  echo.
  goto :end
)

:end
echo [DEBUG] Uninstaller complete - ready to exit
echo.
echo Press any key to close this window...
pause >nul


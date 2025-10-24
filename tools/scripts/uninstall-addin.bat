@echo off
echo ========================================
echo  Redlined ^& Signed - Uninstaller
echo ========================================
echo.

REM Close Word if running
echo Closing Word if running...
tasklist /FI "IMAGENAME eq WINWORD.EXE" 2>NUL | find /I /N "WINWORD.EXE">NUL
if %ERRORLEVEL% EQU 0 (
  echo Word is running. Closing...
  taskkill /F /IM WINWORD.EXE >nul 2>&1
  timeout /t 3 /nobreak >nul
  echo Word closed.
) else (
  echo Word is not running.
)
echo.

REM Remove registry entry
echo Removing registry entry...
reg query "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "wordftw-addin-prod" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  reg delete "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "wordftw-addin-prod" /f >nul 2>&1
  if %ERRORLEVEL% EQU 0 (
    echo ✓ Registry entry removed
  ) else (
    echo ✗ Failed to remove registry entry
  )
) else (
  echo ℹ Registry entry not found (already removed or never installed)
)
echo.

REM Clear cache
echo Clearing Word add-in cache...
if exist "%LOCALAPPDATA%\Microsoft\Office\16.0\Wef" (
  powershell -Command "try { Remove-Item -Path '$env:LOCALAPPDATA\Microsoft\Office\16.0\Wef\*' -Recurse -Force -ErrorAction Stop; Write-Host '✓ Cache cleared' } catch { Write-Host '✗ Failed to clear cache:' $_.Exception.Message; exit 1 }"
) else (
  echo ℹ Cache directory not found (already cleared)
)
echo.

REM Remove downloaded manifest
echo Removing manifest files...
set TEMP_DIR=%TEMP%\wordftw-addin
if exist "%TEMP_DIR%\manifest.xml" (
  del "%TEMP_DIR%\manifest.xml" >nul 2>&1
  echo ✓ Manifest file removed
) else (
  echo ℹ Manifest file not found (already removed)
)

if exist "%TEMP_DIR%" (
  rmdir "%TEMP_DIR%" >nul 2>&1
  echo ✓ Temp directory removed
) else (
  echo ℹ Temp directory not found (already removed)
)
echo.

REM Verify complete removal
echo Verifying uninstall...
reg query "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "wordftw-addin-prod" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo ========================================
  echo  ✓ Uninstall Complete!
  echo ========================================
  echo.
  echo The add-in has been completely removed from your system.
  echo.
  echo WHAT WAS REMOVED:
  echo - Registry entry: HKCU\...\WEF\Developer\wordftw-addin-prod
  echo - Cache: %LOCALAPPDATA%\Microsoft\Office\16.0\Wef\
  echo - Manifest: %TEMP%\wordftw-addin\manifest.xml
  echo.
  echo You can reinstall it at any time by running install-addin.bat
) else (
  echo.
  echo ========================================
  echo  ⚠ Uninstall May Be Incomplete
  echo ========================================
  echo.
  echo The registry entry still exists.
  echo You may need to run this uninstaller as Administrator.
  echo.
  echo Or manually remove:
  echo HKCU\Software\Microsoft\Office\16.0\WEF\Developer\wordftw-addin-prod
)
echo.
pause


@echo off
echo ========================================
echo  Redlined ^& Signed - Word Add-in Installer
echo ========================================
echo.
echo This will install the Word add-in...
echo.

REM Close Word if it's running (MUST be closed before registry changes)
echo Closing Word if running...
taskkill /F /IM WINWORD.EXE >nul 2>&1
timeout /t 2 /nobreak >nul

REM Download manifest to temp location
echo Downloading manifest...
set TEMP_DIR=%TEMP%\wordftw-addin
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"
powershell -Command "Invoke-WebRequest -Uri 'https://wordftw.onrender.com/manifest.xml' -OutFile '%TEMP_DIR%\manifest.xml'"

REM Register manifest directly via Developer registry key
echo Registering add-in...
set MANIFEST_PATH=%TEMP_DIR%\manifest.xml
set ADDIN_ID=wordftw-addin-prod

REM Office 2016/2019/2021/365 (16.0)
reg add "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "%ADDIN_ID%" /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1

REM Office 2013 (15.0) - fallback
reg add "HKCU\Software\Microsoft\Office\15.0\WEF\Developer" /v "%ADDIN_ID%" /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1

echo.
echo ========================================
echo  Installation Complete!
echo ========================================
echo.
echo Downloading document and opening Word...
echo.

REM Download the default document from the server
set DOC_PATH=%TEMP%\wordftw-document.docx

powershell -Command "try { Invoke-WebRequest -Uri 'https://wordftw.onrender.com/documents/working/default.docx' -OutFile '%DOC_PATH%' -ErrorAction Stop; Write-Host '  Document downloaded' } catch { Write-Host '  Download failed'; exit 1 }"

REM Open Word with the downloaded document
if exist "%DOC_PATH%" (
  start winword.exe "%DOC_PATH%"
  timeout /t 2 /nobreak >nul
  echo.
  echo ========================================
  echo  Next Steps: Activate the Add-in
  echo ========================================
  echo.
  echo Word is now open with your document.
  echo.
  echo TO ACTIVATE THE ADD-IN ^(first time only^):
  echo   1. In Word, click the "Insert" tab
  echo   2. Click "Get Add-ins" or "My Add-ins"
  echo   3. Click "Developer Add-ins" at the top
  echo   4. Click "Redlined ^& Signed"
  echo.
  echo The add-in panel will appear on the right side.
  echo After this first activation, it will remember your choice.
  echo.
) else (
  echo.
  echo [ERROR] Could not download document from server.
  echo Please check your internet connection.
  echo.
  start winword.exe
)

echo Press any key to close this window...
pause >nul
exit /b 0


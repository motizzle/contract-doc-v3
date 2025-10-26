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
echo The add-in has been registered and will appear in:
echo Insert ^> My Add-ins ^> Developer Add-ins
echo.
echo Press any key to open Word with a blank document...
pause >nul

REM Download the default document from the server
echo Downloading document...
set DOC_PATH=%TEMP%\wordftw-document.docx

powershell -Command "try { Invoke-WebRequest -Uri 'https://wordftw.onrender.com/documents/working/default.docx' -OutFile '%DOC_PATH%' -ErrorAction Stop } catch { exit 1 }"

REM Open Word with the downloaded document (add-in will auto-load)
if exist "%DOC_PATH%" (
  echo Opening Word with document...
  start winword.exe "%DOC_PATH%"
) else (
  echo Could not download document, opening Word normally...
  echo You can open a document manually to activate the add-in.
  start winword.exe
)

exit /b 0


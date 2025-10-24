# Word Add-in Installation Hardening

**Status:** 📋 Planned  
**Priority:** High  
**Last Updated:** October 24, 2025  
**Platforms:** Windows, macOS  
**Related:** `operations/installation.md`, `automated-testing-suite.md`

---

## Problem Statement

The current Word add-in installation process works but lacks robustness:
- ❌ No dependency checking (Node.js, npx, Office version)
- ❌ No duplicate installation detection
- ❌ No validation of downloaded manifest
- ❌ Generic error messages without actionable steps
- ❌ No installation verification
- ❌ No cleanup of failed installations
- ❌ No automated testing of install/uninstall flows

**User Impact:**
- Users encounter cryptic errors with no guidance
- Duplicate registrations cause conflicts
- Failed installations leave system in broken state
- No way to verify installation succeeded

---

## Goals

### Primary Goals
1. **Bulletproof Installation**: Handle all edge cases gracefully
2. **Clear Error Messages**: Every error has actionable resolution steps
3. **Automated Testing**: Comprehensive test coverage for install/uninstall
4. **Self-Healing**: Detect and fix common issues automatically

### Non-Goals (Out of Scope)
- ❌ Auto-update mechanism (future feature)
- ❌ Telemetry/analytics (future feature)
- ❌ Multi-language support (English only for now)
- ❌ Silent/unattended installation (requires user interaction)

---

## Platform-Specific Implementation Summary

| Feature | Windows | macOS |
|---------|---------|-------|
| **Registration Method** | Registry (`HKCU\...\WEF\Developer`) | `defaults` command (plist) |
| **Manifest Storage** | `%TEMP%\wordftw-addin\` | `~/.wordftw-addin/` |
| **Cache Location** | `%LOCALAPPDATA%\Microsoft\Office\16.0\Wef` | `~/Library/Containers/com.microsoft.Word/Data/Library/Caches` |
| **Office Detection** | Registry query | Check `/Applications/Microsoft Word.app` |
| **Word Process Check** | `tasklist` + `taskkill` | `pgrep` + `osascript quit` |
| **Network Check** | PowerShell `Invoke-WebRequest` | `curl` |
| **XML Validation** | PowerShell `[xml]` parser | `xmllint` + `grep` |
| **Backup Method** | Registry export (`.reg` file) | `defaults read` (plist dump) |
| **Shell** | Batch (`.bat`) | Bash (`.command`) |
| **File Permissions** | Not typically needed | Needs execute: `chmod +x` |

---

## Hardening Areas

### 1. OS Detection & Platform-Specific Setup

#### A. OS Detection (Windows)

**Detect OS at start of installer:**
```batch
@echo off
setlocal enabledelayedexpansion

REM Detect OS
set "OS_TYPE=Windows"
ver | findstr /i "Windows" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] This installer is for Windows only
  echo For macOS, use install-addin.command
  pause
  exit /b 1
)

REM Detect Windows version
for /f "tokens=4-5 delims=. " %%i in ('ver') do set VERSION=%%i.%%j
echo Detected: Windows %VERSION%
```

#### B. OS Detection (macOS)

**Detect OS at start of installer:**
```bash
#!/bin/bash

# Detect OS
OS_TYPE=$(uname -s)
if [ "$OS_TYPE" != "Darwin" ]; then
  echo "[ERROR] This installer is for macOS only"
  echo "For Windows, use install-addin.bat"
  exit 1
fi

# Detect macOS version
OS_VERSION=$(sw_vers -productVersion)
echo "Detected: macOS $OS_VERSION"
```

---

### 2. Pre-Installation Checks

#### A. Dependency Validation

**Check for Node.js (Windows):**
```batch
REM Check Node.js version
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Node.js not found!
  echo.
  echo RESOLUTION:
  echo 1. Download Node.js from https://nodejs.org/
  echo 2. Install Node.js 18 or higher
  echo 3. Run this installer again
  pause
  exit /b 1
)
```

**Check for Node.js (macOS):**
```bash
# Check Node.js version
if ! command -v node &> /dev/null; then
  echo "[ERROR] Node.js not found!"
  echo ""
  echo "RESOLUTION:"
  echo "1. Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
  echo "2. Install Node.js: brew install node"
  echo "3. Run this installer again"
  read -p "Press enter to exit..."
  exit 1
fi
```

**Check npx availability (Windows):**
```batch
REM Check if npx is available
npx --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] npx not found!
  echo.
  echo RESOLUTION:
  echo 1. Reinstall Node.js from https://nodejs.org/
  echo 2. Ensure npm is included in installation
  pause
  exit /b 1
)
```

**Check npx availability (macOS):**
```bash
# Check if npx is available
if ! command -v npx &> /dev/null; then
  echo "[ERROR] npx not found!"
  echo ""
  echo "RESOLUTION:"
  echo "1. Reinstall Node.js: brew reinstall node"
  echo "2. Ensure npm is included"
  read -p "Press enter to exit..."
  exit 1
fi
```

**Check Office version (Windows):**
```batch
REM Check if Office 16.0 (2016+) is installed
reg query "HKCU\Software\Microsoft\Office\16.0" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [WARNING] Office 2016 or higher not detected
  echo.
  echo The add-in requires Microsoft Office 2016 or higher.
  echo If you have Office installed, you may need to repair the installation.
  echo.
  echo Continue anyway? (Y/N)
  choice /C YN /N
  if %ERRORLEVEL% EQU 2 exit /b 1
)
```

**Check Office version (macOS):**
```bash
# Check if Microsoft Office is installed
if [ ! -d "/Applications/Microsoft Word.app" ]; then
  echo "[WARNING] Microsoft Word not detected"
  echo ""
  echo "The add-in requires Microsoft Office 2016 or higher (Mac)."
  echo "If you have Office installed, the path may be different."
  echo ""
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Check Office version if possible
if [ -f "/Applications/Microsoft Word.app/Contents/Info.plist" ]; then
  OFFICE_VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "/Applications/Microsoft Word.app/Contents/Info.plist" 2>/dev/null)
  echo "Detected Office version: $OFFICE_VERSION"
fi
```

**Check PowerShell for cache clearing (Windows only):**
```batch
REM Verify PowerShell is available (for cache clearing)
powershell -Command "exit 0" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [WARNING] PowerShell not available
  echo Cache clearing may not work properly
  echo.
  pause
)
```

**macOS Note:** macOS uses bash/zsh natively, no PowerShell check needed.

#### B. Existing Installation Detection

**Check for existing registry entries (Windows):**
```batch
REM Check if add-in already installed
reg query "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "wordftw-addin-prod" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo [DETECTED] Existing installation found
  echo.
  echo Would you like to:
  echo [1] Reinstall (recommended - cleans old version)
  echo [2] Repair (keep existing registration)
  echo [3] Cancel
  echo.
  choice /C 123 /N
  if %ERRORLEVEL% EQU 3 exit /b 0
  if %ERRORLEVEL% EQU 1 goto :CLEAN_INSTALL
  if %ERRORLEVEL% EQU 2 goto :REPAIR_INSTALL
)
```

**Check for existing installation (macOS):**
```bash
# Check if add-in already registered via defaults
EXISTING_MANIFEST=$(defaults read com.microsoft.Word wef.developer.manifests.wordftw-addin-prod 2>/dev/null)
if [ -n "$EXISTING_MANIFEST" ]; then
  echo "[DETECTED] Existing installation found at:"
  echo "$EXISTING_MANIFEST"
  echo ""
  echo "Would you like to:"
  echo "[1] Reinstall (recommended - cleans old version)"
  echo "[2] Repair (keep existing registration)"
  echo "[3] Cancel"
  echo ""
  read -p "Choose option (1-3): " -n 1 -r
  echo
  case $REPLY in
    1) echo "Reinstalling..." ;;
    2) echo "Repairing..." ;;
    3) exit 0 ;;
    *) echo "Invalid choice, exiting"; exit 1 ;;
  esac
fi
```

**Check for Wef cache directory (Windows):**
```batch
REM Check for cached add-in files
if exist "%LOCALAPPDATA%\Microsoft\Office\16.0\Wef" (
  echo [DETECTED] Cached add-in files found
  echo Clearing cache for fresh installation...
  REM Will clear cache during installation
)
```

**Check for cache directory (macOS):**
```bash
# Check for cached add-in files
MAC_CACHE_DIR="$HOME/Library/Containers/com.microsoft.Word/Data/Library/Caches"
if [ -d "$MAC_CACHE_DIR" ]; then
  echo "[DETECTED] Cached add-in files found"
  echo "Clearing cache for fresh installation..."
  # Will clear cache during installation
fi
```

#### C. Network Connectivity

**Test server reachability (Windows):**
```batch
REM Check if server is reachable
echo Checking server connection...
powershell -Command "try { Invoke-WebRequest -Uri 'https://wordftw.onrender.com/api/v1/health' -Method GET -TimeoutSec 10 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Cannot reach server at https://wordftw.onrender.com
  echo.
  echo RESOLUTION:
  echo 1. Check your internet connection
  echo 2. Verify the server is running
  echo 3. Check if firewall is blocking the connection
  echo.
  echo Retry? (Y/N)
  choice /C YN /N
  if %ERRORLEVEL% EQU 1 goto :CHECK_NETWORK
  exit /b 1
)
echo Server connection OK
```

**Test server reachability (macOS):**
```bash
# Check if server is reachable
echo "Checking server connection..."
if ! curl -f -s -m 10 "https://wordftw.onrender.com/api/v1/health" > /dev/null 2>&1; then
  echo "[ERROR] Cannot reach server at https://wordftw.onrender.com"
  echo ""
  echo "RESOLUTION:"
  echo "1. Check your internet connection"
  echo "2. Verify the server is running"
  echo "3. Check if firewall is blocking the connection"
  echo ""
  read -p "Retry? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Retry logic here
    :
  else
    exit 1
  fi
fi
echo "Server connection OK"
```

---

### 3. Installation Process Hardening

#### A. Manifest Download Validation

**Download with error handling (Windows):**
```batch
REM Download manifest with validation
echo Downloading add-in manifest...
set TEMP_DIR=%TEMP%\wordftw-addin
if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

powershell -Command "$ProgressPreference = 'SilentlyContinue'; try { Invoke-WebRequest -Uri 'https://wordftw.onrender.com/manifest.xml' -OutFile '%TEMP_DIR%\manifest.xml' -ErrorAction Stop } catch { Write-Host 'Download failed:' $_.Exception.Message; exit 1 }"
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Failed to download manifest
  echo.
  echo RESOLUTION:
  echo 1. Check your internet connection
  echo 2. Verify the server is online at https://wordftw.onrender.com
  echo 3. Try again later
  pause
  exit /b 1
)
```

**Download with error handling (macOS):**
```bash
# Download manifest with validation
echo "Downloading add-in manifest..."
TEMP_DIR="$HOME/.wordftw-addin"
mkdir -p "$TEMP_DIR"

if ! curl -f -s -o "$TEMP_DIR/manifest.xml" "https://wordftw.onrender.com/manifest.xml"; then
  echo "[ERROR] Failed to download manifest"
  echo ""
  echo "RESOLUTION:"
  echo "1. Check your internet connection"
  echo "2. Verify the server is online at https://wordftw.onrender.com"
  echo "3. Try again later"
  read -p "Press enter to exit..."
  exit 1
fi
echo "Manifest downloaded successfully"
```

**Validate manifest content (Windows):**
```batch
REM Verify manifest is valid XML
powershell -Command "try { [xml]$xml = Get-Content '%TEMP_DIR%\manifest.xml'; if ($xml.OfficeApp.Id -eq $null) { exit 1 } exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Downloaded manifest is invalid or corrupted
  echo.
  echo RESOLUTION:
  echo 1. Try downloading again
  echo 2. Contact support if problem persists
  del "%TEMP_DIR%\manifest.xml" >nul 2>&1
  pause
  exit /b 1
)
echo Manifest validated successfully
```

**Validate manifest content (macOS):**
```bash
# Verify manifest is valid XML
if ! xmllint --noout "$TEMP_DIR/manifest.xml" 2>/dev/null; then
  echo "[ERROR] Downloaded manifest is invalid or corrupted"
  echo ""
  echo "RESOLUTION:"
  echo "1. Try downloading again"
  echo "2. Contact support if problem persists"
  rm -f "$TEMP_DIR/manifest.xml"
  read -p "Press enter to exit..."
  exit 1
fi

# Verify it has OfficeApp structure
if ! grep -q "OfficeApp" "$TEMP_DIR/manifest.xml"; then
  echo "[ERROR] Manifest structure is invalid"
  rm -f "$TEMP_DIR/manifest.xml"
  read -p "Press enter to exit..."
  exit 1
fi

echo "Manifest validated successfully"
```

#### B. Registration Operations Safety

**Backup before modification (Windows - Registry):**
```batch
REM Backup registry key before modification
echo Creating registry backup...
reg export "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" "%TEMP_DIR%\registry_backup.reg" /y >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo Registry backup created: %TEMP_DIR%\registry_backup.reg
)
```

**Atomic registry update (Windows):**
```batch
REM Remove old entry first
reg delete "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "wordftw-addin-prod" /f >nul 2>&1

REM Add new entry
set MANIFEST_PATH=%TEMP_DIR%\manifest.xml
reg add "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "wordftw-addin-prod" /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Failed to register add-in
  echo.
  echo RESOLUTION:
  echo 1. Run this installer as Administrator
  echo 2. Check if registry is locked by another program
  echo 3. Restore backup: %TEMP_DIR%\registry_backup.reg
  pause
  exit /b 1
)
echo Add-in registered successfully
```

**Backup before modification (macOS - defaults):**
```bash
# Backup existing preferences
echo "Creating backup of existing preferences..."
BACKUP_FILE="$TEMP_DIR/word_preferences_backup.plist"
defaults read com.microsoft.Word > "$BACKUP_FILE" 2>/dev/null || echo "No existing preferences to backup"
```

**Atomic defaults update (macOS):**
```bash
# Remove old entry first (if exists)
defaults delete com.microsoft.Word wef.developer.manifests.wordftw-addin-prod 2>/dev/null || true

# Add new entry using defaults write
MANIFEST_PATH="$TEMP_DIR/manifest.xml"
MANIFEST_ID="wordftw-addin-prod"

defaults write com.microsoft.Word wef.developer.manifests -dict-add "$MANIFEST_ID" "$MANIFEST_PATH"

if [ $? -ne 0 ]; then
  echo "[ERROR] Failed to register add-in"
  echo ""
  echo "RESOLUTION:"
  echo "1. Check file permissions on: ~/Library/Preferences/com.microsoft.Word.plist"
  echo "2. Try running: killall cfprefsd"
  echo "3. Restore backup from: $BACKUP_FILE"
  read -p "Press enter to exit..."
  exit 1
fi

# Verify registration
if defaults read com.microsoft.Word wef.developer.manifests.$MANIFEST_ID &>/dev/null; then
  echo "Add-in registered successfully"
else
  echo "[ERROR] Registration verification failed"
  exit 1
fi
```

#### C. Word Process Management

**Safer Word closure (Windows):**
```batch
REM Close Word with warning
echo Checking if Word is running...
tasklist /FI "IMAGENAME eq WINWORD.EXE" 2>NUL | find /I /N "WINWORD.EXE">NUL
if %ERRORLEVEL% EQU 0 (
  echo [WARNING] Microsoft Word is currently running
  echo.
  echo The installer needs to close Word to update the add-in.
  echo Please save any open documents before continuing.
  echo.
  echo Close Word and continue? (Y/N)
  choice /C YN /N
  if %ERRORLEVEL% EQU 2 exit /b 0
  
  echo Closing Word...
  taskkill /F /IM WINWORD.EXE >nul 2>&1
  timeout /t 3 /nobreak >nul
  
  REM Verify Word closed
  tasklist /FI "IMAGENAME eq WINWORD.EXE" 2>NUL | find /I /N "WINWORD.EXE">NUL
  if %ERRORLEVEL% EQU 0 (
    echo [ERROR] Failed to close Word
    echo Please close Word manually and run this installer again
    pause
    exit /b 1
  )
)
```

**Safer Word closure (macOS):**
```bash
# Close Word with warning
echo "Checking if Word is running..."
if pgrep -x "Microsoft Word" > /dev/null; then
  echo "[WARNING] Microsoft Word is currently running"
  echo ""
  echo "The installer needs to close Word to update the add-in."
  echo "Please save any open documents before continuing."
  echo ""
  read -p "Close Word and continue? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
  fi
  
  echo "Closing Word..."
  osascript -e 'quit app "Microsoft Word"' 2>/dev/null
  sleep 3
  
  # Verify Word closed
  if pgrep -x "Microsoft Word" > /dev/null; then
    echo "[ERROR] Failed to close Word"
    echo "Please close Word manually and run this installer again"
    read -p "Press enter to exit..."
    exit 1
  fi
fi
```

#### D. Cache Clearing Robustness

**Safe cache clearing (Windows):**
```batch
REM Clear cache with error handling
echo Clearing Word add-in cache...
powershell -Command "try { Remove-Item -Path '$env:LOCALAPPDATA\Microsoft\Office\16.0\Wef\*' -Recurse -Force -ErrorAction Stop } catch { Write-Host 'Cache clearing failed:' $_.Exception.Message; exit 1 }"
if %ERRORLEVEL% NEQ 0 (
  echo [WARNING] Failed to clear cache
  echo The add-in may use cached files
  echo.
  echo Continue anyway? (Y/N)
  choice /C YN /N
  if %ERRORLEVEL% EQU 2 exit /b 1
)
echo Cache cleared successfully
```

**Safe cache clearing (macOS):**
```bash
# Clear cache with error handling
echo "Clearing Word add-in cache..."
CACHE_PATHS=(
  "$HOME/Library/Containers/com.microsoft.Word/Data/Library/Caches"
  "$HOME/Library/Caches/com.microsoft.Word"
)

CACHE_CLEARED=false
for CACHE_PATH in "${CACHE_PATHS[@]}"; do
  if [ -d "$CACHE_PATH" ]; then
    if rm -rf "$CACHE_PATH"/* 2>/dev/null; then
      echo "Cleared cache: $CACHE_PATH"
      CACHE_CLEARED=true
    else
      echo "[WARNING] Failed to clear cache: $CACHE_PATH"
    fi
  fi
done

if [ "$CACHE_CLEARED" = false ]; then
  echo "[WARNING] No cache directories found or failed to clear"
  echo "The add-in may use cached files"
  echo ""
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
else
  echo "Cache cleared successfully"
fi
```

---

### 4. Post-Installation Verification

#### A. Installation Validation

**Verify registry entry (Windows):**
```batch
REM Verify registration
echo Verifying installation...
reg query "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "wordftw-addin-prod" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Registration verification failed
  echo The add-in was not registered properly
  pause
  exit /b 1
)
echo Registration verified
```

**Verify defaults entry (macOS):**
```bash
# Verify registration
echo "Verifying installation..."
MANIFEST_ID="wordftw-addin-prod"
if ! defaults read com.microsoft.Word wef.developer.manifests.$MANIFEST_ID &>/dev/null; then
  echo "[ERROR] Registration verification failed"
  echo "The add-in was not registered properly"
  read -p "Press enter to exit..."
  exit 1
fi
echo "Registration verified"
```

**Verify manifest exists (Windows):**
```batch
REM Verify manifest file
if not exist "%MANIFEST_PATH%" (
  echo [ERROR] Manifest file not found at expected location
  echo Expected: %MANIFEST_PATH%
  pause
  exit /b 1
)
echo Manifest file verified
```

**Verify manifest exists (macOS):**
```bash
# Verify manifest file
if [ ! -f "$MANIFEST_PATH" ]; then
  echo "[ERROR] Manifest file not found at expected location"
  echo "Expected: $MANIFEST_PATH"
  read -p "Press enter to exit..."
  exit 1
fi
echo "Manifest file verified"
```

#### B. Success Confirmation

**Clear success message (Windows):**
```batch
echo.
echo ========================================
echo  Installation Successful!
echo ========================================
echo.
echo The "Redlined & Signed" add-in has been installed.
echo.
echo NEXT STEPS:
echo 1. Word will now open
echo 2. Click: Insert ^> My Add-ins
echo 3. Look under "Developer Add-ins"
echo 4. Click "Redlined & Signed"
echo.
echo TROUBLESHOOTING:
echo - If add-in doesn't appear, restart Word completely
echo - Clear cache: %LOCALAPPDATA%\Microsoft\Office\16.0\Wef
echo - Re-run this installer
echo.
echo Press any key to open Word...
pause >nul

start winword.exe
```

**Clear success message (macOS):**
```bash
echo ""
echo "========================================"
echo " Installation Successful!"
echo "========================================"
echo ""
echo "The \"Redlined & Signed\" add-in has been installed."
echo ""
echo "NEXT STEPS:"
echo "1. Word will now open"
echo "2. Click: Insert > My Add-ins"
echo "3. Look under \"Developer Add-ins\""
echo "4. Click \"Redlined & Signed\""
echo ""
echo "TROUBLESHOOTING:"
echo "- If add-in doesn't appear, restart Word completely"
echo "- Clear cache: ~/Library/Containers/com.microsoft.Word/Data/Library/Caches"
echo "- Re-run this installer"
echo ""
read -p "Press enter to open Word..."

open -a "Microsoft Word"
```

---

### 4. Error Handling & Recovery

#### A. Rollback on Failure

**Rollback strategy:**
```batch
:ROLLBACK
echo.
echo [ROLLBACK] Restoring previous state...

REM Restore registry backup if exists
if exist "%TEMP_DIR%\registry_backup.reg" (
  reg import "%TEMP_DIR%\registry_backup.reg" >nul 2>&1
  echo Registry restored
)

REM Clean up temp files
if exist "%TEMP_DIR%\manifest.xml" del "%TEMP_DIR%\manifest.xml" >nul 2>&1

echo Rollback complete
pause
exit /b 1
```

#### B. Self-Diagnostic Mode

**Add diagnostic flag:**
```batch
REM Run installer with --diagnose flag for detailed output
if "%1"=="--diagnose" (
  echo [DIAGNOSTIC MODE]
  echo.
  
  echo Checking Node.js...
  node --version
  
  echo Checking npm/npx...
  npx --version
  
  echo Checking Office installation...
  reg query "HKCU\Software\Microsoft\Office\16.0"
  
  echo Checking existing add-in...
  reg query "HKCU\Software\Microsoft\Office\16.0\WEF\Developer"
  
  echo Checking cache directory...
  dir "%LOCALAPPDATA%\Microsoft\Office\16.0\Wef" /s
  
  echo Checking server...
  curl -I https://wordftw.onrender.com/api/v1/health
  
  pause
  exit /b 0
)
```

---

### 5. Uninstaller Hardening

#### A. Complete Uninstall Process

**Uninstaller script - Windows (`uninstall-addin.bat`):**
```batch
@echo off
echo ========================================
echo  Redlined ^& Signed - Uninstaller
echo ========================================
echo.

REM Close Word
echo Closing Word if running...
taskkill /F /IM WINWORD.EXE >nul 2>&1
timeout /t 2 /nobreak >nul

REM Remove registry entry
echo Removing registry entry...
reg delete "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "wordftw-addin-prod" /f >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo Registry entry removed
) else (
  echo [WARNING] Registry entry not found or already removed
)

REM Clear cache
echo Clearing cache...
powershell -Command "Remove-Item -Path '$env:LOCALAPPDATA\Microsoft\Office\16.0\Wef\*' -Recurse -Force -ErrorAction SilentlyContinue"
echo Cache cleared

REM Remove downloaded manifest
echo Removing manifest files...
if exist "%TEMP%\wordftw-addin\manifest.xml" (
  del "%TEMP%\wordftw-addin\manifest.xml" >nul 2>&1
  echo Manifest file removed
)
if exist "%TEMP%\wordftw-addin" (
  rmdir "%TEMP%\wordftw-addin" >nul 2>&1
  echo Temp directory removed
)

REM Verify uninstall
reg query "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" /v "wordftw-addin-prod" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo ========================================
  echo  Uninstall Complete!
  echo ========================================
  echo.
  echo The add-in has been completely removed.
) else (
  echo.
  echo [WARNING] Uninstall may be incomplete
  echo Please manually remove the registry entry
)
echo.
echo You can reinstall it at any time.
echo.
pause
```

**Uninstaller script - macOS (`uninstall-addin.command`):**
```bash
#!/bin/bash

echo "========================================"
echo " Redlined & Signed - Uninstaller"
echo "========================================"
echo ""

# Close Word
echo "Closing Word if running..."
osascript -e 'quit app "Microsoft Word"' 2>/dev/null
sleep 2

# Remove defaults entry
echo "Removing registration..."
MANIFEST_ID="wordftw-addin-prod"
if defaults delete com.microsoft.Word wef.developer.manifests.$MANIFEST_ID 2>/dev/null; then
  echo "Registration removed"
else
  echo "[WARNING] Registration not found or already removed"
fi

# Kill preferences daemon to ensure changes apply
killall cfprefsd 2>/dev/null

# Clear cache
echo "Clearing cache..."
CACHE_PATHS=(
  "$HOME/Library/Containers/com.microsoft.Word/Data/Library/Caches"
  "$HOME/Library/Caches/com.microsoft.Word"
)

for CACHE_PATH in "${CACHE_PATHS[@]}"; do
  if [ -d "$CACHE_PATH" ]; then
    rm -rf "$CACHE_PATH"/* 2>/dev/null
    echo "Cache cleared: $CACHE_PATH"
  fi
done

# Remove downloaded manifest
echo "Removing manifest files..."
TEMP_DIR="$HOME/.wordftw-addin"
if [ -f "$TEMP_DIR/manifest.xml" ]; then
  rm -f "$TEMP_DIR/manifest.xml"
  echo "Manifest file removed"
fi
if [ -d "$TEMP_DIR" ]; then
  rmdir "$TEMP_DIR" 2>/dev/null
  echo "Temp directory removed"
fi

# Verify uninstall
if defaults read com.microsoft.Word wef.developer.manifests.$MANIFEST_ID &>/dev/null; then
  echo ""
  echo "[WARNING] Uninstall may be incomplete"
  echo "Please manually remove the registration"
else
  echo ""
  echo "========================================"
  echo " Uninstall Complete!"
  echo "========================================"
  echo ""
  echo "The add-in has been completely removed."
fi
echo ""
echo "You can reinstall it at any time."
echo ""
read -p "Press enter to exit..."
```

---

## Automated Testing Strategy

### Test Phases

#### Phase 1: Dependency Tests (5 tests)
```javascript
describe('Installation Dependencies', () => {
  test('Node.js is available');
  test('npx is available');
  test('Office 16.0+ is installed');
  test('PowerShell is available');
  test('Server is reachable');
});
```

#### Phase 2: Download & Validation Tests (4 tests)
```javascript
describe('Manifest Download', () => {
  test('Manifest downloads successfully');
  test('Manifest is valid XML');
  test('Manifest contains required fields');
  test('Download fails gracefully on network error');
});
```

#### Phase 3: Registry Tests (6 tests)
```javascript
describe('Registry Operations', () => {
  test('Can write to Developer registry key');
  test('Can read from Developer registry key');
  test('Can delete from Developer registry key');
  test('Handles registry backup/restore');
  test('Detects existing installation');
  test('Handles registry locked error');
});
```

#### Phase 4: Installation Flow Tests (8 tests)
```javascript
describe('Fresh Installation', () => {
  test('Clean install succeeds');
  test('Registry entry created');
  test('Manifest file exists at correct location');
  test('Cache cleared during install');
  test('Word process closed if running');
  test('Rollback on failure');
  test('Success message displayed');
  test('Installation verified');
});
```

#### Phase 5: Reinstall/Repair Tests (4 tests)
```javascript
describe('Reinstallation', () => {
  test('Detects existing installation');
  test('Reinstall over existing works');
  test('Repair existing works');
  test('Old registration removed before new one added');
});
```

#### Phase 6: Uninstall Tests (4 tests)
```javascript
describe('Uninstallation', () => {
  test('Uninstaller removes registry entry');
  test('Uninstaller clears cache');
  test('Uninstaller removes manifest');
  test('Clean uninstall verified');
});
```

#### Phase 7: Error Handling Tests (6 tests)
```javascript
describe('Error Scenarios', () => {
  test('Handles network timeout gracefully');
  test('Handles corrupt manifest');
  test('Handles registry permission denied');
  test('Handles Word process won't close');
  test('Handles cache clear failure');
  test('Shows actionable error messages');
});
```

#### Phase 8: Cross-Platform Tests (macOS) (4 tests)
```javascript
describe('macOS Installation', () => {
  test('Mac installer downloads manifest');
  test('Mac installer uses defaults write');
  test('Mac installer verifies installation');
  test('Mac uninstaller cleans up');
});
```

---

## Implementation Checklist

### Phase 1: Windows Installer Hardening (2 days)
- [ ] **OS Detection:**
  - [ ] Add Windows version detection
  - [ ] Add wrong-OS error message
- [ ] **Dependency Checks:**
  - [ ] Check Node.js availability
  - [ ] Check npx availability
  - [ ] Check Office 16.0+ registry
  - [ ] Check PowerShell availability
- [ ] **Existing Installation:**
  - [ ] Detect existing registry entry
  - [ ] Offer reinstall/repair/cancel options
  - [ ] Detect Wef cache directory
- [ ] **Network & Download:**
  - [ ] Test server reachability via PowerShell
  - [ ] Download manifest with error handling
  - [ ] Validate XML structure
- [ ] **Registration:**
  - [ ] Backup registry before modification
  - [ ] Atomic registry update (delete + add)
  - [ ] Verify registration successful
- [ ] **Process Management:**
  - [ ] Check if Word is running
  - [ ] Prompt user before closing
  - [ ] Force close via taskkill
  - [ ] Verify Word closed
- [ ] **Cache Clearing:**
  - [ ] Clear Wef directory via PowerShell
  - [ ] Handle errors gracefully
- [ ] **Post-Install:**
  - [ ] Verify registry entry
  - [ ] Verify manifest file
  - [ ] Show success message with next steps
  - [ ] Open Word automatically
- [ ] **Error Handling:**
  - [ ] Add rollback on failure
  - [ ] Add diagnostic mode (`--diagnose` flag)
  - [ ] Improve all error messages with resolutions

### Phase 2: macOS Installer Hardening (2 days)
- [ ] **OS Detection:**
  - [ ] Add macOS version detection (sw_vers)
  - [ ] Add wrong-OS error message
- [ ] **Dependency Checks:**
  - [ ] Check Node.js availability (command -v)
  - [ ] Check npx availability
  - [ ] Check Word app in /Applications
  - [ ] Check Office version via plist
- [ ] **Existing Installation:**
  - [ ] Detect existing defaults entry
  - [ ] Offer reinstall/repair/cancel options
  - [ ] Detect cache directories
- [ ] **Network & Download:**
  - [ ] Test server reachability via curl
  - [ ] Download manifest with curl
  - [ ] Validate XML with xmllint + grep
- [ ] **Registration:**
  - [ ] Backup defaults before modification
  - [ ] Atomic defaults update (delete + write)
  - [ ] Kill cfprefsd to refresh
  - [ ] Verify registration successful
- [ ] **Process Management:**
  - [ ] Check if Word is running (pgrep)
  - [ ] Prompt user before closing
  - [ ] Quit via osascript
  - [ ] Verify Word closed
- [ ] **Cache Clearing:**
  - [ ] Clear both cache paths
  - [ ] Handle errors gracefully
- [ ] **Post-Install:**
  - [ ] Verify defaults entry
  - [ ] Verify manifest file
  - [ ] Show success message with next steps
  - [ ] Open Word via open -a
- [ ] **File Permissions:**
  - [ ] Add chmod +x instructions to README
  - [ ] Handle permission errors

### Phase 3: Uninstaller Creation (1 day)
- [ ] **Windows Uninstaller:**
  - [ ] Create `uninstall-addin.bat`
  - [ ] Close Word
  - [ ] Remove registry entry
  - [ ] Clear cache
  - [ ] Remove manifest files
  - [ ] Verify complete removal
- [ ] **macOS Uninstaller:**
  - [ ] Create `uninstall-addin.command`
  - [ ] Quit Word
  - [ ] Remove defaults entry
  - [ ] Clear cache paths
  - [ ] Remove manifest files
  - [ ] Verify complete removal
- [ ] **Deployment:**
  - [ ] Add both uninstallers to server/public
  - [ ] Test complete uninstall flows
  - [ ] Add uninstall verification

### Phase 3.5: Developer Environment Switcher Scripts (0.5 days)

**Purpose:** Provide one-click scripts for developers to switch between local and deployed add-in environments during development and testing.

#### Rationale

During development, developers need to:
- **99% of time:** Test against local server (`localhost:4001`) with local add-in (`localhost:4000`)
- **1% of time:** Test against deployed server (`wordftw.onrender.com`) to verify deployment

Manually switching manifests is error-prone and tedious:
```powershell
# Manual process (annoying!)
npx office-addin-debugging stop addin/manifest.xml
npx office-addin-debugging start server/public/manifest.xml
# Oops, which one am I using now? 🤔
```

**Solution:** Simple double-click scripts that handle the switching automatically.

---

#### Windows Implementation: `use-local.bat`

**Location:** `tools/scripts/use-local.bat`

```batch
@echo off
echo ========================================
echo  Switch to LOCAL Add-in
echo ========================================
echo.
echo Switching Word add-in to local development environment...
echo.

REM Stop any currently sideloaded manifests
echo [1/3] Stopping deployed manifest...
npx office-addin-debugging stop server/public/manifest.xml >nul 2>&1

echo [2/3] Stopping local manifest (if any)...
npx office-addin-debugging stop addin/manifest.xml >nul 2>&1

REM Start local manifest
echo [3/3] Starting local manifest...
npx office-addin-debugging start addin/manifest.xml

if %ERRORLEVEL% EQU 0 (
  echo.
  echo ========================================
  echo  ✅ SUCCESS
  echo ========================================
  echo.
  echo Word add-in now points to:
  echo   📍 Add-in:  https://localhost:4000
  echo   📍 API:     https://localhost:4001
  echo.
  echo Make sure your local servers are running:
  echo   Terminal 1: node server/src/server.js
  echo   Terminal 2: cd addin ^&^& npm run dev-server
  echo.
) else (
  echo.
  echo ========================================
  echo  ❌ ERROR
  echo ========================================
  echo.
  echo Failed to start local manifest.
  echo Make sure you have the add-in development tools installed:
  echo   npm install -g office-addin-debugging
  echo.
)

pause
```

---

#### Windows Implementation: `use-deployed.bat`

**Location:** `tools/scripts/use-deployed.bat`

```batch
@echo off
echo ========================================
echo  Switch to DEPLOYED Add-in
echo ========================================
echo.
echo Switching Word add-in to deployed environment...
echo.

REM Stop any currently sideloaded manifests
echo [1/3] Stopping local manifest...
npx office-addin-debugging stop addin/manifest.xml >nul 2>&1

echo [2/3] Stopping deployed manifest (if any)...
npx office-addin-debugging stop server/public/manifest.xml >nul 2>&1

REM Start deployed manifest
echo [3/3] Starting deployed manifest...
npx office-addin-debugging start server/public/manifest.xml

if %ERRORLEVEL% EQU 0 (
  echo.
  echo ========================================
  echo  ✅ SUCCESS
  echo ========================================
  echo.
  echo Word add-in now points to:
  echo   📍 Add-in:  https://wordftw.onrender.com
  echo   📍 API:     https://wordftw.onrender.com/api/v1
  echo.
  echo This is the PRODUCTION environment.
  echo Use this to test the deployed version.
  echo.
) else (
  echo.
  echo ========================================
  echo  ❌ ERROR
  echo ========================================
  echo.
  echo Failed to start deployed manifest.
  echo Make sure you have the add-in development tools installed:
  echo   npm install -g office-addin-debugging
  echo.
)

pause
```

---

#### macOS Implementation: `use-local.command`

**Location:** `tools/scripts/use-local.command`

```bash
#!/bin/bash

echo "========================================"
echo " Switch to LOCAL Add-in"
echo "========================================"
echo ""
echo "Switching Word add-in to local development environment..."
echo ""

# Stop any currently sideloaded manifests
echo "[1/3] Stopping deployed manifest..."
npx office-addin-debugging stop server/public/manifest.xml >/dev/null 2>&1

echo "[2/3] Stopping local manifest (if any)..."
npx office-addin-debugging stop addin/manifest.xml >/dev/null 2>&1

# Start local manifest
echo "[3/3] Starting local manifest..."
if npx office-addin-debugging start addin/manifest.xml; then
  echo ""
  echo "========================================"
  echo " ✅ SUCCESS"
  echo "========================================"
  echo ""
  echo "Word add-in now points to:"
  echo "  📍 Add-in:  https://localhost:4000"
  echo "  📍 API:     https://localhost:4001"
  echo ""
  echo "Make sure your local servers are running:"
  echo "  Terminal 1: node server/src/server.js"
  echo "  Terminal 2: cd addin && npm run dev-server"
  echo ""
else
  echo ""
  echo "========================================"
  echo " ❌ ERROR"
  echo "========================================"
  echo ""
  echo "Failed to start local manifest."
  echo "Make sure you have the add-in development tools installed:"
  echo "  npm install -g office-addin-debugging"
  echo ""
fi

read -p "Press enter to exit..."
```

**Setup:** Make executable with `chmod +x tools/scripts/use-local.command`

---

#### macOS Implementation: `use-deployed.command`

**Location:** `tools/scripts/use-deployed.command`

```bash
#!/bin/bash

echo "========================================"
echo " Switch to DEPLOYED Add-in"
echo "========================================"
echo ""
echo "Switching Word add-in to deployed environment..."
echo ""

# Stop any currently sideloaded manifests
echo "[1/3] Stopping local manifest..."
npx office-addin-debugging stop addin/manifest.xml >/dev/null 2>&1

echo "[2/3] Stopping deployed manifest (if any)..."
npx office-addin-debugging stop server/public/manifest.xml >/dev/null 2>&1

# Start deployed manifest
echo "[3/3] Starting deployed manifest..."
if npx office-addin-debugging start server/public/manifest.xml; then
  echo ""
  echo "========================================"
  echo " ✅ SUCCESS"
  echo "========================================"
  echo ""
  echo "Word add-in now points to:"
  echo "  📍 Add-in:  https://wordftw.onrender.com"
  echo "  📍 API:     https://wordftw.onrender.com/api/v1"
  echo ""
  echo "This is the PRODUCTION environment."
  echo "Use this to test the deployed version."
  echo ""
else
  echo ""
  echo "========================================"
  echo " ❌ ERROR"
  echo "========================================"
  echo ""
  echo "Failed to start deployed manifest."
  echo "Make sure you have the add-in development tools installed:"
  echo "  npm install -g office-addin-debugging"
  echo ""
fi

read -p "Press enter to exit..."
```

**Setup:** Make executable with `chmod +x tools/scripts/use-deployed.command`

---

#### Usage Workflow

**Daily Development (Local):**
```powershell
# Morning: Switch to local
Double-click: use-local.bat

# Start servers in two terminals
Terminal 1> node server/src/server.js
Terminal 2> cd addin; npm run dev-server

# Develop all day, refresh taskpane as needed
```

**Testing Deployed (Rare):**
```powershell
# Switch to deployed to test production
Double-click: use-deployed.bat

# Test the deployed version
# (No local servers needed)

# Switch back to local
Double-click: use-local.bat
```

---

#### Implementation Checklist

- [ ] **Create Scripts:**
  - [ ] `tools/scripts/use-local.bat` (Windows)
  - [ ] `tools/scripts/use-deployed.bat` (Windows)
  - [ ] `tools/scripts/use-local.command` (macOS)
  - [ ] `tools/scripts/use-deployed.command` (macOS)
- [ ] **Set Permissions:**
  - [ ] Make macOS scripts executable (`chmod +x *.command`)
- [ ] **Test Both Platforms:**
  - [ ] Test switching local → deployed → local (Windows)
  - [ ] Test switching local → deployed → local (macOS)
  - [ ] Verify Word add-in loads from correct environment
- [ ] **Documentation:**
  - [ ] Add "Developer Workflow" section to README
  - [ ] Document when to use each script
  - [ ] Add troubleshooting for common issues
- [ ] **Developer Experience:**
  - [ ] Consider adding to npm scripts: `npm run addin:use-local`
  - [ ] Add to VSCode tasks for even faster switching

---

#### Benefits

✅ **One-click switching** between environments  
✅ **No manual manifest management** required  
✅ **Clear feedback** on which environment is active  
✅ **Prevents mistakes** (forgetting to stop old manifest)  
✅ **Faster development** iteration  
✅ **Better testing** of deployed environment  

---

### Phase 4: Automated Testing (2 days)
- [ ] **Cross-Platform Tests (37 tests total):**
  - [ ] Phase 1: Dependencies (5 tests - both platforms)
  - [ ] Phase 2: Download & Validation (4 tests - both platforms)
  - [ ] Phase 3: Registry/Defaults (6 tests - platform-specific)
  - [ ] Phase 4: Installation Flow (8 tests - both platforms)
  - [ ] Phase 5: Reinstall/Repair (4 tests - both platforms)
  - [ ] Phase 6: Uninstall (4 tests - both platforms)
  - [ ] Phase 7: Error Handling (6 tests - both platforms)
- [ ] **Test Infrastructure:**
  - [ ] Set up test fixtures (mock registry/defaults, mock downloads)
  - [ ] Create platform-specific test runners
  - [ ] Add to CI/CD pipeline
  - [ ] Generate coverage report

### Phase 5: Documentation (1 day)
- [ ] **Installation Guides:**
  - [ ] Update `README.md` with platform-specific instructions
  - [ ] Windows installation section
  - [ ] macOS installation section (include chmod instructions)
  - [ ] Linux fallback (manual manifest instructions)
- [ ] **Troubleshooting:**
  - [ ] Create platform-specific troubleshooting guide
  - [ ] Document common error messages (Windows)
  - [ ] Document common error messages (macOS)
  - [ ] Add FAQ section
- [ ] **Developer Docs:**
  - [ ] Document platform differences
  - [ ] Update operations/installation.md

---

## Success Metrics

**Installation Reliability:**
- ✅ 95%+ success rate on fresh installs
- ✅ 100% detection of dependency issues
- ✅ 0 installations that leave system in broken state

**Error Handling:**
- ✅ Every error has actionable resolution steps
- ✅ Failed installations roll back cleanly
- ✅ Users can self-diagnose 80% of issues

**Test Coverage:**
- ✅ 37 automated tests covering all scenarios
- ✅ 100% of critical paths tested
- ✅ Cross-platform parity (Windows/Mac)

**User Experience:**
- ✅ Clear progress indicators during install
- ✅ Estimated time remaining shown
- ✅ Success confirmation with next steps
- ✅ One-click uninstall available

---

## Related Files

**Installers:**
- `server/public/install-addin.bat` (Windows installer)
- `server/public/install-addin.command` (macOS installer)
- `server/public/uninstall-addin.bat` (Windows uninstaller, new)
- `server/public/uninstall-addin.command` (macOS uninstaller, new)

**Developer Utilities:**
- `tools/scripts/use-local.bat` (Windows: switch to local add-in, new)
- `tools/scripts/use-deployed.bat` (Windows: switch to deployed add-in, new)
- `tools/scripts/use-local.command` (macOS: switch to local add-in, new)
- `tools/scripts/use-deployed.command` (macOS: switch to deployed add-in, new)

**Server:**
- `server/src/server.js` (serves manifest at `/manifest.xml`)
- `addin/manifest.xml` (source manifest, local development)
- `server/public/manifest.xml` (production manifest, deployed)
- `render.yaml` (deployment config for Render.com)

**Tests:**
- `server/tests/addin-installation.test.js` (new, 37 tests)
- `server/tests/addin-installation-windows.test.js` (new, Windows-specific)
- `server/tests/addin-installation-macos.test.js` (new, macOS-specific)
- `tools/scripts/run-all-tests.bat` (update to include new tests)

**Documentation:**
- `README.md` (update installation section with platform-specific steps)
- `docs/aiDocs/operations/installation.md` (detailed platform-specific guide)
- `docs/aiDocs/operations/troubleshooting-windows.md` (new)
- `docs/aiDocs/operations/troubleshooting-macos.md` (new)

---

## Open Questions

1. **Auto-update:** Should we add auto-update checking on launch?
   - **Decision:** Phase 2 feature, out of scope for hardening

2. **Silent install:** Support for IT departments to deploy silently?
   - **Decision:** Future feature, requires enterprise considerations

3. **Telemetry:** Should we collect installation success/failure metrics?
   - **Decision:** Phase 2 feature, requires privacy policy

4. **Multiple versions:** Allow side-by-side dev and prod installations?
   - **Decision:** Not needed for prototype, use different manifest IDs in future

---

## Platform-Specific Considerations

### Windows-Specific Issues
1. **Registry Permissions**: Some corporate environments lock registry writes
   - **Solution**: Detect permission errors and suggest running as Administrator
2. **PowerShell Execution Policy**: May be restricted
   - **Solution**: Check policy, guide user to enable RemoteSigned
3. **Antivirus**: May block manifest download or cache clearing
   - **Solution**: Add instructions to whitelist `%TEMP%\wordftw-addin\`
4. **Office Click-to-Run vs MSI**: Different registry paths
   - **Solution**: Check both `16.0` and `15.0` registry keys

### macOS-Specific Issues
1. **File Permissions**: `.command` files need execute permission
   - **Solution**: Add `chmod +x install-addin.command` to README
2. **Gatekeeper**: May block downloaded scripts
   - **Solution**: Add instructions to right-click → Open first time
3. **xmllint Not Available**: Older macOS versions may not have it
   - **Solution**: Fallback to simple `grep` validation
4. **Multiple Office Paths**: Office may be in different locations
   - **Solution**: Check multiple common paths:
     - `/Applications/Microsoft Word.app`
     - `~/Applications/Microsoft Word.app`
     - `/Applications/Microsoft Office 2016/Microsoft Word.app`
5. **cfprefsd Caching**: Preferences daemon caches values
   - **Solution**: Always `killall cfprefsd` after `defaults write`

### Cross-Platform Best Practices
1. **Consistent Error Messages**: Use same format on both platforms
2. **Consistent File Paths**: Store manifest in parallel locations
   - Windows: `%TEMP%\wordftw-addin\`
   - macOS: `~/.wordftw-addin/`
3. **Consistent Verification**: Same steps on both platforms
4. **Platform Detection**: Fail fast with clear error if wrong OS
5. **Rollback Strategy**: Must work on both platforms

---

**Total Estimated Time:** 8 days
**Priority Order:** Phase 1 (Windows) → Phase 2 (macOS) → Phase 3 (Uninstallers) → Phase 4 (Testing) → Phase 5 (Documentation)


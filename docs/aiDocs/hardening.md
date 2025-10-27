# WordFTW System Hardening

**Status:** 📋 Planned  
**Priority:** High  
**Last Updated:** October 27, 2025  
**Scope:** Full Application Stack  
**Related:** `architecture/state-machine.md`, `features/automated-testing-suite.md`

---

## Executive Summary

This document provides a comprehensive hardening strategy for the entire WordFTW application, from installation scripts to server infrastructure to client-side code. Every component follows these core principles:

1. ✅ **Pre-flight checks** - Validate before executing
2. ✅ **Clear error messages** - Every error has actionable resolution
3. ✅ **Graceful degradation** - Partial functionality > total failure
4. ✅ **Rollback capability** - Undo failed operations
5. ✅ **Self-healing** - Detect and fix common issues automatically
6. ✅ **Comprehensive testing** - Automated coverage of all failure modes
7. ✅ **Observability** - Clear logging and diagnostics

---

## Table of Contents

1. [Installation Hardening](#1-installation-hardening)
   - Windows & macOS Installers
   - Uninstallers
   - Developer Environment Switchers
2. [Server Infrastructure Hardening](#2-server-infrastructure-hardening)
   - Startup Checks
   - Graceful Shutdown
   - Health Monitoring
3. [API Endpoint Hardening](#3-api-endpoint-hardening)
   - Input Validation
   - Error Handling
   - Rate Limiting
4. [State Management Hardening](#4-state-management-hardening)
   - Consistency Validation
   - Atomic Updates
   - Corruption Detection
5. [File Operations Hardening](#5-file-operations-hardening)
   - Size Limits
   - Atomic Operations
   - Cleanup Automation
6. [Session Management Hardening](#6-session-management-hardening)
   - Timeout Handling
   - Abandoned Session Cleanup
7. [Network Operations Hardening](#7-network-operations-hardening)
   - Retry Logic
   - Circuit Breakers
8. [Client-Side Hardening](#8-client-side-hardening)
   - Error Boundaries
   - Offline Handling
9. [Testing Strategy](#testing-strategy)
10. [Implementation Roadmap](#implementation-roadmap)

---

# 1. Installation Hardening

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

## Platform-Specific Implementation

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

## 1.1 OS Detection & Platform-Specific Setup

### Windows OS Detection

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

### macOS OS Detection

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

## 1.2 Pre-Installation Checks

### A. Dependency Validation

**Check Node.js (Windows):**
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

**Check Node.js (macOS):**
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

### B. Existing Installation Detection

**Windows:**
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

**macOS:**
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

### C. Network Connectivity

**Windows:**
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

**macOS:**
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

## 1.3 Installation Process

### A. Manifest Download & Validation

**Windows:**
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

**macOS:**
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

### B. Registration with Backup

**Windows:**
```batch
REM Backup registry key before modification
echo Creating registry backup...
reg export "HKCU\Software\Microsoft\Office\16.0\WEF\Developer" "%TEMP_DIR%\registry_backup.reg" /y >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo Registry backup created: %TEMP_DIR%\registry_backup.reg
)

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

**macOS:**
```bash
# Backup existing preferences
echo "Creating backup of existing preferences..."
BACKUP_FILE="$TEMP_DIR/word_preferences_backup.plist"
defaults read com.microsoft.Word > "$BACKUP_FILE" 2>/dev/null || echo "No existing preferences to backup"

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

### C. Cache Clearing

**Windows:**
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

**macOS:**
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

## 1.4 Developer Environment Switchers

**Purpose:** Provide one-click scripts for developers to switch between local and deployed add-in environments.

### Windows: `use-local.bat`

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

### Windows: `use-deployed.bat`

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

### macOS Scripts

Similar scripts for macOS with `.command` extension and bash syntax. (See full implementation in separate section)

---

## 1.5 Uninstallers

### Windows Uninstaller

**Location:** `tools/scripts/uninstall-addin.bat`

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

### macOS Uninstaller

**Location:** `tools/scripts/uninstall-addin.command`

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

# 2. Server Infrastructure Hardening

## 2.1 Startup Pre-flight Checks

### Check Node.js Version

```javascript
// server/src/startup-checks.js
const MIN_NODE_VERSION = 18;

function checkNodeVersion() {
  const version = process.versions.node;
  const major = parseInt(version.split('.')[0]);
  
  if (major < MIN_NODE_VERSION) {
    console.error(`[ERROR] Node.js ${MIN_NODE_VERSION}+ required. Current: ${version}`);
    console.error('');
    console.error('RESOLUTION:');
    console.error('1. Download Node.js from https://nodejs.org/');
    console.error(`2. Install Node.js ${MIN_NODE_VERSION} or higher`);
    console.error('3. Restart the server');
    process.exit(1);
  }
  
  console.log(`✅ Node.js version: ${version}`);
}
```

### Validate Required Modules

```javascript
function checkRequiredModules() {
  const required = [
    'express',
    'cors',
    'fs',
    'path',
    'office-document-generator'
  ];
  
  const missing = [];
  for (const module of required) {
    try {
      require.resolve(module);
    } catch (error) {
      missing.push(module);
    }
  }
  
  if (missing.length > 0) {
    console.error('[ERROR] Missing required modules:', missing.join(', '));
    console.error('');
    console.error('RESOLUTION:');
    console.error('1. Run: npm install');
    console.error('2. Restart the server');
    process.exit(1);
  }
  
  console.log('✅ All required modules installed');
}
```

### Validate Data Directories

```javascript
function checkDataDirectories() {
  const required = [
    'data/app',
    'data/app/documents',
    'data/app/exhibits',
    'data/app/presets',
    'data/working',
    'server/public'
  ];
  
  const missing = [];
  for (const dir of required) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      } catch (error) {
        missing.push(dir);
      }
    }
  }
  
  if (missing.length > 0) {
    console.error('[ERROR] Failed to create required directories:', missing.join(', '));
    console.error('');
    console.error('RESOLUTION:');
    console.error('1. Check file system permissions');
    console.error('2. Ensure disk space is available');
    console.error('3. Run with appropriate permissions');
    process.exit(1);
  }
  
  console.log('✅ All data directories exist');
}
```

### Complete Startup Check

```javascript
// server/src/server.js - Add at the very beginning
async function runStartupChecks() {
  console.log('========================================');
  console.log(' WordFTW Server - Startup Checks');
  console.log('========================================');
  console.log('');
  
  try {
    checkNodeVersion();
    checkRequiredModules();
    checkEnvironmentVariables();
    checkDataDirectories();
    checkDiskSpace();
    
    console.log('');
    console.log('✅ All startup checks passed');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('❌ Startup checks failed');
    console.error('Server cannot start safely');
    console.error('');
    process.exit(1);
  }
}

// Run before anything else
runStartupChecks().then(() => {
  // ... rest of server initialization
});
```

---

## 2.2 Graceful Shutdown

```javascript
const activeRequests = new Set();
let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log('Forced shutdown');
    process.exit(1);
  }
  
  isShuttingDown = true;
  console.log('');
  console.log(`Received ${signal}, shutting down gracefully...`);
  
  // Stop accepting new requests
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  // Wait for active requests to complete
  const timeout = setTimeout(() => {
    console.error('Shutdown timeout, forcing exit');
    process.exit(1);
  }, 30000); // 30 second timeout
  
  // Check active requests
  const checkInterval = setInterval(() => {
    console.log(`Waiting for ${activeRequests.size} active requests...`);
    if (activeRequests.size === 0) {
      clearInterval(checkInterval);
      clearTimeout(timeout);
      console.log('All requests completed, exiting');
      process.exit(0);
    }
  }, 1000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Track active requests
app.use((req, res, next) => {
  if (isShuttingDown) {
    return res.status(503).json({
      error: 'server_shutting_down',
      message: 'Server is shutting down, please retry in a moment'
    });
  }
  
  activeRequests.add(req);
  res.on('finish', () => activeRequests.delete(req));
  res.on('close', () => activeRequests.delete(req));
  
  next();
});
```

---

## 2.3 Health Check Endpoint

```javascript
app.get('/api/v1/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };
  
  // Check memory usage
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    status: 'ok',
    heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
    external: `${(memUsage.external / 1024 / 1024).toFixed(2)} MB`
  };
  
  if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
    health.checks.memory.status = 'warning';
    health.checks.memory.message = 'High memory usage';
  }
  
  // Check file system
  try {
    await fs.promises.access('data/app', fs.constants.R_OK | fs.constants.W_OK);
    health.checks.filesystem = { status: 'ok' };
  } catch (error) {
    health.checks.filesystem = {
      status: 'error',
      message: 'Cannot access data directory',
      error: error.message
    };
    health.status = 'degraded';
  }
  
  // Overall status
  const hasErrors = Object.values(health.checks).some(c => c.status === 'error');
  if (hasErrors) {
    health.status = 'degraded';
  }
  
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

---

# 3. API Endpoint Hardening

## 3.1 Input Validation Framework

```javascript
// server/src/middleware/validation.js
const Joi = require('joi');

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
        type: d.type
      }));
      
      return res.status(400).json({
        error: 'validation_failed',
        message: 'Input validation failed',
        details,
        resolution: 'Please check the request format and try again'
      });
    }
    
    // Replace req.body with validated/sanitized value
    req.body = value;
    next();
  };
}

// Define schemas
const schemas = {
  checkIn: Joi.object({
    userId: Joi.string().required(),
    platform: Joi.string().valid('web', 'word').required()
  }),
  
  checkOut: Joi.object({
    userId: Joi.string().required(),
    platform: Joi.string().valid('web', 'word').required()
  }),
  
  saveProgress: Joi.object({
    userId: Joi.string().required(),
    note: Joi.string().max(500).optional()
  }),
  
  shareVersion: Joi.object({
    userId: Joi.string().required(),
    shared: Joi.boolean().required()
  })
};

module.exports = { validate, schemas };
```

---

## 3.2 Standardized Error Handling

```javascript
// server/src/middleware/error-handler.js

class HardenedError extends Error {
  constructor({ code, message, resolution, context, statusCode = 500 }) {
    super(message);
    this.name = 'HardenedError';
    this.code = code;
    this.resolution = resolution;
    this.context = context;
    this.statusCode = statusCode;
  }
}

const errorCodes = {
  CHECKOUT_CONFLICT: {
    statusCode: 409,
    message: 'Document is already checked out by another user',
    resolution: 'Wait for the other user to check in, or have an admin force check-in'
  },
  VERSION_NOT_FOUND: {
    statusCode: 404,
    message: 'Requested version does not exist',
    resolution: 'Check the version number and try again'
  },
  INVALID_SESSION: {
    statusCode: 401,
    message: 'Invalid or expired session',
    resolution: 'Please refresh the page to establish a new session'
  },
  DISK_FULL: {
    statusCode: 507,
    message: 'Server disk space is full',
    resolution: 'Contact system administrator to free up disk space'
  }
};

function handleError(error, req, res) {
  // Log error with context
  console.error('[ERROR]', {
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    userId: req.body?.userId || req.query?.userId,
    error: error.message,
    stack: error.stack,
    context: error.context
  });
  
  // Handle known errors
  if (error instanceof HardenedError) {
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      resolution: error.resolution,
      ...(process.env.NODE_ENV === 'development' && {
        context: error.context,
        stack: error.stack
      })
    });
  }
  
  // Generic error
  res.status(500).json({
    error: 'internal_server_error',
    message: 'An unexpected error occurred',
    resolution: 'Please try again. If the problem persists, contact support.'
  });
}

// Global error handler
app.use((error, req, res, next) => {
  handleError(error, req, res);
});

module.exports = { HardenedError, handleError, errorCodes };
```

---

## 3.3 Rate Limiting

```javascript
// server/src/middleware/rate-limit.js
const rateLimit = require('express-rate-limit');

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests from this IP',
      resolution: 'Please wait a few minutes before trying again',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

// Strict limit for write operations
const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  skipSuccessfulRequests: true
});

// Apply to routes
app.use('/api/', apiLimiter);
app.post('/api/v1/check-in', writeLimiter, ...);
app.post('/api/v1/save-progress', writeLimiter, ...);
```

---

# 4. State Management Hardening

## 4.1 State Consistency Validation

```javascript
// server/src/validators/state-validator.js

function validateServerState(state) {
  const errors = [];
  
  // Check required fields
  const required = ['revision', 'documentVersion', 'lastUpdated'];
  for (const field of required) {
    if (state[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Validate types
  if (typeof state.revision !== 'number' || state.revision < 1) {
    errors.push('revision must be a positive number');
  }
  
  if (typeof state.documentVersion !== 'number' || state.documentVersion < 1) {
    errors.push('documentVersion must be a positive number');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

---

## 4.2 Atomic State Updates

```javascript
// server/src/utils/atomic-state.js

class StateTransaction {
  constructor(state) {
    this.originalState = JSON.parse(JSON.stringify(state));
    this.newState = JSON.parse(JSON.stringify(state));
    this.committed = false;
  }
  
  update(updates) {
    Object.assign(this.newState, updates);
  }
  
  validate() {
    const validation = validateServerState(this.newState);
    if (!validation.valid) {
      throw new Error(`State validation failed: ${validation.errors.join(', ')}`);
    }
  }
  
  commit(targetState) {
    if (this.committed) {
      throw new Error('Transaction already committed');
    }
    
    this.validate();
    Object.assign(targetState, this.newState);
    this.committed = true;
  }
  
  rollback(targetState) {
    Object.assign(targetState, this.originalState);
  }
}

// Usage
function updateServerStateAtomic(updates) {
  const transaction = new StateTransaction(serverState);
  
  try {
    transaction.update(updates);
    transaction.validate();
    transaction.commit(serverState);
    persistState();
    return { ok: true };
  } catch (error) {
    console.error('[ERROR] State update failed:', error);
    transaction.rollback(serverState);
    return { ok: false, error: error.message };
  }
}
```

---

# 5. File Operations Hardening

## 5.1 File Size Limits

```javascript
// server/src/middleware/file-limits.js
const multer = require('multer');

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/pdf'
    ];
    
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'), false);
    }
    
    cb(null, true);
  }
});
```

---

## 5.2 Atomic File Operations

```javascript
const { v4: uuidv4 } = require('uuid');

async function safeFileWrite(filePath, content) {
  const tempPath = `${filePath}.tmp.${uuidv4()}`;
  
  try {
    // Write to temp file first
    await fs.promises.writeFile(tempPath, content, 'utf8');
    
    // Verify write succeeded
    const written = await fs.promises.readFile(tempPath, 'utf8');
    if (written !== content) {
      throw new Error('File write verification failed');
    }
    
    // Atomic rename
    await fs.promises.rename(tempPath, filePath);
    
    return { ok: true };
  } catch (error) {
    // Clean up temp file
    try {
      await fs.promises.unlink(tempPath);
    } catch {}
    
    throw new HardenedError({
      code: 'FILE_WRITE_FAILED',
      message: `Failed to write file: ${error.message}`,
      resolution: 'Check file permissions and disk space',
      context: { filePath, error: error.message }
    });
  }
}
```

---

## 5.3 Orphaned File Cleanup

```javascript
// server/src/cleanup/orphaned-files.js

const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const MAX_FILE_AGE = 24 * 60 * 60 * 1000; // 24 hours

async function cleanupOrphanedFiles() {
  console.log('[CLEANUP] Starting orphaned file cleanup...');
  
  const patterns = [
    'data/working/*/documents/*.tmp.*',
    'data/working/*/versions/*.tmp.*',
    'data/working/temp/*'
  ];
  
  let cleanedCount = 0;
  const now = Date.now();
  
  for (const pattern of patterns) {
    try {
      const files = await glob(pattern);
      for (const file of files) {
        const stats = await fs.promises.stat(file);
        const age = now - stats.mtimeMs;
        
        if (age > MAX_FILE_AGE) {
          await fs.promises.unlink(file);
          cleanedCount++;
          console.log(`[CLEANUP] Removed: ${file}`);
        }
      }
    } catch (error) {
      console.error(`[CLEANUP] Error with pattern ${pattern}:`, error);
    }
  }
  
  console.log(`[CLEANUP] Removed ${cleanedCount} orphaned files.`);
}

// Start cleanup scheduler
function startCleanupScheduler() {
  setInterval(cleanupOrphanedFiles, CLEANUP_INTERVAL);
  setTimeout(cleanupOrphanedFiles, 10000); // Run 10s after startup
}
```

---

# 6. Session Management Hardening

## 6.1 Session Timeout Handling

```javascript
// server/src/middleware/session-management.js

const SESSION_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours
const sessionLastActive = new Map();

function trackSessionActivity(req, res, next) {
  const sessionId = req.sessionId || 'default';
  sessionLastActive.set(sessionId, Date.now());
  next();
}

function checkSessionExpiry(req, res, next) {
  const sessionId = req.sessionId || 'default';
  const lastActive = sessionLastActive.get(sessionId);
  
  if (lastActive && Date.now() - lastActive > SESSION_TIMEOUT) {
    sessionLastActive.delete(sessionId);
    
    return res.status(440).json({
      error: 'session_expired',
      message: 'Your session has expired due to inactivity',
      resolution: 'Please refresh the page to start a new session'
    });
  }
  
  next();
}

app.use(trackSessionActivity);
app.use('/api', checkSessionExpiry);
```

---

# 7. Network Operations Hardening

## 7.1 Retry Logic with Exponential Backoff

```javascript
// server/src/utils/retry.js

async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    factor = 2
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = Math.min(initialDelay * Math.pow(factor, attempt), maxDelay);
        console.log(`[RETRY] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new HardenedError({
    code: 'MAX_RETRIES_EXCEEDED',
    message: `Operation failed after ${maxRetries} retries`,
    resolution: 'The service may be temporarily unavailable. Please try again later.',
    context: { maxRetries, lastError: lastError.message }
  });
}
```

---

## 7.2 Circuit Breaker Pattern

```javascript
// server/src/utils/circuit-breaker.js

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.timeout = options.timeout || 60000; // 1 minute
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.nextAttempt = Date.now();
  }
  
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new HardenedError({
          code: 'CIRCUIT_BREAKER_OPEN',
          message: 'Service temporarily unavailable',
          resolution: `Please try again after ${new Date(this.nextAttempt).toLocaleTimeString()}`,
          statusCode: 503
        });
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      console.log('[CIRCUIT] Circuit closed - service recovered');
      this.state = 'CLOSED';
    }
  }
  
  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      console.error(`[CIRCUIT] Circuit opened - ${this.failureCount} failures`);
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}
```

---

# 8. Client-Side Hardening

## 8.1 React Error Boundaries

```javascript
// shared-ui/ErrorBoundary.js

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Log to server
    fetch('/api/v1/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack
      })
    }).catch(() => {});
  }
  
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: {
          padding: 20,
          border: '2px solid #EF4444',
          borderRadius: 8,
          background: '#FEF2F2'
        }
      }, [
        React.createElement('h2', { key: 'title' }, '⚠️ Something went wrong'),
        React.createElement('button', {
          key: 'reload',
          onClick: () => window.location.reload()
        }, 'Reload Page')
      ]);
    }
    
    return this.props.children;
  }
}
```

---

## 8.2 Standardized API Calls

```javascript
// shared-ui/utils/api.js

async function apiCall(endpoint, options = {}) {
  const {
    method = 'GET',
    body = null,
    timeout = 30000,
    retries = 3
  } = options;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : null,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json();
        throw new APIError(error.error, error.message, error.resolution);
      }
      
      return await response.json();
    } catch (error) {
      if (attempt < retries - 1 && error.name !== 'AbortError') {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

---

# Testing Strategy

## Installation Tests (37 tests)

### Phase 1: Dependency Tests (5 tests)
```javascript
describe('Installation Dependencies', () => {
  test('Node.js is available');
  test('npx is available');
  test('Office 16.0+ is installed');
  test('PowerShell is available');
  test('Server is reachable');
});
```

### Phase 2: Download & Validation Tests (4 tests)
```javascript
describe('Manifest Download', () => {
  test('Manifest downloads successfully');
  test('Manifest is valid XML');
  test('Manifest contains required fields');
  test('Download fails gracefully on network error');
});
```

### Phase 3: Registry/Defaults Tests (6 tests)
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

### Phase 4: Installation Flow Tests (8 tests)
```javascript
describe('Fresh Installation', () => {
  test('Clean install succeeds');
  test('Registry entry created');
  test('Manifest file exists');
  test('Cache cleared during install');
  test('Word process closed if running');
  test('Rollback on failure');
  test('Success message displayed');
  test('Installation verified');
});
```

---

## API Endpoint Tests (100+ tests)

### Input Validation Tests
```javascript
describe('Input Validation', () => {
  test('Rejects invalid userId format');
  test('Rejects invalid platform value');
  test('Rejects missing required fields');
  test('Sanitizes input data');
  test('Returns detailed validation errors');
});
```

### Error Handling Tests
```javascript
describe('Error Handling', () => {
  test('Returns 409 on checkout conflict');
  test('Returns 404 on version not found');
  test('Returns 401 on invalid session');
  test('Returns 507 on disk full');
  test('All errors include resolution steps');
});
```

---

## Integration Tests (50+ tests)

### End-to-End Scenarios
```javascript
describe('E2E Scenarios', () => {
  test('Full check-in/out cycle');
  test('Version save and share flow');
  test('Concurrent user operations');
  test('Network failure recovery');
  test('Session timeout handling');
});
```

---

# Implementation Roadmap

## Week 1: Installation Hardening
- [ ] Windows installer hardening
- [ ] macOS installer hardening
- [ ] Uninstallers
- [ ] Environment switchers
- [ ] Installation tests

## Week 2: Server Infrastructure
- [ ] Startup checks
- [ ] Graceful shutdown
- [ ] Health check endpoint
- [ ] State validation
- [ ] Atomic state updates

## Week 3: API Layer
- [ ] Input validation framework
- [ ] Error handling middleware
- [ ] Rate limiting
- [ ] Timeout handling
- [ ] Retry logic

## Week 4: File & Session Management
- [ ] File size limits
- [ ] Atomic file operations
- [ ] Orphaned file cleanup
- [ ] Session timeout handling
- [ ] Abandoned session cleanup

## Week 5: Client & Network
- [ ] Error boundaries
- [ ] Standardized API calls
- [ ] Offline detection
- [ ] Circuit breakers
- [ ] Comprehensive testing

---

# Success Metrics

### Reliability
- ✅ 99.9% uptime
- ✅ 0% data corruption
- ✅ 95%+ operation success rate
- ✅ < 1s recovery time from transient errors

### Error Handling
- ✅ 100% errors have resolution steps
- ✅ < 5s user feedback on errors
- ✅ 90%+ self-service issue resolution
- ✅ 0 silent failures

### Testing
- ✅ 90%+ error path coverage
- ✅ 37+ installation tests
- ✅ 100+ API endpoint tests
- ✅ 50+ integration tests

### Performance
- ✅ < 100ms p95 response time
- ✅ < 1% memory growth/hour
- ✅ < 10GB disk growth/day
- ✅ < 5% CPU idle load

---

## Related Files

### Production Scripts (End Users)
**Location:** `server/public/`
- `install-addin.bat` (Windows installer)
- `install-addin.command` (macOS installer)

### Developer Scripts
**Location:** `tools/scripts/`
- `uninstall-addin.bat` / `.command`
- `use-local.bat` / `.command`
- `use-deployed.bat` / `.command`
- `run-local.bat` - Start local dev environment
- `test-install-local.bat` / `.command`

### Server
- `server/src/server.js`
- `server/src/startup-checks.js`
- `server/src/middleware/validation.js`
- `server/src/middleware/error-handler.js`
- `server/src/middleware/rate-limit.js`

### Tests
- `server/tests/addin-installation.test.js`
- `server/tests/api-endpoints.test.js`
- `server/tests/integration.test.js`

---

**Total Estimated Time:** 5 weeks  
**Priority Order:** Installation → Server → API → Files/Sessions → Client/Network  
**Success Measure:** System runs reliably for 30+ days without manual intervention


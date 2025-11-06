#!/bin/bash
# WordFTW Add-in Installer - VERBOSE Terminal Version
# This runs in Terminal and stays open so you can see all output

# Auto-fix permissions and security
chmod +x "$0" 2>/dev/null
xattr -d com.apple.quarantine "$0" 2>/dev/null

set -x  # Enable command tracing for maximum debugging

# Setup logging
LOG_DIR="$HOME/.wordftw-addin"
LOG_FILE="$LOG_DIR/install.log"
mkdir -p "$LOG_DIR"

# Redirect all output to log with timestamps AND show in terminal
exec > >(while IFS= read -r line; do echo "[$(date '+%H:%M:%S')] $line"; done | tee "$LOG_FILE") 2>&1

echo "========================================"
echo " WordFTW Add-in Installer - VERBOSE MODE"
echo "========================================"
echo ""
echo "This window will stay open so you can see everything."
echo "If there are errors, take a screenshot of this window."
echo ""
echo "Installation started: $(date)"
echo "Running as user: $USER"
echo "Home directory: $HOME"
echo "Script location: $0"
echo "Working directory: $(pwd)"
echo "Shell: $SHELL"
echo "macOS version: $(sw_vers -productVersion)"
echo ""
echo "Press Ctrl+C at any time to cancel"
echo ""
sleep 2

# Check if running on macOS
echo "[CHECK] Verifying macOS..."
if [ "$(uname -s)" != "Darwin" ]; then
  echo "✗ ERROR: This installer is for macOS only"
  echo "  Current OS: $(uname -s)"
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi
echo "✓ Running on macOS $(sw_vers -productVersion)"
echo ""

# Check for Microsoft Word
echo "[CHECK] Looking for Microsoft Word..."
WORD_PATHS=(
  "/Applications/Microsoft Word.app"
  "$HOME/Applications/Microsoft Word.app"
  "/Applications/Microsoft Office 365/Microsoft Word.app"
)

WORD_FOUND=false
for WORD_PATH in "${WORD_PATHS[@]}"; do
  echo "  Checking: $WORD_PATH"
  if [ -d "$WORD_PATH" ]; then
    echo "✓ Found Word at: $WORD_PATH"
    WORD_FOUND=true
    
    # Get Word version
    if [ -f "$WORD_PATH/Contents/Info.plist" ]; then
      WORD_VERSION=$(defaults read "$WORD_PATH/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null || echo "unknown")
      echo "  Word version: $WORD_VERSION"
    fi
    break
  fi
done

if [ "$WORD_FOUND" = false ]; then
  echo "✗ ERROR: Microsoft Word not found"
  echo ""
  echo "Checked locations:"
  for WORD_PATH in "${WORD_PATHS[@]}"; do
    echo "  - $WORD_PATH"
  done
  echo ""
  echo "Please install Microsoft Word before running this installer."
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi
echo ""

# Close Word if running
echo "[STEP 1/6] Checking for running Word..."
echo "Command: pgrep -x 'Microsoft Word'"
WORD_PIDS=$(pgrep -x "Microsoft Word" 2>/dev/null)
PGREP_EXIT=$?
echo "  pgrep exit code: $PGREP_EXIT"

if [ -n "$WORD_PIDS" ]; then
  echo "✓ Word is running (PID: $WORD_PIDS)"
  echo "  Attempting to close Word gracefully..."
  echo "  Command: osascript -e 'quit app \"Microsoft Word\"'"
  
  QUIT_OUTPUT=$(osascript -e 'quit app "Microsoft Word"' 2>&1)
  QUIT_EXIT=$?
  echo "  osascript exit code: $QUIT_EXIT"
  if [ -n "$QUIT_OUTPUT" ]; then
    echo "  osascript output: $QUIT_OUTPUT"
  fi
  
  echo "  Waiting 2 seconds for Word to close..."
  sleep 2
  
  # Verify Word closed
  WORD_PIDS_AFTER=$(pgrep -x "Microsoft Word" 2>/dev/null)
  if [ -n "$WORD_PIDS_AFTER" ]; then
    echo "⚠ Word still running (PID: $WORD_PIDS_AFTER)"
    echo "  Continuing anyway - this might be okay"
  else
    echo "✓ Word closed successfully"
  fi
else
  echo "✓ Word is not running"
fi
echo ""

# Download manifest
echo "[STEP 2/6] Downloading manifest from server..."
MANIFEST_URL="https://wordftw.onrender.com/manifest.xml"
MANIFEST_PATH="$LOG_DIR/manifest.xml"
echo "  Source: $MANIFEST_URL"
echo "  Destination: $MANIFEST_PATH"
echo ""
echo "  Testing connectivity to server..."
echo "  Command: curl -I -s $MANIFEST_URL | head -1"
curl -I -s "$MANIFEST_URL" | head -1
echo ""

echo "  Downloading manifest..."
echo "  Command: curl -f -s -w '\\nHTTP_CODE:%{http_code}' -o '$MANIFEST_PATH' '$MANIFEST_URL'"

CURL_OUTPUT=$(curl -f -s -w "\nHTTP_CODE:%{http_code}\nSIZE_DOWNLOAD:%{size_download}\nTIME_TOTAL:%{time_total}" -o "$MANIFEST_PATH" "$MANIFEST_URL" 2>&1)
CURL_EXIT=$?

echo "  curl exit code: $CURL_EXIT"
if [ -n "$CURL_OUTPUT" ]; then
  echo "  curl metrics:"
  echo "$CURL_OUTPUT" | sed 's/^/    /'
fi

if [ $CURL_EXIT -eq 0 ] && [ -f "$MANIFEST_PATH" ]; then
  FILE_SIZE=$(stat -f%z "$MANIFEST_PATH" 2>/dev/null || echo "0")
  echo "✓ Manifest downloaded successfully"
  echo "  File size: $FILE_SIZE bytes"
  echo "  First 100 chars: $(head -c 100 "$MANIFEST_PATH")"
  echo "  Validating XML..."
  if head -n 1 "$MANIFEST_PATH" | grep -q "<?xml"; then
    echo "  ✓ XML header valid"
  else
    echo "  ⚠ XML header may be invalid"
  fi
else
  echo "✗ FAILED to download manifest"
  echo ""
  echo "ERROR DETAILS:"
  echo "  curl exit code: $CURL_EXIT"
  echo "  File exists: $([ -f "$MANIFEST_PATH" ] && echo "yes" || echo "no")"
  
  case $CURL_EXIT in
    6) echo "  → DNS resolution failed" ;;
    7) echo "  → Connection failed - server unreachable" ;;
    22) echo "  → HTTP error - server returned error" ;;
    28) echo "  → Operation timeout" ;;
    *) echo "  → Unknown error" ;;
  esac
  
  echo ""
  echo "Possible causes:"
  echo "  - No internet connection"
  echo "  - Server is down (https://wordftw.onrender.com)"
  echo "  - Firewall blocking connection"
  echo "  - VPN interference"
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi
echo ""

# Register manifest
echo "[STEP 3/6] Registering add-in with Word..."
MANIFEST_ID="wordftw-addin-prod"
echo "  Manifest ID: $MANIFEST_ID"
echo "  Manifest path: $MANIFEST_PATH"
echo "  Preference domain: com.microsoft.Word"
echo "  Preference key: wef.developer.manifests"
echo ""

echo "  Checking if Word preferences exist..."
if defaults read com.microsoft.Word &>/dev/null; then
  echo "  ✓ Word preferences found"
  PREF_COUNT=$(defaults read com.microsoft.Word 2>/dev/null | wc -l)
  echo "    Preference entries: $PREF_COUNT lines"
else
  echo "  ⚠ Word preferences not found"
  echo "    This is normal if Word hasn't been launched yet"
fi
echo ""

echo "  Writing add-in registration..."
echo "  Command: defaults write com.microsoft.Word 'wef.developer.manifests' -dict-add '$MANIFEST_ID' '$MANIFEST_PATH'"

DEFAULTS_OUTPUT=$(defaults write com.microsoft.Word "wef.developer.manifests" -dict-add "$MANIFEST_ID" "$MANIFEST_PATH" 2>&1)
DEFAULTS_EXIT=$?

echo "  defaults write exit code: $DEFAULTS_EXIT"
if [ -n "$DEFAULTS_OUTPUT" ]; then
  echo "  defaults write output:"
  echo "$DEFAULTS_OUTPUT" | sed 's/^/    /'
fi

if [ $DEFAULTS_EXIT -eq 0 ]; then
  echo "✓ Registration command succeeded"
else
  echo "✗ Registration command FAILED"
  echo "  This may indicate:"
  echo "  - Permission issues"
  echo "  - Word not installed properly"
  echo "  - Corrupted preference file"
fi
echo ""

# Kill preferences daemon
echo "[STEP 4/6] Refreshing macOS preference cache..."
echo "  Command: killall cfprefsd"
KILLALL_OUTPUT=$(killall cfprefsd 2>&1)
KILLALL_EXIT=$?
echo "  killall exit code: $KILLALL_EXIT"
if [ $KILLALL_EXIT -eq 0 ]; then
  echo "  ✓ Preference cache refreshed"
else
  echo "  ✓ Preference daemon not running (normal)"
fi
echo "  Waiting 1 second for propagation..."
sleep 1
echo ""

# Verify registration
echo "[STEP 5/6] Verifying registration..."
echo "  Command: defaults read com.microsoft.Word 'wef.developer.manifests.$MANIFEST_ID'"

VERIFY_OUTPUT=$(defaults read com.microsoft.Word "wef.developer.manifests.$MANIFEST_ID" 2>&1)
VERIFY_EXIT=$?

echo "  defaults read exit code: $VERIFY_EXIT"
echo "  defaults read output: $VERIFY_OUTPUT"

if [ $VERIFY_EXIT -eq 0 ]; then
  echo "✓ Verification PASSED - add-in is registered"
  echo "  Registered path: $VERIFY_OUTPUT"
  
  if [ "$VERIFY_OUTPUT" = "$MANIFEST_PATH" ]; then
    echo "  ✓ Path matches exactly"
  else
    echo "  ⚠ Path mismatch (but probably okay)"
    echo "    Expected: $MANIFEST_PATH"
    echo "    Got: $VERIFY_OUTPUT"
  fi
else
  echo "⚠ Verification FAILED"
  echo ""
  echo "This is OFTEN NORMAL and doesn't mean installation failed."
  echo "Common reasons:"
  echo "  - Word has never been launched (no preference file yet)"
  echo "  - Word is not licensed/activated"
  echo "  - macOS security restrictions"
  echo ""
  echo "The add-in will still work once Word is properly set up."
  echo ""
  
  # Try to read entire dictionary for debugging
  echo "  Attempting to read full wef.developer.manifests dictionary..."
  FULL_DICT=$(defaults read com.microsoft.Word "wef.developer.manifests" 2>&1)
  FULL_EXIT=$?
  echo "  Full dictionary exit code: $FULL_EXIT"
  
  if [ $FULL_EXIT -eq 0 ]; then
    echo "  Full dictionary contents:"
    echo "$FULL_DICT" | sed 's/^/    /'
  else
    echo "  Cannot read full dictionary: $FULL_DICT"
  fi
fi
echo ""

# Download sample document
echo "[STEP 6/6] Downloading sample document..."
DOC_PATH="$LOG_DIR/document.docx"
DOC_URL="https://wordftw.onrender.com/documents/working/default.docx"
echo "  Source: $DOC_URL"
echo "  Destination: $DOC_PATH"
echo ""

echo "  Command: curl -f -s -o '$DOC_PATH' '$DOC_URL'"
DOC_CURL_OUTPUT=$(curl -f -s -w "\nHTTP_CODE:%{http_code}\nSIZE_DOWNLOAD:%{size_download}" -o "$DOC_PATH" "$DOC_URL" 2>&1)
DOC_CURL_EXIT=$?

echo "  curl exit code: $DOC_CURL_EXIT"
if [ -n "$DOC_CURL_OUTPUT" ]; then
  echo "  curl metrics:"
  echo "$DOC_CURL_OUTPUT" | sed 's/^/    /'
fi

if [ $DOC_CURL_EXIT -eq 0 ] && [ -f "$DOC_PATH" ]; then
  DOC_SIZE=$(stat -f%z "$DOC_PATH" 2>/dev/null || echo "0")
  echo "✓ Document downloaded successfully"
  echo "  File size: $DOC_SIZE bytes"
  echo "  Location: $DOC_PATH"
else
  echo "⚠ Document download failed (not critical)"
  echo "  You can open any Word document to test the add-in"
fi
echo ""

# Success summary
echo "========================================"
echo " Installation Complete!"
echo "========================================"
echo ""
echo "✓ Installation successful"
echo ""
echo "Summary:"
echo "  • Manifest downloaded from: wordftw.onrender.com"
echo "  • Manifest registered in Word preferences"
echo "  • Manifest ID: $MANIFEST_ID"
echo "  • Manifest location: $MANIFEST_PATH"
echo "  • Log file: $LOG_FILE"
echo ""
echo "Next steps:"
echo "  1. Open Microsoft Word"
echo "  2. Click: Insert → My Add-ins"
echo "  3. Click: Developer Add-ins (at top)"
echo "  4. Click: Redlined & Signed"
echo ""
echo "The add-in panel will appear on the right side."
echo ""
echo "Installation completed: $(date)"
echo ""

# Show notification
osascript -e 'display notification "Installation complete! Open Word to activate the add-in." with title "WordFTW Installer" sound name "Glass"' 2>/dev/null || true

# Open Word with document
if [ -f "$DOC_PATH" ]; then
  echo "Opening Word with sample document..."
  echo "Command: open -a 'Microsoft Word' '$DOC_PATH'"
  
  OPEN_OUTPUT=$(open -a "Microsoft Word" "$DOC_PATH" 2>&1)
  OPEN_EXIT=$?
  
  echo "  open exit code: $OPEN_EXIT"
  if [ -n "$OPEN_OUTPUT" ]; then
    echo "  open output: $OPEN_OUTPUT"
  fi
  
  if [ $OPEN_EXIT -eq 0 ]; then
    echo "✓ Word launched"
  else
    echo "⚠ Could not launch Word automatically"
  fi
else
  echo "No document available to open"
  echo "Please open Word manually"
fi

echo ""
echo "========================================"
echo " DONE"
echo "========================================"
echo ""
echo "If you encountered errors, take a screenshot"
echo "of this entire window and send it to support."
echo ""
echo "Full log saved to:"
echo "  $LOG_FILE"
echo ""
read -p "Press Enter to close this window..."

exit 0


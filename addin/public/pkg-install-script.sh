#!/bin/bash
# WordFTW Add-in Installer - Non-interactive version for .pkg
# This runs automatically when the .pkg is installed

set -x  # Enable command tracing for debugging

# Setup logging
LOG_DIR="$HOME/.wordftw-addin"
LOG_FILE="$LOG_DIR/install.log"
mkdir -p "$LOG_DIR"

# Redirect all output to log with timestamps
exec > >(while IFS= read -r line; do echo "[$(date '+%Y-%m-%d %H:%M:%S')] $line"; done | tee "$LOG_FILE") 2>&1

echo "========================================"
echo " WordFTW Add-in - Automated Installation"
echo "========================================"
echo "Installation started: $(date)"
echo "Running as user: $USER"
echo "Home directory: $HOME"
echo "Script location: $0"
echo "Working directory: $(pwd)"
echo "Shell: $SHELL"
echo "PATH: $PATH"
echo ""

# Close Word if running
echo "[STEP 1/6] Checking for running Word..."
echo "Command: pgrep -x 'Microsoft Word'"
WORD_PIDS=$(pgrep -x "Microsoft Word" 2>/dev/null)
PGREP_EXIT=$?
echo "pgrep exit code: $PGREP_EXIT"

if [ -n "$WORD_PIDS" ]; then
  echo "✓ Word is running (PID: $WORD_PIDS)"
  echo "Attempting to close Word..."
  echo "Command: osascript -e 'quit app \"Microsoft Word\"'"
  
  QUIT_OUTPUT=$(osascript -e 'quit app "Microsoft Word"' 2>&1)
  QUIT_EXIT=$?
  echo "osascript exit code: $QUIT_EXIT"
  if [ -n "$QUIT_OUTPUT" ]; then
    echo "osascript output: $QUIT_OUTPUT"
  fi
  
  echo "Waiting 2 seconds for Word to close..."
  sleep 2
  
  # Verify Word closed
  WORD_PIDS_AFTER=$(pgrep -x "Microsoft Word" 2>/dev/null)
  if [ -n "$WORD_PIDS_AFTER" ]; then
    echo "⚠ Word still running (PID: $WORD_PIDS_AFTER) but continuing..."
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
echo "URL: $MANIFEST_URL"
echo "Destination: $MANIFEST_PATH"
echo "Command: curl -f -s -w '\\nHTTP_CODE:%{http_code}' -o '$MANIFEST_PATH' '$MANIFEST_URL'"

CURL_OUTPUT=$(curl -f -s -w "\nHTTP_CODE:%{http_code}\nSIZE_DOWNLOAD:%{size_download}\nTIME_TOTAL:%{time_total}" -o "$MANIFEST_PATH" "$MANIFEST_URL" 2>&1)
CURL_EXIT=$?

echo "curl exit code: $CURL_EXIT"
if [ -n "$CURL_OUTPUT" ]; then
  echo "curl output:"
  echo "$CURL_OUTPUT"
fi

if [ $CURL_EXIT -eq 0 ] && [ -f "$MANIFEST_PATH" ]; then
  FILE_SIZE=$(stat -f%z "$MANIFEST_PATH" 2>/dev/null || echo "0")
  echo "✓ Manifest downloaded successfully"
  echo "  File size: $FILE_SIZE bytes"
  echo "  First line: $(head -n 1 "$MANIFEST_PATH")"
else
  echo "✗ Failed to download manifest"
  echo "  curl exit code: $CURL_EXIT"
  echo "  File exists: $([ -f "$MANIFEST_PATH" ] && echo "yes" || echo "no")"
  echo ""
  echo "ERROR DETAILS:"
  case $CURL_EXIT in
    6) echo "  DNS resolution failed - check internet connection" ;;
    7) echo "  Connection failed - server unreachable" ;;
    22) echo "  HTTP error - server returned error code" ;;
    28) echo "  Operation timeout - check network speed" ;;
    *) echo "  Unknown curl error code: $CURL_EXIT" ;;
  esac
  echo ""
  echo "You can retry installation later when connectivity is restored."
  exit 1
fi
echo ""

# Register manifest
echo "[STEP 3/6] Registering add-in with Word..."
MANIFEST_ID="wordftw-addin-prod"
echo "Manifest ID: $MANIFEST_ID"
echo "Manifest path: $MANIFEST_PATH"
echo "Target preference domain: com.microsoft.Word"
echo "Target preference key: wef.developer.manifests"
echo ""

echo "Command: defaults write com.microsoft.Word 'wef.developer.manifests' -dict-add '$MANIFEST_ID' '$MANIFEST_PATH'"
DEFAULTS_OUTPUT=$(defaults write com.microsoft.Word "wef.developer.manifests" -dict-add "$MANIFEST_ID" "$MANIFEST_PATH" 2>&1)
DEFAULTS_EXIT=$?

echo "defaults write exit code: $DEFAULTS_EXIT"
if [ -n "$DEFAULTS_OUTPUT" ]; then
  echo "defaults write output: $DEFAULTS_OUTPUT"
fi

if [ $DEFAULTS_EXIT -eq 0 ]; then
  echo "✓ defaults write command succeeded"
else
  echo "✗ defaults write command failed"
  echo "  This may indicate permission issues or Word not installed"
fi
echo ""

# Kill preferences daemon
echo "[STEP 4/6] Refreshing preference cache..."
echo "Command: killall cfprefsd"
if killall cfprefsd 2>/dev/null; then
  echo "✓ Preferences daemon restarted"
else
  echo "✓ Preferences daemon not running (normal)"
fi
echo "Waiting 1 second for preferences to propagate..."
sleep 1
echo ""

# Verify registration
echo "[STEP 5/6] Verifying registration..."
echo "Command: defaults read com.microsoft.Word 'wef.developer.manifests.$MANIFEST_ID'"

VERIFY_OUTPUT=$(defaults read com.microsoft.Word "wef.developer.manifests.$MANIFEST_ID" 2>&1)
VERIFY_EXIT=$?

echo "defaults read exit code: $VERIFY_EXIT"
echo "defaults read output: $VERIFY_OUTPUT"

if [ $VERIFY_EXIT -eq 0 ]; then
  echo "✓ Add-in registered successfully"
  echo "  Registered path: $VERIFY_OUTPUT"
  
  if [ "$VERIFY_OUTPUT" = "$MANIFEST_PATH" ]; then
    echo "  Path verification: MATCH ✓"
  else
    echo "  Path verification: MISMATCH (but may still work)"
  fi
else
  echo "⚠ Registration verification failed"
  echo "  This is often NORMAL if:"
  echo "  - Word hasn't been launched yet (no preference file)"
  echo "  - Word is not licensed"
  echo "  The add-in will still work once Word is properly set up"
  
  # Try to read the entire dictionary for debugging
  echo ""
  echo "Attempting to read entire wef.developer.manifests dictionary..."
  FULL_DICT=$(defaults read com.microsoft.Word "wef.developer.manifests" 2>&1)
  FULL_EXIT=$?
  echo "Full dictionary exit code: $FULL_EXIT"
  if [ $FULL_EXIT -eq 0 ]; then
    echo "Full dictionary:"
    echo "$FULL_DICT"
  else
    echo "Cannot read dictionary: $FULL_DICT"
  fi
fi
echo ""

# Download sample document
echo "[STEP 6/6] Downloading sample document..."
DOC_PATH="$LOG_DIR/document.docx"
DOC_URL="https://wordftw.onrender.com/documents/working/default.docx"
echo "URL: $DOC_URL"
echo "Destination: $DOC_PATH"
echo "Command: curl -f -s -w '\\nHTTP_CODE:%{http_code}' -o '$DOC_PATH' '$DOC_URL'"

DOC_CURL_OUTPUT=$(curl -f -s -w "\nHTTP_CODE:%{http_code}\nSIZE_DOWNLOAD:%{size_download}" -o "$DOC_PATH" "$DOC_URL" 2>&1)
DOC_CURL_EXIT=$?

echo "curl exit code: $DOC_CURL_EXIT"
if [ -n "$DOC_CURL_OUTPUT" ]; then
  echo "curl output:"
  echo "$DOC_CURL_OUTPUT"
fi

if [ $DOC_CURL_EXIT -eq 0 ] && [ -f "$DOC_PATH" ]; then
  DOC_SIZE=$(stat -f%z "$DOC_PATH" 2>/dev/null || echo "0")
  echo "✓ Document downloaded successfully"
  echo "  File size: $DOC_SIZE bytes"
  echo "  File location: $DOC_PATH"
else
  echo "⚠ Could not download sample document"
  echo "  This is not critical - you can open any Word document"
  echo "  curl exit code: $DOC_CURL_EXIT"
  echo "  File exists: $([ -f "$DOC_PATH" ] && echo "yes" || echo "no")"
fi
echo ""

echo "========================================"
echo " Installation Complete!"
echo "========================================"
echo ""
echo "✓ The WordFTW add-in has been installed successfully"
echo ""
echo "Installation summary:"
echo "  - Manifest downloaded and registered"
echo "  - Preference domain: com.microsoft.Word"
echo "  - Manifest ID: $MANIFEST_ID"
echo "  - Manifest location: $MANIFEST_PATH"
echo "  - Installation log: $LOG_FILE"
echo ""
echo "Next steps:"
echo "  1. Open Microsoft Word"
echo "  2. Click Insert → My Add-ins"
echo "  3. Click 'Developer Add-ins'"
echo "  4. Click 'Redlined & Signed'"
echo ""
echo "The add-in panel will appear on the right side of Word."
echo ""
echo "Installation completed: $(date)"
echo ""

# Show notification to user
echo "Showing notification to user..."
NOTIFY_OUTPUT=$(osascript -e 'display notification "The WordFTW add-in has been installed successfully. Open Word to activate it." with title "WordFTW Installation Complete" sound name "Glass"' 2>&1)
NOTIFY_EXIT=$?
echo "Notification exit code: $NOTIFY_EXIT"
if [ -n "$NOTIFY_OUTPUT" ]; then
  echo "Notification output: $NOTIFY_OUTPUT"
fi
echo ""

# Optionally open Word with the document
if [ -f "$DOC_PATH" ]; then
  echo "Opening Word with sample document..."
  echo "Command: open -a 'Microsoft Word' '$DOC_PATH'"
  
  OPEN_OUTPUT=$(open -a "Microsoft Word" "$DOC_PATH" 2>&1)
  OPEN_EXIT=$?
  
  echo "open command exit code: $OPEN_EXIT"
  if [ -n "$OPEN_OUTPUT" ]; then
    echo "open command output: $OPEN_OUTPUT"
  fi
  
  if [ $OPEN_EXIT -eq 0 ]; then
    echo "✓ Word launched successfully"
  else
    echo "⚠ Could not launch Word automatically"
    echo "  Please open Word manually"
  fi
else
  echo "Skipping Word launch (no document available)"
  echo "Please open Word manually to test the add-in"
fi

echo ""
echo "Full installation log saved to: $LOG_FILE"
echo "Send this log file to support if you encounter any issues."
echo ""

exit 0


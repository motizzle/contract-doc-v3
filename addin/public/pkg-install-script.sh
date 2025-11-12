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

# Register manifest by copying to Word's wef folder (official Mac method)
echo "[STEP 3/6] Installing add-in manifest..."
echo "Installing to Word's add-in folder for sandboxed Word..."
echo ""

# Check if Word is sandboxed (has Containers directory)
WEF_DIR_SANDBOXED="$HOME/Library/Containers/com.microsoft.Word/Data/Documents/wef"
WEF_DIR_NORMAL="$HOME/Library/Application Support/Microsoft/Office/16.0/wef"

# Try sandboxed location first (most common for modern Mac Word)
if [ -d "$HOME/Library/Containers/com.microsoft.Word" ]; then
  WEF_DIR="$WEF_DIR_SANDBOXED"
  echo "Detected sandboxed Word installation"
else
  WEF_DIR="$WEF_DIR_NORMAL"
  echo "Detected non-sandboxed Word installation"
fi

echo "Target directory: $WEF_DIR"
echo ""

# Create wef directory if it doesn't exist
echo "Creating add-in directory..."
if mkdir -p "$WEF_DIR" 2>/dev/null; then
  echo "✓ Directory ready: $WEF_DIR"
else
  echo "✗ Failed to create directory: $WEF_DIR"
  echo "  This may indicate permission issues"
  exit 1
fi

# Copy manifest to wef folder
echo ""
echo "Copying manifest to Word's add-in folder..."
echo "Command: cp '$MANIFEST_PATH' '$WEF_DIR/manifest.xml'"

if cp "$MANIFEST_PATH" "$WEF_DIR/manifest.xml" 2>/dev/null; then
  echo "✓ Manifest copied successfully"
else
  echo "✗ Failed to copy manifest"
  exit 1
fi

# Verify the copy
echo ""
echo "[STEP 4/6] Verifying installation..."
if [ -f "$WEF_DIR/manifest.xml" ]; then
  FILE_SIZE=$(stat -f%z "$WEF_DIR/manifest.xml" 2>/dev/null || echo "0")
  echo "✓ Manifest installed successfully"
  echo "  Location: $WEF_DIR/manifest.xml"
  echo "  Size: $FILE_SIZE bytes"
else
  echo "⚠ Manifest verification failed"
  echo "  File not found at: $WEF_DIR/manifest.xml"
fi
echo ""

# Download sample document
echo "[STEP 5/5] Downloading sample document..."
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
echo " Installation complete"
echo "========================================"
echo ""
echo "The WordFTW add-in has been installed successfully."
echo ""
echo "Installation summary:"
echo "  - Manifest installed to: $WEF_DIR"
echo "  - Installation log: $LOG_FILE"
echo ""
echo "To activate the add-in:"
echo "  1. Open Microsoft Word"
echo "  2. Go to Insert → My Add-ins"
echo "  3. Look under 'Shared Folder'"
echo "  4. Select 'OpenGov Contracting'"
echo ""
echo "The add-in will appear on the right side of Word."
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


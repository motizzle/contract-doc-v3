#!/bin/bash

# Auto-fix permissions and security
chmod +x "$0" 2>/dev/null
xattr -d com.apple.quarantine "$0" 2>/dev/null

# Setup logging
LOG_FILE="$HOME/.wordftw-addin/install.log"
mkdir -p "$HOME/.wordftw-addin"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "========================================"
echo " Redlined & Signed - Word Add-in Installer"
echo "========================================"
echo ""
echo "Installation started: $(date)"
echo "Log file: $LOG_FILE"
echo ""

# Function to log errors and exit
log_error() {
  echo ""
  echo "========================================"
  echo " [ERROR] Installation Failed"
  echo "========================================"
  echo ""
  echo "$1"
  echo ""
  echo "DEBUG INFORMATION:"
  echo "- macOS Version: $(sw_vers -productVersion)"
  echo "- Script Location: $0"
  echo "- Current User: $USER"
  echo "- Timestamp: $(date)"
  echo ""
  echo "Full installation log saved to:"
  echo "$LOG_FILE"
  echo ""
  echo "Please send this log file to support for assistance."
  echo ""
  read -p "Press enter to exit..."
  exit 1
}

# Check if running on macOS
if [ "$(uname -s)" != "Darwin" ]; then
  log_error "This installer is for macOS only. For Windows, use install-addin.bat"
fi
echo "[OK] Running on macOS $(sw_vers -productVersion)"

# Check for Microsoft Word
echo ""
echo "Checking for Microsoft Word..."
WORD_PATHS=(
  "/Applications/Microsoft Word.app"
  "$HOME/Applications/Microsoft Word.app"
  "/Applications/Microsoft Office 365/Microsoft Word.app"
)

WORD_FOUND=false
for WORD_PATH in "${WORD_PATHS[@]}"; do
  if [ -d "$WORD_PATH" ]; then
    echo "[OK] Found Word at: $WORD_PATH"
    WORD_FOUND=true
    break
  fi
done

if [ "$WORD_FOUND" = false ]; then
  log_error "Microsoft Word not found. Please install Microsoft Word first.\nChecked locations:\n${WORD_PATHS[*]}"
fi

# Close Word if it's running
echo ""
echo "Closing Word if running..."
if pgrep -x "Microsoft Word" > /dev/null; then
  echo "- Word is running, closing..."
  osascript -e 'quit app "Microsoft Word"' 2>/dev/null
  sleep 2
  if pgrep -x "Microsoft Word" > /dev/null; then
    log_error "Failed to close Word. Please close Word manually and try again."
  fi
  echo "- Word closed successfully"
else
  echo "- Word is not running"
fi

# Download manifest to temp location
echo ""
echo "Downloading manifest..."
TEMP_DIR="$HOME/.wordftw-addin"
mkdir -p "$TEMP_DIR" || log_error "Failed to create temp directory: $TEMP_DIR"

MANIFEST_URL="https://wordftw.onrender.com/manifest.xml"
echo "- URL: $MANIFEST_URL"
echo "- Destination: $TEMP_DIR/manifest.xml"

if ! curl -f -s -o "$TEMP_DIR/manifest.xml" "$MANIFEST_URL"; then
  log_error "Failed to download manifest from:\n$MANIFEST_URL\n\nPlease check:\n1. Internet connection\n2. Server status\n3. Firewall settings"
fi

# Verify manifest downloaded and is valid XML
if [ ! -f "$TEMP_DIR/manifest.xml" ]; then
  log_error "Manifest file not found after download"
fi

FILE_SIZE=$(stat -f%z "$TEMP_DIR/manifest.xml" 2>/dev/null || echo "0")
if [ "$FILE_SIZE" -lt 100 ]; then
  log_error "Downloaded manifest file is too small ($FILE_SIZE bytes). May be corrupt or error page."
fi

echo "- Downloaded successfully ($FILE_SIZE bytes)"

# Validate XML (basic check)
if ! head -n 1 "$TEMP_DIR/manifest.xml" | grep -q "<?xml"; then
  echo "[WARN] Manifest may not be valid XML, but continuing..."
fi

# Register manifest in Office preferences
echo ""
echo "Registering add-in..."
MANIFEST_ID="wordftw-addin-prod"

if ! defaults write com.microsoft.Word "wef.developer.manifests" -dict-add "$MANIFEST_ID" "$TEMP_DIR/manifest.xml" 2>/dev/null; then
  log_error "Failed to register add-in.\n\nPossible causes:\n1. Permission denied (try with sudo)\n2. Word preferences file is locked\n3. Invalid manifest path"
fi

# Kill preferences daemon to ensure changes apply
killall cfprefsd 2>/dev/null

# Verify registration
sleep 1
if defaults read com.microsoft.Word "wef.developer.manifests.$MANIFEST_ID" &>/dev/null; then
  echo "- Add-in registered successfully"
else
  log_error "Registration verification failed. The add-in was not properly registered."
fi

echo ""
echo "========================================"
echo " [SUCCESS] Installation Complete!"
echo "========================================"
echo ""
echo "The add-in has been registered and will appear in Word:"
echo "  Insert > My Add-ins > Developer Add-ins"
echo ""
echo "Next steps:"
echo "1. Open Word with document (press enter below)"
echo "2. The add-in will appear automatically"
echo "3. Or go to: Insert > My Add-ins > Developer Add-ins"
echo ""
echo "Installation log saved to:"
echo "$LOG_FILE"
echo ""
read -p "Press enter to open Word with document..."

# Download the document
echo "Downloading document..."
DOC_PATH="$HOME/.wordftw-addin/document.docx"
if curl -f -s -o "$DOC_PATH" "https://wordftw.onrender.com/documents/working/default.docx"; then
  echo "[OK] Document downloaded"
  # Open Word with the document
  if ! open -a "Microsoft Word" "$DOC_PATH" 2>/dev/null; then
    echo "[WARN] Could not open Word with document"
    echo "Trying to open Word normally..."
    open -a "Microsoft Word" 2>/dev/null || echo "Please open Word manually from Applications"
  fi
else
  echo "[WARN] Could not download document"
  echo "Opening Word normally..."
  if ! open -a "Microsoft Word" 2>/dev/null; then
    echo "[WARN] Could not open Word automatically"
    echo "Please open Word manually from Applications"
    read -p "Press enter to exit..."
  fi
fi

echo ""
echo "Installation completed: $(date)"
exit 0

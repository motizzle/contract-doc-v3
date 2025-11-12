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

# Install manifest to Word's wef folder (official Mac method for sandboxed Word)
echo ""
echo "Installing add-in..."

# Check if Word is sandboxed (has Containers directory)
if [ -d "$HOME/Library/Containers/com.microsoft.Word" ]; then
  WEF_DIR="$HOME/Library/Containers/com.microsoft.Word/Data/Documents/wef"
  echo "- Detected sandboxed Word installation"
else
  WEF_DIR="$HOME/Library/Application Support/Microsoft/Office/16.0/wef"
  echo "- Detected non-sandboxed Word installation"
fi

# Create wef directory if it doesn't exist
if ! mkdir -p "$WEF_DIR" 2>/dev/null; then
  log_error "Failed to create add-in directory at:\n$WEF_DIR\n\nThis may indicate permission issues."
fi

# Copy manifest to wef folder
if cp "$TEMP_DIR/manifest.xml" "$WEF_DIR/manifest.xml" 2>/dev/null; then
  echo "- Add-in installed successfully"
  echo "- Location: $WEF_DIR/manifest.xml"
else
  log_error "Failed to copy manifest to:\n$WEF_DIR/manifest.xml\n\nThis may indicate permission issues."
fi

# Verify installation
sleep 1
if [ -f "$WEF_DIR/manifest.xml" ]; then
  FILE_SIZE=$(stat -f%z "$WEF_DIR/manifest.xml" 2>/dev/null || echo "0")
  echo "- Installation verified ($FILE_SIZE bytes)"
else
  log_error "Installation verification failed. Manifest not found at:\n$WEF_DIR/manifest.xml"
fi

echo ""
echo "========================================"
echo " Installation complete"
echo "========================================"
echo ""
echo "Installation log saved to: $LOG_FILE"
echo ""
echo "Downloading document and opening Word..."
echo ""

# Download the document
DOC_PATH="$HOME/.wordftw-addin/document.docx"
if curl -f -s -o "$DOC_PATH" "https://wordftw.onrender.com/documents/working/default.docx"; then
  echo "[OK] Document downloaded"
  # Open Word with the document
  if open -a "Microsoft Word" "$DOC_PATH" 2>/dev/null; then
    sleep 2
    echo ""
    echo "========================================"
    echo " How to activate the add-in"
    echo "========================================"
    echo ""
    echo "Word is now open with your document."
    echo ""
    echo "To activate the add-in (first time only):"
    echo "  1. In Word, go to Insert → My Add-ins"
    echo "  2. Look under 'Shared Folder'"
    echo "  3. Select 'OpenGov Contracting'"
    echo ""
    echo "The add-in panel will appear on the right side."
    echo "After this first activation, Word will remember your choice."
    echo ""
  else
    echo "[WARN] Could not open Word with document"
    echo "Please open Word manually and then open the document:"
    echo "  $DOC_PATH"
  fi
else
  echo "[ERROR] Could not download document from server"
  echo "Please check your internet connection."
  echo ""
  open -a "Microsoft Word" 2>/dev/null || echo "Please open Word manually from Applications"
fi

echo ""
read -p "Press enter to close..."
echo ""
echo "Installation completed: $(date)"
exit 0

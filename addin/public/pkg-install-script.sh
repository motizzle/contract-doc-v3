#!/bin/bash
# WordFTW Add-in Installer - Non-interactive version for .pkg
# This runs automatically when the .pkg is installed

# Setup logging
LOG_DIR="$HOME/.wordftw-addin"
LOG_FILE="$LOG_DIR/install.log"
mkdir -p "$LOG_DIR"

# Redirect all output to log
exec > >(tee "$LOG_FILE") 2>&1

echo "========================================"
echo " WordFTW Add-in - Automated Installation"
echo "========================================"
echo "Installation started: $(date)"
echo ""

# Close Word if running
echo "Checking for running Word..."
WORD_PIDS=$(pgrep -x "Microsoft Word" 2>/dev/null)
if [ -n "$WORD_PIDS" ]; then
  echo "Closing Word (PID: $WORD_PIDS)..."
  osascript -e 'quit app "Microsoft Word"' 2>/dev/null || true
  sleep 2
fi

# Download manifest
echo "Downloading manifest from server..."
MANIFEST_URL="https://wordftw.onrender.com/manifest.xml"
MANIFEST_PATH="$LOG_DIR/manifest.xml"

if curl -f -s -o "$MANIFEST_PATH" "$MANIFEST_URL"; then
  FILE_SIZE=$(stat -f%z "$MANIFEST_PATH" 2>/dev/null || echo "0")
  echo "✓ Manifest downloaded ($FILE_SIZE bytes)"
else
  echo "✗ Failed to download manifest"
  echo "  This may be due to network connectivity"
  echo "  You can retry installation later"
  exit 1
fi

# Register manifest
echo "Registering add-in with Word..."
MANIFEST_ID="wordftw-addin-prod"

defaults write com.microsoft.Word "wef.developer.manifests" -dict-add "$MANIFEST_ID" "$MANIFEST_PATH" 2>&1

# Kill preferences daemon
killall cfprefsd 2>/dev/null || true
sleep 1

# Verify registration
if defaults read com.microsoft.Word "wef.developer.manifests.$MANIFEST_ID" &>/dev/null; then
  echo "✓ Add-in registered successfully"
else
  echo "✗ Registration verification failed"
  echo "  This may be normal if Word hasn't been launched yet"
fi

# Download sample document
echo "Downloading sample document..."
DOC_PATH="$LOG_DIR/document.docx"
DOC_URL="https://wordftw.onrender.com/documents/working/default.docx"

if curl -f -s -o "$DOC_PATH" "$DOC_URL"; then
  DOC_SIZE=$(stat -f%z "$DOC_PATH" 2>/dev/null || echo "0")
  echo "✓ Document downloaded ($DOC_SIZE bytes)"
else
  echo "✗ Could not download sample document"
  echo "  You can open any Word document to test the add-in"
fi

echo ""
echo "========================================"
echo " Installation Complete!"
echo "========================================"
echo ""
echo "The WordFTW add-in has been installed."
echo ""
echo "Next steps:"
echo "  1. Open Microsoft Word"
echo "  2. Click Insert → My Add-ins"
echo "  3. Click 'Developer Add-ins'"
echo "  4. Click 'Redlined & Signed'"
echo ""
echo "Installation log: $LOG_FILE"
echo "Installation completed: $(date)"
echo ""

# Show notification to user
osascript -e 'display notification "The WordFTW add-in has been installed successfully. Open Word to activate it." with title "WordFTW Installation Complete" sound name "Glass"' 2>/dev/null || true

# Optionally open Word with the document
if [ -f "$DOC_PATH" ]; then
  echo "Opening Word with sample document..."
  open -a "Microsoft Word" "$DOC_PATH" 2>/dev/null || true
fi

exit 0


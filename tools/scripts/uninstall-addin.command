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


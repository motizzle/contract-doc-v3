#!/bin/bash

echo "========================================"
echo " Redlined & Signed - Uninstaller"
echo "========================================"
echo ""

# Close Word
echo "Closing Word if running..."
osascript -e 'quit app "Microsoft Word"' 2>/dev/null
sleep 2

# Remove manifest from wef folder
echo "Removing add-in..."

# Check both possible locations
WEF_DIR_SANDBOXED="$HOME/Library/Containers/com.microsoft.Word/Data/Documents/wef"
WEF_DIR_NORMAL="$HOME/Library/Application Support/Microsoft/Office/16.0/wef"

REMOVED=false
if [ -f "$WEF_DIR_SANDBOXED/manifest.xml" ]; then
  rm -f "$WEF_DIR_SANDBOXED/manifest.xml" 2>/dev/null
  echo "- Removed from sandboxed location"
  REMOVED=true
fi

if [ -f "$WEF_DIR_NORMAL/manifest.xml" ]; then
  rm -f "$WEF_DIR_NORMAL/manifest.xml" 2>/dev/null
  echo "- Removed from normal location"
  REMOVED=true
fi

if [ "$REMOVED" = false ]; then
  echo "[WARNING] Manifest not found in either location"
fi

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
STILL_EXISTS=false
if [ -f "$WEF_DIR_SANDBOXED/manifest.xml" ] || [ -f "$WEF_DIR_NORMAL/manifest.xml" ]; then
  STILL_EXISTS=true
fi

if [ "$STILL_EXISTS" = true ]; then
  echo ""
  echo "[WARNING] Uninstall may be incomplete"
  echo "Manifest file still exists. Please manually remove it."
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


#!/bin/bash

echo "========================================"
echo " Redlined & Signed - Word Add-in Installer"
echo "========================================"
echo ""
echo "This will install the Word add-in..."
echo ""

# Create the catalog folder if it doesn't exist
CATALOG_DIR="$HOME/Library/Containers/com.microsoft.Word/Data/Documents/wef"
mkdir -p "$CATALOG_DIR"

# Download the manifest
echo "Downloading manifest..."
curl -L "https://wordftw.onrender.com/manifest.xml" -o "$CATALOG_DIR/manifest.xml"

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Failed to download manifest."
    echo "Please check your internet connection and try again."
    read -p "Press any key to exit..."
    exit 1
fi

echo ""
echo "========================================"
echo " Installation Complete!"
echo "========================================"
echo ""
echo "The add-in has been installed."
echo ""
echo "Next steps:"
echo "1. Open Microsoft Word"
echo "2. Go to: Insert > My Add-ins > Shared Folder"
echo "3. Click 'Redlined & Signed'"
echo ""
echo "Press any key to open Word now..."
read -n 1 -s

# Open Word
open -a "Microsoft Word"

exit 0


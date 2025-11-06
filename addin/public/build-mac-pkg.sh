#!/bin/bash
# Build a macOS .pkg installer for WordFTW add-in

set -e

echo "========================================"
echo " Building WordFTW Mac Installer (.pkg)"
echo "========================================"
echo ""

# Check if we're on macOS
if [ "$(uname -s)" != "Darwin" ]; then
  echo "ERROR: This build script must be run on macOS"
  exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Build directory structure
BUILD_DIR="$SCRIPT_DIR/pkg-build"
SCRIPTS_DIR="$BUILD_DIR/scripts"
PKG_NAME="WordFTW-Add-in-Installer.pkg"

echo "Setting up build directory..."
rm -rf "$BUILD_DIR"
mkdir -p "$SCRIPTS_DIR"

# Copy the non-interactive install script as postinstall
echo "Creating installation script..."
cp pkg-install-script.sh "$SCRIPTS_DIR/postinstall"
chmod +x "$SCRIPTS_DIR/postinstall"

# Create package
echo "Building .pkg installer..."
pkgbuild --nopayload \
  --scripts "$SCRIPTS_DIR" \
  --identifier "com.wordftw.addin.installer" \
  --version "1.0" \
  --install-location "/" \
  "$PKG_NAME"

if [ $? -ne 0 ]; then
  echo "ERROR: Failed to build .pkg"
  rm -rf "$BUILD_DIR"
  exit 1
fi

# Clean up
rm -rf "$BUILD_DIR"

echo "✓ Package created successfully"
echo ""
echo "========================================"
echo " Build Complete!"
echo "========================================"
echo ""
echo "Installer package: $PKG_NAME"
echo "Size: $(du -h "$PKG_NAME" | cut -f1)"
echo ""
echo "To test locally:"
echo "  sudo installer -pkg '$PKG_NAME' -target /"
echo ""
echo "OR just double-click the .pkg file"
echo ""
echo "To distribute:"
echo "  1. Upload $PKG_NAME to your website/GitHub"
echo "  2. Users download and double-click to install"
echo ""


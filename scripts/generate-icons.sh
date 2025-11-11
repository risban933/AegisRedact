#!/bin/bash

# Icon Generation Script for AegisRedact
# Generates all required PWA icon sizes from the source SVG

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is not installed."
    echo "Please install it first:"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  macOS: brew install imagemagick"
    echo "  Or use an online tool like https://realfavicongenerator.net/"
    exit 1
fi

# Source SVG file
SVG_SOURCE="public/icons/icon.svg"

# Output directory
OUTPUT_DIR="public/icons"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo "Generating icons from $SVG_SOURCE..."

# Generate PNG icons at various sizes
convert -background none -density 1200 "$SVG_SOURCE" -resize 192x192 "$OUTPUT_DIR/android-chrome-192x192.png"
echo "✓ Generated android-chrome-192x192.png"

convert -background none -density 1200 "$SVG_SOURCE" -resize 512x512 "$OUTPUT_DIR/android-chrome-512x512.png"
echo "✓ Generated android-chrome-512x512.png"

convert -background none -density 1200 "$SVG_SOURCE" -resize 180x180 "$OUTPUT_DIR/apple-touch-icon.png"
echo "✓ Generated apple-touch-icon.png"

convert -background none -density 1200 "$SVG_SOURCE" -resize 96x96 "$OUTPUT_DIR/icon-96x96.png"
echo "✓ Generated icon-96x96.png"

convert -background none -density 1200 "$SVG_SOURCE" -resize 144x144 "$OUTPUT_DIR/icon-144x144.png"
echo "✓ Generated icon-144x144.png"

# Generate favicon.ico with multiple sizes
convert -background none -density 1200 "$SVG_SOURCE" \
    \( -clone 0 -resize 16x16 \) \
    \( -clone 0 -resize 32x32 \) \
    \( -clone 0 -resize 48x48 \) \
    -delete 0 "$OUTPUT_DIR/favicon.ico"
echo "✓ Generated favicon.ico"

# Generate maskable icon (with padding for safe zone)
convert -background none -density 1200 "$SVG_SOURCE" -resize 432x432 -gravity center -extent 512x512 "$OUTPUT_DIR/maskable-icon-512x512.png"
echo "✓ Generated maskable-icon-512x512.png"

echo ""
echo "✅ All icons generated successfully!"
echo ""
echo "Generated files:"
ls -lh "$OUTPUT_DIR"/*.png "$OUTPUT_DIR"/*.ico 2>/dev/null
echo ""
echo "Next steps:"
echo "1. Verify the icons look correct"
echo "2. Update manifest.webmanifest if needed"
echo "3. Run 'npm run build' to rebuild with new icons"

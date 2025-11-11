# App Icon Generation

The SVG source file `icon.svg` contains the AegisRedact app icon design.

## Quick Generation (Recommended)

### Option 1: Online Tool (Easiest)
1. Upload `icon.svg` to https://realfavicongenerator.net/
2. Download the generated package
3. Extract all files to this directory
4. Done!

### Option 2: ImageMagick (Local)
```bash
# Install ImageMagick first
# Ubuntu/Debian: sudo apt-get install imagemagick
# macOS: brew install imagemagick

# Run the generation script
./scripts/generate-icons.sh
```

## Required Icon Sizes

- `android-chrome-192x192.png` - Android home screen (required)
- `android-chrome-512x512.png` - Android splash screen (required)
- `apple-touch-icon.png` - iOS home screen (180x180)
- `favicon.ico` - Browser tab (16x16, 32x32, 48x48)
- `icon-96x96.png` - Windows tiles
- `icon-144x144.png` - Windows tiles

## Current Status

⚠️ **Placeholder icons** are currently 1x1 pixels.
   Please generate proper icons before deploying to production.

## Icon Design

The AegisRedact icon features:
- **Shield** - Security and protection
- **Redaction bars** - Core app functionality
- **Checkmark** - Successful protection
- **Gradient background** - Modern, professional appearance
- **Brand colors** - Blue (#667eea) to Blue (#3b82f6)

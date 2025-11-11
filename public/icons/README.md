# App Icon Generation

The SVG source file `icon.svg` contains the AegisRedact app icon design.

## Current Status

✅ **Production icons generated!** All required icon sizes have been created using sharp.

## Regenerating Icons

If you need to regenerate icons (e.g., after updating `icon.svg`):

### Option 1: npm Script (Recommended)
```bash
npm run icons
```

### Option 2: Direct Script Execution
```bash
node scripts/generate-icons.mjs
```

### Option 3: ImageMagick (Alternative)
```bash
# Install ImageMagick first
# Ubuntu/Debian: sudo apt-get install imagemagick
# macOS: brew install imagemagick

# Run the shell script
./scripts/generate-icons.sh
```

### Option 4: Online Tool
1. Upload `icon.svg` to https://realfavicongenerator.net/
2. Download the generated package
3. Extract all files to this directory

## Generated Icon Sizes

The following icons are automatically generated from `icon.svg`:

| File | Size | Purpose | Status |
|------|------|---------|--------|
| `android-chrome-192x192.png` | 192×192 | Android home screen (required) | ✅ Generated |
| `android-chrome-512x512.png` | 512×512 | Android splash screen (required) | ✅ Generated |
| `apple-touch-icon.png` | 180×180 | iOS home screen | ✅ Generated |
| `favicon-16x16.png` | 16×16 | Browser tab (small) | ✅ Generated |
| `favicon-32x32.png` | 32×32 | Browser tab (large) | ✅ Generated |
| `icon-96x96.png` | 96×96 | Windows tile | ✅ Generated |
| `icon-144x144.png` | 144×144 | Windows tile (large) | ✅ Generated |

## Icon Design

The AegisRedact icon features:
- **Shield** - Security and protection
- **Redaction bars** - Core app functionality
- **Checkmark** - Successful protection
- **Gradient background** - Modern, professional appearance
- **Brand colors** - Blue (#667eea) to Blue (#3b82f6)

## Technical Details

Icons are generated using the `sharp` library with:
- **Density**: 300 DPI for high-quality rendering
- **Fit**: Contain (maintains aspect ratio)
- **Background**: Transparent
- **Compression**: Level 9 (maximum)
- **Quality**: 100%

## Verification

After generation, verify icons are properly referenced:

1. **HTML** (`index.html`):
   - `<link rel="icon" ... href="/icons/favicon-32x32.png" />`
   - `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />`

2. **Manifest** (`manifest.webmanifest`):
   - 192×192 icon for Android installation
   - 512×512 icon for splash screen

3. **Build output** (`dist/icons/`):
   - All icons copied to distribution folder
   - Verified in production build

Run `npm run build` to test the complete PWA build with icons.

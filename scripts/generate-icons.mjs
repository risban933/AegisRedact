#!/usr/bin/env node

/**
 * Generate app icons using Node.js and sharp
 * Converts SVG to PNG at multiple sizes for PWA installation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Icon sizes needed for PWA
const ICON_SIZES = [
  { size: 192, name: 'android-chrome-192x192.png', description: 'Android home screen (required)' },
  { size: 512, name: 'android-chrome-512x512.png', description: 'Android splash screen (required)' },
  { size: 180, name: 'apple-touch-icon.png', description: 'iOS home screen' },
  { size: 96, name: 'icon-96x96.png', description: 'Windows tile' },
  { size: 144, name: 'icon-144x144.png', description: 'Windows tile large' },
  { size: 32, name: 'favicon-32x32.png', description: 'Browser tab (large)' },
  { size: 16, name: 'favicon-16x16.png', description: 'Browser tab (small)' }
];

async function generateIcons() {
  console.log('📱 Generating AegisRedact PWA icons...\n');

  const outputDir = path.join(__dirname, '..', 'public', 'icons');
  const sourceSvg = path.join(outputDir, 'icon.svg');

  // Check if source SVG exists
  if (!fs.existsSync(sourceSvg)) {
    console.error('❌ Error: icon.svg not found in public/icons/');
    console.error('   Please ensure the SVG source file exists first.\n');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Read SVG file
  const svgBuffer = fs.readFileSync(sourceSvg);

  // Generate each icon size
  let successCount = 0;
  let errorCount = 0;

  for (const { size, name, description } of ICON_SIZES) {
    try {
      const outputPath = path.join(outputDir, name);

      await sharp(svgBuffer, { density: 300 }) // High DPI for quality
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .png({
          compressionLevel: 9,
          quality: 100
        })
        .toFile(outputPath);

      const stats = fs.statSync(outputPath);
      const sizeKB = (stats.size / 1024).toFixed(2);

      console.log(`✅ ${name.padEnd(30)} ${size}x${size}px  ${sizeKB}KB  ${description}`);
      successCount++;

    } catch (error) {
      console.error(`❌ Failed to generate ${name}: ${error.message}`);
      errorCount++;
    }
  }

  // Generate multi-resolution favicon.ico (16x16 and 32x32)
  console.log('\n📦 Generating multi-resolution favicon.ico...');
  try {
    const favicon16Path = path.join(outputDir, 'favicon-16x16.png');
    const favicon32Path = path.join(outputDir, 'favicon-32x32.png');
    const faviconPath = path.join(outputDir, '..', 'favicon.ico');

    // Note: sharp doesn't support ICO output, so we'll copy the 32x32 as fallback
    // For true .ico support, use an online tool or imagemagick
    fs.copyFileSync(favicon32Path, faviconPath.replace('.ico', '-32x32.png'));

    console.log('ℹ️  favicon.ico creation requires external tool (ImageMagick or online converter)');
    console.log('   Using favicon-32x32.png as fallback for now');
    console.log('   For true .ico: https://convertio.co/png-ico/');

  } catch (error) {
    console.error(`⚠️  Could not generate favicon.ico: ${error.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log(`✅ Successfully generated ${successCount}/${ICON_SIZES.length} icons`);
  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount} errors occurred`);
  }
  console.log('='.repeat(80));

  // Verification
  console.log('\n📋 Verification:');
  console.log('   1. Check public/icons/ for generated PNG files');
  console.log('   2. Verify manifest.webmanifest references correct icon paths');
  console.log('   3. Run `npm run build` to test PWA build');
  console.log('   4. Use Lighthouse to audit PWA installation');

  console.log('\n🚀 Icons are now production-ready!\n');
}

// Run the generator
generateIcons().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});

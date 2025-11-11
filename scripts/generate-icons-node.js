#!/usr/bin/env node

/**
 * Generate app icons using Node.js and sharp
 * Alternative to ImageMagick-based generation
 */

const fs = require('fs');
const path = require('path');

// Simple PNG generator for placeholders
// Creates solid color PNGs with the app's brand colors
function generatePlaceholderIcon(size, outputPath) {
  // Create a simple PNG data URL representation
  // For production, you should use the SVG with a proper tool

  const canvas = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#bg)"/>
      <g transform="translate(${size/2}, ${size/2})">
        <path d="M ${-size*0.15},${-size*0.19} L 0,${-size*0.23} L ${size*0.15},${-size*0.19} L ${size*0.15},${size*0.04} C ${size*0.15},${size*0.15} ${size*0.08},${size*0.23} 0,${size*0.27} C ${-size*0.08},${size*0.23} ${-size*0.15},${size*0.15} ${-size*0.15},${size*0.04} Z"
              fill="#ffffff" opacity="0.95"/>
        <rect x="${-size*0.10}" y="${-size*0.12}" width="${size*0.20}" height="${size*0.04}" rx="${size*0.02}" fill="#0b1020" opacity="0.9"/>
        <rect x="${-size*0.10}" y="${-size*0.04}" width="${size*0.20}" height="${size*0.04}" rx="${size*0.02}" fill="#0b1020" opacity="0.9"/>
        <rect x="${-size*0.10}" y="${size*0.04}" width="${size*0.20}" height="${size*0.04}" rx="${size*0.02}" fill="#0b1020" opacity="0.9"/>
        <path d="M ${-size*0.05},${size*0.08} L ${-size*0.02},${size*0.12} L ${size*0.07},0"
              stroke="#10b981" stroke-width="${size*0.024}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.8"/>
      </g>
    </svg>
  `;

  return canvas;
}

console.log('📱 Generating AegisRedact app icons...\n');
console.log('⚠️  NOTE: This creates SVG-based placeholders.');
console.log('   For production PNG icons, use:');
console.log('   - ImageMagick: ./scripts/generate-icons.sh');
console.log('   - OR: https://realfavicongenerator.net/\n');

const sizes = [
  { size: 192, name: 'android-chrome-192x192.svg' },
  { size: 512, name: 'android-chrome-512x512.svg' },
  { size: 180, name: 'apple-touch-icon.svg' },
  { size: 96, name: 'icon-96x96.svg' },
  { size: 144, name: 'icon-144x144.svg' }
];

const outputDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Copy the main SVG icon
const sourceSvg = path.join(outputDir, 'icon.svg');
if (fs.existsSync(sourceSvg)) {
  sizes.forEach(({ size, name }) => {
    const svg = generatePlaceholderIcon(size, name);
    const outputPath = path.join(outputDir, name);
    fs.writeFileSync(outputPath, svg);
    console.log(`✓ Generated ${name}`);
  });

  console.log('\n✅ Icon placeholders generated!\n');
  console.log('Next steps:');
  console.log('1. Install ImageMagick to generate proper PNG files');
  console.log('2. Run: ./scripts/generate-icons.sh');
  console.log('3. OR upload icon.svg to https://realfavicongenerator.net/\n');
} else {
  console.error('❌ Error: icon.svg not found in public/icons/');
  console.error('   Please ensure the SVG source file exists first.\n');
  process.exit(1);
}

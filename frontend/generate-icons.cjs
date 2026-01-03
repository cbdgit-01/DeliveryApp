// Script to generate PWA icons from icon.svg
// Run: node generate-icons.cjs

const fs = require('fs');
const path = require('path');

async function generateIcons() {
  try {
    const sharp = require('sharp');
    
    const sizes = [
      { name: 'pwa-192x192.png', size: 192 },
      { name: 'pwa-512x512.png', size: 512 },
      { name: 'apple-touch-icon.png', size: 180 },
      { name: 'favicon-32x32.png', size: 32 },
      { name: 'favicon-16x16.png', size: 16 },
    ];

    const sourcePath = path.join(__dirname, 'public', 'icon.svg');
    const publicDir = path.join(__dirname, 'public');
    
    // Check if source exists
    if (!fs.existsSync(sourcePath)) {
      console.error('Error: icon.svg not found in public folder');
      return;
    }
    
    for (const { name, size } of sizes) {
      await sharp(sourcePath)
        .resize(size, size)
        .png()
        .toFile(path.join(publicDir, name));
      console.log(`Generated ${name}`);
    }
    
    console.log('\nAll PWA icons generated!');

  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      console.log('Sharp not installed. Run: npm install sharp --save-dev');
    } else {
      console.error('Error:', e.message);
    }
  }
}

generateIcons();

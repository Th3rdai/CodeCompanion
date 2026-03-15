const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertSvgToPng(svgPath, pngPath, width, height) {
  const svgBuffer = fs.readFileSync(svgPath);
  await sharp(svgBuffer)
    .resize(width, height)
    .png()
    .toFile(pngPath);
  console.log(`Created ${pngPath} (${width}x${height})`);
}

async function main() {
  const resourcesDir = __dirname;

  // Convert icon.svg to icon.png (1024x1024)
  await convertSvgToPng(
    path.join(resourcesDir, 'icon.svg'),
    path.join(resourcesDir, 'icon.png'),
    1024,
    1024
  );

  // Convert dmg-background.svg to dmg-background.png (540x380)
  await convertSvgToPng(
    path.join(resourcesDir, 'dmg-background.svg'),
    path.join(resourcesDir, 'dmg-background.png'),
    540,
    380
  );

  console.log('Icon conversion complete!');
}

main().catch(console.error);

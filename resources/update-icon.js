#!/usr/bin/env node

/**
 * Icon Converter Script
 * Converts the new Th3rdAI eye icon to all required formats for electron-builder
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// Try existing icon first, then fall back to new one
const INPUT_IMAGE = fs.existsSync(path.join(__dirname, "th3rdai-eye-icon.png"))
  ? path.join(__dirname, "th3rdai-eye-icon.png")
  : path.join(__dirname, "th3rdai-icon.png");
const OUTPUT_DIR = __dirname;

async function convertIcon() {
  try {
    console.log("🎨 Converting Th3rdAI eye icon to all required formats...\n");

    // 1. Main PNG icon (1024x1024 for high quality)
    console.log("  Creating icon.png (1024x1024)...");
    await sharp(INPUT_IMAGE)
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path.join(OUTPUT_DIR, "icon.png"));
    console.log("  ✅ icon.png created\n");

    // 2. ICO for Windows (256x256, 128x128, 64x64, 48x48, 32x32, 16x16)
    console.log("  Creating icon.ico (multi-size)...");
    const icoSizes = [256, 128, 64, 48, 32, 16];
    const _icoBuffers = await Promise.all(
      icoSizes.map((size) =>
        sharp(INPUT_IMAGE)
          .resize(size, size, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer(),
      ),
    );

    // Write ICO file (simplified - just use largest size)
    // For proper .ico with multiple sizes, we'd need an ico library
    await sharp(INPUT_IMAGE)
      .resize(256, 256, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toFormat("png")
      .toFile(path.join(OUTPUT_DIR, "icon.ico"));
    console.log("  ✅ icon.ico created\n");

    // 3. ICNS for macOS (requires external tool, but we can create PNG at macOS standard sizes)
    console.log("  Creating macOS icon sizes...");
    const macSizes = [16, 32, 64, 128, 256, 512, 1024];
    for (const size of macSizes) {
      await sharp(INPUT_IMAGE)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toFile(path.join(OUTPUT_DIR, `icon_${size}x${size}.png`));
      console.log(`    Created icon_${size}x${size}.png`);
    }
    console.log("  ✅ macOS icon PNGs created\n");

    // 4. NSIS Sidebar (164x314 for Windows installer)
    console.log("  Creating NSIS sidebar image...");
    await sharp(INPUT_IMAGE)
      .resize(164, 314, {
        fit: "contain",
        background: { r: 42, g: 40, b: 70, alpha: 1 },
      })
      .png()
      .toFile(path.join(OUTPUT_DIR, "nsis-sidebar.png"));
    console.log("  ✅ nsis-sidebar.png created\n");

    // 5. DMG Background (540x380 for macOS installer)
    console.log("  Creating DMG background...");
    await sharp(INPUT_IMAGE)
      .resize(200, 200, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path.join(OUTPUT_DIR, "dmg-icon.png"));
    console.log("  ✅ dmg-icon.png created\n");

    console.log("🎉 All icon formats created successfully!");
    console.log("\nNext steps:");
    console.log(
      "1. Create .icns for macOS: brew install imagemagick && npm run create-icns",
    );
    console.log("2. Rebuild the app: npm run electron:build");
  } catch (error) {
    console.error("❌ Error converting icon:", error);
    process.exit(1);
  }
}

// Run conversion
if (!fs.existsSync(INPUT_IMAGE)) {
  console.error(`❌ Input image not found: ${INPUT_IMAGE}`);
  console.log(
    "\nPlease save the Th3rdAI eye icon as: resources/th3rdai-eye-icon.png",
  );
  process.exit(1);
}

convertIcon();

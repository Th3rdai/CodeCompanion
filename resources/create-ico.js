#!/usr/bin/env node

/**
 * Create proper Windows .ico file from PNG
 */

const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const inputPng = path.join(__dirname, 'icon.png');
const outputIco = path.join(__dirname, 'icon.ico');

async function createIco() {
  try {
    console.log('🔧 Creating proper Windows .ico file...');

    const icoBuffer = await pngToIco(inputPng);
    fs.writeFileSync(outputIco, icoBuffer);

    console.log('✅ icon.ico created successfully!');
    console.log(`   Size: ${icoBuffer.length} bytes`);

  } catch (error) {
    console.error('❌ Error creating .ico file:', error);
    process.exit(1);
  }
}

createIco();

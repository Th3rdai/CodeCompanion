#!/usr/bin/env node
/**
 * License Key Generator for Code Companion Pro
 *
 * Generates Ed25519-signed license keys that can be validated offline.
 * The private key is stored locally (never shipped with the app).
 * The public key is embedded in lib/license-manager.js.
 *
 * Usage:
 *   node scripts/generate-license-key.js --email user@example.com --tier pro --expires 2027-03-14
 *   node scripts/generate-license-key.js --email user@example.com --features skillz,agentic --expires 2027-03-14
 *   node scripts/generate-license-key.js --generate-keypair   # First-time setup
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PRIVATE_KEY_PATH = path.join(__dirname, '.license-private-key');
const PUBLIC_KEY_PATH = path.join(__dirname, '.license-public-key');

const VALID_FEATURES = ['prompting', 'skillz', 'agentic', 'create'];

// ── Parse CLI arguments ─────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--generate-keypair') parsed.generateKeypair = true;
    else if (args[i] === '--email' && args[i + 1]) parsed.email = args[++i];
    else if (args[i] === '--tier' && args[i + 1]) parsed.tier = args[++i];
    else if (args[i] === '--features' && args[i + 1]) parsed.features = args[++i];
    else if (args[i] === '--expires' && args[i + 1]) parsed.expires = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') parsed.help = true;
  }
  return parsed;
}

// ── Generate Ed25519 keypair ────────────────────────

function generateKeypair() {
  if (fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error('Keypair already exists. Delete .license-private-key and .license-public-key to regenerate.');
    process.exit(1);
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, 'utf8');
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, 'utf8');

  console.log('Ed25519 keypair generated:');
  console.log(`  Private key: ${PRIVATE_KEY_PATH}`);
  console.log(`  Public key:  ${PUBLIC_KEY_PATH}`);
  console.log('');
  console.log('Copy this public key into lib/license-manager.js:');
  console.log('');
  console.log(publicKey);
}

// ── Generate a license key ──────────────────────────

function generateLicenseKey({ email, tier, features, expires }) {
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error('No private key found. Run with --generate-keypair first.');
    process.exit(1);
  }

  if (!email || !expires) {
    console.error('Missing required arguments: --email, --expires');
    console.error('Also provide either --tier or --features');
    console.error('Example: node scripts/generate-license-key.js --email user@example.com --features skillz,agentic --expires 2027-03-14');
    process.exit(1);
  }

  if (!tier && !features) {
    console.error('Must provide either --tier or --features');
    console.error('  --tier pro                     Legacy full-Pro key');
    console.error('  --features skillz,agentic      Feature-based key');
    process.exit(1);
  }

  if (tier) {
    const validTiers = ['pro'];
    if (!validTiers.includes(tier)) {
      console.error(`Invalid tier: ${tier}. Valid tiers: ${validTiers.join(', ')}`);
      process.exit(1);
    }
  }

  let parsedFeatures;
  if (features) {
    parsedFeatures = features.split(',').map(f => f.trim());
    const invalid = parsedFeatures.filter(f => !VALID_FEATURES.includes(f));
    if (invalid.length > 0) {
      console.error(`Invalid features: ${invalid.join(', ')}. Valid features: ${VALID_FEATURES.join(', ')}`);
      process.exit(1);
    }
  }

  const expiryDate = new Date(expires);
  if (isNaN(expiryDate.getTime())) {
    console.error(`Invalid date: ${expires}. Use YYYY-MM-DD format.`);
    process.exit(1);
  }

  const payload = {
    email,
    exp: expiryDate.toISOString(),
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  // Feature-based key takes precedence over tier
  if (parsedFeatures) {
    payload.features = parsedFeatures;
  } else {
    payload.tier = tier;
  }

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const privateKeyPem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
  const signature = crypto.sign(null, Buffer.from(payloadB64), privateKeyPem);
  const signatureB64 = signature.toString('base64url');

  const licenseKey = `CC-PRO-${payloadB64}.${signatureB64}`;

  console.log('License key generated:');
  console.log('');
  console.log(licenseKey);
  console.log('');
  console.log('Payload:');
  console.log(JSON.stringify(payload, null, 2));
}

// ── Main ────────────────────────────────────────────

const args = parseArgs();

if (args.help) {
  console.log(`
Code Companion Pro — License Key Generator

Usage:
  node scripts/generate-license-key.js --generate-keypair
  node scripts/generate-license-key.js --email <email> --tier pro --expires <YYYY-MM-DD>
  node scripts/generate-license-key.js --email <email> --features <list> --expires <YYYY-MM-DD>

Options:
  --generate-keypair  Generate a new Ed25519 keypair (first-time setup)
  --email <email>     License holder's email
  --tier <tier>       License tier (pro) — legacy full-access key
  --features <list>   Comma-separated feature list (e.g., skillz,agentic)
                      Valid features: ${VALID_FEATURES.join(', ')}
  --expires <date>    Expiration date (YYYY-MM-DD)
  --help, -h          Show this help

Examples:
  # Legacy Pro key (all pro features)
  node scripts/generate-license-key.js --email user@example.com --tier pro --expires 2027-03-14

  # Feature-based key (specific features only)
  node scripts/generate-license-key.js --email user@example.com --features skillz,agentic --expires 2027-03-14

  # Single-feature key
  node scripts/generate-license-key.js --email user@example.com --features skillz --expires 2027-03-14
`);
} else if (args.generateKeypair) {
  generateKeypair();
} else {
  generateLicenseKey(args);
}

const path = require('path');

/**
 * macOS signing modes (see BUILD.md):
 * - Default: ad-hoc (`identity: '-'`) — faster local DMG/ZIP; Gatekeeper may prompt.
 * - Distribution: MAC_DISTRIBUTION_SIGN=1 + MAC_CODESIGN_IDENTITY — Developer ID + hardened runtime.
 * - Optional notarization: MAC_NOTARIZE=1 + APPLE_TEAM_ID (and APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD for xcrun).
 *
 * Windows Authenticode: WIN_DISTRIBUTION_SIGN=1 + WIN_CSC_LINK or CSC_LINK (.pfx), or CSC_NAME / WIN_CSC_NAME (store).
 * Linux AppImage GPG: LINUX_GPG_SIGN=1 + LINUX_GPG_KEY_ID (afterAllArtifactBuild hook).
 */
const macDistributionSign = process.env.MAC_DISTRIBUTION_SIGN === '1';
const macCodesignIdentity = (process.env.MAC_CODESIGN_IDENTITY || '').trim();

if (macDistributionSign && !macCodesignIdentity) {
  throw new Error(
    'MAC_DISTRIBUTION_SIGN=1 requires MAC_CODESIGN_IDENTITY (e.g. "Developer ID Application: Your Name (TEAMID)"). ' +
      'For fast local builds, omit MAC_DISTRIBUTION_SIGN and run npm run electron:build:mac'
  );
}

const macNotarize =
  macDistributionSign &&
  process.env.MAC_NOTARIZE === '1' &&
  (process.env.APPLE_TEAM_ID || '').trim();

const winDistributionSign = process.env.WIN_DISTRIBUTION_SIGN === '1';
const winPfxPath = (process.env.WIN_CSC_LINK || process.env.CSC_LINK || '').trim();
const winCertStoreName = (process.env.CSC_NAME || process.env.WIN_CSC_NAME || '').trim();

if (winDistributionSign && !winPfxPath && !winCertStoreName) {
  throw new Error(
    'WIN_DISTRIBUTION_SIGN=1 requires WIN_CSC_LINK or CSC_LINK (path to .pfx), or CSC_NAME / WIN_CSC_NAME (Windows certificate store). ' +
      'For unsigned local builds, omit WIN_DISTRIBUTION_SIGN and run npm run electron:build:win'
  );
}

module.exports = {
  appId: 'com.th3rdai.code-companion',
  productName: 'Code Companion',
  copyright: 'Copyright © 2026 James Avila / Th3rdAI',
  directories: { output: 'release' },
  /**
   * Use package `name` (no spaces) so release filenames match `latest-*.yml` `url` entries.
   * Spaces in `productName` led to GitHub assets like `Code.Companion-…` while YAML listed `Code-Companion-…` → 404 for auto-update downloads.
   */
  artifactName: '${name}-${version}-${arch}.${ext}',
  asar: false,
  files: [
    'dist/**/*',
    'lib/**/*',
    'mcp/**/*',
    'server.js',
    'mcp-server.js',
    'startup.sh',
    'deploy.sh',
    'rebuild.sh',
    'cert/README.txt',
    'electron/**/*',
    'resources/**/*',
    'package.json',
    'node_modules/**/*',
    // Never package user config or secrets (PAT, tokens, etc.)
    '!.cc-config.json',
    '!CodeCompanion-Data',
    '!.env',
    '!.env.local',
    '!node_modules/@playwright/**/*',
    '!node_modules/playwright/**/*',
    '!node_modules/playwright-core/**/*',
    '!node_modules/electron/**/*',
    '!src/**/*',
    '!test/**/*',
    '!tests/**/*',
    '!.planning/**/*',
    '!landing/**/*',
    '!MAKER_framework/**/*',
    '!test-results/**/*',
    '!scripts/**/*',
    '!journal/**/*',
    '!design-system/**/*',
    '!.playwright-mcp/**/*',
  ],
  mac: {
    target: ['dmg', 'zip'],
    icon: 'resources/icon.icns',
    category: 'public.app-category.developer-tools',
    hardenedRuntime: macDistributionSign,
    identity: macDistributionSign ? macCodesignIdentity : '-',
    ...(macNotarize ? { notarize: { teamId: (process.env.APPLE_TEAM_ID || '').trim() } } : {}),
    gatekeeperAssess: false,
    extendInfo: {
      NSMicrophoneUsageDescription: 'Code Companion uses the microphone for voice dictation to transcribe speech into text fields.',
    },
  },
  dmg: {
    background: 'resources/dmg-background.png',
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: 'link', path: '/Applications' },
    ],
  },
  win: {
    target: ['nsis', 'zip'],
    icon: 'resources/icon.ico',
    ...(winDistributionSign && winPfxPath
      ? {
          certificateFile: winPfxPath,
          certificatePassword: process.env.WIN_CSC_KEY_PASSWORD || process.env.CSC_KEY_PASSWORD,
          signingHashAlgorithms: ['sha256'],
        }
      : {}),
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'resources/icon.ico',
    uninstallerIcon: 'resources/icon.ico',
    installerHeaderIcon: 'resources/icon.ico',
    license: 'LICENSE',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Code Companion',
    runAfterFinish: true,
    installerSidebar: 'resources/nsis-sidebar.bmp',
    uninstallerSidebar: 'resources/nsis-sidebar.bmp',
  },
  linux: {
    target: ['AppImage', 'zip'],
    icon: 'resources/icon.png',
    category: 'Development',
  },
  publish: {
    provider: 'github',
    owner: 'th3rdai',
    repo: 'CodeCompanion',
    /** Explicit: never skip writing latest-*.yml to release/ (electron-builder default is true). */
    publishAutoUpdate: true,
  },
  extraResources: [
    { from: 'resources/data-readme.txt', to: 'data-readme.txt' },
  ],

  /** Detached GPG signatures for *.AppImage when LINUX_GPG_SIGN=1 (see scripts/linux-gpg-after-artifact.js). */
  afterAllArtifactBuild: path.join(__dirname, 'scripts', 'linux-gpg-after-artifact.js'),
};

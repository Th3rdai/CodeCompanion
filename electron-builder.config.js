module.exports = {
  appId: 'com.th3rdai.code-companion',
  productName: 'Code Companion',
  directories: { output: 'release' },
  files: [
    'dist/**/*',
    'lib/**/*',
    'mcp/**/*',
    'server.js',
    'mcp-server.js',
    'electron/**/*',
    'resources/**/*',
    'package.json',
    'node_modules/**/*',
    '!node_modules/@playwright/**/*',
    '!node_modules/playwright/**/*',
    '!node_modules/electron/**/*',
    '!src/**/*',
    '!test/**/*',
    '!.planning/**/*',
    '!landing/**/*',
    '!MAKER_framework/**/*',
    '!test-results/**/*',
  ],
  mac: {
    target: ['dmg', 'zip'],
    icon: 'resources/icon.png',
    category: 'public.app-category.developer-tools',
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
    icon: 'resources/icon.png',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'resources/icon.png',
  },
  linux: {
    target: ['AppImage', 'zip'],
    icon: 'resources/icon.png',
    category: 'Development',
  },
  publish: {
    provider: 'github',
    owner: 'th3rdai',
    repo: 'code-companion',
  },
  extraResources: [
    { from: 'resources/data-readme.txt', to: 'data-readme.txt' },
  ],
};

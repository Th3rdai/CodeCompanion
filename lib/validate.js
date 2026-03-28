const fs = require('fs')
const path = require('path')
const { chatStream } = require('./ollama-client')
const { SYSTEM_PROMPTS } = require('./prompts')

const VALIDATION_FILES = {
  linting: [
    '.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.cjs',
    'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs',
    '.pylintrc', 'pylintrc', 'ruff.toml', '.ruff.toml',
    '.rubocop.yml', '.golangci.yml', '.golangci.yaml',
    '.stylelintrc', '.stylelintrc.json',
  ],
  typeChecking: [
    'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json',
    'mypy.ini', '.mypy.ini', 'pyrightconfig.json',
    'jsconfig.json',
  ],
  formatting: [
    '.prettierrc', '.prettierrc.js', '.prettierrc.json', '.prettierrc.yml', '.prettierrc.cjs',
    'prettier.config.js', '.editorconfig',
    'pyproject.toml', // black/ruff format config
  ],
  testing: [
    'jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.cjs',
    'vitest.config.js', 'vitest.config.ts', 'vitest.config.mjs',
    'pytest.ini', 'setup.cfg', 'conftest.py',
    'playwright.config.js', 'playwright.config.ts',
    'cypress.config.js', 'cypress.config.ts',
    '.mocharc.yml', '.mocharc.json',
    'karma.conf.js',
  ],
  ci: [
    '.github/workflows', '.gitlab-ci.yml', 'Jenkinsfile',
    '.circleci/config.yml', '.travis.yml',
    'bitbucket-pipelines.yml',
  ],
  packageManagers: [
    'package.json', 'pyproject.toml', 'Cargo.toml',
    'go.mod', 'Gemfile', 'Makefile', 'Rakefile',
    'build.gradle', 'pom.xml', 'CMakeLists.txt',
  ],
}

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', 'dist', 'build',
  '__pycache__', '.venv', 'venv', '.idea', '.vscode',
  'coverage', '.cache', '.turbo', '.svelte-kit',
])

/**
 * Scan a project folder and discover validation-relevant files and configs.
 */
function scanProjectForValidation(folder) {
  const absFolder = path.resolve(folder)
  if (!fs.existsSync(absFolder) || !fs.statSync(absFolder).isDirectory()) {
    throw new Error('Folder not found')
  }

  const discovered = {
    linting: [],
    typeChecking: [],
    formatting: [],
    testing: [],
    ci: [],
    packageManagers: [],
    testDirs: [],
    scripts: {},
    language: 'unknown',
    framework: 'unknown',
    readme: null,
    claudeMd: null,
  }

  // Scan root and one level of subdirs for config files
  function scanDir(dirPath, depth) {
    if (depth > 3) return
    let entries
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }) }
    catch { return }

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue
      if (entry.name.startsWith('.') && !entry.name.startsWith('.eslint') &&
          !entry.name.startsWith('.prettier') && !entry.name.startsWith('.editor') &&
          !entry.name.startsWith('.mypy') && !entry.name.startsWith('.ruff') &&
          !entry.name.startsWith('.github') && !entry.name.startsWith('.gitlab') &&
          !entry.name.startsWith('.mocha') && !entry.name.startsWith('.stylelint') &&
          !entry.name.startsWith('.rubocop') && !entry.name.startsWith('.golangci') &&
          !entry.name.startsWith('.circleci') && !entry.name.startsWith('.travis') &&
          !entry.name.startsWith('.pylint') &&
          entry.name !== '.ruff.toml') continue

      const fullPath = path.join(dirPath, entry.name)
      const relPath = path.relative(absFolder, fullPath)

      if (entry.isDirectory()) {
        // Check for test directories
        if (['test', 'tests', '__tests__', 'spec', 'specs', 'e2e', 'cypress', 'playwright'].includes(entry.name.toLowerCase())) {
          discovered.testDirs.push(relPath)
        }
        // Check for CI dirs
        if (entry.name === '.github') {
          const wfDir = path.join(fullPath, 'workflows')
          if (fs.existsSync(wfDir)) {
            try {
              const wfFiles = fs.readdirSync(wfDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
              for (const wf of wfFiles) {
                discovered.ci.push(path.join(relPath, 'workflows', wf))
              }
            } catch {}
          }
        }
        if (entry.name === '.circleci') {
          const cfgPath = path.join(fullPath, 'config.yml')
          if (fs.existsSync(cfgPath)) discovered.ci.push(path.join(relPath, 'config.yml'))
        }
        scanDir(fullPath, depth + 1)
        continue
      }

      // Match config files
      for (const [category, patterns] of Object.entries(VALIDATION_FILES)) {
        if (category === 'ci') continue // handled via directory scan above
        if (patterns.includes(entry.name)) {
          discovered[category].push(relPath)
        }
      }

      // CI files at root
      if (['.gitlab-ci.yml', 'Jenkinsfile', '.travis.yml', 'bitbucket-pipelines.yml'].includes(entry.name)) {
        discovered.ci.push(relPath)
      }
    }
  }

  scanDir(absFolder, 0)

  // Read package.json scripts
  const pkgJsonPath = path.join(absFolder, 'package.json')
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
      discovered.scripts = pkg.scripts || {}
      discovered.language = 'javascript'
      // Detect framework
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
      if (deps.react) discovered.framework = 'react'
      else if (deps.vue) discovered.framework = 'vue'
      else if (deps.svelte || deps['@sveltejs/kit']) discovered.framework = 'svelte'
      else if (deps.next) discovered.framework = 'next.js'
      else if (deps.express) discovered.framework = 'express'
      else if (deps.fastify) discovered.framework = 'fastify'
    } catch {}
  }

  // Detect Python
  const pyprojectPath = path.join(absFolder, 'pyproject.toml')
  if (fs.existsSync(pyprojectPath)) {
    discovered.language = 'python'
    try {
      const content = fs.readFileSync(pyprojectPath, 'utf8')
      if (content.includes('django')) discovered.framework = 'django'
      else if (content.includes('fastapi')) discovered.framework = 'fastapi'
      else if (content.includes('flask')) discovered.framework = 'flask'
    } catch {}
  }

  // Detect Go, Rust, etc.
  if (fs.existsSync(path.join(absFolder, 'go.mod'))) discovered.language = 'go'
  if (fs.existsSync(path.join(absFolder, 'Cargo.toml'))) discovered.language = 'rust'
  if (fs.existsSync(path.join(absFolder, 'Gemfile'))) discovered.language = 'ruby'

  // Read README for workflow context
  for (const readmeName of ['README.md', 'readme.md', 'README.rst', 'README.txt']) {
    const readmePath = path.join(absFolder, readmeName)
    if (fs.existsSync(readmePath)) {
      try {
        const content = fs.readFileSync(readmePath, 'utf8')
        discovered.readme = content.slice(0, 8000) // cap at 8KB
      } catch {}
      break
    }
  }

  // Read CLAUDE.md for project context
  for (const name of ['CLAUDE.md', 'AGENTS.md']) {
    const p = path.join(absFolder, name)
    if (fs.existsSync(p)) {
      try {
        discovered.claudeMd = fs.readFileSync(p, 'utf8').slice(0, 4000)
      } catch {}
      break
    }
  }

  // Read CI workflow content (first one found, capped)
  if (discovered.ci.length > 0) {
    const ciPath = path.join(absFolder, discovered.ci[0])
    if (fs.existsSync(ciPath)) {
      try {
        discovered.ciContent = fs.readFileSync(ciPath, 'utf8').slice(0, 4000)
      } catch {}
    }
  }

  return discovered
}

/**
 * Generate a validate.md for the project using AI.
 */
async function generateValidateCommand(ollamaUrl, model, folder, scanResult, ollamaOptions = {}) {
  const userContent = `Generate a project-specific validate.md command for this project.

**Project folder:** ${folder}
**Language:** ${scanResult.language}
**Framework:** ${scanResult.framework}

**Discovered validation configs:**
- Linting: ${scanResult.linting.length > 0 ? scanResult.linting.join(', ') : 'none found'}
- Type checking: ${scanResult.typeChecking.length > 0 ? scanResult.typeChecking.join(', ') : 'none found'}
- Formatting: ${scanResult.formatting.length > 0 ? scanResult.formatting.join(', ') : 'none found'}
- Testing: ${scanResult.testing.length > 0 ? scanResult.testing.join(', ') : 'none found'}
- CI/CD: ${scanResult.ci.length > 0 ? scanResult.ci.join(', ') : 'none found'}
- Package managers: ${scanResult.packageManagers.length > 0 ? scanResult.packageManagers.join(', ') : 'none found'}
- Test directories: ${scanResult.testDirs.length > 0 ? scanResult.testDirs.join(', ') : 'none found'}

**Package.json scripts:**
${Object.keys(scanResult.scripts).length > 0
    ? Object.entries(scanResult.scripts).map(([k, v]) => `- ${k}: ${v}`).join('\n')
    : 'none found'}

${scanResult.readme ? `**README (excerpt):**\n${scanResult.readme.slice(0, 3000)}` : ''}

${scanResult.claudeMd ? `**CLAUDE.md (excerpt):**\n${scanResult.claudeMd.slice(0, 2000)}` : ''}

${scanResult.ciContent ? `**CI config (excerpt):**\n\`\`\`yaml\n${scanResult.ciContent.slice(0, 2000)}\n\`\`\`` : ''}`

  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS['validate'] },
    { role: 'user', content: userContent },
  ]

  const stream = await chatStream(ollamaUrl, model, messages, [], ollamaOptions)
  return stream
}

module.exports = {
  scanProjectForValidation,
  generateValidateCommand,
  VALIDATION_FILES,
}

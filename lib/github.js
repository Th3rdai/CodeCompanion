const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * GitHub integration module for Th3rdAI Code Companion.
 * Handles repo cloning (public + private), GitHub API browsing,
 * and personal access token management.
 */

// Directory where cloned repos are stored
const REPOS_DIR_NAME = 'github-repos';

/**
 * Get the repos directory path, creating it if needed.
 */
function getReposDir(appRoot) {
  const dir = path.join(appRoot, REPOS_DIR_NAME);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Parse a GitHub URL into owner/repo.
 * Supports formats:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo.git
 *   git@github.com:owner/repo.git
 *   owner/repo
 */
function parseGitHubUrl(input) {
  input = input.trim();

  // owner/repo shorthand
  const shorthand = input.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shorthand) {
    return { owner: shorthand[1], repo: shorthand[2].replace(/\.git$/, '') };
  }

  // HTTPS URL
  const httpsMatch = input.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2].replace(/\.git$/, '') };
  }

  // SSH URL
  const sshMatch = input.match(/git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2].replace(/\.git$/, '') };
  }

  return null;
}

/**
 * Build the clone URL, injecting token for private repos.
 */
function buildCloneUrl(owner, repo, token) {
  if (token) {
    return `https://${token}@github.com/${owner}/${repo}.git`;
  }
  return `https://github.com/${owner}/${repo}.git`;
}

/**
 * Clone a GitHub repo to the local repos directory.
 * Returns { success, localPath, error }
 */
function cloneRepo(appRoot, repoUrl, token, options = {}) {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return { success: false, error: 'Invalid GitHub URL. Use: https://github.com/owner/repo or owner/repo' };
  }

  const { owner, repo } = parsed;
  const reposDir = getReposDir(appRoot);
  const localPath = path.join(reposDir, `${owner}--${repo}`);

  // Already cloned? Pull instead
  if (fs.existsSync(localPath)) {
    try {
      execSync('git pull --ff-only', { cwd: localPath, timeout: 30000, stdio: 'pipe' });
      return {
        success: true,
        localPath,
        owner,
        repo,
        message: `Updated existing clone of ${owner}/${repo}`,
        alreadyExisted: true,
      };
    } catch (err) {
      return {
        success: true,
        localPath,
        owner,
        repo,
        message: `Using existing clone of ${owner}/${repo} (pull skipped)`,
        alreadyExisted: true,
      };
    }
  }

  // Clone
  const cloneUrl = buildCloneUrl(owner, repo, token);
  const depth = options.shallow !== false ? ['--depth', '1'] : [];

  try {
    execSync(
      `git clone ${depth.join(' ')} "${cloneUrl}" "${localPath}"`,
      { timeout: 120000, stdio: 'pipe' }
    );

    return {
      success: true,
      localPath,
      owner,
      repo,
      message: `Cloned ${owner}/${repo} successfully`,
      alreadyExisted: false,
    };
  } catch (err) {
    const stderr = err.stderr?.toString() || err.message;

    // Clean up failed clone
    try { fs.rmSync(localPath, { recursive: true, force: true }); } catch {}

    if (stderr.includes('Authentication failed') || stderr.includes('could not read Username')) {
      return { success: false, error: `Authentication failed for ${owner}/${repo}. If this is a private repo, add a GitHub token in Settings.` };
    }
    if (stderr.includes('not found') || stderr.includes('Repository not found')) {
      return { success: false, error: `Repository ${owner}/${repo} not found. Check the URL and make sure you have access.` };
    }

    return { success: false, error: `Clone failed: ${stderr.slice(0, 200)}` };
  }
}

/**
 * Delete a cloned repo.
 */
function deleteClonedRepo(appRoot, dirName) {
  const reposDir = getReposDir(appRoot);
  const fullPath = path.join(reposDir, dirName);

  // Security: ensure it's inside repos dir
  if (!fullPath.startsWith(reposDir)) {
    return { success: false, error: 'Invalid path' };
  }

  if (!fs.existsSync(fullPath)) {
    return { success: false, error: 'Repo not found' };
  }

  try {
    fs.rmSync(fullPath, { recursive: true, force: true });
    return { success: true, message: `Deleted ${dirName}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * List all cloned repos with basic metadata.
 */
function listClonedRepos(appRoot) {
  const reposDir = getReposDir(appRoot);

  if (!fs.existsSync(reposDir)) return [];

  const entries = fs.readdirSync(reposDir, { withFileTypes: true });
  const repos = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const fullPath = path.join(reposDir, entry.name);
    const gitDir = path.join(fullPath, '.git');
    if (!fs.existsSync(gitDir)) continue;

    // Parse owner--repo format
    const parts = entry.name.split('--');
    const owner = parts[0] || '';
    const repo = parts.slice(1).join('--') || entry.name;

    // Get last commit info
    let lastCommit = '';
    let branch = '';
    try {
      lastCommit = execSync('git log -1 --format="%h %s" 2>/dev/null', { cwd: fullPath, encoding: 'utf8' }).trim();
      branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { cwd: fullPath, encoding: 'utf8' }).trim();
    } catch {}

    // Count files
    let fileCount = 0;
    try {
      const countOutput = execSync('git ls-files | wc -l', { cwd: fullPath, encoding: 'utf8' }).trim();
      fileCount = parseInt(countOutput, 10) || 0;
    } catch {}

    const stat = fs.statSync(fullPath);

    repos.push({
      dirName: entry.name,
      owner,
      repo,
      fullPath,
      branch,
      lastCommit,
      fileCount,
      clonedAt: stat.birthtime || stat.ctime,
      url: `https://github.com/${owner}/${repo}`,
    });
  }

  return repos.sort((a, b) => (b.clonedAt || 0) - (a.clonedAt || 0));
}

/**
 * Make an authenticated GitHub API request.
 * Returns a promise that resolves to the parsed JSON response.
 */
function githubApiRequest(endpoint, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      headers: {
        'User-Agent': 'Th3rdAI-Code-Companion',
        'Accept': 'application/vnd.github.v3+json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.message || `GitHub API error: ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error('Failed to parse GitHub API response'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('GitHub API timeout')); });
  });
}

/**
 * List repos for the authenticated user (requires token).
 */
async function listUserRepos(token, page = 1, perPage = 30) {
  if (!token) throw new Error('GitHub token required to list your repos');
  const repos = await githubApiRequest(`/user/repos?sort=updated&per_page=${perPage}&page=${page}`, token);
  return repos.map(r => ({
    name: r.name,
    fullName: r.full_name,
    owner: r.owner.login,
    description: r.description,
    private: r.private,
    url: r.html_url,
    cloneUrl: r.clone_url,
    language: r.language,
    stars: r.stargazers_count,
    updatedAt: r.updated_at,
    defaultBranch: r.default_branch,
  }));
}

/**
 * Validate a GitHub personal access token by checking the /user endpoint.
 */
async function validateToken(token) {
  try {
    const user = await githubApiRequest('/user', token);
    return {
      valid: true,
      username: user.login,
      name: user.name,
      avatar: user.avatar_url,
      scopes: 'repo', // We can't read scopes from API, but the user should know
    };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

module.exports = {
  getReposDir,
  parseGitHubUrl,
  buildCloneUrl,
  cloneRepo,
  deleteClonedRepo,
  listClonedRepos,
  githubApiRequest,
  listUserRepos,
  validateToken,
};

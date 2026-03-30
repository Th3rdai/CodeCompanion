const { execSync, execFileSync, spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const https = require("https");

/**
 * GitHub integration module for Th3rdAI Code Companion.
 * Handles repo cloning (public + private), GitHub API browsing,
 * and personal access token management.
 */

// Directory where cloned repos are stored
const REPOS_DIR_NAME = "github-repos";

/** PAT from Settings entry, or `GITHUB_TOKEN_{index}` / `.env`, or legacy `GITHUB_TOKEN`. */
function effectiveGithubToken(entry, index) {
  const stored = entry && entry.token && String(entry.token).trim();
  if (stored) return stored;
  if (Number.isInteger(index) && index >= 0) {
    const fromIdx = process.env[`GITHUB_TOKEN_${index}`];
    if (fromIdx && String(fromIdx).trim()) return String(fromIdx).trim();
  }
  return "";
}

function effectiveLegacyGithubToken(config) {
  const stored = config.githubToken && String(config.githubToken).trim();
  if (stored) return stored;
  const gh = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  return (gh && String(gh).trim()) || "";
}

/**
 * Resolve the best GitHub token for a given owner/repo context.
 * Checks `config.githubTokens[]` first (match by username/label),
 * then falls back to legacy `config.githubToken` / `GITHUB_TOKEN`.
 * @param {object} config - the app config
 * @param {string} [owner] - repo owner to match against token username/label
 * @returns {string} token string or ''
 */
function resolveToken(config, owner) {
  const tokens = config.githubTokens || [];
  if (owner && tokens.length) {
    const ownerLower = owner.toLowerCase();
    const match =
      tokens.find((t) => (t.label || "").toLowerCase() === ownerLower) ||
      tokens.find((t) => (t.username || "").toLowerCase() === ownerLower);
    if (match) {
      const idx = tokens.indexOf(match);
      const tok = effectiveGithubToken(match, idx);
      if (tok) return tok;
    }
  }
  if (tokens.length) {
    const tok = effectiveGithubToken(tokens[0], 0);
    if (tok) return tok;
  }
  return effectiveLegacyGithubToken(config);
}

/**
 * Get all configured tokens (for status/listing).
 * Merges legacy single token into array format.
 */
function getAllTokens(config) {
  const raw = [...(config.githubTokens || [])];
  const tokens = raw.map((t, i) => ({
    ...t,
    token: effectiveGithubToken(t, i),
  }));
  const legacy = effectiveLegacyGithubToken(config);
  if (legacy && !tokens.some((t) => t.token === legacy)) {
    tokens.unshift({
      label: "default",
      token: legacy,
      username: "",
      avatar: "",
    });
  }
  return tokens;
}

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
    return { owner: shorthand[1], repo: shorthand[2].replace(/\.git$/, "") };
  }

  // HTTPS URL
  const httpsMatch = input.match(
    /github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/,
  );
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2].replace(/\.git$/, "") };
  }

  // SSH URL
  const sshMatch = input.match(
    /git@github\.com:([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/,
  );
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2].replace(/\.git$/, "") };
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
    return {
      success: false,
      error:
        "Invalid GitHub URL. Use: https://github.com/owner/repo or owner/repo",
    };
  }

  const { owner, repo } = parsed;
  // Use custom destination if provided, otherwise default to appRoot github-repos dir
  const destDir = options.destination;
  const localPath = destDir
    ? path.join(destDir, repo)
    : path.join(getReposDir(appRoot), `${owner}--${repo}`);

  // Already cloned? Pull instead
  if (fs.existsSync(localPath)) {
    try {
      execSync("git pull --ff-only", {
        cwd: localPath,
        timeout: 30000,
        stdio: "pipe",
      });
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
  const depth = options.shallow !== false ? ["--depth", "1"] : [];

  try {
    execSync(`git clone ${depth.join(" ")} "${cloneUrl}" "${localPath}"`, {
      timeout: 120000,
      stdio: "pipe",
    });

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
    try {
      fs.rmSync(localPath, { recursive: true, force: true });
    } catch {}

    if (
      stderr.includes("Authentication failed") ||
      stderr.includes("could not read Username")
    ) {
      return {
        success: false,
        error: `Authentication failed for ${owner}/${repo}. If this is a private repo, add a GitHub token in Settings.`,
      };
    }
    if (
      stderr.includes("not found") ||
      stderr.includes("Repository not found")
    ) {
      return {
        success: false,
        error: `Repository ${owner}/${repo} not found. Check the URL and make sure you have access.`,
      };
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
  const resolvedFull = path.resolve(fullPath);
  const resolvedRepos = path.resolve(reposDir);
  if (
    resolvedFull === resolvedRepos ||
    !resolvedFull.startsWith(resolvedRepos + path.sep)
  ) {
    return { success: false, error: "Invalid path" };
  }

  if (!fs.existsSync(fullPath)) {
    return { success: false, error: "Repo not found" };
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
    const gitDir = path.join(fullPath, ".git");
    if (!fs.existsSync(gitDir)) continue;

    // Parse owner--repo format
    const parts = entry.name.split("--");
    const owner = parts[0] || "";
    const repo = parts.slice(1).join("--") || entry.name;

    // Get last commit info
    let lastCommit = "";
    let branch = "";
    try {
      lastCommit = execSync('git log -1 --format="%h %s" 2>/dev/null', {
        cwd: fullPath,
        encoding: "utf8",
      }).trim();
      branch = execSync("git rev-parse --abbrev-ref HEAD 2>/dev/null", {
        cwd: fullPath,
        encoding: "utf8",
      }).trim();
    } catch {}

    // Count files
    let fileCount = 0;
    try {
      const countOutput = execSync("git ls-files | wc -l", {
        cwd: fullPath,
        encoding: "utf8",
      }).trim();
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
      hostname: "api.github.com",
      path: endpoint,
      headers: {
        "User-Agent": "Th3rdAI-Code-Companion",
        Accept: "application/vnd.github.v3+json",
      },
    };

    if (token) {
      options.headers["Authorization"] = `Bearer ${token}`;
    }

    const req = https.get(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(
              new Error(
                parsed.message || `GitHub API error: ${res.statusCode}`,
              ),
            );
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error("Failed to parse GitHub API response"));
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("GitHub API timeout"));
    });
  });
}

/**
 * List repos for the authenticated user (requires token).
 */
async function listUserRepos(token, page = 1, perPage = 30) {
  if (!token) throw new Error("GitHub token required to list your repos");
  const repos = await githubApiRequest(
    `/user/repos?sort=updated&per_page=${perPage}&page=${page}`,
    token,
  );
  return repos.map((r) => ({
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
    const user = await githubApiRequest("/user", token);
    return {
      valid: true,
      username: user.login,
      name: user.name,
      avatar: user.avatar_url,
      scopes: "repo", // We can't read scopes from API, but the user should know
    };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

const TOKEN_VALIDATION_CACHE_TTL_MS = 5 * 60 * 1000;
const tokenValidationCache = new Map();

/** validateToken with short TTL cache for valid tokens (fewer /user calls from Settings). */
async function validateTokenCached(token) {
  if (!token) return { valid: false, error: "No token" };
  const key = crypto.createHash("sha256").update(token).digest("hex");
  const hit = tokenValidationCache.get(key);
  if (hit && Date.now() < hit.expires) return hit.result;
  const result = await validateToken(token);
  if (result.valid) {
    tokenValidationCache.set(key, {
      result,
      expires: Date.now() + TOKEN_VALIDATION_CACHE_TTL_MS,
    });
  }
  return result;
}

function runGit(repoPath, args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoPath,
    encoding: "utf8",
    timeout: options.timeout || 15000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function ensureGitRepo(repoPath) {
  if (!repoPath || !fs.existsSync(repoPath)) {
    throw new Error("Repository path not found");
  }
  const gitDir = path.join(repoPath, ".git");
  if (!fs.existsSync(gitDir)) {
    throw new Error("Selected folder is not a git repository");
  }
}

function parseStatusLine(line) {
  const code = line.slice(0, 2);
  const rawPath = line.slice(3).trim();
  const filePath = rawPath.includes(" -> ")
    ? rawPath.split(" -> ").pop()
    : rawPath;
  return {
    code,
    path: filePath,
    staged: code[0] !== " " && code[0] !== "?",
    unstaged: code[1] !== " ",
    untracked: code === "??",
    conflicted: code.includes("U"),
  };
}

function getGitStatus(repoPath) {
  ensureGitRepo(repoPath);

  const branch = runGit(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const statusRaw = runGit(repoPath, ["status", "--porcelain"]);
  const files = statusRaw
    ? statusRaw.split("\n").filter(Boolean).map(parseStatusLine)
    : [];
  const branchesRaw = runGit(repoPath, ["branch", "--format=%(refname:short)"]);
  const branches = branchesRaw ? branchesRaw.split("\n").filter(Boolean) : [];

  let ahead = 0;
  let behind = 0;
  try {
    const upstreamCounts = runGit(repoPath, [
      "rev-list",
      "--left-right",
      "--count",
      "@{upstream}...HEAD",
    ]);
    const parts = upstreamCounts.split(/\s+/);
    behind = parseInt(parts[0], 10) || 0;
    ahead = parseInt(parts[1], 10) || 0;
  } catch {
    ahead = 0;
    behind = 0;
  }

  return {
    branch,
    branches,
    ahead,
    behind,
    changedFiles: files,
    mergeInProgress: fs.existsSync(path.join(repoPath, ".git", "MERGE_HEAD")),
  };
}

function createBranch(repoPath, branchName, checkout = true) {
  ensureGitRepo(repoPath);
  const clean = String(branchName || "").trim();
  if (!clean) throw new Error("Branch name is required");
  if (
    !/^[A-Za-z0-9._/-]+$/.test(clean) ||
    clean.startsWith("/") ||
    clean.endsWith("/")
  ) {
    throw new Error("Invalid branch name");
  }

  if (checkout) runGit(repoPath, ["checkout", "-b", clean]);
  else runGit(repoPath, ["branch", clean]);

  return { success: true, branch: clean, checkedOut: checkout };
}

function getGitDiff(repoPath, filePath = "") {
  ensureGitRepo(repoPath);
  const args = ["diff"];
  if (filePath) args.push("--", filePath);
  const diff = runGit(repoPath, args, { timeout: 30000 });
  return { diff };
}

function getMergePreview(repoPath, sourceBranch, targetRef = "HEAD") {
  ensureGitRepo(repoPath);
  if (!sourceBranch) throw new Error("sourceBranch is required");

  const mergeBase = runGit(repoPath, ["merge-base", targetRef, sourceBranch]);
  const preview = runGit(
    repoPath,
    ["merge-tree", mergeBase, targetRef, sourceBranch],
    { timeout: 30000 },
  );
  const hasConflicts = /<<<<<<<|=======|>>>>>>>/.test(preview);

  return {
    sourceBranch,
    targetRef,
    hasConflicts,
    preview,
    resolutionHints: hasConflicts
      ? [
          "Review conflicting files in the diff viewer before merging.",
          "Resolve each conflict by choosing ours/theirs or manual edit.",
          "Stage resolved files, then complete merge commit.",
        ]
      : ["No merge conflicts detected in preview."],
  };
}

function listConflictFiles(repoPath) {
  ensureGitRepo(repoPath);
  const raw = runGit(repoPath, ["diff", "--name-only", "--diff-filter=U"]);
  return raw ? raw.split("\n").filter(Boolean) : [];
}

function resolveConflictFile(repoPath, filePath, strategy) {
  ensureGitRepo(repoPath);
  const strategyArg =
    strategy === "theirs" ? "--theirs" : strategy === "ours" ? "--ours" : null;
  if (!strategyArg) throw new Error('strategy must be "ours" or "theirs"');
  if (!filePath) throw new Error("filePath is required");

  runGit(repoPath, ["checkout", strategyArg, "--", filePath]);
  runGit(repoPath, ["add", "--", filePath]);
  return { success: true, filePath, strategy };
}

/**
 * Create a new GitHub repository via REST API.
 */
async function createRepo(token, name, options = {}) {
  const { description = "", isPrivate = false, autoInit = false } = options;

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      name,
      description,
      private: isPrivate,
      auto_init: autoInit,
    });

    const req = https.request(
      {
        hostname: "api.github.com",
        path: "/user/repos",
        method: "POST",
        headers: {
          "User-Agent": "Th3rdAI-Code-Companion",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
          Accept: "application/vnd.github+json",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            if (res.statusCode === 201) {
              resolve({
                success: true,
                name: data.name,
                fullName: data.full_name,
                url: data.html_url,
                cloneUrl: data.clone_url,
                sshUrl: data.ssh_url,
                private: data.private,
              });
            } else {
              resolve({
                success: false,
                error: data.message || "Failed to create repository",
                errors: data.errors,
                status: res.statusCode,
              });
            }
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Initialize a git repo locally and push to a remote GitHub URL.
 */
function initAndPush(localPath, remoteUrl, token, options = {}) {
  const {
    branch = "main",
    commitMessage = "Initial commit",
    gitUser = "Code Companion",
    gitEmail = "codecompanion@th3rdai.com",
  } = options;

  if (!fs.existsSync(localPath)) {
    return { success: false, error: "Local path does not exist" };
  }

  try {
    const isGitRepo = fs.existsSync(path.join(localPath, ".git"));

    if (!isGitRepo) {
      execSync("git init", { cwd: localPath, stdio: "pipe" });
      execSync(`git checkout -b ${branch}`, { cwd: localPath, stdio: "pipe" });
    }

    // Set local git config (doesn't affect global config)
    execSync(`git config user.name "${gitUser}"`, {
      cwd: localPath,
      stdio: "pipe",
    });
    execSync(`git config user.email "${gitEmail}"`, {
      cwd: localPath,
      stdio: "pipe",
    });

    // Add all files
    execSync("git add -A", { cwd: localPath, stdio: "pipe" });

    // Check if there's anything to commit
    try {
      execSync("git diff --cached --quiet", { cwd: localPath, stdio: "pipe" });
      // No changes staged — check if there are any commits at all
      try {
        execSync("git rev-parse HEAD", { cwd: localPath, stdio: "pipe" });
        // Has commits, nothing new to commit
      } catch {
        // No commits yet, force a commit even if empty
        execSync(
          `git commit --allow-empty -m "${commitMessage.replace(/"/g, '\\"')}"`,
          { cwd: localPath, stdio: "pipe" },
        );
      }
    } catch {
      // Has staged changes — commit them
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
        cwd: localPath,
        stdio: "pipe",
      });
    }

    // Inject token into remote URL for auth
    const authedUrl = remoteUrl.replace("https://", `https://${token}@`);

    // Set or update remote
    try {
      execSync(`git remote set-url origin "${authedUrl}"`, {
        cwd: localPath,
        stdio: "pipe",
      });
    } catch {
      execSync(`git remote add origin "${authedUrl}"`, {
        cwd: localPath,
        stdio: "pipe",
      });
    }

    // Push
    const pushResult = execSync(`git push -u origin ${branch}`, {
      cwd: localPath,
      stdio: "pipe",
      timeout: 30000,
    }).toString();

    // Remove token from stored remote (security)
    try {
      execSync(`git remote set-url origin "${remoteUrl}"`, {
        cwd: localPath,
        stdio: "pipe",
      });
    } catch {}

    return { success: true, branch, message: "Pushed to GitHub" };
  } catch (err) {
    // Clean up token from remote URL on error too
    try {
      execSync(`git remote set-url origin "${remoteUrl}"`, {
        cwd: localPath,
        stdio: "pipe",
      });
    } catch {}
    return { success: false, error: err.stderr?.toString() || err.message };
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
  validateTokenCached,
  resolveToken,
  getAllTokens,
  getGitStatus,
  createBranch,
  getGitDiff,
  getMergePreview,
  listConflictFiles,
  resolveConflictFile,
  createRepo,
  initAndPush,
};

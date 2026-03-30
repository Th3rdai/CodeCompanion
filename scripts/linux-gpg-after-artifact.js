/**
 * electron-builder `afterAllArtifactBuild` — optional detached GPG signatures for Linux AppImages.
 * Enable with LINUX_GPG_SIGN=1 and LINUX_GPG_KEY_ID (see BUILD.md).
 */
const path = require("path");
const { execFileSync } = require("child_process");
const fs = require("fs");

module.exports = async function linuxGpgAfterArtifactBuild(buildResult) {
  if (process.env.LINUX_GPG_SIGN !== "1") {
    return [];
  }

  const keyId = (process.env.LINUX_GPG_KEY_ID || "").trim();
  if (!keyId) {
    console.warn(
      "[linux-gpg] LINUX_GPG_SIGN=1 but LINUX_GPG_KEY_ID is empty — skipping AppImage signatures",
    );
    return [];
  }

  let paths = [];
  if (buildResult && Array.isArray(buildResult.artifactPaths)) {
    paths = buildResult.artifactPaths;
  }
  if (paths.length === 0) {
    const releaseDir = path.join(__dirname, "..", "release");
    if (fs.existsSync(releaseDir)) {
      paths = fs
        .readdirSync(releaseDir)
        .filter((f) => f.endsWith(".AppImage"))
        .map((f) => path.join(releaseDir, f));
    }
  }

  const extra = [];

  for (const p of paths) {
    if (!p.endsWith(".AppImage") || !fs.existsSync(p)) continue;
    try {
      execFileSync(
        "gpg",
        [
          "--batch",
          "--yes",
          "--detach-sign",
          "--armor",
          "--local-user",
          keyId,
          p,
        ],
        { stdio: "inherit" },
      );
      const asc = `${p}.asc`;
      if (fs.existsSync(asc)) {
        console.log("[linux-gpg] Created signature:", asc);
        extra.push(asc);
      }
    } catch (e) {
      console.error("[linux-gpg] Failed to sign", p, e.message);
      throw e;
    }
  }

  return extra;
};

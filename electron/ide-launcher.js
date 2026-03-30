const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

/**
 * Launches an IDE with a project folder, using platform-aware commands
 * @param {string} ideName - 'vscode', 'cursor', 'windsurf', 'claude-code', or 'opencode'
 * @param {string} folder - Absolute path to project folder
 * @returns {Promise<void>}
 * @throws {Error} If IDE/platform combo unsupported or launch fails
 */
async function launchIDE(ideName, folder) {
  const platform = process.platform;
  let command = null;

  switch (ideName) {
    case "vscode":
      if (platform === "darwin") {
        command = `open -a "Visual Studio Code" "${folder}"`;
      } else if (platform === "win32") {
        command = `cmd /c start "" "code" "${folder}"`;
      } else if (platform === "linux") {
        command = `code "${folder}"`;
      }
      break;

    case "cursor":
      if (platform === "darwin") {
        command = `open -a "Cursor" "${folder}"`;
      } else if (platform === "win32") {
        command = `cmd /c start "" "cursor" "${folder}"`;
      } else if (platform === "linux") {
        command = `cursor "${folder}"`;
      }
      break;

    case "windsurf":
      if (platform === "darwin") {
        command = `open -a "Windsurf" "${folder}"`;
      } else if (platform === "win32") {
        command = `cmd /c start "" "windsurf" "${folder}"`;
      } else if (platform === "linux") {
        command = `windsurf "${folder}"`;
      }
      break;

    case "claude-code":
      if (platform === "darwin") {
        const script = `tell application "Terminal" to do script "cd \\"${folder}\\" && claude --dangerously-skip-permissions"`;
        command = `osascript -e '${script.replace(/'/g, "'\\''")}'`;
      } else if (platform === "win32") {
        command = `cmd /c start cmd /k "cd /d \\"${folder}\\" && claude --dangerously-skip-permissions"`;
      } else if (platform === "linux") {
        command = `x-terminal-emulator -e "cd '${folder}' && claude --dangerously-skip-permissions"`;
      }
      break;

    case "opencode":
      if (platform === "darwin") {
        const script = `tell application "Terminal" to do script "cd \\"${folder}\\" && opencode"`;
        command = `osascript -e '${script.replace(/'/g, "'\\''")}'`;
      } else if (platform === "win32") {
        command = `cmd /c start cmd /k "cd /d \\"${folder}\\" && opencode"`;
      } else if (platform === "linux") {
        command = `x-terminal-emulator -e "cd '${folder}' && opencode"`;
      }
      break;

    default:
      throw new Error(`Unsupported IDE: ${ideName}`);
  }

  if (!command) {
    throw new Error(
      `IDE "${ideName}" is not supported on platform "${platform}"`,
    );
  }

  try {
    await execAsync(command);
    console.log(`[IDE Launcher] Launched ${ideName} in: ${folder}`);
  } catch (error) {
    console.error(`[IDE Launcher] Failed to launch ${ideName}:`, error.message);
    throw new Error(`Failed to launch ${ideName}: ${error.message}`);
  }
}

module.exports = { launchIDE };

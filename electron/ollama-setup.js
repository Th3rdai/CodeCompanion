const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const https = require("https");

const execAsync = promisify(exec);

function ollamaAuthHeaders(apiKey) {
  const h = {};
  const k = apiKey && String(apiKey).trim();
  if (k) h.Authorization = `Bearer ${k}`;
  return h;
}

/**
 * Check if Ollama is running and list models
 * @param {string} ollamaUrl - Ollama server URL
 * @param {string} [apiKey] - Optional Bearer token (Ollama Cloud)
 * @returns {Promise<{running: boolean, models: string[]}>}
 */
async function checkOllamaRunning(ollamaUrl, apiKey) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${ollamaUrl}/api/tags`, {
      signal: controller.signal,
      headers: ollamaAuthHeaders(apiKey),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { running: false, models: [] };
    }

    const data = await response.json();
    const models = (data.models || []).map((m) => m.name);
    return { running: true, models };
  } catch (err) {
    return { running: false, models: [] };
  }
}

/**
 * Install Ollama based on platform
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function installOllama() {
  const platform = process.platform;

  try {
    if (platform === "darwin") {
      // macOS: Download and install
      console.log("[Ollama Setup] Installing Ollama on macOS...");

      // Download Ollama installer
      const downloadUrl = "https://ollama.com/download/Ollama-darwin.zip";
      const tmpDir = require("os").tmpdir();
      const zipPath = path.join(tmpDir, "Ollama-darwin.zip");
      const extractDir = path.join(tmpDir, "ollama-install");

      // Download file
      await downloadFile(downloadUrl, zipPath);
      console.log("[Ollama Setup] Downloaded installer");

      // Extract and install
      if (!fs.existsSync(extractDir)) {
        fs.mkdirSync(extractDir, { recursive: true });
      }

      await execAsync(`unzip -o "${zipPath}" -d "${extractDir}"`);
      console.log("[Ollama Setup] Extracted installer");

      // Open the .app to start installation
      await execAsync(`open "${extractDir}/Ollama.app"`);
      console.log("[Ollama Setup] Launched Ollama app");

      // Clean up
      fs.unlinkSync(zipPath);
    } else if (platform === "win32") {
      // Windows: Download and run installer
      console.log("[Ollama Setup] Installing Ollama on Windows...");

      const downloadUrl = "https://ollama.com/download/OllamaSetup.exe";
      const tmpDir = require("os").tmpdir();
      const installerPath = path.join(tmpDir, "OllamaSetup.exe");

      // Download installer
      await downloadFile(downloadUrl, installerPath);
      console.log("[Ollama Setup] Downloaded installer");

      // Run installer
      await execAsync(`"${installerPath}"`);
      console.log("[Ollama Setup] Launched installer");
    } else if (platform === "linux") {
      // Linux: Use install script
      console.log("[Ollama Setup] Installing Ollama on Linux...");

      await execAsync("curl -fsSL https://ollama.com/install.sh | sh");
      console.log("[Ollama Setup] Installation script completed");
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // Poll for Ollama to become responsive
    const maxAttempts = 60; // 2 minutes (60 * 2s)
    let attempts = 0;

    console.log("[Ollama Setup] Waiting for Ollama to start...");
    while (attempts < maxAttempts) {
      const { running } = await checkOllamaRunning("http://localhost:11434");
      if (running) {
        console.log("[Ollama Setup] Ollama is now running!");
        return { success: true };
      }

      // Wait 2 seconds before next attempt
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error("Ollama did not start within 2 minutes");
  } catch (error) {
    console.error("[Ollama Setup] Installation failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Download file from URL
 * @param {string} url - Download URL
 * @param {string} destPath - Destination file path
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirect
          file.close();
          fs.unlinkSync(destPath);
          return downloadFile(response.headers.location, destPath)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destPath);
          return reject(new Error(`Download failed: ${response.statusCode}`));
        }

        response.pipe(file);

        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        file.close();
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        reject(err);
      });
  });
}

/**
 * Pull a model from Ollama with progress streaming
 * @param {string} ollamaUrl - Ollama server URL
 * @param {string} modelName - Model name to pull
 * @param {Function} onProgress - Progress callback (status, total, completed, percent)
 * @returns {Promise<{success: boolean}>}
 */
async function pullModel(ollamaUrl, modelName, onProgress, apiKey) {
  try {
    const response = await fetch(`${ollamaUrl}/api/pull`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...ollamaAuthHeaders(apiKey),
      },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!response.ok) {
      throw new Error(`Pull request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const data = JSON.parse(line);

          // Calculate progress percentage
          let percent = 0;
          if (data.total && data.completed) {
            percent = Math.round((data.completed / data.total) * 100);
          }

          // Send progress update
          onProgress({
            status: data.status || "downloading",
            total: data.total || 0,
            completed: data.completed || 0,
            percent,
          });

          // Check for completion
          if (data.status === "success") {
            console.log("[Ollama Setup] Model pull completed successfully");
            return { success: true };
          }
        } catch (parseErr) {
          console.error(
            "[Ollama Setup] Failed to parse progress line:",
            parseErr.message,
          );
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error("[Ollama Setup] Model pull failed:", error.message);
    throw error;
  }
}

module.exports = {
  checkOllamaRunning,
  installOllama,
  pullModel,
};

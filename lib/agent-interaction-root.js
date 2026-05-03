"use strict";

const path = require("path");

/**
 * Active agent file context: File Browser folder when it lies inside Settings
 * project folder; otherwise the project folder. Relative paths for builtins
 * resolve here; projectFolder remains the outer permission boundary.
 */
function getAgentInteractionRoot(config) {
  if (!config?.projectFolder) return "";
  const resolvedProj = path.resolve(config.projectFolder);
  const chatRaw =
    config.chatFolder && String(config.chatFolder).trim()
      ? path.resolve(config.chatFolder)
      : resolvedProj;
  if (chatRaw === resolvedProj || chatRaw.startsWith(resolvedProj + path.sep)) {
    return chatRaw;
  }
  return resolvedProj;
}

module.exports = { getAgentInteractionRoot };

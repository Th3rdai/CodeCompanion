/**
 * Attach images from File Browser (read-raw / drop) using the same pipeline as
 * chat upload: validate + processImage + vision-ready base64. Avoids UTF-8 text
 * reads of binary PNG/JPEG/GIF which corrupt chat context.
 */

import { validateImage, processImage, hashImage } from "./image-processor.js";

const ALLOWED = ["image/png", "image/jpeg", "image/gif"];

/**
 * @param {string} name
 * @returns {string} MIME or ""
 */
export function guessImageMimeFromFilename(name) {
  const lower = String(name || "").toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  return "";
}

/** PNG / JPEG / GIF only (matches vision upload whitelist). */
export function isBrowserChatImageFilename(name) {
  return guessImageMimeFromFilename(name) !== "";
}

function imagePrivacyAccepted() {
  try {
    return localStorage.getItem("cc-image-privacy-accepted") === "true";
  } catch {
    return false;
  }
}

/**
 * @param {Blob} blob
 * @param {string} fileName
 * @returns {File}
 */
export function imageFileFromBlob(blob, fileName) {
  const mime =
    (blob.type && ALLOWED.includes(blob.type) ? blob.type : null) ||
    guessImageMimeFromFilename(fileName);
  if (!mime) {
    throw new Error("Not a supported chat image type (PNG, JPEG, GIF only).");
  }
  return new File([blob], fileName, { type: mime });
}

/**
 * @param {object} opts
 * @param {Blob|File} opts.blob
 * @param {string} opts.fileName
 * @param {object} [opts.imageSupportConfig]
 * @param {function} opts.attachFile — App attachFile (adds to attachedFiles)
 * @param {function} [opts.onToast]
 * @returns {Promise<boolean>} true if attached
 */
export async function attachChatImageFromBlob({
  blob,
  fileName,
  imageSupportConfig = {},
  attachFile,
  onToast,
}) {
  if (!imagePrivacyAccepted()) {
    onToast?.(
      "To attach images, accept the privacy notice once via the chat Upload (📎) button.",
    );
    return false;
  }
  let file;
  try {
    file = imageFileFromBlob(blob, fileName);
  } catch (e) {
    onToast?.(e.message || String(e));
    return false;
  }
  const v = await validateImage(file, imageSupportConfig);
  if (!v.valid) {
    onToast?.(`❌ ${fileName}: ${v.error}`);
    return false;
  }
  try {
    const processed = await processImage(file, imageSupportConfig);
    const hash = await hashImage(processed.base64);
    attachFile({
      name: fileName,
      content: processed.base64,
      type: "image",
      isImage: true,
      thumbnail: processed.thumbnail,
      size: processed.size,
      dimensions: processed.dimensions,
      format: processed.format,
      hash,
    });
    return true;
  } catch (err) {
    const msg = (err && err.message) || String(err);
    const low = msg.toLowerCase();
    if (low.includes("dimension")) {
      onToast?.(`❌ ${fileName}: Image too large to process`);
    } else if (low.includes("canvas") || low.includes("context")) {
      onToast?.(`❌ ${fileName}: Failed to process image (browser error)`);
    } else if (low.includes("memory") || low.includes("out of")) {
      onToast?.("❌ Out of memory. Try smaller images or fewer at once.");
    } else if (low.includes("corrupt") || low.includes("invalid")) {
      onToast?.(`❌ ${fileName}: Corrupted or invalid image file`);
    } else {
      onToast?.(`❌ ${fileName}: ${msg}`);
    }
    return false;
  }
}

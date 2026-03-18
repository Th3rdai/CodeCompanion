const crypto = require('crypto');

/**
 * Image Processing Utility Module
 * Handles validation, processing, thumbnail generation, and metadata extraction
 * for image uploads in Code Companion.
 *
 * Critical: Ollama expects base64 WITHOUT data URI prefix (data:image/png;base64,)
 */

// Vision model families that support image inputs
const VISION_FAMILIES = [
  'llava',           // LLaVA (all variants)
  'bakllava',        // BakLLaVA
  'minicpm-v',       // MiniCPM-V
  'moondream',       // Moondream (efficient vision)
  'minimax',         // MiniMax M2
  'cogvlm',          // CogVLM
  'fuyu',            // Fuyu
  'idefics',         // IDEFICS
  'qwen-vl',         // Qwen-VL
  'internvl',        // InternVL
  'yi-vl',           // Yi-VL
  'deepseek-vl',     // DeepSeek-VL
  'glm-4v',          // GLM-4V
];

// Supported MIME types (strict whitelist for security)
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif'];

/**
 * Validates an image file against size, dimension, and format constraints
 * @param {File|Buffer} file - File object (browser) or Buffer (Node.js)
 * @param {Object} config - Image support configuration
 * @returns {Promise<Object>} { valid: boolean, error?: string, dimensions?: {width, height}, size?: number }
 */
async function validateImage(file, config = {}) {
  const maxSizeMB = config.maxSizeMB || 25;
  const maxDimensionPx = config.maxDimensionPx || 8192;

  // 1. MIME Type Check
  const fileType = file.type || '';
  if (!ALLOWED_MIME_TYPES.includes(fileType)) {
    return {
      valid: false,
      error: `Unsupported format: ${fileType}. Only PNG, JPEG, GIF allowed.`
    };
  }

  // 2. File Size Check
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: ${maxSizeMB}MB`
    };
  }

  // 3. Load Image to Check Validity & Dimensions (browser only)
  if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
    try {
      const dimensions = await getImageDimensions(file);

      if (dimensions.width > maxDimensionPx || dimensions.height > maxDimensionPx) {
        return {
          valid: false,
          error: `Image too large: ${dimensions.width}x${dimensions.height}px. Max: ${maxDimensionPx}px`
        };
      }

      // 4. Warn about animated GIFs
      if (fileType === 'image/gif') {
        console.warn('GIF detected - only first frame will be analyzed');
      }

      return { valid: true, dimensions, size: file.size };
    } catch (err) {
      return { valid: false, error: 'Invalid or corrupted image file' };
    }
  }

  // Fallback for Node.js environment (skip dimension check)
  return { valid: true, size: file.size };
}

/**
 * Gets image dimensions by loading into Image element (browser only)
 * @param {File} file - File object
 * @returns {Promise<Object>} { width: number, height: number }
 */
function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('getImageDimensions only works in browser'));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Process image: resize, compress, generate thumbnail, strip EXIF
 * @param {File} file - File object
 * @param {Object} options - Processing options from config
 * @returns {Promise<Object>} { base64: string, thumbnail: string, size: number, dimensions: {width, height}, format: string, hash: string }
 */
async function processImage(file, options = {}) {
  if (typeof window === 'undefined') {
    throw new Error('processImage only works in browser (requires Canvas API)');
  }

  const resizeThreshold = options.resizeThreshold || 2048;
  const compressionQuality = options.compressionQuality || 0.9;

  try {
    // 1. Load image to canvas (this strips EXIF automatically)
    let canvas = await loadImageToCanvas(file);

    // 2. Multi-step downscale for large images
    while (canvas.width > resizeThreshold * 2 || canvas.height > resizeThreshold * 2) {
      canvas = downscaleCanvas(canvas, 0.5);
    }

    // 3. Final resize to exact threshold if still oversized
    if (canvas.width > resizeThreshold || canvas.height > resizeThreshold) {
      canvas = resizeCanvas(canvas, resizeThreshold);
    }

    // 4. Compress to JPEG (or keep PNG if transparency needed)
    const outputFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const dataURL = canvas.toDataURL(outputFormat, compressionQuality);

    // 5. Extract base64 WITHOUT prefix (for Ollama)
    const base64 = extractBase64(dataURL);

    // 6. Generate thumbnail (128x128, WITH prefix for display)
    const thumbnail = await generateThumbnail(dataURL, 128);

    // 7. Calculate hash for duplicate detection
    const hash = hashImage(base64);

    // 8. Get final dimensions
    const dimensions = { width: canvas.width, height: canvas.height };

    return {
      base64,
      thumbnail,
      size: file.size,
      dimensions,
      format: outputFormat.split('/')[1],
      hash
    };
  } catch (err) {
    if (err.message.includes('canvas')) {
      throw new Error(`Failed to process image (browser error): ${err.message}`);
    } else if (err.message.includes('memory')) {
      throw new Error('Out of memory. Try smaller images or fewer at once.');
    } else {
      throw err;
    }
  }
}

/**
 * Loads an image file into a Canvas element (browser only)
 * @param {File} file - Image file
 * @returns {Promise<HTMLCanvasElement>} Canvas with image drawn
 */
function loadImageToCanvas(file) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Canvas API not available'));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      resolve(canvas);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image to canvas'));
    };

    img.src = url;
  });
}

/**
 * Downscales a canvas by a given factor
 * @param {HTMLCanvasElement} canvas - Source canvas
 * @param {number} factor - Scale factor (0.5 = 50%)
 * @returns {HTMLCanvasElement} New scaled canvas
 */
function downscaleCanvas(canvas, factor) {
  const newWidth = Math.floor(canvas.width * factor);
  const newHeight = Math.floor(canvas.height * factor);

  const newCanvas = document.createElement('canvas');
  newCanvas.width = newWidth;
  newCanvas.height = newHeight;

  const ctx = newCanvas.getContext('2d');
  ctx.drawImage(canvas, 0, 0, newWidth, newHeight);

  return newCanvas;
}

/**
 * Resizes canvas to fit within max dimension while preserving aspect ratio
 * @param {HTMLCanvasElement} canvas - Source canvas
 * @param {number} maxDimension - Maximum width or height
 * @returns {HTMLCanvasElement} New resized canvas
 */
function resizeCanvas(canvas, maxDimension) {
  const { width, height } = canvas;
  let newWidth = width;
  let newHeight = height;

  if (width > height) {
    if (width > maxDimension) {
      newWidth = maxDimension;
      newHeight = Math.floor((height * maxDimension) / width);
    }
  } else {
    if (height > maxDimension) {
      newHeight = maxDimension;
      newWidth = Math.floor((width * maxDimension) / height);
    }
  }

  const newCanvas = document.createElement('canvas');
  newCanvas.width = newWidth;
  newCanvas.height = newHeight;

  const ctx = newCanvas.getContext('2d');
  ctx.drawImage(canvas, 0, 0, newWidth, newHeight);

  return newCanvas;
}

/**
 * Extracts base64 string from data URL (removes prefix)
 * @param {string} dataURL - Data URL (e.g., "data:image/png;base64,iVBORw0KG...")
 * @returns {string} Base64 string without prefix
 */
function extractBase64(dataURL) {
  const matches = dataURL.match(/^data:image\/[a-z]+;base64,(.+)$/);
  if (!matches || matches.length < 2) {
    throw new Error('Invalid data URL format');
  }
  return matches[1];
}

/**
 * Generates a thumbnail from a data URL
 * @param {string} dataURL - Source data URL
 * @param {number} size - Thumbnail size (square)
 * @returns {Promise<string>} Thumbnail data URL (WITH prefix for display)
 */
function generateThumbnail(dataURL, size = 128) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Thumbnail generation requires browser Canvas API'));
      return;
    }

    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Calculate dimensions preserving aspect ratio
      const aspectRatio = img.width / img.height;
      let thumbWidth = size;
      let thumbHeight = size;

      if (aspectRatio > 1) {
        thumbHeight = Math.floor(size / aspectRatio);
      } else {
        thumbWidth = Math.floor(size * aspectRatio);
      }

      canvas.width = size;
      canvas.height = size;

      // Center the image on canvas
      const x = Math.floor((size - thumbWidth) / 2);
      const y = Math.floor((size - thumbHeight) / 2);

      ctx.fillStyle = '#f0f0f0'; // Light gray background
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, x, y, thumbWidth, thumbHeight);

      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };

    img.onerror = () => reject(new Error('Failed to generate thumbnail'));
    img.src = dataURL;
  });
}

/**
 * Checks if a model family or name supports vision inputs
 * @param {string} modelFamily - Model family name from Ollama
 * @param {string} modelName - Full model name (optional)
 * @returns {boolean} True if vision-capable
 */
function checkVisionModel(modelFamily, modelName = '') {
  if (!modelFamily && !modelName) return false;
  const normalizedFamily = (modelFamily || '').toLowerCase();
  const normalizedName = (modelName || '').toLowerCase();

  // Check both family and model name (llava models report family as "llama")
  return VISION_FAMILIES.some(vf =>
    normalizedFamily.includes(vf) || normalizedName.includes(vf)
  );
}

/**
 * Generates MD5 hash of base64 image data for duplicate detection
 * @param {string} base64OrDataURL - Base64 string or data URL
 * @returns {string} MD5 hash (hex)
 */
function hashImage(base64OrDataURL) {
  // Extract base64 if data URL provided
  let base64 = base64OrDataURL;
  if (base64OrDataURL.startsWith('data:')) {
    base64 = extractBase64(base64OrDataURL);
  }

  // Take first 10KB for performance (enough for uniqueness)
  const sample = base64.substring(0, 10240);
  return crypto.createHash('md5').update(sample).digest('hex');
}

/**
 * Estimates token count for an image (rough approximation)
 * Vision models typically use ~765 tokens per image
 * @param {string} imageBase64 - Base64 image string
 * @returns {number} Estimated token count
 */
function estimateTokens(imageBase64) {
  // Rough approximation: vision models use fixed token budget per image
  // llava uses ~765 tokens regardless of size (uses fixed grid)
  return 765;
}

/**
 * Validates a data URI for security
 * @param {string} dataURI - Data URI to validate
 * @returns {boolean} True if valid and safe
 */
function validateDataURI(dataURI) {
  const pattern = /^data:image\/(png|jpeg|gif);base64,[A-Za-z0-9+/=]+$/;
  return pattern.test(dataURI);
}

/**
 * Sanitizes a filename (removes unsafe characters)
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
  const path = require('path');
  return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
}

module.exports = {
  validateImage,
  processImage,
  extractBase64,
  generateThumbnail,
  checkVisionModel,
  hashImage,
  estimateTokens,
  validateDataURI,
  sanitizeFilename,
  getImageDimensions,
  VISION_FAMILIES,
  ALLOWED_MIME_TYPES
};

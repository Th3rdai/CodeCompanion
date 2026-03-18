/**
 * Image Processing Utility Module (Browser Version)
 * Handles validation, processing, thumbnail generation, and metadata extraction
 * for image uploads in Code Companion.
 *
 * Critical: Ollama expects base64 WITHOUT data URI prefix (data:image/png;base64,)
 */

// Vision model families that support image inputs
export const VISION_FAMILIES = [
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
export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif'];

/**
 * Get image dimensions from a File object
 * @param {File} file - Image file
 * @returns {Promise<{width: number, height: number}>}
 */
function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
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
 * Validates an image file against size, dimension, and format constraints
 * @param {File} file - File object from browser input
 * @param {Object} config - Image support configuration
 * @returns {Promise<Object>} { valid: boolean, error?: string, dimensions?: {width, height}, size?: number }
 */
export async function validateImage(file, config = {}) {
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

  // 3. Load Image to Check Validity & Dimensions
  try {
    const dimensions = await getImageDimensions(file);

    if (dimensions.width > maxDimensionPx || dimensions.height > maxDimensionPx) {
      return {
        valid: false,
        error: `Image too large: ${dimensions.width}x${dimensions.height}px. Max: ${maxDimensionPx}px`
      };
    }

    return { valid: true, dimensions, size: file.size };
  } catch (err) {
    return { valid: false, error: 'Invalid or corrupted image file' };
  }
}

/**
 * Process image: resize, compress, generate thumbnail, strip EXIF
 * @param {File} file - Image file
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} { base64, thumbnail, size, dimensions, format }
 */
export async function processImage(file, options = {}) {
  const resizeThreshold = options.resizeThreshold || 2048;
  const compressionQuality = options.compressionQuality || 0.9;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const img = new Image();
        img.onload = async () => {
          let canvas = document.createElement('canvas');
          let ctx = canvas.getContext('2d');

          let { width, height } = img;

          // Multi-step downscaling for quality
          while (width > resizeThreshold * 2 || height > resizeThreshold * 2) {
            width = Math.floor(width * 0.5);
            height = Math.floor(height * 0.5);
          }

          // Final resize to threshold
          if (width > resizeThreshold || height > resizeThreshold) {
            const ratio = Math.min(resizeThreshold / width, resizeThreshold / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;

          // Draw image (this strips EXIF and re-encodes, destroying embedded scripts)
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to JPEG with compression
          const dataURL = canvas.toDataURL('image/jpeg', compressionQuality);
          const base64 = extractBase64(dataURL);

          // Generate thumbnail
          const thumbnail = await generateThumbnail(dataURL, 128);

          // Determine format
          const format = file.type.split('/')[1] || 'jpeg';

          resolve({
            base64, // NO data URI prefix (for Ollama API)
            thumbnail, // WITH data URI prefix (for display)
            size: file.size,
            dimensions: { width, height },
            format
          });
        };

        img.onerror = () => reject(new Error('Failed to load image for processing'));
        img.src = e.target.result;
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Strips data URI prefix from base64 string
 * @param {string} dataURL - Data URI (data:image/png;base64,...)
 * @returns {string} Raw base64 string
 */
export function extractBase64(dataURL) {
  if (!dataURL || typeof dataURL !== 'string') return '';
  const match = dataURL.match(/^data:image\/[a-z]+;base64,(.+)$/);
  return match ? match[1] : dataURL;
}

/**
 * Generate thumbnail from data URL
 * @param {string} dataURL - Source image data URL
 * @param {number} size - Thumbnail size (width/height of square)
 * @returns {Promise<string>} Thumbnail data URL
 */
export async function generateThumbnail(dataURL, size = 128) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Calculate aspect ratio
      const aspectRatio = img.width / img.height;
      let thumbWidth, thumbHeight;

      if (aspectRatio > 1) {
        thumbWidth = size;
        thumbHeight = Math.floor(size / aspectRatio);
      } else {
        thumbHeight = size;
        thumbWidth = Math.floor(size * aspectRatio);
      }

      canvas.width = thumbWidth;
      canvas.height = thumbHeight;

      ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };

    img.onerror = () => reject(new Error('Failed to generate thumbnail'));
    img.src = dataURL;
  });
}

/**
 * Check if a model family supports vision
 * @param {string} modelFamily - Model family name
 * @returns {boolean}
 */
export function checkVisionModel(modelFamily) {
  if (!modelFamily) return false;
  const normalized = modelFamily.toLowerCase();
  return VISION_FAMILIES.some(vf => normalized.includes(vf));
}

/**
 * Hash image for duplicate detection
 * @param {string} base64OrDataURL - Base64 string or data URL
 * @returns {Promise<string>} MD5 hash
 */
export async function hashImage(base64OrDataURL) {
  // Extract base64 if data URL
  const base64 = base64OrDataURL.startsWith('data:')
    ? extractBase64(base64OrDataURL)
    : base64OrDataURL;

  // Use SubtleCrypto for hashing (browser API)
  const encoder = new TextEncoder();
  const data = encoder.encode(base64);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 16); // Return first 16 chars (like MD5)
}

/**
 * Estimate token count for an image
 * @param {string} imageBase64 - Base64 image string
 * @returns {number} Estimated token count (~765 per image)
 */
export function estimateTokens(imageBase64) {
  // Ollama vision models use ~765 tokens per image
  return 765;
}

/**
 * Validate data URI format
 * @param {string} dataURI - Data URI to validate
 * @returns {boolean}
 */
export function validateDataURI(dataURI) {
  const pattern = /^data:image\/(png|jpeg|gif);base64,[A-Za-z0-9+/=]+$/;
  return pattern.test(dataURI);
}

/**
 * Sanitize filename (remove unsafe characters)
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

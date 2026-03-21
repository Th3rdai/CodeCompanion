/**
 * Client-side document processing utilities.
 * Handles detection of convertible document types and conversion via the backend API.
 * Documents are converted to markdown by docling-serve (proxied through Express).
 */

// Supported document extensions for conversion via docling-serve
export const DOCUMENT_EXTENSIONS = new Set([
  '.pdf', '.pptx', '.docx', '.xlsx', '.xls', '.csv',
  '.doc', '.ppt', '.odt', '.ods', '.odp',
  '.rtf', '.latex', '.tex', '.epub',
]);

// MIME types for convertible documents
export const DOCUMENT_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/msword',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf',
  'text/csv',
  'application/epub+zip',
  'application/x-latex',
]);

/**
 * Check if a File object is a convertible document type.
 * Checks extension first (more reliable), falls back to MIME type.
 * @param {File} file - Browser File object
 * @returns {boolean}
 */
export function isConvertibleDocument(file) {
  const name = file.name || '';
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx >= 0) {
    const ext = name.slice(dotIdx).toLowerCase();
    if (DOCUMENT_EXTENSIONS.has(ext)) return true;
  }
  return DOCUMENT_MIMES.has(file.type);
}

/**
 * Check if a filename string represents a convertible document.
 * @param {string} filename
 * @returns {boolean}
 */
export function isConvertibleFilename(filename) {
  const dotIdx = (filename || '').lastIndexOf('.');
  if (dotIdx < 0) return false;
  return DOCUMENT_EXTENSIONS.has(filename.slice(dotIdx).toLowerCase());
}

/**
 * Get the accept string for file input elements to include document types.
 * Append this to existing accept attributes.
 * @returns {string}
 */
export function getDocumentAcceptString() {
  return '.pdf,.pptx,.docx,.xlsx,.xls,.doc,.ppt,.odt,.ods,.odp,.rtf,.tex,.epub';
}

/**
 * Read a File as base64 (without the data URI prefix).
 * @param {File} file
 * @returns {Promise<string>} base64-encoded content
 */
export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // Strip data URI prefix: "data:application/pdf;base64,..."
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert a document file via the backend /api/convert-document endpoint.
 * Reads the file as base64 and sends to the server, which proxies to docling-serve.
 *
 * @param {File} file - Browser File object
 * @returns {Promise<{markdown: string, filename: string, originalSize: number, markdownSize: number, truncated: boolean, status: string, processingTime: number, errors: string[]}>}
 * @throws {Error} if conversion fails or docling is unavailable
 */
export async function convertDocument(file) {
  const base64 = await readFileAsBase64(file);

  const res = await fetch('/api/convert-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: base64, filename: file.name }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    // Provide helpful messages for common errors
    if (res.status === 503) {
      throw new Error(err.setupHint
        ? `${err.error}. ${err.detail}`
        : err.error || 'Document conversion service unavailable');
    }
    if (res.status === 413) {
      throw new Error(err.error || 'File too large for conversion');
    }
    if (res.status === 400) {
      throw new Error(err.error || 'Unsupported file type');
    }
    throw new Error(err.detail || err.error || `Conversion failed (HTTP ${res.status})`);
  }

  return await res.json();
}

/**
 * Validate a document file before attempting conversion.
 * Checks size and extension on the client side before sending to server.
 *
 * @param {File} file - Browser File object
 * @param {object} [options]
 * @param {number} [options.maxSizeMB=50] - Maximum file size in MB
 * @returns {{valid: boolean, error?: string}}
 */
export function validateDocument(file, options = {}) {
  const maxSizeMB = options.maxSizeMB || 50;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (!isConvertibleDocument(file)) {
    return { valid: false, error: `Unsupported document type: ${file.name}` };
  }

  if (file.size > maxSizeBytes) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    return { valid: false, error: `File too large: ${sizeMB}MB (max ${maxSizeMB}MB)` };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  return { valid: true };
}

/**
 * Format a document conversion result for attachment to chat/review.
 * @param {object} result - Response from convertDocument()
 * @param {File} originalFile - The original File object
 * @returns {object} Attachment-ready object matching the app's attachedFiles format
 */
export function formatAsAttachment(result, originalFile) {
  return {
    name: `${originalFile.name} (converted)`,
    content: result.markdown,
    lines: result.markdown.split('\n').length,
    size: result.markdownSize,
    convertedFrom: originalFile.name,
    originalSize: result.originalSize,
    truncated: result.truncated || false,
    type: 'converted-document',
  };
}

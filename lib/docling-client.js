/**
 * Docling-serve REST API client.
 * Communicates with a locally-running docling-serve instance for document conversion.
 */

const LOG_PREFIX = '[Docling]';

function log(level, msg, data) {
  const ts = new Date().toISOString();
  const extra = data ? ' ' + JSON.stringify(data) : '';
  console[level === 'ERROR' ? 'error' : 'log'](`${ts} [${level}] ${LOG_PREFIX} ${msg}${extra}`);
}

/**
 * Check if docling-serve is reachable.
 * @param {string} doclingUrl - Base URL (e.g. http://localhost:5002)
 * @param {string} [apiKey] - Optional API key
 * @returns {Promise<{connected: boolean, version?: string, error?: string}>}
 */
async function checkConnection(doclingUrl, apiKey) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const headers = {};
    if (apiKey) headers['X-Api-Key'] = apiKey;

    const res = await fetch(`${doclingUrl}/health`, {
      signal: controller.signal,
      headers,
    });
    clearTimeout(timeout);

    if (res.ok) {
      await res.json().catch(() => ({}));
      log('INFO', `Connected to docling-serve at ${doclingUrl}`);
      // Try to get version info
      let version;
      try {
        const vRes = await fetch(`${doclingUrl}/version`, { headers });
        if (vRes.ok) {
          const vData = await vRes.json();
          version = vData.version || vData.docling_version;
        }
      } catch {
        // Version endpoint may not exist — not critical
      }
      return { connected: true, version };
    }
    return { connected: false, error: `HTTP ${res.status}` };
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Connection timed out (5s)' : err.message;
    log('ERROR', `Cannot reach docling-serve at ${doclingUrl}`, { error: msg });
    return { connected: false, error: msg };
  }
}

/**
 * Convert a document file to markdown/text via docling-serve.
 * Uses the /v1/convert/file multipart endpoint.
 *
 * @param {string} doclingUrl - Base URL
 * @param {string} [apiKey] - Optional API key
 * @param {Buffer} fileBuffer - Raw file contents
 * @param {string} filename - Original filename (used for format detection)
 * @param {object} [options]
 * @param {string} [options.outputFormat='md'] - Output format: md, json, html, text, doctags
 * @param {boolean} [options.ocr=true] - Enable OCR
 * @param {string} [options.ocrEngine='easyocr'] - OCR engine
 * @param {number} [options.timeoutSec=120] - Timeout in seconds
 * @returns {Promise<{markdown: string, status: string, processingTime: number, errors: string[]}>}
 */
async function convertDocument(doclingUrl, apiKey, fileBuffer, filename, options = {}) {
  const {
    outputFormat = 'md',
    ocr = true,
    ocrEngine = 'easyocr',
    timeoutSec = 120,
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSec * 1000);

  try {
    // Build multipart form data using Node.js native FormData + Blob
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    formData.append('files', blob, filename);
    formData.append('to_formats', outputFormat);
    if (ocr) {
      formData.append('ocr', 'true');
      formData.append('ocr_engine', ocrEngine);
    }
    formData.append('table_mode', 'fast');
    formData.append('abort_on_error', 'false');

    const headers = {};
    if (apiKey) headers['X-Api-Key'] = apiKey;

    log('INFO', `Converting ${filename} (${(fileBuffer.length / 1024).toFixed(1)}KB)`, { outputFormat, ocr });

    const res = await fetch(`${doclingUrl}/v1/convert/file`, {
      method: 'POST',
      body: formData,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Docling returned HTTP ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();

    // Extract content based on output format
    const doc = data.document || data;
    let markdown = '';
    if (outputFormat === 'md') {
      markdown = doc.md_content || doc.markdown || '';
    } else if (outputFormat === 'text') {
      markdown = doc.text_content || '';
    } else if (outputFormat === 'html') {
      markdown = doc.html_content || '';
    } else {
      markdown = doc.md_content || JSON.stringify(doc, null, 2);
    }

    const status = data.status || 'success';
    const processingTime = data.processing_time || 0;
    const errors = data.errors || [];

    log('INFO', `Converted ${filename}: ${status} (${processingTime.toFixed(1)}s, ${(markdown.length / 1024).toFixed(1)}KB output)`);

    return { markdown, status, processingTime, errors };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error(`Document conversion timed out after ${timeoutSec}s`);
    }
    throw err;
  }
}

/**
 * Start async conversion for large documents.
 * @param {string} doclingUrl - Base URL
 * @param {string} [apiKey] - Optional API key
 * @param {Buffer} fileBuffer - Raw file contents
 * @param {string} filename - Original filename
 * @param {object} [options]
 * @param {string} [options.outputFormat='md'] - Output format
 * @param {boolean} [options.ocr=true] - Enable OCR
 * @param {string} [options.ocrEngine='easyocr'] - OCR engine
 * @returns {Promise<{taskId: string}>}
 */
async function convertDocumentAsync(doclingUrl, apiKey, fileBuffer, filename, options = {}) {
  const { outputFormat = 'md', ocr = true, ocrEngine = 'easyocr' } = options;

  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
  formData.append('files', blob, filename);
  formData.append('to_formats', outputFormat);
  if (ocr) {
    formData.append('ocr', 'true');
    formData.append('ocr_engine', ocrEngine);
  }
  formData.append('table_mode', 'fast');

  const headers = {};
  if (apiKey) headers['X-Api-Key'] = apiKey;

  const res = await fetch(`${doclingUrl}/v1/convert/file/async`, {
    method: 'POST',
    body: formData,
    headers,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Async conversion failed: HTTP ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const taskId = data.task_id;
  if (!taskId) throw new Error('No task_id in async response');

  log('INFO', `Async conversion started for ${filename}: task ${taskId}`);
  return { taskId };
}

/**
 * Poll async task status.
 * @param {string} doclingUrl - Base URL
 * @param {string} [apiKey] - Optional API key
 * @param {string} taskId - Task ID from convertDocumentAsync
 * @returns {Promise<{status: string, position?: number, error?: string}>}
 */
async function pollTaskStatus(doclingUrl, apiKey, taskId) {
  const headers = {};
  if (apiKey) headers['X-Api-Key'] = apiKey;

  const res = await fetch(`${doclingUrl}/v1/status/poll/${taskId}`, { headers });
  if (!res.ok) throw new Error(`Poll failed: HTTP ${res.status}`);

  const data = await res.json();
  return {
    status: data.task_status || 'unknown',
    position: data.task_position,
    error: data.error_message,
  };
}

/**
 * Get async task result.
 * @param {string} doclingUrl - Base URL
 * @param {string} [apiKey] - Optional API key
 * @param {string} taskId - Task ID from convertDocumentAsync
 * @param {string} [outputFormat='md'] - Output format used in conversion
 * @returns {Promise<{markdown: string, status: string, processingTime: number, errors: string[]}>}
 */
async function getTaskResult(doclingUrl, apiKey, taskId, outputFormat = 'md') {
  const headers = {};
  if (apiKey) headers['X-Api-Key'] = apiKey;

  const res = await fetch(`${doclingUrl}/v1/result/${taskId}`, { headers });
  if (!res.ok) throw new Error(`Get result failed: HTTP ${res.status}`);

  const data = await res.json();
  const doc = data.document || data;
  let markdown = '';
  if (outputFormat === 'md') {
    markdown = doc.md_content || doc.markdown || '';
  } else if (outputFormat === 'text') {
    markdown = doc.text_content || '';
  } else {
    markdown = doc.md_content || JSON.stringify(doc, null, 2);
  }

  return {
    markdown,
    status: data.status || 'success',
    processingTime: data.processing_time || 0,
    errors: data.errors || [],
  };
}

/**
 * Docling-serve API key: `DOCLING_API_KEY` from repo-root `.env` wins over Settings (.cc-config.json).
 */
function effectiveDoclingApiKey(config) {
  const env = process.env.DOCLING_API_KEY;
  if (env && String(env).trim()) return String(env).trim();
  return (config?.docling?.apiKey && String(config.docling.apiKey).trim()) || '';
}

module.exports = {
  checkConnection,
  convertDocument,
  convertDocumentAsync,
  pollTaskStatus,
  getTaskResult,
  effectiveDoclingApiKey,
};

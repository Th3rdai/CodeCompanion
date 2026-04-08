/**
 * routes/convert.js
 *
 * POST /api/convert-document — document-to-markdown conversion using Docling
 * (when enabled) with a built-in converter fallback.
 *
 * Extracted from server.js in Phase 24.5-03.
 */

const express = require("express");
const path = require("path");
const {
  convertDocument: convertDoc,
  effectiveDoclingApiKey,
} = require("../lib/docling-client");
const {
  canConvertBuiltin,
  convertBuiltin,
} = require("../lib/builtin-doc-converter");
const { CLIENT_INTERNAL_ERROR } = require("../lib/client-errors");
const { createRateLimiter } = require("../lib/rate-limiter");

const ALLOWED_EXTS = new Set([
  ".pdf",
  ".pptx",
  ".docx",
  ".xlsx",
  ".xls",
  ".csv",
  ".doc",
  ".ppt",
  ".odt",
  ".ods",
  ".odp",
  ".rtf",
  ".latex",
  ".tex",
  ".epub",
]);

function createConvertRouter({ getConfig, log }) {
  const router = express.Router();

  router.post(
    "/convert-document",
    express.json({ limit: "50mb" }),
    createRateLimiter({
      name: "convert",
      max: 10,
      windowMs: 60000,
      methods: ["POST"],
    }),
    async (req, res) => {
      const config = getConfig();
      const { content, filename } = req.body;

      if (!content || !filename) {
        return res.status(400).json({ error: "Missing content or filename" });
      }

      const ext = path.extname(filename).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) {
        return res.status(400).json({ error: `Unsupported file type: ${ext}` });
      }

      let buffer;
      try {
        buffer = Buffer.from(content, "base64");
      } catch {
        return res.status(400).json({ error: "Invalid base64 content" });
      }

      const maxBytes = (config.docling?.maxFileSizeMB || 50) * 1024 * 1024;
      if (buffer.length > maxBytes) {
        return res.status(413).json({
          error: `File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB (max ${config.docling?.maxFileSizeMB || 50}MB)`,
        });
      }

      log(
        "INFO",
        `Converting document: ${filename} (${(buffer.length / 1024).toFixed(1)}KB)`,
      );

      const mkResponse = (result, converter) => ({
        markdown: result.markdown,
        filename,
        originalSize: buffer.length,
        markdownSize: result.markdown.length,
        truncated: result.truncated || false,
        status: result.status,
        processingTime: result.processingTime,
        errors: result.errors,
        converter,
      });

      // ── Try Docling first if enabled ──
      if (config.docling?.enabled) {
        try {
          const result = await convertDoc(
            config.docling.url,
            effectiveDoclingApiKey(config),
            buffer,
            filename,
            {
              outputFormat: config.docling.outputFormat || "md",
              ocr: config.docling.ocr !== false,
              ocrEngine: config.docling.ocrEngine || "easyocr",
              timeoutSec: config.docling.timeoutSec || 120,
            },
          );
          return res.json(mkResponse(result, "docling"));
        } catch (err) {
          const isConn =
            err.message?.includes("ECONNREFUSED") ||
            err.message?.includes("fetch failed");
          log(
            "WARN",
            `Docling ${isConn ? "unreachable" : "error"} for ${filename}: ${err.message}`,
          );
          if (!canConvertBuiltin(filename)) {
            if (isConn) {
              return res.status(503).json({
                error: `${ext.slice(1).toUpperCase()} files require Docling for conversion`,
                detail: `Cannot reach Docling at ${config.docling.url}. Built-in conversion supports PDF, DOCX, and XLSX only.`,
                setupHint:
                  'pip install "docling-serve[ui]" && docling-serve run --host 127.0.0.1 --port 5002',
              });
            }
            return res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
          }
          log("INFO", `Falling back to built-in converter for ${filename}`);
        }
      }

      // ── Built-in fallback ──
      if (canConvertBuiltin(filename)) {
        try {
          const result = await convertBuiltin(buffer, filename);
          return res.json(mkResponse(result, "builtin"));
        } catch (err) {
          log("ERROR", `Built-in conversion failed: ${filename}`, {
            error: err.message,
          });
          return res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
        }
      }

      // ── Unsupported format without Docling ──
      const reason = !config.docling?.enabled
        ? "Document conversion (Docling) is disabled in Settings"
        : "Cannot reach the Docling server";
      return res.status(503).json({
        error: `${ext.slice(1).toUpperCase()} files require Docling for conversion`,
        detail: `${reason}. Built-in conversion supports PDF, DOCX, and XLSX only.`,
        setupHint:
          'pip install "docling-serve[ui]" && docling-serve run --host 127.0.0.1 --port 5002',
      });
    },
  );

  return router;
}

module.exports = createConvertRouter;

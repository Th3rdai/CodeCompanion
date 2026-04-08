const express = require("express");
const path = require("path");

const {
  generateOfficeFile,
  SUPPORTED_FORMATS: OFFICE_FORMATS,
  FORMAT_META,
} = require("../lib/office-generator");
const { CLIENT_INTERNAL_ERROR } = require("../lib/client-errors");

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log } = appContext;

  // ── GET /api/export/formats ───────────────────────────
  router.get("/export/formats", (_req, res) => res.json(FORMAT_META));

  // ── POST /api/generate-office ─────────────────────────
  // Rate limiter is applied as app.use('/api/generate-office', ...) in server.js
  router.post(
    "/generate-office",
    express.json({ limit: "10mb" }),
    async (req, res) => {
      const { content, filename } = req.body;
      if (!content || !filename) {
        return res.status(400).json({ error: "Missing content or filename" });
      }
      const ext = path.extname(filename).toLowerCase();
      if (!OFFICE_FORMATS.has(ext)) {
        return res.status(400).json({ error: `Unsupported format: ${ext}` });
      }
      try {
        log(
          "INFO",
          `Generating ${ext} file: ${filename} (${content.length} chars input)`,
        );
        const result = await generateOfficeFile(
          content,
          filename,
          req.body.options,
        );
        log(
          "INFO",
          `Generated ${filename}: ${(result.size / 1024).toFixed(1)}KB in ${result.processingTime}s`,
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );
        const mimeTypes = {
          ".docx":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ".xlsx":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ".pptx":
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          ".csv": "text/csv",
          ".pdf": "application/pdf",
          ".odt": "application/vnd.oasis.opendocument.text",
          ".ods": "application/vnd.oasis.opendocument.spreadsheet",
          ".html": "text/html",
          ".json": "application/json",
          ".md": "text/markdown",
          ".txt": "text/plain",
        };
        res.setHeader(
          "Content-Type",
          mimeTypes[ext] || "application/octet-stream",
        );
        res.send(result.buffer);
      } catch (err) {
        log("ERROR", `Export failed: ${filename}`, { error: err.message });
        res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
      }
    },
  );

  return router;
};

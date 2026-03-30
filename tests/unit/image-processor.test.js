const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  checkVisionModel,
  extractBase64,
  hashImage,
  estimateTokens,
  validateDataURI,
  sanitizeFilename,
  validateImage,
  VISION_FAMILIES,
  ALLOWED_MIME_TYPES,
} = require("../../lib/image-processor");

describe("Image Processor - Vision Model Detection", () => {
  describe("checkVisionModel", () => {
    it("identifies llava family models", () => {
      assert.equal(checkVisionModel("llava"), true);
      assert.equal(checkVisionModel("Llava"), true);
      assert.equal(checkVisionModel("LLAVA"), true);
    });

    it("identifies bakllava family models", () => {
      assert.equal(checkVisionModel("bakllava"), true);
      assert.equal(checkVisionModel("BakLLaVA"), true);
    });

    it("identifies minicpm-v family models", () => {
      assert.equal(checkVisionModel("minicpm-v"), true);
      assert.equal(checkVisionModel("MiniCPM-V"), true);
    });

    it("rejects non-vision models", () => {
      assert.equal(checkVisionModel("llama3"), false);
      assert.equal(checkVisionModel("mistral"), false);
      assert.equal(checkVisionModel("qwen"), false);
      assert.equal(checkVisionModel("phi"), false);
    });

    it("handles edge cases", () => {
      assert.equal(checkVisionModel(""), false);
      assert.equal(checkVisionModel(null), false);
      assert.equal(checkVisionModel(undefined), false);
    });
  });

  describe("VISION_FAMILIES constant", () => {
    it("exports correct vision families", () => {
      assert.deepEqual(VISION_FAMILIES, [
        "llava",
        "bakllava",
        "minicpm-v",
        "moondream",
        "minimax",
        "cogvlm",
        "fuyu",
        "idefics",
        "qwen-vl",
        "internvl",
        "yi-vl",
        "deepseek-vl",
        "glm-4v",
      ]);
    });
  });
});

describe("Image Processor - Base64 Extraction", () => {
  describe("extractBase64", () => {
    it("extracts base64 from PNG data URL", () => {
      const dataURL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA";
      const base64 = extractBase64(dataURL);
      assert.equal(base64, "iVBORw0KGgoAAAANSUhEUgAAAAUA");
    });

    it("extracts base64 from JPEG data URL", () => {
      const dataURL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABI";
      const base64 = extractBase64(dataURL);
      assert.equal(base64, "/9j/4AAQSkZJRgABAQEASABI");
    });

    it("extracts base64 from GIF data URL", () => {
      const dataURL = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5";
      const base64 = extractBase64(dataURL);
      assert.equal(base64, "R0lGODlhAQABAIAAAP///wAAACH5");
    });

    it("handles very long base64 strings", () => {
      const longBase64 = "A".repeat(10000);
      const dataURL = `data:image/png;base64,${longBase64}`;
      const base64 = extractBase64(dataURL);
      assert.equal(base64, longBase64);
    });

    it("throws on invalid data URL format", () => {
      assert.throws(
        () => extractBase64("not-a-data-url"),
        /Invalid data URL format/,
      );
      assert.throws(
        () => extractBase64("data:text/plain,hello"),
        /Invalid data URL format/,
      );
      assert.throws(
        () => extractBase64("iVBORw0KGgo..."),
        /Invalid data URL format/,
      );
    });

    it("throws on missing base64 content", () => {
      assert.throws(
        () => extractBase64("data:image/png;base64,"),
        /Invalid data URL format/,
      );
    });
  });
});

describe("Image Processor - Hashing", () => {
  describe("hashImage", () => {
    it("generates consistent hash for same content", () => {
      const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAUA";
      const hash1 = hashImage(base64);
      const hash2 = hashImage(base64);
      assert.equal(hash1, hash2);
    });

    it("generates different hashes for different content", () => {
      const base64a = "iVBORw0KGgoAAAANSUhEUgAAAAUA";
      const base64b = "/9j/4AAQSkZJRgABAQEASABI";
      const hash1 = hashImage(base64a);
      const hash2 = hashImage(base64b);
      assert.notEqual(hash1, hash2);
    });

    it("handles data URLs by extracting base64 first", () => {
      const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAUA";
      const dataURL = `data:image/png;base64,${base64}`;
      const hashFromBase64 = hashImage(base64);
      const hashFromDataURL = hashImage(dataURL);
      assert.equal(hashFromBase64, hashFromDataURL);
    });

    it("returns 32-character hex string (MD5)", () => {
      const hash = hashImage("iVBORw0KGgoAAAANSUhEUgAAAAUA");
      assert.equal(hash.length, 32);
      assert.match(hash, /^[a-f0-9]{32}$/);
    });

    it("samples first 10KB for large images", () => {
      // Hash should be consistent even if content beyond 10KB differs
      const largeBase64a = "A".repeat(20000) + "B".repeat(10000);
      const largeBase64b = "A".repeat(20000) + "C".repeat(10000);
      const hash1 = hashImage(largeBase64a);
      const hash2 = hashImage(largeBase64b);
      assert.equal(
        hash1,
        hash2,
        "Hashes should match when first 10KB is identical",
      );
    });
  });
});

describe("Image Processor - Token Estimation", () => {
  describe("estimateTokens", () => {
    it("returns fixed 765 tokens for all images", () => {
      assert.equal(estimateTokens("short-base64"), 765);
      assert.equal(estimateTokens("A".repeat(10000)), 765);
      assert.equal(estimateTokens("B".repeat(100000)), 765);
    });

    it("matches llava fixed token budget", () => {
      // llava uses fixed grid regardless of image size
      const expectedTokens = 765;
      assert.equal(estimateTokens("any-image-data"), expectedTokens);
    });
  });
});

describe("Image Processor - Data URI Validation", () => {
  describe("validateDataURI", () => {
    it("accepts valid PNG data URI", () => {
      assert.equal(validateDataURI("data:image/png;base64,iVBORw0KGgo="), true);
    });

    it("accepts valid JPEG data URI", () => {
      assert.equal(
        validateDataURI("data:image/jpeg;base64,/9j/4AAQSkZJ"),
        true,
      );
    });

    it("accepts valid GIF data URI", () => {
      assert.equal(validateDataURI("data:image/gif;base64,R0lGODlhAQAB"), true);
    });

    it("rejects non-image MIME types", () => {
      assert.equal(validateDataURI("data:text/plain;base64,aGVsbG8="), false);
      assert.equal(
        validateDataURI("data:application/pdf;base64,JVBERi0x"),
        false,
      );
    });

    it("rejects unsupported image formats", () => {
      assert.equal(
        validateDataURI("data:image/svg+xml;base64,PHN2Zz4="),
        false,
      );
      assert.equal(validateDataURI("data:image/webp;base64,UklGRhIA"), false);
      assert.equal(validateDataURI("data:image/bmp;base64,Qk0yAA=="), false);
    });

    it("rejects malformed data URIs", () => {
      assert.equal(validateDataURI("not-a-data-uri"), false);
      assert.equal(validateDataURI("data:image/png,not-base64"), false);
      assert.equal(validateDataURI("data:image/png;base64,"), false);
    });

    it("rejects data URIs with invalid base64 characters", () => {
      assert.equal(
        validateDataURI("data:image/png;base64,invalid!@#$%"),
        false,
      );
      assert.equal(
        validateDataURI("data:image/png;base64,<script>alert(1)</script>"),
        false,
      );
    });

    it("accepts base64 with padding", () => {
      assert.equal(validateDataURI("data:image/png;base64,iVBORw0KGgo="), true);
      assert.equal(validateDataURI("data:image/png;base64,ABC=="), true);
    });
  });
});

describe("Image Processor - Filename Sanitization", () => {
  describe("sanitizeFilename", () => {
    it("preserves safe filenames", () => {
      assert.equal(sanitizeFilename("image.png"), "image.png");
      assert.equal(sanitizeFilename("my-photo_123.jpg"), "my-photo_123.jpg");
    });

    it("removes path traversal attempts", () => {
      assert.equal(sanitizeFilename("../../../etc/passwd"), "passwd");
      assert.equal(sanitizeFilename("../../file.png"), "file.png");
    });

    it("removes unsafe characters", () => {
      assert.equal(sanitizeFilename('file<>:"|?.png'), "file______.png");
      assert.equal(
        sanitizeFilename("image with spaces.jpg"),
        "image_with_spaces.jpg",
      );
    });

    it("preserves extensions", () => {
      assert.equal(sanitizeFilename("photo.jpeg"), "photo.jpeg");
      assert.equal(sanitizeFilename("screenshot.PNG"), "screenshot.PNG");
    });

    it("handles absolute paths by taking basename", () => {
      assert.equal(sanitizeFilename("/var/www/uploads/image.png"), "image.png");
      // Windows paths on macOS/Linux: path.basename keeps backslashes, then replaces them
      assert.equal(
        sanitizeFilename("C:\\Users\\Documents\\photo.jpg"),
        "C__Users_Documents_photo.jpg",
      );
    });

    it("handles filenames with multiple dots", () => {
      assert.equal(
        sanitizeFilename("file.name.with.dots.png"),
        "file.name.with.dots.png",
      );
    });

    it("replaces special characters with underscores", () => {
      assert.equal(sanitizeFilename("café.jpg"), "caf_.jpg");
      assert.equal(sanitizeFilename("файл.png"), "____.png");
    });
  });
});

describe("Image Processor - Image Validation", () => {
  describe("validateImage (Node.js mode)", () => {
    // Note: Full validation requires browser environment
    // These tests verify Node.js fallback behavior

    it("rejects unsupported MIME types", async () => {
      const file = { type: "image/svg+xml", size: 1000 };
      const result = await validateImage(file);
      assert.equal(result.valid, false);
      assert.match(result.error, /Unsupported format/);
    });

    it("accepts PNG MIME type", async () => {
      const file = { type: "image/png", size: 1000 };
      const result = await validateImage(file);
      // In Node.js, dimensions check is skipped
      assert.equal(result.valid, true);
    });

    it("accepts JPEG MIME type", async () => {
      const file = { type: "image/jpeg", size: 1000 };
      const result = await validateImage(file);
      assert.equal(result.valid, true);
    });

    it("accepts GIF MIME type", async () => {
      const file = { type: "image/gif", size: 1000 };
      const result = await validateImage(file);
      assert.equal(result.valid, true);
    });

    it("rejects files exceeding size limit", async () => {
      const file = {
        type: "image/png",
        size: 30 * 1024 * 1024, // 30MB
      };
      const result = await validateImage(file, { maxSizeMB: 25 });
      assert.equal(result.valid, false);
      assert.match(result.error, /File too large/);
      assert.match(result.error, /30.0MB/);
    });

    it("accepts files within size limit", async () => {
      const file = {
        type: "image/png",
        size: 5 * 1024 * 1024, // 5MB
      };
      const result = await validateImage(file, { maxSizeMB: 25 });
      assert.equal(result.valid, true);
    });

    it("uses default 25MB limit when not specified", async () => {
      const file = {
        type: "image/jpeg",
        size: 26 * 1024 * 1024, // 26MB
      };
      const result = await validateImage(file);
      assert.equal(result.valid, false);
    });

    it("returns size in validation result", async () => {
      const fileSize = 123456;
      const file = { type: "image/png", size: fileSize };
      const result = await validateImage(file);
      assert.equal(result.size, fileSize);
    });
  });
});

describe("Image Processor - Constants", () => {
  describe("ALLOWED_MIME_TYPES", () => {
    it("exports correct MIME types", () => {
      assert.deepEqual(ALLOWED_MIME_TYPES, [
        "image/png",
        "image/jpeg",
        "image/gif",
      ]);
    });

    it("does not include unsafe formats", () => {
      assert.equal(ALLOWED_MIME_TYPES.includes("image/svg+xml"), false);
      assert.equal(ALLOWED_MIME_TYPES.includes("image/webp"), false);
      assert.equal(ALLOWED_MIME_TYPES.includes("image/bmp"), false);
    });
  });
});

describe("Image Processor - Browser-Only Functions", () => {
  // These functions require browser APIs (Canvas, Image, etc.)
  // Document that they need browser environment for E2E tests

  it("processImage requires browser environment", () => {
    const { processImage } = require("../../lib/image-processor");
    assert.equal(typeof processImage, "function");
    // Cannot test in Node.js - requires Canvas API
  });

  it("generateThumbnail requires browser environment", () => {
    const { generateThumbnail } = require("../../lib/image-processor");
    assert.equal(typeof generateThumbnail, "function");
    // Cannot test in Node.js - requires Canvas API
  });

  it("getImageDimensions requires browser environment", () => {
    const { getImageDimensions } = require("../../lib/image-processor");
    assert.equal(typeof getImageDimensions, "function");
    // Cannot test in Node.js - requires Image element
  });
});

describe("Image Processor - Module Exports", () => {
  it("exports all required functions", () => {
    const imageProcessor = require("../../lib/image-processor");

    assert.equal(typeof imageProcessor.validateImage, "function");
    assert.equal(typeof imageProcessor.processImage, "function");
    assert.equal(typeof imageProcessor.extractBase64, "function");
    assert.equal(typeof imageProcessor.generateThumbnail, "function");
    assert.equal(typeof imageProcessor.checkVisionModel, "function");
    assert.equal(typeof imageProcessor.hashImage, "function");
    assert.equal(typeof imageProcessor.estimateTokens, "function");
    assert.equal(typeof imageProcessor.validateDataURI, "function");
    assert.equal(typeof imageProcessor.sanitizeFilename, "function");
    assert.equal(typeof imageProcessor.getImageDimensions, "function");
  });

  it("exports constants", () => {
    const imageProcessor = require("../../lib/image-processor");

    assert(Array.isArray(imageProcessor.VISION_FAMILIES));
    assert(Array.isArray(imageProcessor.ALLOWED_MIME_TYPES));
  });
});

#!/usr/bin/env node
/**
 * Test multiple consecutive file generations to verify Promise hang fix.
 * Tests both markdown (simple) and PDF (complex) generation.
 */

const https = require("https");

// Accept self-signed cert for testing
const agent = new https.Agent({ rejectUnauthorized: false });

async function generateFile(filename, content, format = "md") {
  const ext = format.startsWith(".") ? format : `.${format}`;
  const fullFilename = `${filename}${ext}`;

  console.log(`\n[${new Date().toISOString()}] Generating ${fullFilename}...`);

  const data = JSON.stringify({
    content,
    filename: fullFilename,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout after 10s for ${fullFilename}`));
    }, 10000);

    const req = https.request(
      {
        hostname: "localhost",
        port: 8903,
        path: "/api/generate-office",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
        agent,
      },
      (res) => {
        clearTimeout(timeout);

        let responseData = Buffer.alloc(0);
        res.on("data", (chunk) => {
          responseData = Buffer.concat([responseData, chunk]);
        });

        res.on("end", () => {
          if (res.statusCode === 200) {
            const sizeKB = (responseData.length / 1024).toFixed(2);
            console.log(
              `✅ ${fullFilename} generated successfully (${sizeKB}KB)`,
            );
            resolve({ filename: fullFilename, buffer: responseData });
          } else {
            const error = responseData.toString();
            console.error(`❌ ${fullFilename} failed: ${res.statusCode}`);
            console.error(`   Error: ${error}`);
            reject(new Error(`HTTP ${res.statusCode}: ${error}`));
          }
        });
      },
    );

    req.on("error", (err) => {
      clearTimeout(timeout);
      console.error(`❌ ${fullFilename} request failed: ${err.message}`);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

async function runTest() {
  console.log("🧪 Testing multiple consecutive file generations...");
  console.log("=".repeat(60));

  const results = [];
  const errors = [];

  // Test 1: Five markdown files in sequence
  console.log("\n📝 Test 1: Five markdown files");
  for (let i = 1; i <= 5; i++) {
    try {
      const result = await generateFile(
        `test-md-${i}`,
        `# Test Document ${i}\n\nThis is test document number ${i}.\n\n## Section 1\n\nSome content here.\n\n- Item 1\n- Item 2\n- Item 3\n\n## Section 2\n\nMore content.\n`,
        "md",
      );
      results.push(result);
    } catch (err) {
      errors.push({ test: `markdown-${i}`, error: err.message });
    }
  }

  // Test 2: Three PDF files in sequence
  console.log("\n📄 Test 2: Three PDF files");
  for (let i = 1; i <= 3; i++) {
    try {
      const result = await generateFile(
        `test-pdf-${i}`,
        `# PDF Test ${i}\n\n## Overview\n\nThis is a PDF generation test.\n\n### Details\n\nTesting multiple consecutive PDF generations to ensure no Promise hangs occur.\n\n**Bold text** and *italic text* should render correctly.\n\n\`\`\`javascript\nfunction test() {\n  console.log("Code block test");\n}\n\`\`\`\n`,
        "pdf",
      );
      results.push(result);
    } catch (err) {
      errors.push({ test: `pdf-${i}`, error: err.message });
    }
  }

  // Test 3: Mixed formats
  console.log("\n🎭 Test 3: Mixed formats");
  const mixedTests = [
    {
      name: "test-docx",
      format: "docx",
      content: "# DOCX Test\n\nWord document test.",
    },
    {
      name: "test-html",
      format: "html",
      content: "# HTML Test\n\nHTML export test.",
    },
    {
      name: "test-txt",
      format: "txt",
      content: "# Text Test\n\nPlain text test.",
    },
  ];

  for (const test of mixedTests) {
    try {
      const result = await generateFile(test.name, test.content, test.format);
      results.push(result);
    } catch (err) {
      errors.push({ test: `${test.format}`, error: err.message });
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 RESULTS");
  console.log("=".repeat(60));
  console.log(`✅ Successful: ${results.length}`);
  console.log(`❌ Failed: ${errors.length}`);

  if (errors.length > 0) {
    console.log("\n❌ Failures:");
    errors.forEach((e) => {
      console.log(`   ${e.test}: ${e.error}`);
    });
  }

  if (errors.length === 0) {
    console.log("\n✨ All tests passed! File generation works correctly.");
    console.log("   No Promise hangs detected - the fix is working! 🎉");
  } else {
    console.log("\n⚠️  Some tests failed. Check errors above.");
    process.exit(1);
  }
}

// Check if server is running
https
  .get("https://localhost:8903/api/models", { agent }, (res) => {
    if (res.statusCode === 200) {
      console.log("✓ Server is running on https://localhost:8903");
      runTest().catch((err) => {
        console.error("\n💥 Test suite error:", err);
        process.exit(1);
      });
    } else {
      console.error(
        `✗ Server returned ${res.statusCode}. Is it running on port 8903?`,
      );
      process.exit(1);
    }
  })
  .on("error", (err) => {
    console.error("✗ Cannot connect to server on https://localhost:8903");
    console.error(`  Error: ${err.message}`);
    console.error("\n  Start the server with: npm start");
    process.exit(1);
  });

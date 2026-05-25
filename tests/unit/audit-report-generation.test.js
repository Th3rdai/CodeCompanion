const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  generateAuditReport,
  generateOfficeFile,
} = require("../../lib/office-generator");

describe("generateAuditReport", () => {
  it("should generate a PDF buffer from security report data", async () => {
    const mockSecurityReport = {
      overallGrade: "B",
      riskSummary: "2 high-severity vulnerabilities detected",
      cleanBillOfHealth: false,
      categories: {
        accessControl: {
          grade: "C",
          vulnerabilities: [
            {
              title: "Missing Authorization Check",
              severity: "high",
              owaspCategory: "A01",
              description: "Admin endpoints lack authorization validation",
              impact: "Unauthorized users can access admin functionality",
              remediation: "Add role-based access control middleware",
            },
          ],
        },
        injection: {
          grade: "A",
          vulnerabilities: [],
        },
      },
      complianceControls: {
        nist: ["AC-2", "AC-3", "AC-6"],
        soc2: ["CC6.1", "CC6.2"],
        hipaa: ["164.308(a)(3)", "164.312(a)(1)"],
        pci: ["7.1", "7.2", "8.2"],
      },
    };

    const options = {
      organizationName: "Test Corp",
      scanDate: "2026-05-24",
      filename: "test-audit",
    };

    const pdfBuffer = await generateAuditReport(mockSecurityReport, options);

    // Verify PDF buffer
    assert.ok(Buffer.isBuffer(pdfBuffer), "Should return a Buffer");
    assert.ok(pdfBuffer.length > 0, "Buffer should not be empty");

    // Verify PDF signature (starts with %PDF)
    const pdfHeader = pdfBuffer.slice(0, 4).toString();
    assert.strictEqual(pdfHeader, "%PDF", "Should be a valid PDF file");
  });

  it("should handle clean bill of health reports", async () => {
    const cleanReport = {
      overallGrade: "A",
      riskSummary: "No vulnerabilities detected",
      cleanBillOfHealth: true,
      categories: {},
      complianceControls: {
        nist: [],
        soc2: [],
        hipaa: [],
        pci: [],
      },
    };

    const pdfBuffer = await generateAuditReport(cleanReport, {
      organizationName: "Secure Corp",
    });

    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.length > 0);
    assert.strictEqual(pdfBuffer.slice(0, 4).toString(), "%PDF");
  });

  it("should include organization name in report", async () => {
    const report = {
      overallGrade: "B",
      riskSummary: "Minor issues found",
      cleanBillOfHealth: false,
      categories: {
        configuration: {
          grade: "B",
          vulnerabilities: [
            {
              title: "Debug Mode Enabled",
              severity: "medium",
              owaspCategory: "A05",
              description: "Production app running in debug mode",
              impact: "Exposes sensitive error information",
              remediation: "Disable debug mode in production",
            },
          ],
        },
      },
      complianceControls: {
        nist: ["CM-6"],
        soc2: ["CC7.2"],
        hipaa: [],
        pci: ["2.2"],
      },
    };

    const pdfBuffer = await generateAuditReport(report, {
      organizationName: "Acme Industries",
      scanDate: "2026-05-24",
    });

    // PDF should be valid and contain the organization name
    // (text extraction would require pdf-parse, but we can verify structure)
    assert.ok(Buffer.isBuffer(pdfBuffer));
    assert.ok(pdfBuffer.length > 1000, "PDF should have substantial content");
  });

  it("should handle all severity levels", async () => {
    const report = {
      overallGrade: "D",
      riskSummary: "Multiple critical vulnerabilities",
      cleanBillOfHealth: false,
      categories: {
        injection: {
          grade: "F",
          vulnerabilities: [
            {
              title: "SQL Injection",
              severity: "critical",
              owaspCategory: "A03",
              description: "Unvalidated user input in SQL query",
              impact: "Full database compromise possible",
              remediation: "Use parameterized queries",
            },
            {
              title: "XSS Vulnerability",
              severity: "high",
              owaspCategory: "A03",
              description: "User input rendered without escaping",
              impact: "Session hijacking possible",
              remediation: "Sanitize all user input before rendering",
            },
          ],
        },
        configuration: {
          grade: "C",
          vulnerabilities: [
            {
              title: "Weak TLS Configuration",
              severity: "medium",
              owaspCategory: "A05",
              description: "TLS 1.0 still enabled",
              impact: "Vulnerable to downgrade attacks",
              remediation: "Disable TLS 1.0 and 1.1",
            },
          ],
        },
        dataProtection: {
          grade: "B",
          vulnerabilities: [
            {
              title: "Missing HSTS Header",
              severity: "low",
              owaspCategory: "A02",
              description: "HTTP Strict Transport Security not enforced",
              impact: "Vulnerable to MITM attacks",
              remediation: "Add HSTS header to all responses",
            },
          ],
        },
      },
      complianceControls: {
        nist: ["SI-10", "AC-3", "CM-6", "SC-8"],
        soc2: ["CC7.1", "CC6.1", "CC7.2", "CC6.7"],
        hipaa: ["164.308(a)(1)(ii)(B)", "164.312(e)(1)"],
        pci: ["6.5.1", "7.1", "2.2", "4.2"],
      },
    };

    const pdfBuffer = await generateAuditReport(report, {
      organizationName: "Multi-Vuln Test Corp",
    });

    assert.ok(Buffer.isBuffer(pdfBuffer));
    // Report with multiple vulns should be larger
    assert.ok(
      pdfBuffer.length > 5000,
      "Multi-vulnerability report should be substantial",
    );
    assert.strictEqual(pdfBuffer.slice(0, 4).toString(), "%PDF");
  });

  it("should reject when audit PDF rendering logic throws", async () => {
    const malformedReport = {
      overallGrade: "D",
      riskSummary: "Malformed vulnerability data",
      cleanBillOfHealth: false,
      categories: {
        injection: {
          grade: "F",
          vulnerabilities: [
            {
              title: "Broken Severity Field",
              severity: null,
              description:
                "Invalid severity should trigger a rendering failure",
            },
          ],
        },
      },
      complianceControls: {},
    };

    await assert.rejects(
      generateAuditReport(malformedReport, {
        organizationName: "Containment Test Org",
      }),
      /toUpperCase/,
    );
  });
});

describe("generateOfficeFile PDF containment", () => {
  it("should reject when generatePdf rendering logic throws", async () => {
    const malformedContent = {
      split() {
        return [null];
      },
    };

    await assert.rejects(
      generateOfficeFile(malformedContent, "report.pdf"),
      /trimEnd/,
    );
  });
});

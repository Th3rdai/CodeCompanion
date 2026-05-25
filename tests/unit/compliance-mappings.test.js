const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  COMPLIANCE_MAP,
  getControlsForFindings,
  getControlsForCategory,
  getAllMappings,
} = require("../../lib/compliance-mappings");

describe("compliance-mappings", () => {
  describe("COMPLIANCE_MAP structure", () => {
    it("should have all 10 OWASP categories (A01-A10)", () => {
      const expectedCategories = [
        "A01",
        "A02",
        "A03",
        "A04",
        "A05",
        "A06",
        "A07",
        "A08",
        "A09",
        "A10",
      ];
      const actualCategories = Object.keys(COMPLIANCE_MAP);

      assert.strictEqual(actualCategories.length, 10);
      expectedCategories.forEach((cat) => {
        assert.ok(COMPLIANCE_MAP[cat], `Missing OWASP category: ${cat}`);
      });
    });

    it("should have required fields for each category", () => {
      Object.entries(COMPLIANCE_MAP).forEach(([key, value]) => {
        assert.ok(value.id, `${key} missing id`);
        assert.ok(value.label, `${key} missing label`);
        assert.ok(value.description, `${key} missing description`);
        assert.ok(Array.isArray(value.nist), `${key} nist should be array`);
        assert.ok(Array.isArray(value.soc2), `${key} soc2 should be array`);
        assert.ok(Array.isArray(value.hipaa), `${key} hipaa should be array`);
        assert.ok(Array.isArray(value.pci), `${key} pci should be array`);
      });
    });

    it("should have at least one control mapping per framework per category", () => {
      Object.entries(COMPLIANCE_MAP).forEach(([key, value]) => {
        assert.ok(value.nist.length > 0, `${key} should have NIST controls`);
        assert.ok(value.soc2.length > 0, `${key} should have SOC 2 controls`);
        assert.ok(value.hipaa.length > 0, `${key} should have HIPAA controls`);
        assert.ok(value.pci.length > 0, `${key} should have PCI DSS controls`);
      });
    });
  });

  describe("getControlsForFindings()", () => {
    it("should return empty arrays for null input", () => {
      const result = getControlsForFindings(null);
      assert.deepStrictEqual(result, {
        nist: [],
        soc2: [],
        hipaa: [],
        pci: [],
      });
    });

    it("should return empty arrays for undefined input", () => {
      const result = getControlsForFindings(undefined);
      assert.deepStrictEqual(result, {
        nist: [],
        soc2: [],
        hipaa: [],
        pci: [],
      });
    });

    it("should return empty arrays for empty findings array", () => {
      const result = getControlsForFindings([]);
      assert.deepStrictEqual(result, {
        nist: [],
        soc2: [],
        hipaa: [],
        pci: [],
      });
    });

    it("should extract controls for a single finding (A01)", () => {
      const findings = [{ category: "A01", severity: "high" }];
      const result = getControlsForFindings(findings);

      assert.ok(result.nist.length > 0, "Should have NIST controls");
      assert.ok(result.soc2.length > 0, "Should have SOC 2 controls");
      assert.ok(result.hipaa.length > 0, "Should have HIPAA controls");
      assert.ok(result.pci.length > 0, "Should have PCI DSS controls");

      // Verify specific known controls for A01 (Broken Access Control)
      assert.ok(result.nist.includes("AC-2"), "A01 should map to NIST AC-2");
      assert.ok(result.soc2.includes("CC6.1"), "A01 should map to SOC 2 CC6.1");
    });

    it("should deduplicate controls from multiple findings", () => {
      const findings = [
        { category: "A01", severity: "high" },
        { category: "A01", severity: "medium" }, // duplicate category
        { category: "A07", severity: "high" },
      ];
      const result = getControlsForFindings(findings);

      // Both A01 and A07 include "CC6.1" and "CC6.2"
      const cc61Count = result.soc2.filter((c) => c === "CC6.1").length;
      assert.strictEqual(cc61Count, 1, "Should deduplicate SOC 2 CC6.1");
    });

    it("should handle findings with owaspCategory field (alternative field name)", () => {
      const findings = [{ owaspCategory: "A03", severity: "critical" }];
      const result = getControlsForFindings(findings);

      assert.ok(result.nist.length > 0, "Should extract NIST controls");
      assert.ok(result.nist.includes("SI-10"), "A03 should map to NIST SI-10");
    });

    it("should return sorted control arrays", () => {
      const findings = [
        { category: "A03", severity: "high" },
        { category: "A01", severity: "high" },
        { category: "A09", severity: "medium" },
      ];
      const result = getControlsForFindings(findings);

      // Verify arrays are sorted
      const isSorted = (arr) =>
        arr.every((val, i, a) => i === 0 || a[i - 1] <= val);

      assert.ok(isSorted(result.nist), "NIST controls should be sorted");
      assert.ok(isSorted(result.soc2), "SOC 2 controls should be sorted");
      assert.ok(isSorted(result.hipaa), "HIPAA controls should be sorted");
      assert.ok(isSorted(result.pci), "PCI DSS controls should be sorted");
    });

    it("should ignore findings with missing category field", () => {
      const findings = [
        { category: "A01", severity: "high" },
        { severity: "high" }, // missing category
        { category: "A02", severity: "medium" },
      ];
      const result = getControlsForFindings(findings);

      // Should only process A01 and A02
      assert.ok(result.nist.length > 0);
      // Verify no error thrown and result is valid
    });

    it("should ignore findings with invalid category IDs", () => {
      const findings = [
        { category: "A01", severity: "high" },
        { category: "A99", severity: "high" }, // invalid
        { category: "XSS", severity: "medium" }, // invalid
      ];
      const result = getControlsForFindings(findings);

      // Should only process A01
      assert.ok(result.nist.includes("AC-2"));
    });

    it("should handle all 10 OWASP categories", () => {
      const findings = [
        { category: "A01", severity: "high" },
        { category: "A02", severity: "high" },
        { category: "A03", severity: "high" },
        { category: "A04", severity: "medium" },
        { category: "A05", severity: "medium" },
        { category: "A06", severity: "high" },
        { category: "A07", severity: "high" },
        { category: "A08", severity: "medium" },
        { category: "A09", severity: "low" },
        { category: "A10", severity: "medium" },
      ];
      const result = getControlsForFindings(findings);

      assert.ok(
        result.nist.length >= 10,
        "Should aggregate many NIST controls",
      );
      assert.ok(
        result.soc2.length >= 5,
        "Should aggregate many SOC 2 controls",
      );
      assert.ok(
        result.hipaa.length >= 5,
        "Should aggregate many HIPAA controls",
      );
      assert.ok(
        result.pci.length >= 10,
        "Should aggregate many PCI DSS controls",
      );
    });
  });

  describe("getControlsForCategory()", () => {
    it("should return mapping for valid OWASP category", () => {
      const result = getControlsForCategory("A01");

      assert.ok(result, "Should return a mapping object");
      assert.strictEqual(result.id, "A01");
      assert.strictEqual(result.label, "Broken Access Control");
      assert.ok(Array.isArray(result.nist));
      assert.ok(Array.isArray(result.soc2));
      assert.ok(Array.isArray(result.hipaa));
      assert.ok(Array.isArray(result.pci));
    });

    it("should return null for invalid OWASP category", () => {
      const result = getControlsForCategory("A99");
      assert.strictEqual(result, null);
    });

    it("should return null for empty string", () => {
      const result = getControlsForCategory("");
      assert.strictEqual(result, null);
    });

    it("should return specific controls for A03 (Injection)", () => {
      const result = getControlsForCategory("A03");

      assert.strictEqual(result.label, "Injection");
      assert.ok(result.nist.includes("SI-10"));
      assert.ok(result.soc2.includes("CC7.1"));
    });
  });

  describe("getAllMappings()", () => {
    it("should return the complete COMPLIANCE_MAP", () => {
      const result = getAllMappings();

      assert.strictEqual(typeof result, "object");
      assert.strictEqual(Object.keys(result).length, 10);
      assert.deepStrictEqual(result, COMPLIANCE_MAP);
    });
  });

  describe("Real-world scenario: Security Review Report", () => {
    it("should map findings from a typical security review", () => {
      // Simulate findings from a security review
      const findings = [
        {
          category: "A01",
          severity: "high",
          description: "Missing authorization checks on admin endpoints",
        },
        {
          category: "A03",
          severity: "critical",
          description: "SQL injection vulnerability in search query",
        },
        {
          category: "A05",
          severity: "medium",
          description: "Debug mode enabled in production",
        },
        {
          category: "A09",
          severity: "high",
          description: "No audit logging for sensitive operations",
        },
      ];

      const controls = getControlsForFindings(findings);

      // Verify we get relevant controls
      assert.ok(
        controls.nist.includes("AC-3"),
        "Should include access control (AC-3)",
      );
      assert.ok(
        controls.nist.includes("SI-10"),
        "Should include input validation (SI-10)",
      );
      assert.ok(
        controls.nist.includes("AU-2"),
        "Should include audit logging (AU-2)",
      );

      assert.ok(
        controls.pci.includes("7.1"),
        "Should include PCI access restrictions",
      );
      assert.ok(
        controls.pci.includes("10.1"),
        "Should include PCI audit trails",
      );

      assert.ok(
        controls.hipaa.includes("164.312(a)(1)"),
        "Should include HIPAA access control",
      );
    });
  });
});

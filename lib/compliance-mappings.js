/**
 * Compliance Framework Mappings
 *
 * Maps OWASP Top 10 2021 categories to compliance control frameworks:
 * - NIST SP 800-53 Rev 5
 * - SOC 2 (AICPA Trust Services Criteria)
 * - HIPAA (45 CFR Part 164)
 * - PCI DSS v4.0
 *
 * Sources:
 * - NIST SP 800-53 Rev 5: https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final
 * - OWASP→NIST mapping: https://owasp.org/www-project-cyber-controls/
 * - AICPA Trust Services Criteria (SOC 2): https://www.aicpa.org/content/dam/aicpa/interestareas/frc/assuranceadvisoryservices/downloadabledocuments/trust-services-criteria.pdf
 * - 45 CFR Part 164 (HIPAA): https://www.hhs.gov/hipaa/for-professionals/security/index.html
 * - PCI DSS v4.0: https://www.pcisecuritystandards.org/document_library/
 */

/**
 * OWASP Top 10 2021 to Compliance Framework Mappings
 * Each category maps to relevant controls in NIST, SOC 2, HIPAA, and PCI DSS
 */
const COMPLIANCE_MAP = {
  A01: {
    id: "A01",
    label: "Broken Access Control",
    description:
      "Failures in access restrictions allowing unauthorized access to data or functionality",
    nist: ["AC-2", "AC-3", "AC-5", "AC-6", "AC-17", "AU-2", "AU-12"],
    soc2: ["CC6.1", "CC6.2", "CC6.3", "CC6.6"],
    hipaa: ["164.308(a)(3)", "164.308(a)(4)", "164.312(a)(1)"],
    pci: ["7.1", "7.2", "7.3", "8.2", "8.6"],
  },
  A02: {
    id: "A02",
    label: "Cryptographic Failures",
    description:
      "Failures in protecting sensitive data through encryption and cryptographic controls",
    nist: ["SC-8", "SC-12", "SC-13", "SC-17", "SC-28"],
    soc2: ["CC6.1", "CC6.7"],
    hipaa: ["164.312(a)(2)(iv)", "164.312(e)(1)", "164.312(e)(2)(ii)"],
    pci: ["3.1", "3.4", "3.5", "3.6", "4.2"],
  },
  A03: {
    id: "A03",
    label: "Injection",
    description:
      "User-supplied data not validated, filtered, or sanitized, allowing code injection attacks",
    nist: ["SI-10", "SI-15", "SA-11"],
    soc2: ["CC7.1", "CC8.1"],
    hipaa: ["164.308(a)(1)(ii)(B)", "164.308(a)(8)"],
    pci: ["6.2", "6.3", "6.5.1", "11.3"],
  },
  A04: {
    id: "A04",
    label: "Insecure Design",
    description:
      "Missing or ineffective security controls in the design phase, leading to architectural flaws",
    nist: ["SA-8", "SA-11", "SA-15", "PL-8", "RA-3"],
    soc2: ["CC3.2", "CC7.1", "CC7.2"],
    hipaa: ["164.308(a)(1)(ii)(B)", "164.308(a)(8)"],
    pci: ["6.1", "6.2", "6.3"],
  },
  A05: {
    id: "A05",
    label: "Security Misconfiguration",
    description:
      "Insecure default configurations, incomplete setups, or misconfigured security headers",
    nist: ["CM-2", "CM-6", "CM-7", "CM-8", "SI-2"],
    soc2: ["CC6.6", "CC7.2", "CC8.1"],
    hipaa: ["164.308(a)(1)(ii)(B)", "164.308(a)(5)(ii)(B)"],
    pci: ["2.1", "2.2", "2.3", "6.2", "11.3"],
  },
  A06: {
    id: "A06",
    label: "Vulnerable and Outdated Components",
    description:
      "Use of components with known vulnerabilities or outdated versions lacking security patches",
    nist: ["SI-2", "SA-11", "RA-5", "CM-8"],
    soc2: ["CC7.1", "CC8.1"],
    hipaa: ["164.308(a)(5)(ii)(B)", "164.308(a)(8)"],
    pci: ["6.2", "6.3", "11.2"],
  },
  A07: {
    id: "A07",
    label: "Identification and Authentication Failures",
    description:
      "Weak authentication mechanisms, credential management failures, or session handling issues",
    nist: ["IA-2", "IA-5", "IA-8", "IA-11", "AC-7", "AU-2"],
    soc2: ["CC6.1", "CC6.2", "CC6.7"],
    hipaa: ["164.308(a)(5)(ii)(C)", "164.312(a)(2)(i)", "164.312(d)"],
    pci: ["8.1", "8.2", "8.3", "8.4", "8.5"],
  },
  A08: {
    id: "A08",
    label: "Software and Data Integrity Failures",
    description:
      "Code and infrastructure that do not protect against integrity violations or supply chain attacks",
    nist: ["SI-7", "SA-10", "SA-12", "SA-15", "CM-3", "CM-5"],
    soc2: ["CC7.2", "CC8.1"],
    hipaa: ["164.312(c)(1)", "164.312(e)(2)(i)"],
    pci: ["6.2", "6.3", "6.4", "11.3"],
  },
  A09: {
    id: "A09",
    label: "Security Logging and Monitoring Failures",
    description:
      "Insufficient logging, detection, monitoring, and active response to security events",
    nist: ["AU-2", "AU-3", "AU-6", "AU-12", "SI-4"],
    soc2: ["CC7.2", "CC7.3"],
    hipaa: ["164.308(a)(1)(ii)(D)", "164.312(b)"],
    pci: ["10.1", "10.2", "10.3", "10.6", "10.7"],
  },
  A10: {
    id: "A10",
    label: "Server-Side Request Forgery (SSRF)",
    description:
      "Web applications that fetch remote resources without validating user-supplied URLs",
    nist: ["SI-10", "SC-7", "AC-4"],
    soc2: ["CC6.6", "CC7.1"],
    hipaa: ["164.312(e)(1)"],
    pci: ["6.5.10", "11.3"],
  },
};

/**
 * Get compliance controls triggered by security findings
 * @param {Array} findings - Security review findings with OWASP categories
 * @returns {Object} Deduplicated controls by framework: { nist, soc2, hipaa, pci }
 *
 * @example
 * const findings = [
 *   { category: "A01", description: "...", severity: "high" },
 *   { category: "A03", description: "...", severity: "medium" },
 * ];
 * const controls = getControlsForFindings(findings);
 * // { nist: ["AC-2", "AC-3", ...], soc2: ["CC6.1", ...], hipaa: [...], pci: [...] }
 */
function getControlsForFindings(findings) {
  if (!findings || !Array.isArray(findings)) {
    return { nist: [], soc2: [], hipaa: [], pci: [] };
  }

  const controls = {
    nist: new Set(),
    soc2: new Set(),
    hipaa: new Set(),
    pci: new Set(),
  };

  findings.forEach((finding) => {
    const category = finding.category || finding.owaspCategory;
    if (!category) return;

    const mapping = COMPLIANCE_MAP[category];
    if (!mapping) return;

    // Add controls from each framework
    mapping.nist?.forEach((c) => controls.nist.add(c));
    mapping.soc2?.forEach((c) => controls.soc2.add(c));
    mapping.hipaa?.forEach((c) => controls.hipaa.add(c));
    mapping.pci?.forEach((c) => controls.pci.add(c));
  });

  // Convert sets to sorted arrays
  return {
    nist: Array.from(controls.nist).sort(),
    soc2: Array.from(controls.soc2).sort(),
    hipaa: Array.from(controls.hipaa).sort(),
    pci: Array.from(controls.pci).sort(),
  };
}

/**
 * Get detailed control information for a specific OWASP category
 * @param {string} owaspCategory - OWASP category ID (e.g., "A01")
 * @returns {Object|null} Control mapping or null if not found
 */
function getControlsForCategory(owaspCategory) {
  return COMPLIANCE_MAP[owaspCategory] || null;
}

/**
 * Get all OWASP categories with their mappings
 * @returns {Object} Complete compliance map
 */
function getAllMappings() {
  return COMPLIANCE_MAP;
}

module.exports = {
  COMPLIANCE_MAP,
  getControlsForFindings,
  getControlsForCategory,
  getAllMappings,
};

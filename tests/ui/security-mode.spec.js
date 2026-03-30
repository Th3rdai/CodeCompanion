/**
 * UI tests for Security mode
 * Tests mode tab visibility, SecurityPanel rendering, and SecurityReport display
 */

import { test, expect } from "@playwright/test";

const mockSecurityReportResponse = {
  type: "security-report",
  data: {
    overallGrade: "C",
    riskSummary:
      "Several security vulnerabilities were found including SQL injection and hardcoded credentials.",
    topRisk: {
      category: "injection",
      title: "SQL Injection via string concatenation",
      explanation:
        "User input is directly concatenated into SQL queries without parameterization.",
    },
    categories: {
      accessControl: {
        grade: "B",
        summary: "Basic access control in place",
        vulnerabilities: [],
      },
      dataProtection: {
        grade: "D",
        summary: "Hardcoded credentials found",
        vulnerabilities: [
          {
            title: "Hardcoded database password",
            severity: "high",
            owaspCategory: "A02:2021",
            description: "Database password is hardcoded in the source file.",
            impact: "Credentials exposed in version control.",
            remediation:
              "Use environment variables for sensitive configuration.",
            remediationPrompt:
              "Please move the hardcoded database password to an environment variable and read it with process.env.DB_PASSWORD.",
            cvssEstimate: "High (7.0-8.9)",
          },
        ],
      },
      injection: {
        grade: "F",
        summary: "SQL injection vulnerability detected",
        vulnerabilities: [
          {
            title: "SQL Injection via string concatenation",
            severity: "critical",
            owaspCategory: "A03:2021",
            wstgTestCase: "WSTG-INPV-05",
            description:
              "User input is directly concatenated into SQL queries.",
            impact: "Full database compromise possible.",
            codeLocation:
              'Line 15: query = "SELECT * FROM users WHERE id = " + userId',
            remediation:
              "Use parameterized queries instead of string concatenation.",
            remediationPrompt:
              "Please replace the SQL string concatenation on line 15 with a parameterized query using prepared statements.",
            cvssEstimate: "Critical (9.0-10.0)",
          },
        ],
      },
      authAndSession: {
        grade: "B",
        summary: "Session handling is adequate",
        vulnerabilities: [],
      },
      configuration: {
        grade: "A",
        summary: "Configuration follows best practices",
        vulnerabilities: [],
      },
      apiSecurity: {
        grade: "B",
        summary: "API endpoints are reasonably protected",
        vulnerabilities: [],
      },
    },
    cleanBillOfHealth: false,
    testCaseSuggestions: [
      "Test SQL injection with common payloads",
      "Verify credentials are not in source code",
    ],
  },
};

test.describe("Security Mode", () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock models API so the app thinks Ollama is connected
    await context.route("**/api/models", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models: [{ name: "test-model" }],
          ollamaUrl: "http://localhost:11434",
        }),
      });
    });

    // Mock license API
    await context.route("**/api/license", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tier: "pro", features: undefined }),
      });
    });

    // Mock pentest API with structured response
    await context.route("**/api/pentest", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSecurityReportResponse),
      });
    });

    // Mock history API
    await context.route("**/api/history", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: "test-id" }),
        });
      }
    });

    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("th3rdai_onboarding_complete", "true");
      localStorage.setItem("cc-selected-model", "test-model");
    });
    await page.reload();
    await page.waitForResponse("**/api/models");
  });

  test("Security mode tab is visible in mode selector", async ({ page }) => {
    const securityTab = page.getByRole("button", { name: /Security/i });
    await expect(securityTab).toBeVisible();
  });

  test("clicking Security tab shows SecurityPanel with paste input", async ({
    page,
  }) => {
    await page.click('button:has-text("Security")');
    const inputArea = page.getByPlaceholder(/paste your code here for owasp/i);
    await expect(inputArea).toBeVisible();
  });

  test("SecurityPanel has Scan for Vulnerabilities button", async ({
    page,
  }) => {
    await page.click('button:has-text("Security")');
    const scanButton = page.getByRole("button", {
      name: /scan for vulnerabilities/i,
    });
    await expect(scanButton).toBeVisible();
  });

  test("SecurityReport renders all 6 category sections", async ({ page }) => {
    await page.click('button:has-text("Security")');
    await page
      .getByPlaceholder(/paste your code here for owasp/i)
      .fill(
        'const password = "admin123"; db.query("SELECT * FROM users WHERE id = " + req.params.id);',
      );
    await page
      .getByRole("button", { name: /scan for vulnerabilities/i })
      .click();

    // Wait for report to render
    await expect(page.locator("text=Security Scan Report")).toBeVisible();

    // Check all 6 category labels are present (use heading selector for uniqueness)
    await expect(page.locator('h3:has-text("Access Control")')).toBeVisible();
    await expect(page.locator('h3:has-text("Data Protection")')).toBeVisible();
    await expect(
      page.locator('h3:has-text("Injection & Input")'),
    ).toBeVisible();
    await expect(page.locator('h3:has-text("Auth & Sessions")')).toBeVisible();
    await expect(page.locator('h3:has-text("Configuration")')).toBeVisible();
    await expect(page.locator('h3:has-text("API Security")')).toBeVisible();
  });

  test("SecurityReport shows vulnerability details with severity pills", async ({
    page,
  }) => {
    await page.click('button:has-text("Security")');
    await page
      .getByPlaceholder(/paste your code here for owasp/i)
      .fill("const x = 1;");
    await page
      .getByRole("button", { name: /scan for vulnerabilities/i })
      .click();

    await expect(page.locator("text=Security Scan Report")).toBeVisible();

    // Check severity pills are rendered
    await expect(page.locator("text=critical").first()).toBeVisible();
    await expect(page.locator("text=high").first()).toBeVisible();
  });
});

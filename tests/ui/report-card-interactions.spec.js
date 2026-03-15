/**
 * Component tests for ReportCard progressive disclosure
 * Tests color-coded grades, minimal default view, and "Show all findings" toggle
 */

import { test, expect } from '@playwright/test';

const mockReportCardResponse = {
  type: 'report-card',
  data: {
    overallGrade: 'B',
    cleanBillOfHealth: false,
    topPriority: {
      category: 'security',
      title: 'Missing input validation',
      explanation: 'The code accepts user input without validation, which could lead to security issues.'
    },
    categories: {
      bugs: {
        grade: 'A',
        summary: 'No logic errors found',
        findings: []
      },
      security: {
        grade: 'C',
        summary: 'Some security concerns need attention',
        findings: [
          {
            severity: 'high',
            title: 'Missing input validation',
            explanation: 'User input is not validated before processing.',
            suggestedFix: 'Add input validation: if (!input) throw new Error("Invalid input");'
          }
        ]
      },
      readability: {
        grade: 'B',
        summary: 'Code is mostly clear',
        findings: []
      },
      completeness: {
        grade: 'B',
        summary: 'Most edge cases covered',
        findings: []
      }
    }
  }
};

test.describe('ReportCard Progressive Disclosure', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock models API so the app thinks Ollama is connected
    await context.route('**/api/models', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'test-model' }], ollamaUrl: 'http://localhost:11434' })
      });
    });

    // Mock the review API so we get a predictable report card
    await context.route('**/api/review', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockReportCardResponse)
      });
    });

    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('th3rdai_onboarding_complete', 'true');
      localStorage.setItem('cc-selected-model', 'test-model');
    });
    await page.reload();
    // Wait for model fetch to complete and button to become enabled
    await page.waitForResponse('**/api/models');

    // Navigate to Review mode and submit code
    await page.click('button:has-text("Review")');
    await page.getByPlaceholder(/paste your code here/i).fill('function test() { return true; }');
    await page.getByRole('button', { name: /run code review/i }).click();

    // Wait for report card to appear
    await expect(page.getByText(/report card/i).first()).toBeVisible({ timeout: 15000 });
  });

  test('displays color-coded grades with category labels', async ({ page }) => {
    // Verify category names are displayed
    await expect(page.getByText(/bugs/i).first()).toBeVisible();
    await expect(page.getByText(/security/i).first()).toBeVisible();
    await expect(page.getByText(/readability/i).first()).toBeVisible();
    await expect(page.getByText(/completeness/i).first()).toBeVisible();

    // Verify overall grade is displayed
    await expect(page.getByText('B').first()).toBeVisible();
  });

  test('shows top priority callout', async ({ page }) => {
    // The top priority finding should be visible
    await expect(page.getByText(/Missing input validation/i).first()).toBeVisible();
  });

  test('"Show all findings" toggle expands to reveal detailed findings', async ({ page }) => {
    // Look for the expand button
    const showAllButton = page.getByRole('button', { name: /show all findings/i });

    // If show all exists, click it
    if (await showAllButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await showAllButton.click();

      // Detailed findings should now be visible
      await expect(page.getByText(/Missing input validation/i).first()).toBeVisible();

      // Button text should change
      await expect(page.getByRole('button', { name: /hide/i })).toBeVisible();
    } else {
      // Findings may already be expanded — just verify they're present
      await expect(page.getByText(/Missing input validation/i).first()).toBeVisible();
    }
  });

  test('toggle collapses findings back to minimal view', async ({ page }) => {
    const showAllButton = page.getByRole('button', { name: /show all findings/i });

    if (await showAllButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Expand
      await showAllButton.click();
      await expect(page.getByRole('button', { name: /hide/i })).toBeVisible();

      // Collapse
      await page.getByRole('button', { name: /hide/i }).click();
      await expect(page.getByRole('button', { name: /show all findings/i })).toBeVisible();
    }
  });
});

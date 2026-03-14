/**
 * Component tests for ReportCard progressive disclosure
 * Tests color-coded grades, minimal default view, and "Show all findings" toggle
 */

import { test, expect } from '@playwright/test';

// Mock report card data for testing
const mockReportData = {
  overallGrade: 'B',
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
};

test.describe('ReportCard Progressive Disclosure', () => {
  test('displays color-coded grades with icons and labels', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Review")');

    // Fill and submit code
    await page.fill('#review-code', 'function test() { return true; }');
    // Note: In real scenario, we'd need a mock API response
    // For now, test will fail until component is updated

    // Check for grade badges (color indicators + text labels)
    const gradeBadges = await page.locator('.text-emerald-300, .text-blue-300, .text-amber-300, .text-orange-300, .text-red-300').count();
    expect(gradeBadges).toBeGreaterThan(0);

    // Check for category labels (not just color alone)
    const categoryLabels = await page.locator('text=Bugs, text=Security, text=Readability, text=Completeness').count();
    expect(categoryLabels).toBeGreaterThan(0);
  });

  test('shows minimal layout by default', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Review")');

    // After review completes, check minimal view elements
    // - Overall grade
    // - Top priority callout
    // - Grade summary grid
    // - "Show all findings" toggle should be visible

    const showAllButton = await page.locator('button:has-text("Show all findings")').count();
    expect(showAllButton).toBe(1);
  });

  test('"Show all findings" toggle expands to reveal detailed findings', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Review")');

    // Wait for report card to appear
    // Click "Show all findings" button
    await page.click('button:has-text("Show all findings")');

    // Detailed findings should now be visible
    // Check for FindingCard components (severity pills, titles, etc.)
    const findingCards = await page.locator('.glass.rounded-xl.border.border-slate-700\\/30.p-3').count();
    expect(findingCards).toBeGreaterThan(0);

    // Button text should change
    const hideButton = await page.locator('button:has-text("Hide detailed findings")').count();
    expect(hideButton).toBe(1);
  });

  test('toggle collapses findings back to minimal view', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Review")');

    // Expand findings
    await page.click('button:has-text("Show all findings")');

    // Collapse findings
    await page.click('button:has-text("Hide detailed findings")');

    // Detailed findings should be hidden
    // Button text should revert
    const showButton = await page.locator('button:has-text("Show all findings")').count();
    expect(showButton).toBe(1);
  });
});

import { test, expect } from '@playwright/test';

test.describe('JargonGlossary component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('th3rdai_onboarding_complete', 'true'));
    await page.reload();
    // Open glossary panel
    await page.getByRole('button', { name: /glossary/i }).click();
  });

  test('UX-03: displays all terms with search and category filtering', async ({ page }) => {
    // Verify glossary header
    await expect(page.getByText('Jargon Glossary')).toBeVisible();

    // Verify search input exists
    const searchInput = page.getByPlaceholder(/Search terms/i);
    await expect(searchInput).toBeVisible();

    // Test search filtering
    await searchInput.fill('api');
    await expect(page.getByText('API', { exact: true })).toBeVisible();
  });

  test('UX-03: category filtering works', async ({ page }) => {
    // Click Security category
    await page.getByRole('button', { name: 'Security' }).click();

    // Verify Security terms visible
    await expect(page.getByText('SQL Injection')).toBeVisible();
  });
});

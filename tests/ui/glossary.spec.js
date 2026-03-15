import { test, expect } from '@playwright/test';

test.describe('Glossary panel integration', () => {
  test('UX-03: glossary panel opens from toolbar button', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('th3rdai_onboarding_complete', 'true'));
    await page.reload();

    // Click glossary button in toolbar
    await page.getByRole('button', { name: /glossary/i }).click();

    // Verify panel opens
    await expect(page.getByText('Jargon Glossary')).toBeVisible();
  });
});

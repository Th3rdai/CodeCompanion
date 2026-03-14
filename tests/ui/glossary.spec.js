import { test, expect } from '@playwright/test';

test.describe('Glossary panel integration', () => {
  test('UX-03: glossary panel opens from toolbar button', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Dismiss onboarding if present
    const skipButton = page.getByRole('button', { name: /Skip tour/i });
    if (await skipButton.isVisible()) {
      await skipButton.click();
    }

    // Click glossary button in toolbar
    await page.getByRole('button', { name: /glossary/i }).click();

    // Verify panel opens
    await expect(page.getByText('Jargon Glossary')).toBeVisible();
  });
});

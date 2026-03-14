import { test, expect } from '@playwright/test';

test.describe('Privacy banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
    // Clear privacy banner dismissal
    await page.evaluate(() => localStorage.removeItem('th3rdai_privacy_banner_dismissed'));
    await page.reload();
  });

  test('UX-04: privacy banner visible on first launch', async ({ page }) => {
    // Dismiss onboarding first
    const skipButton = page.getByRole('button', { name: /Skip tour/i });
    if (await skipButton.isVisible()) {
      await skipButton.click();
    }

    // Verify banner visible
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByText(/Your code and conversations stay on your machine/i)).toBeVisible();
  });

  test('UX-04: privacy banner dismisses and persists dismissal', async ({ page }) => {
    // Dismiss onboarding
    const skipButton = page.getByRole('button', { name: /Skip tour/i });
    if (await skipButton.isVisible()) {
      await skipButton.click();
    }

    // Click "Got it" to dismiss banner
    await page.getByRole('button', { name: /Got it/i }).click();

    // Verify banner hidden
    await expect(page.getByRole('status')).not.toBeVisible();

    // Reload and verify banner does not reappear
    await page.reload();
    await expect(page.getByRole('status')).not.toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Privacy banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear privacy banner dismissal, ensure onboarding is complete
    await page.evaluate(() => {
      localStorage.removeItem('th3rdai_privacy_banner_dismissed');
      localStorage.setItem('th3rdai_onboarding_complete', 'true');
    });
    await page.reload();
  });

  test('UX-04: privacy banner visible on first launch', async ({ page }) => {
    // Verify banner visible
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByText(/Your code and conversations stay on your machine/i)).toBeVisible();
  });

  test('UX-04: privacy banner dismisses and persists dismissal', async ({ page }) => {
    // Click "Got it" to dismiss banner (aria-label is "Dismiss privacy banner")
    await page.getByRole('button', { name: /Dismiss privacy banner/i }).click();

    // Verify banner hidden
    await expect(page.getByRole('status')).not.toBeVisible();

    // Reload and verify banner does not reappear
    await page.reload();
    await expect(page.getByRole('status')).not.toBeVisible();
  });
});

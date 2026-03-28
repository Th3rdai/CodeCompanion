import { test, expect } from '@playwright/test';
import browserAppReady from '../helpers/app-ready.js';

async function reloadAndWaitForModels(page) {
  const modelsPromise = page.waitForResponse(
    (r) => r.url().includes('/api/models'),
    { timeout: 30_000 }
  );
  await page.reload();
  await modelsPromise;
  await page.waitForSelector('#model-select', { state: 'visible', timeout: 30_000 });
}

test.describe('Privacy banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(browserAppReady);
    await page.goto('/');
    // Clear privacy banner dismissal, ensure onboarding is complete
    await page.evaluate(() => {
      localStorage.removeItem('th3rdai_privacy_banner_dismissed');
      localStorage.setItem('th3rdai_onboarding_complete', 'true');
    });
    await reloadAndWaitForModels(page);
  });

  test('UX-04: privacy banner visible on first launch', async ({ page }) => {
    await expect(page.getByTestId('privacy-banner-dismiss')).toBeVisible();
    await expect(page.getByText(/Your code and conversations stay on your machine/i)).toBeVisible();
  });

  test('UX-04: privacy banner dismisses and persists dismissal', async ({ page }) => {
    const dismiss = page.getByTestId('privacy-banner-dismiss');
    await expect(dismiss).toBeVisible({ timeout: 15_000 });
    await expect(dismiss).toBeEnabled();
    await dismiss.scrollIntoViewIfNeeded();
    await dismiss.click();

    await expect(page.getByTestId('privacy-banner-dismiss')).not.toBeVisible();

    // Reload and verify banner does not reappear
    await reloadAndWaitForModels(page);
    await expect(page.getByTestId('privacy-banner-dismiss')).not.toBeVisible();
  });
});

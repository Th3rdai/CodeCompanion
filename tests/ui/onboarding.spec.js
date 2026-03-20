import { test, expect } from '@playwright/test';

test.describe('Onboarding first launch', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to simulate first launch
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('th3rdai_onboarding_complete'));
    await page.reload();
  });

  test('UX-01: displays onboarding wizard on first launch', async ({ page }) => {
    // Verify wizard visible
    await expect(page.getByRole('dialog', { name: 'Welcome wizard' })).toBeVisible();
    await expect(page.getByText('Welcome to Code Companion')).toBeVisible();

    // Verify first step content matches vibe-coder tone
    await expect(page.getByText(/AI coding tool/i)).toBeVisible();
    await expect(page.getByText(/Product Managers/i)).not.toBeVisible(); // Should NOT appear
  });

  test('UX-01: wizard persists completion to localStorage', async ({ page }) => {
    // Complete wizard
    await page.getByRole('button', { name: /Next/i }).click(); // Step 2 — Ollama
    await page.getByRole('button', { name: /Next/i }).click(); // Step 3 — Modes
    await page.getByRole('button', { name: /Next/i }).click(); // Step 4 — Images
    await page.getByRole('button', { name: /Next/i }).click(); // Step 5 — Privacy
    await page.getByRole('button', { name: /Let's Go!/i }).click(); // Finish

    // Verify wizard closed
    await expect(page.getByRole('dialog', { name: 'Welcome wizard' })).not.toBeVisible();

    // Reload and verify wizard does not reappear
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Welcome wizard' })).not.toBeVisible();
  });
});

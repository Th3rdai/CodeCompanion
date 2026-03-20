import { test, expect } from '@playwright/test';

test.describe('OnboardingWizard component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('th3rdai_onboarding_complete'));
    await page.reload();
  });

  test('UX-01: displays 5 steps with correct vibe-coder content', async ({ page }) => {
    // Step 1: Welcome
    await expect(page.getByText('Welcome to Code Companion')).toBeVisible();
    await expect(page.getByText(/AI coding tool/i)).toBeVisible();

    // Navigate to Step 2: Ollama
    await page.getByRole('button', { name: /Next/i }).click();
    await expect(page.getByText('Connect to Ollama')).toBeVisible();
    await expect(page.getByText(/Troubleshooting/i)).toBeVisible();

    // Navigate to Step 3: Modes
    await page.getByRole('button', { name: /Next/i }).click();
    await expect(page.getByText('Pick Your Mode')).toBeVisible();
    // Verify Lucide icons rendered (not emoji) — 8 SVG icons in the mode grid
    const modeGrid = page.locator('.grid');
    await expect(modeGrid.locator('svg')).toHaveCount(8);

    // Navigate to Step 4: Images
    await page.getByRole('button', { name: /Next/i }).click();
    await expect(page.getByText('Upload Images')).toBeVisible();

    // Navigate to Step 5: Privacy
    await page.getByRole('button', { name: /Next/i }).click();
    await expect(page.getByText('Your Data Stays Here')).toBeVisible();
  });

  test('UX-01: keyboard navigation works (arrow keys, Enter, Escape)', async ({ page }) => {
    // Verify wizard is showing
    await expect(page.getByRole('dialog', { name: 'Welcome wizard' })).toBeVisible();

    // Focus wizard
    await page.getByRole('dialog', { name: 'Welcome wizard' }).focus();

    // ArrowRight advances step
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Connect to Ollama')).toBeVisible();

    // ArrowLeft goes back
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('Welcome to Code Companion')).toBeVisible();

    // Escape closes wizard
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Welcome wizard' })).not.toBeVisible();
  });
});

import { test, expect } from '@playwright/experimental-ct-react';
import OnboardingWizard from '../../src/components/OnboardingWizard';

test.describe('OnboardingWizard component', () => {
  test('UX-01: displays 4 steps with correct vibe-coder content', async ({ mount }) => {
    const component = await mount(<OnboardingWizard onComplete={() => {}} />);

    // Step 1: Welcome
    await expect(component.getByText('Welcome to Code Companion')).toBeVisible();
    await expect(component.getByText(/AI coding tool/i)).toBeVisible();

    // Navigate to Step 2: Ollama
    await component.getByRole('button', { name: /Next/i }).click();
    await expect(component.getByText('Connect to Ollama')).toBeVisible();
    await expect(component.getByText(/Troubleshooting/i)).toBeVisible(); // New troubleshooting section

    // Navigate to Step 3: Modes
    await component.getByRole('button', { name: /Next/i }).click();
    await expect(component.getByText('Pick Your Mode')).toBeVisible();
    // Verify Lucide icons rendered (not emoji)
    const modeGrid = component.locator('.grid');
    await expect(modeGrid.locator('svg')).toHaveCount(8); // 8 Lucide SVG icons

    // Navigate to Step 4: Privacy
    await component.getByRole('button', { name: /Next/i }).click();
    await expect(component.getByText('Your Data Stays Here')).toBeVisible();
  });

  test('UX-01: keyboard navigation works (arrow keys, Enter, Escape)', async ({ mount, page }) => {
    const completed = [];
    await mount(<OnboardingWizard onComplete={() => completed.push(true)} />);

    // Focus wizard
    await page.keyboard.press('Tab');

    // ArrowRight advances step
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText('Connect to Ollama')).toBeVisible();

    // ArrowLeft goes back
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('Welcome to Code Companion')).toBeVisible();

    // Escape closes wizard
    await page.keyboard.press('Escape');
    expect(completed).toHaveLength(1);
  });
});

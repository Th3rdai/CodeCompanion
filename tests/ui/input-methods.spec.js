import { test, expect } from '@playwright/test';
import browserAppReady from '../helpers/app-ready.js';

test.describe('ReviewPanel Input Methods', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(browserAppReady);
    await page.goto('/');
    await page.reload();
    // Navigate to Review mode
    await page.getByTestId('mode-tab-review').click();
  });

  test('should render three input method tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /paste code/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /upload file/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /browse files/i })).toBeVisible();
  });

  test('should display code textarea in Paste tab', async ({ page }) => {
    // Paste tab should be selected by default
    await expect(page.getByPlaceholder('Paste your code here...')).toBeVisible();
    await expect(page.getByPlaceholder(/server\.js/i)).toBeVisible();
  });

  test('should display file upload zone in Upload tab', async ({ page }) => {
    await page.getByRole('tab', { name: /upload file/i }).click();
    await expect(page.getByText(/drag and drop a file/i)).toBeVisible();
    await expect(page.getByText(/choose file/i)).toBeVisible();
  });

  test('should display file browser trigger in Browse tab', async ({ page }) => {
    await page.getByRole('tab', { name: /browse files/i }).click();
    await expect(page.getByText(/browse files from your project folder/i)).toBeVisible();
    await expect(page.getByText(/open file browser/i)).toBeVisible();
  });

  test('should support keyboard navigation between tabs', async ({ page }) => {
    await page.getByRole('tab', { name: /paste code/i }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /upload file/i })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /browse files/i })).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: /upload file/i })).toBeFocused();
  });

  test('should render tab icons correctly', async ({ page }) => {
    const pasteTab = page.getByRole('tab', { name: /paste code/i });
    const uploadTab = page.getByRole('tab', { name: /upload file/i });
    const browseTab = page.getByRole('tab', { name: /browse files/i });
    await expect(pasteTab.locator('svg')).toBeVisible();
    await expect(uploadTab.locator('svg')).toBeVisible();
    await expect(browseTab.locator('svg')).toBeVisible();
  });
});

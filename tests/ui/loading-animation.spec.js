/**
 * Component tests for LoadingAnimation
 * Tests bouncing animation, rotating messages, accessibility, and filename display
 */

import { test, expect } from '@playwright/test';

test.describe('LoadingAnimation Component', () => {
  test('displays bouncing dots animation', async ({ page }) => {
    await page.goto('/');

    // Navigate to Review mode
    await page.click('button:has-text("Review")');

    // Submit code to trigger loading state
    await page.fill('#review-code', 'function test() { return true; }');
    await page.click('button:has-text("Run Code Review")');

    // Check for bouncing dots (3 animated elements)
    const bouncingDots = await page.locator('.animate-bounce').count();
    expect(bouncingDots).toBe(3);
  });

  test('displays rotating encouraging messages', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Review")');

    // Submit code to trigger loading state
    await page.fill('#review-code', 'function test() { return true; }');
    await page.click('button:has-text("Run Code Review")');

    // Wait for loading state
    await page.waitForSelector('section[aria-label="Review in progress"]');

    // Check that at least one encouraging message is displayed
    const messageText = await page.locator('section[aria-label="Review in progress"] p.text-slate-400').first().textContent();

    // Message should be one of the encouraging phrases
    const encouragingPhrases = [
      'Looking for ways to make your code even better!',
      'Checking for any gotchas...',
      'Making sure everything\'s ship-shape!',
      'Scanning for those sneaky edge cases...'
    ];

    const containsEncouragingPhrase = encouragingPhrases.some(phrase =>
      messageText?.includes(phrase) || messageText?.includes('Analyzing')
    );
    expect(containsEncouragingPhrase).toBeTruthy();
  });

  test('has aria-live region for screen reader accessibility', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Review")');

    // Submit code to trigger loading state
    await page.fill('#review-code', 'function test() { return true; }');
    await page.click('button:has-text("Run Code Review")');

    // Check for aria-live region
    const ariaLiveRegion = await page.locator('[aria-live="polite"]').count();
    expect(ariaLiveRegion).toBeGreaterThan(0);
  });

  test('displays filename when provided', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Review")');

    // Fill in filename and code
    await page.fill('#review-filename', 'test.js');
    await page.fill('#review-code', 'function test() { return true; }');
    await page.click('button:has-text("Run Code Review")');

    // Check that filename is displayed during loading
    await page.waitForSelector('section[aria-label="Review in progress"]');
    const content = await page.locator('section[aria-label="Review in progress"]').textContent();
    expect(content).toContain('test.js');
  });
});

import { test, expect } from '@playwright/experimental-ct-react';
import { GlossaryPanel } from '../../src/components/JargonGlossary';

test.describe('JargonGlossary component', () => {
  test('UX-03: displays all terms with search and category filtering', async ({ mount }) => {
    const component = await mount(<GlossaryPanel onClose={() => {}} />);

    // Verify glossary header
    await expect(component.getByText('Jargon Glossary')).toBeVisible();

    // Verify search input exists
    const searchInput = component.getByPlaceholder(/Search terms/i);
    await expect(searchInput).toBeVisible();

    // Test search filtering
    await searchInput.fill('api');
    await expect(component.getByText('API')).toBeVisible();
    await expect(component.getByText(/waiter taking your order/i)).toBeVisible(); // API definition with analogy
  });

  test('UX-03: category filtering works', async ({ mount }) => {
    const component = await mount(<GlossaryPanel onClose={() => {}} />);

    // Click Security category
    await component.getByRole('button', { name: 'Security' }).click();

    // Verify only Security terms visible
    await expect(component.getByText('SQL Injection')).toBeVisible();
    await expect(component.getByText('Authentication')).toBeVisible();

    // Non-Security terms should not be visible
    await expect(component.getByText('Component')).not.toBeVisible(); // Frontend category
  });
});

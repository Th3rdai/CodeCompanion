import { test, expect } from '@playwright/experimental-ct-react';
import ReviewPanel from '../../src/components/ReviewPanel.jsx';

test.describe('ReviewPanel Input Methods', () => {
  test('should render three input method tabs', async ({ mount }) => {
    const component = await mount(
      <ReviewPanel
        selectedModel="llama3:13b"
        connected={true}
        streaming={false}
        onAttachFromBrowser={{ current: () => {} }}
        onToast={() => {}}
        onSwitchToChat={() => {}}
        onSaveReview={() => {}}
      />
    );

    // Verify all three tabs exist
    await expect(component.getByRole('tab', { name: /paste code/i })).toBeVisible();
    await expect(component.getByRole('tab', { name: /upload file/i })).toBeVisible();
    await expect(component.getByRole('tab', { name: /browse files/i })).toBeVisible();
  });

  test('should display code textarea in Paste tab', async ({ mount }) => {
    const component = await mount(
      <ReviewPanel
        selectedModel="llama3:13b"
        connected={true}
        streaming={false}
        onAttachFromBrowser={{ current: () => {} }}
        onToast={() => {}}
        onSwitchToChat={() => {}}
        onSaveReview={() => {}}
      />
    );

    // Paste tab should be selected by default
    await expect(component.getByPlaceholder(/paste your code here/i)).toBeVisible();
    await expect(component.getByPlaceholder(/filename/i)).toBeVisible();
  });

  test('should display file upload zone in Upload tab', async ({ mount }) => {
    const component = await mount(
      <ReviewPanel
        selectedModel="llama3:13b"
        connected={true}
        streaming={false}
        onAttachFromBrowser={{ current: () => {} }}
        onToast={() => {}}
        onSwitchToChat={() => {}}
        onSaveReview={() => {}}
      />
    );

    // Click Upload tab
    await component.getByRole('tab', { name: /upload file/i }).click();

    // Verify upload zone is visible
    await expect(component.getByText(/drag and drop a file/i)).toBeVisible();
    await expect(component.getByText(/choose file/i)).toBeVisible();
  });

  test('should display file browser trigger in Browse tab', async ({ mount }) => {
    const component = await mount(
      <ReviewPanel
        selectedModel="llama3:13b"
        connected={true}
        streaming={false}
        onAttachFromBrowser={{ current: () => {} }}
        onToast={() => {}}
        onSwitchToChat={() => {}}
        onSaveReview={() => {}}
      />
    );

    // Click Browse tab
    await component.getByRole('tab', { name: /browse files/i }).click();

    // Verify browser trigger is visible
    await expect(component.getByText(/browse files from your project folder/i)).toBeVisible();
    await expect(component.getByText(/open file browser/i)).toBeVisible();
  });

  test('should support keyboard navigation between tabs', async ({ mount, page }) => {
    const component = await mount(
      <ReviewPanel
        selectedModel="llama3:13b"
        connected={true}
        streaming={false}
        onAttachFromBrowser={{ current: () => {} }}
        onToast={() => {}}
        onSwitchToChat={() => {}}
        onSaveReview={() => {}}
      />
    );

    // Focus first tab
    await component.getByRole('tab', { name: /paste code/i }).focus();

    // Press Right arrow to move to Upload tab
    await page.keyboard.press('ArrowRight');
    await expect(component.getByRole('tab', { name: /upload file/i })).toBeFocused();

    // Press Right arrow to move to Browse tab
    await page.keyboard.press('ArrowRight');
    await expect(component.getByRole('tab', { name: /browse files/i })).toBeFocused();

    // Press Left arrow to move back to Upload tab
    await page.keyboard.press('ArrowLeft');
    await expect(component.getByRole('tab', { name: /upload file/i })).toBeFocused();
  });

  test('should render tab icons correctly', async ({ mount }) => {
    const component = await mount(
      <ReviewPanel
        selectedModel="llama3:13b"
        connected={true}
        streaming={false}
        onAttachFromBrowser={{ current: () => {} }}
        onToast={() => {}}
        onSwitchToChat={() => {}}
        onSaveReview={() => {}}
      />
    );

    // Check for Lucide React icons (FileText, Upload, FolderOpen)
    // Icons are rendered as SVG elements with specific classes
    const pasteTab = component.getByRole('tab', { name: /paste code/i });
    const uploadTab = component.getByRole('tab', { name: /upload file/i });
    const browseTab = component.getByRole('tab', { name: /browse files/i });

    await expect(pasteTab.locator('svg')).toBeVisible();
    await expect(uploadTab.locator('svg')).toBeVisible();
    await expect(browseTab.locator('svg')).toBeVisible();
  });
});

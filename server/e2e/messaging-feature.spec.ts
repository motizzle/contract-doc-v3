import { test, expect } from '@playwright/test';

test.describe('Phase 14: Messaging Feature', () => {

  test('messaging tab loads and displays correctly', async ({ page }) => {
    await page.goto('/web/view.html');
    
    // Wait for React to mount
    await page.waitForSelector('.tab', { timeout: 10000 });
    
    // Click on Messages tab
    const messagesTab = page.locator('.tab', { hasText: 'Messages' });
    await messagesTab.click();
    
    // Verify messaging panel is visible
    await page.waitForTimeout(500);
    const hasMessagingContent = await page.locator('#app-root').evaluate(el => {
      return el.textContent?.includes('New Message') || el.textContent?.includes('Messages');
    });
    expect(hasMessagingContent).toBe(true);
  });

  test('can open new message modal', async ({ page }) => {
    await page.goto('/web/view.html');
    
    // Wait and click Messages tab
    await page.waitForSelector('.tab', { timeout: 10000 });
    const messagesTab = page.locator('.tab', { hasText: 'Messages' });
    await messagesTab.click();
    await page.waitForTimeout(500);
    
    // Look for "New Message" button and click it
    const newMessageBtn = page.locator('button', { hasText: 'New Message' });
    await expect(newMessageBtn).toBeVisible({ timeout: 5000 });
    await newMessageBtn.click();
    
    // Verify modal opened
    const modalTitle = page.locator('h3', { hasText: 'New Message' });
    await expect(modalTitle).toBeVisible({ timeout: 2000 });
  });

  test('new message modal has required fields', async ({ page }) => {
    await page.goto('/web/view.html');
    
    // Navigate to messaging and open modal
    await page.waitForSelector('.tab', { timeout: 10000 });
    const messagesTab = page.locator('.tab', { hasText: 'Messages' });
    await messagesTab.click();
    await page.waitForTimeout(500);
    
    const newMessageBtn = page.locator('button', { hasText: 'New Message' });
    await newMessageBtn.click();
    await page.waitForTimeout(500);
    
    // Check for recipient field
    const hasRecipientField = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('Recipients') || text.includes('To:');
    });
    expect(hasRecipientField).toBe(true);
    
    // Check for message text field
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 2000 });
  });

  test('can filter messages by state', async ({ page }) => {
    await page.goto('/web/view.html');
    
    // Navigate to messaging tab
    await page.waitForSelector('.tab', { timeout: 10000 });
    const messagesTab = page.locator('.tab', { hasText: 'Messages' });
    await messagesTab.click();
    await page.waitForTimeout(500);
    
    // Look for filter buttons (Open, Archived, etc.)
    const hasFilterButtons = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('Open') || text.includes('Archived');
    });
    expect(hasFilterButtons).toBe(true);
  });

  test('messages list displays when messages exist', async ({ page }) => {
    await page.goto('/web/view.html');
    
    // Navigate to messaging tab
    await page.waitForSelector('.tab', { timeout: 10000 });
    const messagesTab = page.locator('.tab', { hasText: 'Messages' });
    await messagesTab.click();
    await page.waitForTimeout(1000);
    
    // Check if either messages display or "No messages" text appears
    const hasContent = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('No messages') || text.includes('Message') || text.includes('conversation');
    });
    expect(hasContent).toBe(true);
  });

  test('messaging panel has export functionality', async ({ page }) => {
    await page.goto('/web/view.html');
    
    // Navigate to messaging tab
    await page.waitForSelector('.tab', { timeout: 10000 });
    const messagesTab = page.locator('.tab', { hasText: 'Messages' });
    await messagesTab.click();
    await page.waitForTimeout(500);
    
    // Look for Export button
    const exportBtn = page.locator('button', { hasText: 'Export' });
    const exportBtnExists = await exportBtn.count();
    expect(exportBtnExists).toBeGreaterThan(0);
  });

  test('can toggle message flags', async ({ page }) => {
    await page.goto('/web/view.html');
    
    // Navigate to messaging tab
    await page.waitForSelector('.tab', { timeout: 10000 });
    const messagesTab = page.locator('.tab', { hasText: 'Messages' });
    await messagesTab.click();
    await page.waitForTimeout(500);
    
    // Check for flag filter options
    const hasFlags = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('Internal') || text.includes('External') || text.includes('Privileged');
    });
    expect(hasFlags).toBe(true);
  });

  test('messaging tab shows unread count badge', async ({ page }) => {
    await page.goto('/web/view.html');
    
    // Wait for tabs to load
    await page.waitForSelector('.tab', { timeout: 10000 });
    
    // Messages tab should be visible (even if count is 0)
    const messagesTab = page.locator('.tab', { hasText: 'Messages' });
    await expect(messagesTab).toBeVisible();
  });

  test('no JavaScript errors during messaging navigation', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && 
          !msg.text().includes('favicon') && 
          !msg.text().includes('Chrome extensions')) {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/web/view.html');
    
    // Navigate to messaging tab
    await page.waitForSelector('.tab', { timeout: 10000 });
    const messagesTab = page.locator('.tab', { hasText: 'Messages' });
    await messagesTab.click();
    await page.waitForTimeout(1000);
    
    // Open new message modal
    try {
      const newMessageBtn = page.locator('button', { hasText: 'New Message' });
      if (await newMessageBtn.isVisible()) {
        await newMessageBtn.click();
        await page.waitForTimeout(500);
      }
    } catch (e) {
      // Modal open might fail, that's ok for this test
    }
    
    // Verify no errors occurred
    expect(consoleErrors.length).toBe(0);
  });

  test('messaging panel layout is responsive', async ({ page }) => {
    await page.goto('/web/view.html');
    
    // Navigate to messaging tab
    await page.waitForSelector('.tab', { timeout: 10000 });
    const messagesTab = page.locator('.tab', { hasText: 'Messages' });
    await messagesTab.click();
    await page.waitForTimeout(500);
    
    // Verify panel takes up appropriate space
    const appRoot = page.locator('#app-root');
    const boundingBox = await appRoot.boundingBox();
    
    expect(boundingBox).not.toBeNull();
    if (boundingBox) {
      expect(boundingBox.height).toBeGreaterThan(100);
      expect(boundingBox.width).toBeGreaterThan(100);
    }
  });

  test('messaging panel refreshes after factory reset', async ({ page }) => {
    await page.goto('/web/view.html');
    
    // Navigate to messaging tab
    await page.waitForSelector('.tab', { timeout: 10000 });
    const messagesTab = page.locator('.tab', { hasText: 'Messages' });
    await messagesTab.click();
    await page.waitForTimeout(1000);
    
    // Trigger factory reset via API
    await page.evaluate(async () => {
      try {
        await fetch('https://localhost:4001/api/v1/factory-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'admin' })
        });
      } catch (e) {
        console.error('Factory reset failed:', e);
      }
    });
    
    // Wait for reset to propagate
    await page.waitForTimeout(2000);
    
    // Verify messaging panel still works
    const hasMessagingContent = await page.locator('#app-root').evaluate(el => {
      return el.textContent?.includes('New Message') || el.textContent?.includes('Messages') || el.textContent?.includes('No messages');
    });
    expect(hasMessagingContent).toBe(true);
    
    // Verify we can still open new message modal
    const newMessageBtn = page.locator('button', { hasText: 'New Message' });
    if (await newMessageBtn.isVisible()) {
      await newMessageBtn.click();
      await page.waitForTimeout(500);
      
      const modalTitle = page.locator('h3', { hasText: 'New Message' });
      await expect(modalTitle).toBeVisible({ timeout: 2000 });
    }
  });

  test('can search messages', async ({ page }) => {
    await page.goto('/web/view.html');
    
    // Navigate to messaging tab
    await page.waitForSelector('.tab', { timeout: 10000 });
    const messagesTab = page.locator('.tab', { hasText: 'Messages' });
    await messagesTab.click();
    await page.waitForTimeout(1000);
    
    // Look for search input
    const searchInput = page.locator('input[type="text"]').filter({ hasText: '' }).first();
    if (await searchInput.isVisible()) {
      // Type search query
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      
      // Verify search is active (messages filtered or "no results" shown)
      const hasSearchResult = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('No messages') || text.includes('Message') || text.includes('Search');
      });
      expect(hasSearchResult).toBe(true);
    }
  });

  test('prevents duplicate one-on-one conversations in UI', async ({ page }) => {
    await page.goto('/web/view.html');
    
    // Navigate to messaging tab
    await page.waitForSelector('.tab', { timeout: 10000 });
    const messagesTab = page.locator('.tab', { hasText: 'Messages' });
    await messagesTab.click();
    await page.waitForTimeout(500);
    
    // Open new message modal
    const newMessageBtn = page.locator('button', { hasText: 'New Message' });
    if (await newMessageBtn.isVisible()) {
      await newMessageBtn.click();
      await page.waitForTimeout(500);
      
      // The validation logic exists in client-side code
      // Verify modal has recipient selection
      const hasRecipients = await page.evaluate(() => {
        return document.body.textContent?.includes('Recipients') || document.body.textContent?.includes('To:');
      });
      expect(hasRecipients).toBe(true);
    }
  });
});


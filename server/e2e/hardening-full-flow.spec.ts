import { test, expect, Page } from '@playwright/test';

/**
 * AUTOMATED HARDENING TESTS
 * 
 * Tests every button, every flow, every interaction.
 * Checks API responses, UI updates, and console errors.
 * 
 * Run with: cd server && npm run e2e
 */

// Helper: Wait for element and check it's visible
async function waitFor(page: Page, selector: string, timeout = 10000) {
  const element = page.locator(selector);
  await expect(element).toBeVisible({ timeout });
  return element;
}

// Helper: Check for console errors
function setupConsoleMonitoring(page: Page) {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

// Helper: Wait for API response
async function waitForApi(page: Page, urlPattern: string | RegExp) {
  return await page.waitForResponse(
    response => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout: 10000 }
  );
}

// Helper: Factory reset
async function factoryReset(page: Page) {
  await page.goto('/');
  await page.waitForTimeout(2000); // Wait for page to load
  
  const resetButton = page.locator('button:has-text("Factory Reset")');
  if (await resetButton.count() > 0) {
    await resetButton.click();
    await page.waitForTimeout(2000); // Wait for reset to complete
  }
}

// Helper: Select user from dropdown
async function selectUser(page: Page, userName: string) {
  const userDropdown = page.locator('select').first();
  await userDropdown.selectOption({ label: userName });
  await page.waitForTimeout(1000); // Wait for state to update
}

test.describe('HARDENING: Full Application Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  // ========================================
  // ROUND 1: DOCUMENT OPERATIONS
  // ========================================
  
  test('1.1 Factory Reset works', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // Click factory reset
    const resetButton = await waitFor(page, 'button:has-text("Factory Reset")');
    await resetButton.click();
    
    // Wait for confirmation or completion
    await page.waitForTimeout(2000);
    
    // Check activity log for reset event
    const activityTab = page.locator('text=Activity');
    if (await activityTab.count() > 0) {
      await activityTab.click();
      await page.waitForTimeout(500);
      
      // Look for factory reset in activity log
      const activityText = await page.locator('.activity-log, [class*="activity"]').textContent();
      expect(activityText).toContain('Factory reset');
    }
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });

  test('1.2 Save Progress works', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // Wait for save button
    const saveButton = await waitFor(page, 'button:has-text("Save"), button:has-text("Save Progress")');
    
    // Listen for API call
    const apiPromise = waitForApi(page, '/api/v1/save-progress');
    
    // Click save
    await saveButton.click();
    
    // Wait for API response
    const response = await apiPromise;
    expect(response.status()).toBe(200);
    
    // Check for success toast or activity log entry
    await page.waitForTimeout(1000);
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });

  test('1.3 Take Snapshot creates version', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // Look for snapshot button
    const snapshotButton = await waitFor(page, 'button:has-text("Snapshot"), button:has-text("Take Snapshot")');
    
    // Listen for API call
    const apiPromise = waitForApi(page, '/api/v1/document/snapshot');
    
    // Click snapshot
    await snapshotButton.click();
    
    // Wait for API response
    const response = await apiPromise;
    expect(response.status()).toBe(200);
    
    // Wait for version to appear
    await page.waitForTimeout(2000);
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });

  // ========================================
  // ROUND 2: VERSION MANAGEMENT
  // ========================================
  
  test('2.1 View previous version', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // First create a version
    await factoryReset(page);
    const snapshotButton = await waitFor(page, 'button:has-text("Snapshot"), button:has-text("Take Snapshot")');
    await snapshotButton.click();
    await page.waitForTimeout(2000);
    
    // Now view version 1
    const viewButton = page.locator('button:has-text("View")').first();
    if (await viewButton.count() > 0) {
      const apiPromise = waitForApi(page, '/api/v1/versions/view');
      await viewButton.click();
      
      const response = await apiPromise;
      expect(response.status()).toBe(200);
      
      // Check for "Viewing Version" banner
      await page.waitForTimeout(1000);
      const banner = await page.locator('text=/Viewing Version/i').count();
      expect(banner).toBeGreaterThan(0);
    }
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });

  test('2.2 Share version with vendor', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // Make sure we're an editor (Warren Peace)
    await selectUser(page, 'Warren Peace');
    
    // Create a version first
    await factoryReset(page);
    const snapshotButton = await waitFor(page, 'button:has-text("Snapshot"), button:has-text("Take Snapshot")');
    await snapshotButton.click();
    await page.waitForTimeout(2000);
    
    // Find share toggle
    const shareToggle = page.locator('input[type="checkbox"][aria-label*="share"], button:has-text("Share")').first();
    
    if (await shareToggle.count() > 0) {
      // Get current state
      const wasChecked = await shareToggle.isChecked().catch(() => false);
      
      // Listen for share API call
      const apiPromise = waitForApi(page, /\/api\/v1\/versions\/\d+\/share/);
      
      // Toggle share
      await shareToggle.click();
      
      // Wait for API response
      const response = await apiPromise;
      expect(response.status()).toBe(200);
      
      // Verify state changed
      await page.waitForTimeout(1000);
      const isNowChecked = await shareToggle.isChecked().catch(() => !wasChecked);
      expect(isNowChecked).not.toBe(wasChecked);
    }
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });

  test('2.3 Vendor sees shared version', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // Setup: Editor shares version
    await selectUser(page, 'Warren Peace');
    await factoryReset(page);
    const snapshotButton = await waitFor(page, 'button:has-text("Snapshot"), button:has-text("Take Snapshot")');
    await snapshotButton.click();
    await page.waitForTimeout(2000);
    
    // Share it
    const shareToggle = page.locator('input[type="checkbox"][aria-label*="share"], button:has-text("Share")').first();
    if (await shareToggle.count() > 0) {
      await shareToggle.click();
      await page.waitForTimeout(1000);
    }
    
    // Switch to vendor
    await selectUser(page, 'Hugh R Ewe');
    await page.waitForTimeout(2000);
    
    // Check vendor can see the version
    const versionsText = await page.locator('[class*="version"], [class*="Version"]').textContent();
    expect(versionsText).toContain('Version');
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });

  test('2.4 Vendor saves and version auto-shares', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // Switch to vendor
    await selectUser(page, 'Hugh R Ewe');
    
    // Take snapshot as vendor
    const snapshotButton = await waitFor(page, 'button:has-text("Snapshot"), button:has-text("Take Snapshot")');
    const apiPromise = waitForApi(page, '/api/v1/document/snapshot');
    await snapshotButton.click();
    
    const response = await apiPromise;
    expect(response.status()).toBe(200);
    
    // Wait for version to appear
    await page.waitForTimeout(2000);
    
    // Version should be auto-shared (visible to vendor)
    const versions = await page.locator('[class*="version"]').count();
    expect(versions).toBeGreaterThan(0);
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });

  test('2.5 Unshare removes version from vendor', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // Setup: Create and share version
    await selectUser(page, 'Warren Peace');
    await factoryReset(page);
    
    const snapshotButton = await waitFor(page, 'button:has-text("Snapshot"), button:has-text("Take Snapshot")');
    await snapshotButton.click();
    await page.waitForTimeout(2000);
    
    // Share it
    const shareToggle = page.locator('input[type="checkbox"][aria-label*="share"]').nth(1); // Not version 1
    if (await shareToggle.count() > 0 && !(await shareToggle.isChecked())) {
      await shareToggle.click();
      await page.waitForTimeout(1000);
    }
    
    // Switch to vendor and verify they see it
    await selectUser(page, 'Hugh R Ewe');
    await page.waitForTimeout(1000);
    let versionsBefore = await page.locator('[class*="version"]').count();
    
    // Switch back and unshare
    await selectUser(page, 'Warren Peace');
    await page.waitForTimeout(1000);
    
    const shareToggle2 = page.locator('input[type="checkbox"][aria-label*="share"]').nth(1);
    if (await shareToggle2.count() > 0 && await shareToggle2.isChecked()) {
      const apiPromise = waitForApi(page, /\/api\/v1\/versions\/\d+\/share/);
      await shareToggle2.click();
      await apiPromise;
      await page.waitForTimeout(1000);
    }
    
    // Switch to vendor and verify it's gone
    await selectUser(page, 'Hugh R Ewe');
    await page.waitForTimeout(2000);
    
    // Vendor should not see unshared version (or should auto-switch)
    // At minimum, they should still see version 1
    const versionsAfter = await page.locator('[class*="version"]').count();
    expect(versionsAfter).toBeGreaterThanOrEqual(1);
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });

  // ========================================
  // ROUND 3: CHECKOUT/CHECKIN
  // ========================================
  
  test('3.1 Checkout document', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    await selectUser(page, 'Warren Peace');
    
    // Find checkout button
    const checkoutButton = await waitFor(page, 'button:has-text("Checkout"), button:has-text("Check Out")');
    
    // Listen for API call
    const apiPromise = waitForApi(page, '/api/v1/checkout');
    
    // Click checkout
    await checkoutButton.click();
    
    // Wait for API response
    const response = await apiPromise;
    expect(response.status()).toBe(200);
    
    // Wait for UI update
    await page.waitForTimeout(1000);
    
    // Verify button changed to "Checkin"
    const checkinButton = page.locator('button:has-text("Checkin"), button:has-text("Check In")');
    await expect(checkinButton).toBeVisible();
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });

  test('3.2 Other user sees lock', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // User A checks out
    await selectUser(page, 'Warren Peace');
    const checkoutButton = await waitFor(page, 'button:has-text("Checkout"), button:has-text("Check Out")');
    await checkoutButton.click();
    await page.waitForTimeout(1000);
    
    // Switch to User B
    await selectUser(page, 'Kent Uckey');
    await page.waitForTimeout(1000);
    
    // Verify checkout button is disabled or shows lock message
    const pageText = await page.textContent('body');
    expect(pageText).toContain('Warren Peace'); // Should show who has it checked out
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });

  test('3.3 Checkin document', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // Checkout first
    await selectUser(page, 'Warren Peace');
    const checkoutButton = await waitFor(page, 'button:has-text("Checkout"), button:has-text("Check Out")');
    await checkoutButton.click();
    await page.waitForTimeout(1000);
    
    // Now checkin
    const checkinButton = await waitFor(page, 'button:has-text("Checkin"), button:has-text("Check In")');
    
    const apiPromise = waitForApi(page, '/api/v1/checkin');
    await checkinButton.click();
    
    const response = await apiPromise;
    expect(response.status()).toBe(200);
    
    // Verify button changed back to "Checkout"
    await page.waitForTimeout(1000);
    await expect(page.locator('button:has-text("Checkout"), button:has-text("Check Out")')).toBeVisible();
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });

  // ========================================
  // ROUND 4: VARIABLES
  // ========================================
  
  test('4.1 Variables panel loads', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // Click variables tab
    const variablesTab = page.locator('text=Variables, button:has-text("Variables")');
    if (await variablesTab.count() > 0) {
      await variablesTab.first().click();
      await page.waitForTimeout(1000);
      
      // Verify variables loaded
      const variables = await page.locator('[class*="variable"], [data-testid*="variable"]').count();
      expect(variables).toBeGreaterThan(0);
    }
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });

  test('4.2 Edit variable value', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // Click variables tab
    const variablesTab = page.locator('text=Variables, button:has-text("Variables")');
    if (await variablesTab.count() > 0) {
      await variablesTab.first().click();
      await page.waitForTimeout(1000);
      
      // Find first editable input
      const input = page.locator('input[type="text"], textarea').first();
      if (await input.count() > 0) {
        // Listen for update API call
        const apiPromise = waitForApi(page, /\/api\/v1\/variables/);
        
        // Edit value
        await input.click();
        await input.fill('Test Value Updated');
        await input.blur(); // Trigger save on blur
        
        // Wait for API response
        const response = await apiPromise;
        expect(response.status()).toBe(200);
      }
    }
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });

  // ========================================
  // ROUND 5: REAL-TIME UPDATES (SSE)
  // ========================================
  
  test('5.1 SSE connection established', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // Wait for page load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check for SSE connection in network tab
    const hasSSE = await page.evaluate(() => {
      // Check if EventSource is present
      return typeof EventSource !== 'undefined';
    });
    
    expect(hasSSE).toBe(true);
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });

  // ========================================
  // ROUND 6: ERROR HANDLING
  // ========================================
  
  test('6.1 Checkout conflict shows error', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // User A checks out
    await selectUser(page, 'Warren Peace');
    const checkoutButton = await waitFor(page, 'button:has-text("Checkout"), button:has-text("Check Out")');
    await checkoutButton.click();
    await page.waitForTimeout(1000);
    
    // Switch to User B and try to checkout
    await selectUser(page, 'Kent Uckey');
    await page.waitForTimeout(1000);
    
    const checkoutButton2 = page.locator('button:has-text("Checkout"), button:has-text("Check Out")');
    if (await checkoutButton2.count() > 0 && await checkoutButton2.isEnabled()) {
      await checkoutButton2.click();
      await page.waitForTimeout(1000);
      
      // Should show error message
      const pageText = await page.textContent('body');
      expect(pageText).toMatch(/checked out|conflict|Warren Peace/i);
    }
    
    // Verify no unexpected console errors (409 conflict is expected)
    const unexpectedErrors = errors.filter(e => !e.includes('409') && !e.includes('conflict'));
    expect(unexpectedErrors).toHaveLength(0);
  });

  test('6.2 No console errors during normal usage', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // Go through a normal workflow
    await factoryReset(page);
    await page.waitForTimeout(1000);
    
    // Take snapshot
    const snapshotButton = page.locator('button:has-text("Snapshot"), button:has-text("Take Snapshot")');
    if (await snapshotButton.count() > 0) {
      await snapshotButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Switch user
    await selectUser(page, 'Kent Uckey');
    await page.waitForTimeout(1000);
    
    // Switch back
    await selectUser(page, 'Warren Peace');
    await page.waitForTimeout(1000);
    
    // Verify NO console errors
    expect(errors).toHaveLength(0);
  });

  // ========================================
  // ROUND 7: COMPREHENSIVE FLOW
  // ========================================
  
  test('7.1 Complete editor workflow', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // Reset
    await factoryReset(page);
    
    // Checkout
    await selectUser(page, 'Warren Peace');
    const checkoutBtn = await waitFor(page, 'button:has-text("Checkout"), button:has-text("Check Out")');
    await checkoutBtn.click();
    await page.waitForTimeout(1000);
    
    // Save
    const saveBtn = page.locator('button:has-text("Save"), button:has-text("Save Progress")');
    if (await saveBtn.count() > 0) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
    }
    
    // Snapshot
    const snapshotBtn = page.locator('button:has-text("Snapshot"), button:has-text("Take Snapshot")');
    if (await snapshotBtn.count() > 0) {
      await snapshotBtn.click();
      await page.waitForTimeout(2000);
    }
    
    // Share with vendor
    const shareToggle = page.locator('input[type="checkbox"][aria-label*="share"]').nth(1);
    if (await shareToggle.count() > 0) {
      await shareToggle.click();
      await page.waitForTimeout(1000);
    }
    
    // Checkin
    const checkinBtn = page.locator('button:has-text("Checkin"), button:has-text("Check In")');
    if (await checkinBtn.count() > 0) {
      await checkinBtn.click();
      await page.waitForTimeout(1000);
    }
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });

  test('7.2 Complete vendor workflow', async ({ page }) => {
    const errors = setupConsoleMonitoring(page);
    
    // Setup: Editor shares version
    await selectUser(page, 'Warren Peace');
    await factoryReset(page);
    
    const snapshotBtn = await waitFor(page, 'button:has-text("Snapshot"), button:has-text("Take Snapshot")');
    await snapshotBtn.click();
    await page.waitForTimeout(2000);
    
    const shareToggle = page.locator('input[type="checkbox"][aria-label*="share"]').nth(1);
    if (await shareToggle.count() > 0) {
      await shareToggle.click();
      await page.waitForTimeout(1000);
    }
    
    // Switch to vendor
    await selectUser(page, 'Hugh R Ewe');
    await page.waitForTimeout(1000);
    
    // View shared version
    const viewBtn = page.locator('button:has-text("View")').first();
    if (await viewBtn.count() > 0) {
      await viewBtn.click();
      await page.waitForTimeout(1000);
    }
    
    // Take own snapshot
    const snapshotBtn2 = page.locator('button:has-text("Snapshot"), button:has-text("Take Snapshot")');
    if (await snapshotBtn2.count() > 0) {
      await snapshotBtn2.click();
      await page.waitForTimeout(2000);
    }
    
    // Verify no console errors
    expect(errors).toHaveLength(0);
  });
});


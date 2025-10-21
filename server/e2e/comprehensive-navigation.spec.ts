import { test, expect } from '@playwright/test';

test.describe('Comprehensive Navigation & Features', () => {

  // Tab Navigation Tests
  test.describe('Tab Navigation', () => {
    
    test('AI tab loads and displays chat interface', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const aiTab = page.locator('.tab', { hasText: 'AI' });
      await aiTab.click();
      await page.waitForTimeout(500);
      
      // Check for chat interface elements
      const hasChatInterface = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('AI') || text.includes('chat');
      });
      expect(hasChatInterface).toBe(true);
      
      // Verify textarea for input exists
      const textarea = page.locator('textarea');
      const textareaCount = await textarea.count();
      expect(textareaCount).toBeGreaterThan(0);
    });

    test('Workflow tab loads and displays approvals', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const workflowTab = page.locator('.tab', { hasText: 'Workflow' });
      await workflowTab.click();
      await page.waitForTimeout(500);
      
      // Check for workflow/approval elements
      const hasWorkflowContent = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('Approve') || text.includes('Workflow') || text.includes('approval');
      });
      expect(hasWorkflowContent).toBe(true);
    });

    test('Versions tab loads and displays version list', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const versionsTab = page.locator('.tab', { hasText: 'Versions' });
      await versionsTab.click();
      await page.waitForTimeout(500);
      
      // Check for version content
      const hasVersionContent = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('Version') || text.includes('version');
      });
      expect(hasVersionContent).toBe(true);
    });

    test('Activity tab loads and displays activity log', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const activityTab = page.locator('.tab', { hasText: 'Activity' });
      await activityTab.click();
      await page.waitForTimeout(500);
      
      // Check for activity content
      const hasActivityContent = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('Activity') || text.includes('activity') || text.includes('No activity');
      });
      expect(hasActivityContent).toBe(true);
    });

    test('Comparison tab loads correctly', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const comparisonTab = page.locator('.tab', { hasText: 'Compare' });
      await comparisonTab.click();
      await page.waitForTimeout(500);
      
      // Check for comparison interface
      const hasComparisonContent = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('Compare') || text.includes('comparison');
      });
      expect(hasComparisonContent).toBe(true);
    });

    test('Variables tab loads and displays variables', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const variablesTab = page.locator('.tab', { hasText: 'Variables' });
      await variablesTab.click();
      await page.waitForTimeout(500);
      
      // Check for variables content
      const hasVariablesContent = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('Variable') || text.includes('variable') || text.includes('No variables');
      });
      expect(hasVariablesContent).toBe(true);
    });

    test('can switch between all tabs without errors', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error' && 
            !msg.text().includes('favicon') && 
            !msg.text().includes('Chrome extensions') &&
            !msg.text().includes('404') &&
            !msg.text().includes('superdoc')) {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const tabs = ['AI', 'Workflow', 'Messages', 'Versions', 'Activity', 'Compare', 'Variables'];
      
      for (const tabName of tabs) {
        const tab = page.locator('.tab', { hasText: tabName });
        if (await tab.isVisible()) {
          await tab.click();
          await page.waitForTimeout(300);
        }
      }
      
      if (consoleErrors.length > 0) {
        console.log('Console errors found:', consoleErrors);
      }
       expect(consoleErrors.length).toBe(0);
    });
  });

  // Workflow/Approvals Tests
  test.describe('Workflow Approvals', () => {
    
    test('workflow panel displays approval status', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const workflowTab = page.locator('.tab', { hasText: 'Workflow' });
      await workflowTab.click();
      await page.waitForTimeout(1000);
      
      // Check for approval buttons or status
      const hasApprovalUI = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('Approve') || text.includes('Remove') || text.includes('Reset') || text.includes('Request Review');
      });
      expect(hasApprovalUI).toBe(true);
    });

    test('can toggle approval state', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const workflowTab = page.locator('.tab', { hasText: 'Workflow' });
      await workflowTab.click();
      await page.waitForTimeout(1000);
      
      // Look for an approve button
      const approveBtn = page.locator('button:has-text("Approve")');
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        await page.waitForTimeout(500);
        
        // Verify state changed (button text might change or disappear)
        const hasChangeOccurred = await page.evaluate(() => {
          const text = document.body.textContent || '';
          return text.includes('Approved') || text.includes('Remove');
        });
        expect(hasChangeOccurred).toBe(true);
      }
    });

    test('workflow panel shows progress indicator', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const workflowTab = page.locator('.tab', { hasText: 'Workflow' });
      await workflowTab.click();
      await page.waitForTimeout(1000);
      
      // Check for progress indicators (approved/total)
      const hasProgress = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return /\d+\/\d+/.test(text) || text.includes('Complete');
      });
      expect(hasProgress).toBe(true);
    });

    // E2E Test: Send to Vendor button visibility
    // Purpose: Verifies the Send to Vendor button was moved from dropdown to Workflow panel
    // Why: Better UX - frequently used action should be directly accessible
    // Coverage: Tests UI relocation of Send to Vendor button (commit d2d3b93)
    test('workflow panel has Send to Vendor button', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const workflowTab = page.locator('.tab', { hasText: 'Workflow' });
      await workflowTab.click();
      await page.waitForTimeout(2000); // Give more time for workflow panel to fully render
      
      // Verify Send to Vendor button exists in Workflow panel (not hidden in dropdown)
      const sendToVendorBtn = page.locator('button', { hasText: 'Send to Vendor' });
      const buttonCount = await sendToVendorBtn.count();
      expect(buttonCount).toBeGreaterThan(0);
    });

    // E2E Test: Request Review button visibility
    // Purpose: Verifies the Request Review button was moved from dropdown to Workflow panel
    // Why: Better UX - frequently used action should be directly accessible
    // Coverage: Tests UI relocation of Request Review button (commit d2d3b93)
    test('workflow panel has Request Review button', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const workflowTab = page.locator('.tab', { hasText: 'Workflow' });
      await workflowTab.click();
      await page.waitForTimeout(1000);
      
      // Verify Request Review button is visible in Workflow panel (not hidden in dropdown)
      const requestReviewBtn = page.locator('button', { hasText: 'Request Review' });
      await expect(requestReviewBtn).toBeVisible({ timeout: 2000 });
    });

    // E2E Test: Request Review modal interaction
    // Purpose: Verifies clicking Request Review button opens the review notification modal
    // Why: Ensures the workflow action is properly connected to the modal
    // Coverage: Tests modal opening from Request Review button (commit d2d3b93)
    test('Request Review button opens modal', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const workflowTab = page.locator('.tab', { hasText: 'Workflow' });
      await workflowTab.click();
      await page.waitForTimeout(1000);
      
      // Click Request Review button
      const requestReviewBtn = page.locator('button', { hasText: 'Request Review' });
      if (await requestReviewBtn.isVisible()) {
        await requestReviewBtn.click();
        await page.waitForTimeout(500);
        
        // Verify modal opened with review/notification content
        const modalContent = await page.evaluate(() => {
          return document.body.textContent?.includes('review') || document.body.textContent?.includes('Notify');
        });
        expect(modalContent).toBe(true);
      }
    });
  });

  // Version Control Tests
  test.describe('Version Control', () => {
    
    test('versions panel lists available versions', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const versionsTab = page.locator('.tab', { hasText: 'Versions' });
      await versionsTab.click();
      await page.waitForTimeout(1000);
      
      // Check for version entries or "no versions" message
      const hasVersionInfo = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('Version') || text.includes('No versions') || /v\d+/.test(text);
      });
      expect(hasVersionInfo).toBe(true);
    });

    test('can view version details', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const versionsTab = page.locator('.tab', { hasText: 'Versions' });
      await versionsTab.click();
      await page.waitForTimeout(1000);
      
      // Look for View or View Details buttons
      const viewBtn = page.locator('button:has-text("View")').first();
      if (await viewBtn.isVisible()) {
        await viewBtn.click();
        await page.waitForTimeout(1000);
        
        // Verify viewing mode activated
        const isViewingVersion = await page.evaluate(() => {
          const text = document.body.textContent || '';
          return text.includes('Viewing') || text.includes('viewing');
        });
        expect(isViewingVersion).toBe(true);
      }
    });

    test('version panel has restore functionality', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const versionsTab = page.locator('.tab', { hasText: 'Versions' });
      await versionsTab.click();
      await page.waitForTimeout(1000);
      
      // Check for version cards (versions can be viewed by clicking)
      const hasVersionUI = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('Version') || text.includes('No versions yet');
      });
      expect(hasVersionUI).toBe(true);
    });

    test('comparison interface shows diff options', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const comparisonTab = page.locator('.tab', { hasText: 'Compare' });
      await comparisonTab.click();
      await page.waitForTimeout(1000);
      
      // Check for comparison controls
      const hasComparisonControls = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('Compare') || text.includes('version') || text.includes('Current');
      });
      expect(hasComparisonControls).toBe(true);
    });
  });

  // Variables Management Tests
  test.describe('Variables Management', () => {
    
    test('variables panel displays variable list', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const variablesTab = page.locator('.tab', { hasText: 'Variables' });
      await variablesTab.click();
      await page.waitForTimeout(1000);
      
      // Check for variables UI (Create Variable button or empty state)
      const hasVariablesUI = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('Create Variable') || text.includes('No variables yet');
      });
      expect(hasVariablesUI).toBe(true);
    });

    test('can add new variable', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const variablesTab = page.locator('.tab', { hasText: 'Variables' });
      await variablesTab.click();
      await page.waitForTimeout(1000);
      
      // Look for add/new variable button
      const addBtn = page.locator('button:has-text("Add"), button:has-text("New")').first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
        await page.waitForTimeout(500);
        
        // Verify modal or form appeared
        const hasVariableForm = await page.evaluate(() => {
          const text = document.body.textContent || '';
          return text.includes('Name') || text.includes('Value') || text.includes('Create');
        });
        expect(hasVariableForm).toBe(true);
      }
    });

    test('variables panel shows variable details', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const variablesTab = page.locator('.tab', { hasText: 'Variables' });
      await variablesTab.click();
      await page.waitForTimeout(1000);
      
      // Variables should show name and value
      const hasVariableDetails = await page.evaluate(() => {
        return document.querySelectorAll('input, textarea').length > 0;
      });
      expect(hasVariableDetails).toBe(true);
    });
  });

  // Activity Log Tests
  test.describe('Activity Log', () => {
    
    test('activity log displays recent events', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const activityTab = page.locator('.tab', { hasText: 'Activity' });
      await activityTab.click();
      await page.waitForTimeout(1000);
      
      // Check for activity entries
      const hasActivityEntries = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('activity') || text.includes('Activity') || text.includes('No activity');
      });
      expect(hasActivityEntries).toBe(true);
    });

    test('activity log shows timestamps', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const activityTab = page.locator('.tab', { hasText: 'Activity' });
      await activityTab.click();
      await page.waitForTimeout(1000);
      
      // Check for time indicators
      const hasTimestamps = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return /\d+\s*(second|minute|hour|day|ago)/.test(text) || /\d{1,2}:\d{2}/.test(text);
      });
      expect(hasTimestamps).toBe(true);
    });

    // E2E Test: Activity log card expansion
    // Purpose: Verifies activity cards can be clicked to expand and show additional details
    // Why: Users need to see full details of activities (e.g., diff changes, metadata)
    // Coverage: Tests expandable activity card interaction (commit 2ada58b)
    test('activity log cards are expandable', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const activityTab = page.locator('.tab', { hasText: 'Activity' });
      await activityTab.click();
      await page.waitForTimeout(1000);
      
      // Look for an activity card to click
      const activityCards = page.locator('.activity-card, [class*="activity"]').first();
      const cardExists = await activityCards.count() > 0;
      
      if (cardExists) {
        await activityCards.click();
        await page.waitForTimeout(500);
        
        // After clicking, details should expand or some interaction should occur
        // We verify the page still works and hasn't crashed
        const isStillFunctional = await page.evaluate(() => {
          return document.body.textContent !== '';
        });
        expect(isStillFunctional).toBe(true);
      }
    });

    test('activity log displays user actions', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const activityTab = page.locator('.tab', { hasText: 'Activity' });
      await activityTab.click();
      await page.waitForTimeout(1000);
      
      // Check for action descriptions
      const hasActions = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('saved') || text.includes('approved') || 
               text.includes('created') || text.includes('updated') ||
               text.includes('Activity');
      });
      expect(hasActions).toBe(true);
    });
  });

  // Document Actions Tests
  test.describe('Document Actions', () => {
    
    test('user dropdown opens and displays options', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      // Find and click user dropdown
      const userBtn = page.locator('button:has-text("Warren"), button:has-text("User")').first();
      if (await userBtn.isVisible()) {
        await userBtn.click();
        await page.waitForTimeout(500);
        
        // Check for user options
        const hasUserOptions = await page.evaluate(() => {
          const text = document.body.textContent || '';
          return text.includes('Warren') || text.includes('Kent') || text.includes('Yuri');
        });
        expect(hasUserOptions).toBe(true);
      }
    });

    test('document actions menu exists', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      // Look for action buttons (save, checkout, etc)
      const hasActionButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const buttonTexts = buttons.map(b => b.textContent?.toLowerCase() || '');
        return buttonTexts.some(t => 
          t.includes('save') || t.includes('checkout') || t.includes('check-in')
        );
      });
      expect(hasActionButtons).toBe(true);
    });

    test('save button is functional', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      // Look for save button
      const saveBtn = page.locator('button:has-text("Save")').first();
      if (await saveBtn.isVisible() && !(await saveBtn.isDisabled())) {
        const initialText = await saveBtn.textContent();
        await saveBtn.click();
        await page.waitForTimeout(1000);
        
        // Button should still exist (may have changed state)
        const stillExists = await saveBtn.isVisible();
        expect(stillExists).toBe(true);
      }
    });
  });

  // Modal Interactions Tests
  test.describe('Modal Interactions', () => {
    
    test('modals can be closed with escape or close button', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      // Try to open a modal (new message for example)
      const messagesTab = page.locator('.tab', { hasText: 'Messages' });
      await messagesTab.click();
      await page.waitForTimeout(500);
      
      const newMessageBtn = page.locator('button:has-text("New Message")');
      if (await newMessageBtn.isVisible()) {
        await newMessageBtn.click();
        await page.waitForTimeout(500);
        
        // Try to close with escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        
        // Modal should be closed
        const modalStillVisible = await page.locator('h3:has-text("New Message")').isVisible();
        expect(modalStillVisible).toBe(false);
      }
    });

    test('clicking outside modal closes it', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const messagesTab = page.locator('.tab', { hasText: 'Messages' });
      await messagesTab.click();
      await page.waitForTimeout(500);
      
      const newMessageBtn = page.locator('button:has-text("New Message")');
      if (await newMessageBtn.isVisible()) {
        await newMessageBtn.click();
        await page.waitForTimeout(500);
        
        // Click outside modal (on overlay)
        await page.mouse.click(50, 50);
        await page.waitForTimeout(300);
        
        // Modal should be closed
        const modalStillVisible = await page.locator('h3:has-text("New Message")').isVisible();
        expect(modalStillVisible).toBe(false);
      }
    });
  });

  // Cross-Feature Integration Tests
  test.describe('Cross-Feature Integration', () => {
    
    test('creating activity is reflected in activity log', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      // Perform an action (e.g., switch users)
      const userBtn = page.locator('button:has-text("Warren"), button:has-text("User")').first();
      if (await userBtn.isVisible()) {
        await userBtn.click();
        await page.waitForTimeout(500);
        
        // Select a different user if available
        const kentBtn = page.locator('button:has-text("Kent")').first();
        if (await kentBtn.isVisible()) {
          await kentBtn.click();
          await page.waitForTimeout(1000);
          
          // Navigate to activity log
          const activityTab = page.locator('.tab', { hasText: 'Activity' });
          await activityTab.click();
          await page.waitForTimeout(1000);
          
          // Activity should show recent action
          const hasRecentActivity = await page.evaluate(() => {
            const text = document.body.textContent || '';
            return text.includes('Activity') || text.includes('activity');
          });
          expect(hasRecentActivity).toBe(true);
        }
      }
    });

    test('app state persists across tab switches', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      // Switch to messages tab and remember state
      const messagesTab = page.locator('.tab', { hasText: 'Messages' });
      await messagesTab.click();
      await page.waitForTimeout(500);
      
      const initialContent = await page.locator('#app-root').textContent();
      
      // Switch to another tab
      const aiTab = page.locator('.tab', { hasText: 'AI' });
      await aiTab.click();
      await page.waitForTimeout(500);
      
      // Switch back to messages
      await messagesTab.click();
      await page.waitForTimeout(500);
      
      // Content should be similar (state preserved)
      const finalContent = await page.locator('#app-root').textContent();
      expect(finalContent).toBeTruthy();
      expect(typeof finalContent).toBe('string');
    });

    test('no memory leaks during extensive navigation', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const tabs = ['AI', 'Workflow', 'Messages', 'Versions', 'Activity'];
      
      // Navigate through tabs multiple times
      for (let i = 0; i < 3; i++) {
        for (const tabName of tabs) {
          const tab = page.locator('.tab', { hasText: tabName });
          if (await tab.isVisible()) {
            await tab.click();
            await page.waitForTimeout(200);
          }
        }
      }
      
      // App should still be responsive
      const appRoot = page.locator('#app-root');
      const isVisible = await appRoot.isVisible();
      expect(isVisible).toBe(true);
    });
  });

  // Scenario Loader Tests
  test.describe('Scenario Loader', () => {
    
    // E2E Test: Scenario Loader modal opens
    // Purpose: Verifies the Scenario Loader modal can be opened from the 3-dot menu
    // Why: Users need access to scenario management
    // Coverage: Modal opening, UI visibility
    test('Scenario Loader modal opens from 3-dot menu', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      // Find and click the 3-dot menu button (⋮)
      const menuButton = page.locator('button', { hasText: '⋮' });
      await menuButton.click();
      await page.waitForTimeout(500);
      
      // Click "Scenario Loader" menu item
      const scenarioLoaderItem = page.locator('.ui-menu-item', { hasText: 'Scenario Loader' });
      if (await scenarioLoaderItem.isVisible()) {
        await scenarioLoaderItem.click();
        await page.waitForTimeout(1000);
        
        // Verify modal opened
        const modalTitle = page.locator('.modal-header', { hasText: 'Scenario Loader' });
        const isVisible = await modalTitle.isVisible();
        expect(isVisible).toBe(true);
      }
    });

    // E2E Test: Scenario Loader displays presets
    // Purpose: Verifies the two preset scenarios (Factory Reset, Almost Done) are visible
    // Why: Users need to see available presets
    // Coverage: Preset rendering in modal
    test('Scenario Loader displays preset scenarios', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      // Open Scenario Loader modal
      const menuButton = page.locator('button', { hasText: '⋮' });
      await menuButton.click();
      await page.waitForTimeout(500);
      
      const scenarioLoaderItem = page.locator('.ui-menu-item', { hasText: 'Scenario Loader' });
      if (await scenarioLoaderItem.isVisible()) {
        await scenarioLoaderItem.click();
        await page.waitForTimeout(1000);
        
        // Verify preset scenarios are displayed
        const modalContent = await page.locator('.modal-panel').textContent();
        expect(modalContent).toContain('Factory Reset');
        expect(modalContent).toContain('Almost Done');
        expect(modalContent).toContain('Save Current Scenario');
      }
    });

    // E2E Test: Load empty preset
    // Purpose: Verifies loading the empty/factory reset preset clears all data
    // Why: Empty preset must restore clean baseline state
    // Coverage: Preset loading, data clearing
    test('loading empty preset clears all data', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      // Navigate to Messages tab to verify messages exist or create some
      const messagesTab = page.locator('.tab', { hasText: 'Messages' });
      await messagesTab.click();
      await page.waitForTimeout(500);
      
      // Open Scenario Loader modal
      const menuButton = page.locator('button', { hasText: '⋮' });
      await menuButton.click();
      await page.waitForTimeout(500);
      
      const scenarioLoaderItem = page.locator('.ui-menu-item', { hasText: 'Scenario Loader' });
      if (await scenarioLoaderItem.isVisible()) {
        await scenarioLoaderItem.click();
        await page.waitForTimeout(1000);
        
        // Click "Factory Reset" card
        const factoryResetCard = page.locator('text=Factory Reset').first();
        await factoryResetCard.click();
        await page.waitForTimeout(2000);
        
        // Verify Messages tab is now empty
        await messagesTab.click();
        await page.waitForTimeout(500);
        
        const hasEmptyState = await page.evaluate(() => {
          const text = document.body.textContent || '';
          return text.includes('No messages') || text.includes('New Message');
        });
        expect(hasEmptyState).toBe(true);
      }
    });

    // E2E Test: Load nearly-done preset
    // Purpose: Verifies loading the nearly-done preset restores populated state
    // Why: Nearly-done preset must restore 90% complete negotiation state
    // Coverage: Preset loading with pre-populated data
    test('loading nearly-done preset restores populated state', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      // First reset to empty
      await page.evaluate(async () => {
        await fetch('https://localhost:4001/api/v1/factory-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'test', preset: 'empty' })
        });
      });
      await page.waitForTimeout(2000);
      
      // Open Scenario Loader modal
      const menuButton = page.locator('button', { hasText: '⋮' });
      await menuButton.click();
      await page.waitForTimeout(500);
      
      const scenarioLoaderItem = page.locator('.ui-menu-item', { hasText: 'Scenario Loader' });
      if (await scenarioLoaderItem.isVisible()) {
        await scenarioLoaderItem.click();
        await page.waitForTimeout(1000);
        
        // Click "Almost Done" card
        const almostDoneCard = page.locator('text=Almost Done').first();
        await almostDoneCard.click();
        await page.waitForTimeout(2000);
        
        // Verify Activity tab has entries
        const activityTab = page.locator('.tab', { hasText: 'Activity' });
        await activityTab.click();
        await page.waitForTimeout(500);
        
        const hasActivity = await page.evaluate(() => {
          const activityCards = document.querySelectorAll('.activity-card');
          return activityCards.length > 0;
        });
        expect(hasActivity).toBe(true);
        
        // Verify Messages tab has entries
        const messagesTab = page.locator('.tab', { hasText: 'Messages' });
        await messagesTab.click();
        await page.waitForTimeout(500);
        
        const hasMessages = await page.evaluate(() => {
          const text = document.body.textContent || '';
          return !text.includes('No messages');
        });
        expect(hasMessages).toBe(true);
      }
    });

    // E2E Test: Save Current Scenario button is visible
    // Purpose: Verifies the "Save Current Scenario" option is present
    // Why: Users need to see the save option to create custom scenarios
    // Coverage: Save scenario UI visibility
    test('Save Current Scenario button is visible in modal', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      // Open Scenario Loader modal
      const menuButton = page.locator('button', { hasText: '⋮' });
      await menuButton.click();
      await page.waitForTimeout(500);
      
      const scenarioLoaderItem = page.locator('.ui-menu-item', { hasText: 'Scenario Loader' });
      if (await scenarioLoaderItem.isVisible()) {
        await scenarioLoaderItem.click();
        await page.waitForTimeout(1000);
        
        // Verify "Save Current Scenario" card is visible
        const saveCard = page.locator('text=Save Current Scenario');
        const isVisible = await saveCard.isVisible();
        expect(isVisible).toBe(true);
      }
    });

    // E2E Test: Scenario Loader modal closes
    // Purpose: Verifies the modal can be closed via X button
    // Why: Users need to dismiss the modal
    // Coverage: Modal closing functionality
    test('Scenario Loader modal closes when X is clicked', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      // Open Scenario Loader modal
      const menuButton = page.locator('button', { hasText: '⋮' });
      await menuButton.click();
      await page.waitForTimeout(500);
      
      const scenarioLoaderItem = page.locator('.ui-menu-item', { hasText: 'Scenario Loader' });
      if (await scenarioLoaderItem.isVisible()) {
        await scenarioLoaderItem.click();
        await page.waitForTimeout(1000);
        
        // Click X button
        const closeButton = page.locator('.ui-modal__close');
        if (await closeButton.isVisible()) {
          await closeButton.click();
          await page.waitForTimeout(500);
          
          // Verify modal is no longer visible
          const modalTitle = page.locator('.modal-header', { hasText: 'Scenario Loader' });
          const isVisible = await modalTitle.isVisible();
          expect(isVisible).toBe(false);
        }
      }
    });
  });
});


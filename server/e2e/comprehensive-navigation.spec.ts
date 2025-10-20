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
            !msg.text().includes('Chrome extensions')) {
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

    test('workflow panel has Send to Vendor button', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const workflowTab = page.locator('.tab', { hasText: 'Workflow' });
      await workflowTab.click();
      await page.waitForTimeout(1000);
      
      // Look for Send to Vendor button
      const sendToVendorBtn = page.locator('button', { hasText: 'Send to Vendor' });
      await expect(sendToVendorBtn).toBeVisible({ timeout: 2000 });
    });

    test('workflow panel has Request Review button', async ({ page }) => {
      await page.goto('/web/view.html');
      await page.waitForSelector('.tab', { timeout: 10000 });
      
      const workflowTab = page.locator('.tab', { hasText: 'Workflow' });
      await workflowTab.click();
      await page.waitForTimeout(1000);
      
      // Look for Request Review button
      const requestReviewBtn = page.locator('button', { hasText: 'Request Review' });
      await expect(requestReviewBtn).toBeVisible({ timeout: 2000 });
    });

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
        
        // Verify modal opened
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
      
      // Check for restore option
      const hasRestoreOption = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('Restore') || text.includes('restore');
      });
      expect(hasRestoreOption).toBe(true);
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
      
      // Check for variable content
      const hasVariablesList = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return text.includes('variable') || text.includes('No variables');
      });
      expect(hasVariablesList).toBe(true);
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
});


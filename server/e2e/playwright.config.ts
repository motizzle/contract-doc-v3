import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './', // This e2e directory only
  testMatch: '**/*.spec.ts', // Only .spec.ts files
  testIgnore: ['**/tests/**', '**/node_modules/**', '**/*.test.js'], // Ignore Jest test directories
  timeout: 15_000, // Reduced from 30s to 15s per test
  fullyParallel: true, // Run tests in parallel
  workers: 3, // Run up to 3 tests simultaneously
  retries: 0, // No retries for faster feedback
  use: {
    baseURL: 'https://localhost:4001',
    headless: true,
    ignoreHTTPSErrors: true,
    navigationTimeout: 10_000, // Max 10s for page navigation
    actionTimeout: 5_000, // Max 5s for actions (click, fill, etc.)
  },
});

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './', // This e2e directory only
  testMatch: '**/*.spec.ts', // Only .spec.ts files
  testIgnore: ['**/tests/**', '**/node_modules/**', '**/*.test.js'], // Ignore Jest test directories
  timeout: 20_000, // Increased to 20s per test for server load
  fullyParallel: false, // Run tests sequentially to avoid server overload
  workers: 1, // Run 1 test at a time (no parallel execution)
  retries: 0, // No retries for faster feedback
  use: {
    baseURL: 'https://localhost:4001',
    headless: true,
    ignoreHTTPSErrors: true,
    navigationTimeout: 10_000, // Max 10s for page navigation
    actionTimeout: 5_000, // Max 5s for actions (click, fill, etc.)
  },
});

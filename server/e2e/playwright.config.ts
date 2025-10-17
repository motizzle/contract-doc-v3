import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './', // This e2e directory only
  testMatch: '**/*.spec.ts', // Only .spec.ts files
  testIgnore: ['**/tests/**', '**/node_modules/**', '**/*.test.js'], // Ignore Jest test directories
  timeout: 30_000,
  use: {
    baseURL: 'https://localhost:4001',
    headless: true,
    ignoreHTTPSErrors: true,
  },
});

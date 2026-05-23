import { defineConfig, devices } from '@playwright/test';

// E2E runs should set E2E_BASE_URL to an already-running server.
// Optionally set E2E_START_SERVER=1 to let Playwright start Vite.
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: 'e2e/specs',
  outputDir: 'e2e/test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.E2E_START_SERVER
    ? {
        command: 'npm run dev -- --host 127.0.0.1 --port 5173',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],
});

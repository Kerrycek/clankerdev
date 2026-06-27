import { defineConfig, devices } from '@playwright/test';

// E2E runs should set E2E_BASE_URL to an already-running server.
// Optionally set E2E_START_SERVER=1 to let Playwright start Vite.
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';
const storageState = process.env.E2E_STORAGE_STATE?.trim() || undefined;
const ignoreHTTPSErrors = process.env.E2E_IGNORE_HTTPS_ERRORS === '1';
const chromiumExecutablePath = process.env.E2E_CHROMIUM_EXECUTABLE?.trim() || undefined;
const chromiumLaunchOptions = chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : undefined;
const retriesFromEnv = process.env.E2E_RETRIES === undefined ? undefined : Number(process.env.E2E_RETRIES);
const retries = retriesFromEnv !== undefined && Number.isFinite(retriesFromEnv) && retriesFromEnv >= 0 ? Math.trunc(retriesFromEnv) : process.env.CI ? 2 : 0;
const video: 'off' | 'retain-on-failure' = process.env.E2E_DISABLE_VIDEO === '1' ? 'off' : 'retain-on-failure';
const trace: 'off' | 'on' | 'retain-on-failure' =
  process.env.E2E_TRACE === 'off' || process.env.E2E_TRACE === 'on' ? process.env.E2E_TRACE : 'retain-on-failure';

export default defineConfig({
  testDir: 'e2e/specs',
  outputDir: 'e2e/test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html']],
  use: {
    baseURL,
    storageState,
    ignoreHTTPSErrors,
    trace,
    screenshot: 'only-on-failure',
    video,
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
        launchOptions: chromiumLaunchOptions,
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        launchOptions: chromiumLaunchOptions,
      },
    },
  ],
});

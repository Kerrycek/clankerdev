import { defineConfig, devices } from '@playwright/test';

// E2E runs should set E2E_BASE_URL to an already-running server.
// Optionally set E2E_START_SERVER=1 to let Playwright start Vite.
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';
const storageState = process.env.E2E_STORAGE_STATE?.trim() || undefined;
const ignoreHTTPSErrors = process.env.E2E_IGNORE_HTTPS_ERRORS === '1';
const chromiumExecutablePath = process.env.E2E_CHROMIUM_EXECUTABLE_PATH?.trim() || undefined;
const recordArtifacts = process.env.E2E_RECORD_ARTIFACTS !== '0';

function readLocalWebServerTarget(url: string): { host: string; port: string } {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' ? parsed.hostname : '127.0.0.1';
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');

    if (!/^\d{1,5}$/.test(port)) return { host: '127.0.0.1', port: '5173' };

    const n = Number(port);
    if (!Number.isInteger(n) || n <= 0 || n > 65535) return { host: '127.0.0.1', port: '5173' };

    return { host, port };
  } catch {
    return { host: '127.0.0.1', port: '5173' };
  }
}

const webServerTarget = readLocalWebServerTarget(baseURL);

export default defineConfig({
  testDir: 'e2e/specs',
  outputDir: 'e2e/test-results',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html']],
  use: {
    baseURL,
    storageState,
    ignoreHTTPSErrors,
    trace: recordArtifacts ? 'retain-on-failure' : 'off',
    screenshot: recordArtifacts ? 'only-on-failure' : 'off',
    video: recordArtifacts ? 'retain-on-failure' : 'off',
  },
  webServer: process.env.E2E_START_SERVER
    ? {
        command: `npm run dev -- --host ${webServerTarget.host} --port ${webServerTarget.port}`,
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
        launchOptions: chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : undefined,
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        launchOptions: chromiumExecutablePath ? { executablePath: chromiumExecutablePath } : undefined,
      },
    },
  ],
});

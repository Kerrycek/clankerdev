import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, setUiSettingsLocalStorage } from '../../fixtures';

const enabled = process.env.E2E_SCREENSHOTS === '1';

test.describe('Design sandbox visual matrix', () => {
  test.skip(!enabled, 'Set E2E_SCREENSHOTS=1 to enable screenshot generation');

  const variants = [
    { theme: 'light' as const, language: 'en' as const },
    { theme: 'dark' as const, language: 'cs' as const },
  ];

  for (const v of variants) {
    test(`desktop ${v.theme} ${v.language}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await setUiSettingsLocalStorage(page, {
        theme: v.theme,
        language: v.language,
      });

      await bootstrapVpsAdminWindow(page, {
        sessionToken: 'TEST_SESSION',
        webuiNext: { enableDesignSandbox: true },
      });

      await installHaveApiMock(page, {
        user: { id: 1, login: 'e2e', level: 2 },
      });

      await page.goto('/app/_design');

      const root = page.getByTestId('design.page');
      await expect(root).toBeVisible();

      await expect(root).toHaveScreenshot(`design-sandbox.desktop.${v.theme}.${v.language}.png`);
    });
  }
});

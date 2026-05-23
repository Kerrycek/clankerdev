import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

/**
 * Theme + language bootstrap.
 *
 * Validates that `index.html` applies explicit preferences BEFORE React mounts.
 *
 * Note: Playwright is not yet wired in CI (see `e2e/README.md`).
 */

test('bootstrap applies explicit theme + language from localStorage', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'vpsadmin.uiSettings.v1',
      JSON.stringify({
        sidebarCollapsed: false,
        theme: 'dark',
        language: 'cs',
      })
    );
  });

  // Keep the page fully deterministic.
  await bootstrapVpsAdminWindow(page, { apiUrl: '/api', apiVersion: '7.0', sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'test', level: 1 },
    handlers: {
      'GET cluster/public_stats': () => ({ public_stats: { user_count: 0, vps_count: 0, ipv4_left: 999 } }),
      'GET nodes/public_status': () => ({ nodes: [] }),
      'GET outages': () => ({ outages: [] }),
      'GET news_logs': () => ({ news_logs: [] }),
      'GET help_boxes': () => ({ help_boxes: [] }),
    },
  });

  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
});

// TODO(e2e): add a locale-driven test for `System` language default:
// - en unless browser preferred language includes `cs`.

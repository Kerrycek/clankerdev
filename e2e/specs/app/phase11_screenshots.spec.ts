import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const enabled = process.env.E2E_PHASE11_SCREENSHOTS === '1';
const screenshotDir = process.env.E2E_PHASE11_SCREENSHOT_DIR ?? 'e2e/phase11-screenshots';

async function capture(page: Page, name: string, opts: { fullPage?: boolean } = {}) {
  fs.mkdirSync(screenshotDir, { recursive: true });
  const fileName = `${String(name).replace(/[^a-z0-9._-]+/gi, '-').toLowerCase()}.png`;
  const outPath = path.join(screenshotDir, fileName);
  await page.screenshot({ path: outPath, fullPage: opts.fullPage ?? true });
  return outPath;
}

async function installPhase11Mock(page: Page) {
  await bootstrapVpsAdminWindow(page, {
    sessionToken: 'TEST_SESSION',
    webuiNext: { enableDesignSandbox: true },
  });

  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 95 },
    handlers: {
      'GET cluster/public_stats': () => ({ public_stats: { user_count: 1234, vps_count: 5678, ipv4_left: 200 } }),
      'GET nodes/public_status': () => ({
        nodes: [
          { name: 'node-a', status: true, location: { label: 'Prague' }, vps_count: 100, vps_free: 12, cpu_idle: 51 },
          { name: 'node-b', status: false, location: { label: 'Brno' }, vps_count: 80, vps_free: 3, cpu_idle: 0 },
          { name: 'node-c', status: true, location: { label: 'Brno' }, vps_count: 60, vps_free: 8, cpu_idle: 43 },
        ],
      }),
      'GET outages': () => ({
        outages: [
          {
            id: 1,
            title: 'Planned storage maintenance',
            state: 'planned',
            starts_at: '2026-02-20T20:00:00Z',
            ends_at: '2026-02-20T22:00:00Z',
          },
        ],
      }),
      'GET news_logs': () => ({
        news_logs: [
          { id: 1, title: 'New dashboard preview', body: 'Phase 11 visual audit sample.', created_at: '2026-02-18T10:00:00Z' },
        ],
      }),
      'GET help_boxes': () => ({ help_boxes: [] }),
      'GET vpses': () => ({
        vpses: [
          { id: 101, hostname: 'alpha.vps.test', is_running: true, object_state: 'active', user: { id: 10, login: 'alice' } },
          { id: 102, hostname: 'beta.vps.test', is_running: false, object_state: 'active', user: { id: 10, login: 'alice' } },
          { id: 103, hostname: 'gamma.vps.test', is_running: true, object_state: 'active', user: { id: 11, login: 'bob' } },
        ],
        _meta: { total_count: 3 },
      }),
      'GET datasets': () => ({
        datasets: [
          { id: 1, name: 'tank/home', user: { id: 10, login: 'alice' } },
          { id: 2, name: 'tank/backups', user: { id: 10, login: 'alice' } },
        ],
        _meta: { total_count: 2 },
      }),
      'GET dns_zones': () => ({
        dns_zones: [
          { id: 1, name: 'example.test', enabled: true, user: { id: 10, login: 'alice' } },
          { id: 2, name: 'internal.test', enabled: true, user: { id: 10, login: 'alice' } },
        ],
        _meta: { total_count: 2 },
      }),
      'GET transaction_chains': () => ({ transaction_chains: [], _meta: { total_count: 0 } }),
      'GET cluster/search': () => ({ results: [] }),
    },
  });
}

test.describe('Phase 11 screenshot audit', () => {
  test.skip(!enabled, 'Set E2E_PHASE11_SCREENSHOTS=1 to capture the phase 11 screenshot bundle');

  test('captures public, app, admin, mobile and design-system surfaces', async ({ page }) => {
    const captured: string[] = [];
    await installPhase11Mock(page);

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto('/');
    await expect(page.getByTestId('public.overview.page')).toBeVisible();
    captured.push(await capture(page, '01-public-overview-desktop'));

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    captured.push(await capture(page, '02-public-skip-link-focused', { fullPage: false }));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByTestId('public.overview.page')).toBeVisible();
    captured.push(await capture(page, '03-public-overview-mobile'));
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.locator('#public-mobile-navigation')).toBeVisible();
    captured.push(await capture(page, '04-public-mobile-navigation-open', { fullPage: false }));

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto('/app');
    await expect(page.getByTestId('app.dashboard.page')).toBeVisible();
    captured.push(await capture(page, '05-app-dashboard-desktop'));

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    captured.push(await capture(page, '06-app-skip-link-focused', { fullPage: false }));

    await page.getByTestId('tasks.open-button').click();
    await expect(page.locator('#app-tasks-drawer')).toBeVisible();
    captured.push(await capture(page, '07-app-tasks-drawer-open', { fullPage: false }));
    await page.getByTestId('tasks.close-button').click();

    await page.getByTestId('shell.user-menu-button').click();
    await expect(page.getByRole('dialog', { name: 'Account and display settings' })).toBeVisible();
    captured.push(await capture(page, '08-app-user-menu-open', { fullPage: false }));
    await page.getByTestId('shell.header').click({ position: { x: 8, y: 8 } });

    await page.getByTestId('palette.open').click();
    await expect(page.getByTestId('palette.modal')).toBeVisible();
    captured.push(await capture(page, '09-app-command-palette-open', { fullPage: false }));
    await page.keyboard.press('Escape');

    await page.context().setOffline(true);
    await expect(page.getByTestId('shell.sync-indicator')).toBeVisible();
    await page.getByTestId('shell.sync-indicator').click();
    await expect(page.getByTestId('shell.sync-panel')).toBeVisible();
    captured.push(await capture(page, '10-app-offline-sync-popover', { fullPage: false }));
    await page.context().setOffline(false);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app');
    await expect(page.getByTestId('app.dashboard.page')).toBeVisible();
    captured.push(await capture(page, '11-app-dashboard-mobile'));
    await page.getByTestId('shell.mobile-nav-button').click();
    await expect(page.locator('#app-mobile-navigation')).toBeVisible();
    captured.push(await capture(page, '12-app-mobile-navigation-open', { fullPage: false }));

    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto('/admin');
    await expect(page.getByTestId('app.dashboard.page')).toBeVisible();
    captured.push(await capture(page, '13-admin-dashboard-desktop'));
    await page.getByTestId('shell.user-menu-button').click();
    await expect(page.getByRole('dialog', { name: 'Account and display settings' })).toBeVisible();
    captured.push(await capture(page, '14-admin-user-menu-open', { fullPage: false }));
    await page.getByTestId('shell.header').click({ position: { x: 8, y: 8 } });

    await page.goto('/app/_design');
    await expect(page.getByTestId('design.page')).toBeVisible();
    await page.getByTestId('design.controls.theme').selectOption('light');
    await page.getByTestId('design.controls.language').selectOption('en');
    await expect(page.getByTestId('design.controls.summary')).toHaveAttribute('data-theme', 'light');
    captured.push(await capture(page, '15-design-sandbox-light-en'));

    await page.getByTestId('design.controls.theme').selectOption('dark');
    await page.getByTestId('design.controls.language').selectOption('cs');
    await expect(page.getByTestId('design.controls.summary')).toHaveAttribute('data-theme', 'dark');
    captured.push(await capture(page, '16-design-sandbox-dark-cs'));

    await page.getByRole('button', { name: 'Open modal' }).click();
    await expect(page.getByTestId('design.modal')).toBeVisible();
    captured.push(await capture(page, '17-design-modal-open', { fullPage: false }));
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Open drawer (right)' }).click();
    await expect(page.getByTestId('design.drawer.right')).toBeVisible();
    captured.push(await capture(page, '18-design-drawer-open', { fullPage: false }));

    fs.writeFileSync(
      path.join(screenshotDir, 'manifest.json'),
      JSON.stringify({ generatedAt: new Date().toISOString(), count: captured.length, files: captured.map((p) => path.basename(p)) }, null, 2)
    );
  });
});

import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const enabled = process.env.E2E_CAPTURE_SCREENSHOTS === '1';
const screenshotDir = process.env.E2E_SCREENSHOT_DIR?.trim() || 'docs/e2e-screenshots';
const requestedScenarios = new Set(
  (process.env.E2E_SCREENSHOT_SCENARIOS?.trim() || 'dashboard,dataset-downloads')
    .split(',')
    .map((scenario) => scenario.trim())
    .filter(Boolean),
);

function hasScenario(name: string): boolean {
  return requestedScenarios.has('all') || requestedScenarios.has(name);
}

async function waitForStableFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if ('fonts' in document) await document.fonts.ready;
  });
}

async function capturePage(page: Page, fileName: string): Promise<void> {
  fs.mkdirSync(screenshotDir, { recursive: true });
  await waitForStableFonts(page);
  await page.screenshot({ path: path.join(screenshotDir, fileName), fullPage: true });
}

async function installDashboardScreenshotMock(page: Page): Promise<void> {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'screenshot', level: 1 },
    handlers: {
      'GET vpses': () => ({
        vpses: [
          { id: 101, hostname: 'web-01.prg', is_running: true, object_state: 'active' },
          { id: 102, hostname: 'worker-01.prg', is_running: true, object_state: 'active' },
          { id: 103, hostname: 'db-01.brq', is_running: false, object_state: 'active' },
          { id: 104, hostname: 'staging-01.prg', is_running: false, object_state: 'active' },
        ],
        _meta: { total_count: 4 },
      }),
      'GET datasets': () => ({ datasets: [{ id: 10 }, { id: 11 }], _meta: { total_count: 12 } }),
      'GET dns_zones': () => ({ dns_zones: [{ id: 20 }], _meta: { total_count: 3 } }),
      'GET nodes/public_status': () => ({
        nodes: [
          {
            id: 1,
            name: 'node-a.prg',
            fqdn: 'node-a.prg.example.test',
            status: true,
            location: { label: 'Prague DC1' },
            last_report: new Date().toISOString(),
            vps_count: 120,
            vps_free: 18,
            cpu_idle: 47.5,
            kernel: '6.1.0-29-amd64',
            cgroup_version: 'v2',
            pool_state: 'ONLINE',
            pool_status: true,
          },
          {
            id: 2,
            name: 'node-b.prg',
            fqdn: 'node-b.prg.example.test',
            status: false,
            location: { label: 'Prague DC1' },
            last_report: new Date(Date.now() - 90_000).toISOString(),
            vps_count: 80,
            vps_free: 9,
            cpu_idle: 66.2,
            kernel: '6.1.0-29-amd64',
            cgroup_version: 'v2',
            pool_state: 'ONLINE',
            pool_status: true,
            maintenance_lock: 'lock',
            maintenance_lock_reason: 'Memory replacement window',
          },
          {
            id: 3,
            name: 'node-c.brq',
            fqdn: 'node-c.brq.example.test',
            status: true,
            location: { label: 'Brno DC2' },
            last_report: new Date().toISOString(),
            vps_count: 42,
            vps_free: 21,
            cpu_idle: 83.1,
            kernel: '6.1.0-29-amd64',
            cgroup_version: 'v2',
            pool_state: 'ONLINE',
            pool_status: true,
          },
        ],
      }),
      'GET outages': () => ({
        outages: [
          {
            id: 55,
            state: 'announced',
            type: 'maintenance',
            impact: 'network',
            begins_at: new Date(Date.now() + 3_600_000).toISOString(),
            en_summary: 'Prague network maintenance window',
            cs_summary: 'Údržba sítě v Praze',
          },
        ],
      }),
      'GET news_logs': () => ({
        news_logs: [
          {
            id: 9,
            message: 'New platform images are available for Debian and Ubuntu.',
            published_at: new Date().toISOString(),
          },
        ],
      }),
      'GET security_advisories': () => ({
        security_advisories: [
          {
            id: 77,
            name: 'OpenSSL advisory',
            state: 'published',
            published_at: new Date().toISOString(),
            affected: true,
            affected_node_count: 2,
            affected_user_count: 1,
            affected_vps_count: 3,
            en_summary: 'Patch OpenSSL on affected hosts.',
            cs_summary: 'Aktualizujte OpenSSL na dotčených hostech.',
            security_advisory_cves: [{ id: 7701, cve_id: 'CVE-2026-0001' }],
          },
        ],
        _meta: { total_count: 1 },
      }),
    },
  });
}

async function installDatasetDownloadsScreenshotMock(page: Page): Promise<void> {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 99 },
    handlers: {
      'GET datasets/10': () => ({
        id: 10,
        full_name: 'tank/vps/screenshot',
        name: 'screenshot',
        used: 2048,
        refquota: 10240,
        snapshots_count: 5,
        mount_count: 0,
        export_count: 0,
        object_state: 'active',
        vps: { id: 300, hostname: 'alpha.example' },
      }),
      'GET snapshot_downloads': () => ({
        snapshot_downloads: [
          {
            id: 601,
            dataset: 10,
            snapshot: { id: 200, label: 'snap-ready-url' },
            format: 'archive',
            download_url: '/generated/601.tar.gz',
            file_name: 'generated-601.tar.gz',
            size: 128,
            expires_at: '2099-02-10T00:00:00.000Z',
          },
          {
            id: 602,
            dataset: 10,
            snapshot: { id: 201, label: 'snap-pending' },
            format: 'stream',
            ready: false,
            file_name: 'pending-602.zfs',
            expires_at: '2099-02-10T00:00:00.000Z',
          },
          {
            id: 603,
            dataset: 10,
            snapshot: { id: 202, label: 'snap-expired' },
            format: 'archive',
            ready: true,
            url: 'https://example.test/expired-603.tar.gz',
            file_name: 'expired-603.tar.gz',
            expires_at: '2000-01-01T00:00:00.000Z',
          },
          {
            id: 604,
            dataset: 10,
            snapshot: { id: 203, label: 'snap-failed' },
            format: 'archive',
            state: 'failed',
            error_message: 'zfs send failed',
            file_name: 'failed-604.tar.gz',
          },
          {
            id: 605,
            dataset: 10,
            snapshot: { id: 204, label: 'snap-legacy' },
            format: 'archive',
            ready: true,
            file_name: 'legacy-605.tar.gz',
            expires_at: '2099-02-10T00:00:00.000Z',
          },
        ],
      }),
    },
  });
}

test.describe('Screenshot capture harness', () => {
  test.skip(!enabled, 'Set E2E_CAPTURE_SCREENSHOTS=1 to enable screenshot capture.');

  test('captures dashboard scenario @screenshot-capture', async ({ page }) => {
    test.skip(!hasScenario('dashboard'), 'dashboard scenario not requested');

    await page.setViewportSize({ width: 1440, height: 1100 });
    await installDashboardScreenshotMock(page);
    await page.goto('/app');
    await expect(page.getByTestId('app.dashboard.page')).toBeVisible();
    await capturePage(page, 'dashboard.png');
  });

  test('captures dataset download states scenario @screenshot-capture', async ({ page }) => {
    test.skip(!hasScenario('dataset-downloads'), 'dataset-downloads scenario not requested');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await installDatasetDownloadsScreenshotMock(page);
    await page.goto('/app/datasets/10/downloads');
    await expect(page.getByTestId('dataset.downloads.list')).toBeVisible();
    await capturePage(page, 'dataset-downloads.png');
  });
});

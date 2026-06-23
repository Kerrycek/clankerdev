import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

/**
 * Public status landing smoke.
 *
 * This spec is part of the PR smoke suite.
 * Keep it fast and deterministic.
 */
test('@pr-smoke @pr-smoke-mobile @smoke public overview shows key status surfaces', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, {
    apiUrl: '/api',
    apiVersion: '7.0',
    sessionToken: 'TEST',
  });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'test', level: 1 },
    handlers: {
      'GET cluster/public_stats': () => ({
        public_stats: { user_count: 123, vps_count: 456, ipv4_left: 200 },
      }),
      'GET nodes/public_status': () => ({
        nodes: [
          {
            name: 'node1',
            status: true,
            location: { label: 'DC1' },
            last_report: '2025-01-01T00:00:00Z',
            vps_count: 100,
            vps_free: 10,
            cpu_idle: 50,
          },
          {
            name: 'node2',
            status: true,
            location: { label: 'DC1' },
            last_report: '2025-01-01T00:00:00Z',
            vps_count: 120,
            vps_free: 5,
            cpu_idle: 60,
          },
        ],
      }),
      'GET outages': () => ({ outages: [] }),
      'GET news_logs': () => ({ news_logs: [] }),
      'GET help_boxes': () => ({ help_boxes: [] }),
    },
  });

  await page.goto('/');

  // Page shell
  await expect(page.getByTestId('public.overview.page')).toBeVisible();

  // Primary stats
  await expect(page.getByTestId('public.stats.members')).toBeVisible();
  await expect(page.getByTestId('public.stats.nodes')).toBeVisible();
  await expect(page.getByTestId('public.stats.vps')).toBeVisible();

  // Supporting sections
  await expect(page.getByTestId('public.outages.card')).toBeVisible();
  await expect(page.getByTestId('public.nodes.section')).toBeVisible();

  // Not shown when IPv4 is healthy.
  await expect(page.locator('[data-testid="public.ipv4.alert"]')).toHaveCount(0);
});

test('public overview shows IPv4 critical alert when low', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, {
    apiUrl: '/api',
    apiVersion: '7.0',
    sessionToken: 'TEST',
    webuiNext: { publicStatus: { ipv4Warn: 64, ipv4Critical: 16 } },
  });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'test', level: 1 },
    handlers: {
      'GET cluster/public_stats': () => ({
        public_stats: { user_count: 1, vps_count: 1, ipv4_left: 10 },
      }),
      'GET nodes/public_status': () => ({ nodes: [] }),
      'GET outages': () => ({ outages: [] }),
      'GET news_logs': () => ({ news_logs: [] }),
      'GET help_boxes': () => ({ help_boxes: [] }),
    },
  });

  await page.goto('/');

  await expect(page.getByTestId('public.overview.page')).toBeVisible();
  await expect(page.getByTestId('public.ipv4.alert')).toBeVisible();
  await expect(page.getByTestId('public.ipv4.alert')).toContainText('10');
});

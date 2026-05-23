import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const vps = {
  id: 123,
  hostname: 'vps123.example',
  object_state: 'active',
  is_running: true,
  cpus: 2,
  memory: 2048,
  swap: 0,
  diskspace: 20480,
  used_memory: 768,
  used_swap: 0,
  used_diskspace: 5120,
  uptime: 12345,
  loadavg1: 0.12,
  loadavg5: 0.18,
  node: { id: 1, domain_name: 'node1.example' },
  os_template: { label: 'debian' },
  dns_resolver: 'inherit',
};

const statuses = [
  {
    id: 1,
    created_at: '2026-01-31T00:00:00Z',
    loadavg1: 0.05,
    loadavg5: 0.08,
    used_memory: 512,
    used_diskspace: 4096,
  },
  {
    id: 2,
    created_at: '2026-01-31T01:00:00Z',
    loadavg1: 0.22,
    loadavg5: 0.19,
    used_memory: 768,
    used_diskspace: 5120,
  },
  {
    id: 3,
    created_at: '2026-01-31T02:00:00Z',
    loadavg1: 0.12,
    loadavg5: 0.18,
    used_memory: 700,
    used_diskspace: 5300,
  },
];

test.describe('VPS overview metrics charts', () => {
  test('renders charts and switches window', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET vpses/123': () => ({ vps }),
        'GET vpses/123/statuses': () => ({ statuses }),
        'GET ip_addresses': () => ({ ip_addresses: [] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
      },
    });

    await page.goto('/app/vps/123');

    await expect(page.getByTestId('vps.overview.metrics.card')).toBeVisible();
    await expect(page.getByTestId('vps.overview.metrics.chart.load1')).toBeVisible();
    await expect(page.getByTestId('vps.overview.metrics.chart.load5')).toBeVisible();
    await expect(page.getByTestId('vps.overview.metrics.chart.mem_used')).toBeVisible();
    await expect(page.getByTestId('vps.overview.metrics.chart.disk_used')).toBeVisible();

    await page.getByTestId('vps.overview.metrics.window.7d').click();
    await expect(page).toHaveURL(/metrics_window=7d/);
  });
  test('fetches metrics on load (no disclosure) and renders charts', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let statusesCalls = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET vpses/123': () => ({ vps }),
        'GET vpses/123/statuses': () => {
          statusesCalls += 1;
          return { statuses };
        },
        'GET ip_addresses': () => ({ ip_addresses: [] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
      },
    });

    await page.goto('/app/vps/123');

    await expect(page.getByTestId('vps.overview.metrics.card')).toBeVisible();
    await expect(page.getByTestId('vps.overview.metrics.chart.load1')).toBeVisible();

    // Metrics should be fetched without requiring a disclosure click.
    expect(statusesCalls).toBeGreaterThan(0);

  });
});

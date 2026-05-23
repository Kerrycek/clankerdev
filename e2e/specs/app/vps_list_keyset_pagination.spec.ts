import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

/**
 * NOTE: E2E tests are scaffolding only...
 */

test.describe('@smoke VPS list keyset pagination', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    const makeVps = (id: number) => ({
      id,
      hostname: `vps${id}.example`,
      object_state: id === 298 ? 'suspended' : 'active',
      is_running: id === 299 ? false : id % 2 === 0,
      node: { id: (id % 3) + 1, domain_name: `node${(id % 3) + 1}` },
      cpus: (id % 4) + 1,
      memory: 1024 + (id % 8) * 256,
      diskspace: 10240 + (id % 10) * 1024,
      used_memory: 256 + (id % 4) * 128,
      used_diskspace: 1024 + (id % 6) * 512,
      uptime: id % 2 === 0 ? 12345 : 0,
      loadavg1: 0.1,
    });

    const page1 = Array.from({ length: 50 }, (_, i) => 300 - i).map(makeVps);
    const page2 = Array.from({ length: 50 }, (_, i) => 250 - i).map(makeVps);

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET vpses': ({ searchParams }) => {
          const fromId = searchParams.get('vps[from_id]');
          const data = fromId ? page2 : page1;
          return { vpses: data, _meta: { total_count: 100 } };
        },
      },
    });
  });

  test('navigates to next and previous pages via from_id', async ({ page }) => {
    await page.goto('/app/vps');

    await expect(page.getByTestId('vps.list')).toBeVisible();
    await expect(page.getByTestId('vps.row.300')).toBeVisible();
    await expect(page.getByTestId('vps.row.299')).toHaveAttribute('data-row-variant', 'danger');
    await expect(page.getByTestId('vps.row.299.dot')).toBeVisible();
    await expect(page.getByTestId('vps.row.298')).toHaveAttribute('data-row-variant', 'warn');

    await page.getByTestId('vps.pagination.desktop.next').click();
    await expect(page).toHaveURL(/from_id=251/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('vps.row.250')).toBeVisible();
    await expect(page.getByTestId('vps.row.249')).toHaveAttribute('data-row-variant', 'danger');

    await page.getByTestId('vps.pagination.desktop.prev').click();
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page).toHaveURL(/page=1/);
    await expect(page.getByTestId('vps.row.300')).toBeVisible();
  });

  test('respects URL from_id on initial load (no page-1 flash request)', async ({ page }) => {
    const vpsRequests: URL[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET') return;
      const url = new URL(req.url());
      if (!url.pathname.endsWith('/vpses')) return;
      vpsRequests.push(url);
    });

    await page.goto('/app/vps?limit=50&page=2&from_id=251');

    await expect(page.getByTestId('vps.list')).toBeVisible();
    await expect(page.getByTestId('vps.row.250')).toBeVisible();

    // The first VPS index request must already contain the cursor.
    expect(vpsRequests.length).toBeGreaterThan(0);
    const first = vpsRequests[0];
    expect(first.searchParams.get('vps[from_id]')).toBe('251');
    expect(vpsRequests.some((u) => u.searchParams.get('vps[from_id]') === null)).toBe(false);
  });

  test('resets cursor stack on filter change (search request must not keep from_id)', async ({ page }) => {
    const vpsRequests: URL[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET') return;
      const url = new URL(req.url());
      if (!url.pathname.endsWith('/vpses')) return;
      vpsRequests.push(url);
    });

    await page.goto('/app/vps');

    await expect(page.getByTestId('vps.list')).toBeVisible();
    await expect(page.getByTestId('vps.row.300')).toBeVisible();

    // Move to page 2.
    await page.getByTestId('vps.pagination.desktop.next').click();
    await expect(page).toHaveURL(/from_id=251/);
    await expect(page.getByTestId('vps.row.250')).toBeVisible();

    // Clear collected requests up to this point so we only inspect filter-triggered calls.
    vpsRequests.length = 0;

    // Trigger server-side filter (debounced) while on page 2.
    await page.getByTestId('vps.smart_filter.input').fill('vps299');
    await page.getByTestId('vps.smart_filter.input').press('Enter');
    await expect(page.getByTestId('vps.row.299')).toBeVisible();

    // Any request that includes hostname_any must NOT include from_id.
    const filteredReqs = vpsRequests.filter((u) => u.searchParams.get('vps[hostname_any]'));
    expect(filteredReqs.length).toBeGreaterThan(0);
    for (const u of filteredReqs) {
      expect(u.searchParams.get('vps[from_id]')).toBe(null);
    }
  });
});

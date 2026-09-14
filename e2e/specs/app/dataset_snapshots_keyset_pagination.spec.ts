import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@pr-smoke @pr-smoke-mobile Dataset snapshots keyset pagination', () => {
  let requestedSnapshotParams: URLSearchParams[];

  test.beforeEach(async ({ page }) => {
    requestedSnapshotParams = [];
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    const dataset = {
      id: 10,
      full_name: 'tank/vps/ds10',
      name: 'ds10',
      used: 2048,
      refquota: 10240,
      snapshots_count: 123,
      mount_count: 0,
      export_count: 0,
      object_state: 'active',
      vps: { id: 300, hostname: 'alpha.example' },
    };

    const makeSnap = (id: number) => ({
      id,
      name: `snap-${id}`,
      label: `Snapshot ${id}`,
      created_at: '2026-01-26T00:00:00.000Z',
    });

    const allSnapshots = Array.from({ length: 100 }, (_, i) => i + 1).map(makeSnap);

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET datasets/10': () => dataset,
        'GET datasets/10/snapshots': ({ searchParams }) => {
          requestedSnapshotParams.push(new URLSearchParams(searchParams));
          const fromId = Number(searchParams.get('snapshot[from_id]') ?? 0);
          const limit = Number(searchParams.get('snapshot[limit]') ?? 50);
          return {
            snapshots: allSnapshots.filter((snapshot) => snapshot.id > fromId).slice(0, limit),
            _meta: { total_count: allSnapshots.length },
          };
        },
      },
    });
  });

  test('next/prev updates URL and rows', async ({ page }) => {
    const mobile = (page.viewportSize()?.width ?? 1024) < 768;
    const item = (id: number) =>
      page.getByTestId(`dataset.snapshots.${mobile ? 'card' : 'row'}.${id}`);
    const paginationKind = mobile ? 'mobile' : 'desktop';
    const pagination = page.getByTestId(`dataset.snapshots.pagination.${paginationKind}`);

    await page.goto('/app/datasets/10/snapshots');

    await expect(page.getByTestId('dataset.snapshots.list')).toBeVisible();
    await expect(item(1)).toBeVisible();
    expect(requestedSnapshotParams.at(-1)?.get('snapshot[limit]')).toBe('51');

    await pagination
      .getByTestId(`dataset.snapshots.pagination.${paginationKind}.next`)
      .click();
    await expect(page).toHaveURL(/from_id=50/);
    await expect(page).toHaveURL(/page=2/);
    await expect(item(51)).toBeVisible();
    expect(requestedSnapshotParams.at(-1)?.get('snapshot[limit]')).toBe('51');
    await expect(item(1)).toHaveCount(0);
    await expect(
      pagination.getByTestId(`dataset.snapshots.pagination.${paginationKind}.next`),
    ).toBeDisabled();

    await pagination
      .getByTestId(`dataset.snapshots.pagination.${paginationKind}.prev`)
      .click();
    await expect(page).toHaveURL(/page=1/);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(item(1)).toBeVisible();
  });

  test('does not offer or send the unsupported q filter', async ({ page }) => {
    const mobile = (page.viewportSize()?.width ?? 1024) < 768;
    await page.goto('/app/datasets/10/snapshots?q=legacy-search');

    await expect(
      page.getByTestId(`dataset.snapshots.${mobile ? 'card' : 'row'}.1`),
    ).toBeVisible();
    await expect(page.getByTestId('dataset.snapshots.search.input')).toHaveCount(0);
    expect(requestedSnapshotParams.length).toBeGreaterThan(0);
    expect(requestedSnapshotParams.every((params) => !params.has('snapshot[q]'))).toBe(true);
    expect(
      requestedSnapshotParams.every((params) => params.get('_meta[count]') === 'true'),
    ).toBe(true);
  });
});

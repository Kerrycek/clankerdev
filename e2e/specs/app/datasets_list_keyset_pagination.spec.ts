import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Datasets list keyset pagination', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    const makeDataset = (id: number) => ({
      id,
      full_name: `tank/vps/ds${id}`,
      name: `ds${id}`,
      used: id === 300 ? 9000 : id === 299 ? 3900 : 512 + (id % 8) * 128,
      refquota: id === 300 ? 4096 : id === 299 ? 4096 : 4096 + (id % 8) * 512,
      snapshots_count: id % 4,
      mount_count: id % 3,
      export_count: id % 2,
      object_state: 'active',
      vps: { id, hostname: `vps${id}.example` },
    });

    const page1 = Array.from({ length: 50 }, (_, i) => 300 - i).map(makeDataset);
    const page2 = Array.from({ length: 50 }, (_, i) => 250 - i).map(makeDataset);

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 99 },
      handlers: {
        'GET datasets': ({ searchParams }) => {
          const fromId = searchParams.get('dataset[from_id]');
          return { datasets: fromId ? page2 : page1, _meta: { total_count: 100 } };
        },
      },
    });
  });

  test('navigates to next and previous pages via from_id', async ({ page }, testInfo) => {
    await page.goto('/admin/datasets');

    const mobile = testInfo.project.name === 'mobile-chrome';
    const layout = mobile ? 'card' : 'row';
    const pager = `datasets.pagination.${mobile ? 'mobile' : 'desktop'}`;
    const dataset = (id: number) => page.getByTestId(`datasets.${layout}.${id}`);

    await expect(page.getByTestId('datasets.list')).toBeVisible();
    await expect(dataset(300)).toBeVisible();
    if (mobile) {
      await expect(dataset(300)).toHaveClass(/border-danger-border/);
    } else {
      await expect(dataset(300)).toHaveAttribute('data-row-variant', 'danger');
    }
    await expect(page.getByTestId(`datasets.${layout}.300.dot`)).toBeVisible();
    await expect(page.getByTestId(`datasets.${layout}.299.dot`)).toBeVisible();

    await page.getByTestId(`${pager}.next`).click();
    await expect(page).toHaveURL(/from_id=251/);
    await expect(page).toHaveURL(/page=2/);
    await expect(dataset(250)).toBeVisible();

    await page.getByTestId(`${pager}.prev`).click();
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page).toHaveURL(/page=1/);
    await expect(dataset(300)).toBeVisible();
    if (mobile) {
      await expect(dataset(300)).toHaveClass(/border-danger-border/);
    } else {
      await expect(dataset(300)).toHaveAttribute('data-row-variant', 'danger');
    }
    await expect(page.getByTestId(`datasets.${layout}.300.dot`)).toBeVisible();
    await expect(page.getByTestId(`datasets.${layout}.299.dot`)).toBeVisible();
  });
});

test.describe('Datasets list text filter contract', () => {
  test('@pr-smoke @pr-smoke-mobile keeps text filtering local to the current API page', async ({ page }, testInfo) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    const requestedQueries: string[] = [];
    const makeDataset = (id: number, name = `dataset-${id}`) => ({
      id,
      full_name: `tank/vps/${name}`,
      name,
      used: 512,
      refquota: 4096,
      object_state: 'active',
      vps: { id: 7, hostname: 'mail.example.test' },
    });
    const firstPage = Array.from({ length: 50 }, (_, index) => makeDataset(300 - index));
    const secondPage = [makeDataset(250, 'needle-on-next-page')];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 99 },
      handlers: {
        'GET datasets': ({ searchParams }) => {
          requestedQueries.push(searchParams.toString());
          expect(searchParams.get('dataset[q]')).toBeNull();
          const fromId = searchParams.get('dataset[from_id]');
          return {
            datasets: fromId ? secondPage : firstPage,
            _meta: { total_count: 51 },
          };
        },
      },
    });

    await page.goto('/admin/datasets?q=needle-on-next-page');

    await expect(page.getByTestId('datasets.search.page_limited')).toContainText(
      'Search is limited to this page',
    );
    await expect(page.getByTestId('datasets.list.empty')).toContainText('No matches on this page');
    await expect(page.getByTestId('datasets.pagination.filtered.next')).toBeEnabled();
    expect(requestedQueries).toHaveLength(1);

    await page.getByTestId('datasets.pagination.filtered.next').click();

    await expect(page).toHaveURL(/from_id=251/);
    const resultTestId = testInfo.project.name === 'mobile-chrome'
      ? 'datasets.card.250'
      : 'datasets.row.250';
    await expect(page.getByTestId(resultTestId)).toContainText('needle-on-next-page');
    expect(requestedQueries).toHaveLength(2);
    expect(requestedQueries.every((query) => !query.includes('dataset%5Bq%5D'))).toBe(true);
  });
});

test.describe('Datasets list optional columns', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 99 },
      handlers: {
        'GET datasets': () => ({
          datasets: [
            {
              id: 8,
              full_name: 'tank/vps/12',
              name: '12',
              used: 269,
              refquota: 10240,
              vps: { id: 12, hostname: 'dopici' },
            },
            {
              id: 9,
              full_name: 'tank/vps/13',
              name: '13',
              used: 269,
              refquota: 10240,
              vps: { id: 13, hostname: 'hjjh' },
            },
          ],
        }),
      },
    });
  });

  test('hides related object columns when the API does not provide those values', async ({ page }, testInfo) => {
    await page.goto('/admin/datasets');

    const mobile = testInfo.project.name === 'mobile-chrome';
    const entry = page.getByTestId(`datasets.${mobile ? 'card' : 'row'}.8`);
    await expect(page.getByTestId('datasets.list')).toBeVisible();
    await expect(entry).toBeVisible();
    if (mobile) {
      await expect(entry).not.toContainText('Snapshots');
      await expect(entry).not.toContainText('Mounts');
      await expect(entry).not.toContainText('Exports');
    } else {
      await expect(page.getByRole('columnheader', { name: 'Snapshots' })).toHaveCount(0);
      await expect(page.getByRole('columnheader', { name: 'Mounts' })).toHaveCount(0);
      await expect(page.getByRole('columnheader', { name: 'Exports' })).toHaveCount(0);
    }
  });
});

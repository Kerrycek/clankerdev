import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke dataset plans and expansion', () => {
  test('renders dataset plans tab', async ({ page }, testInfo) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installHaveApiMock(page, {
      user: { id: 10, login: 'alice', level: 1 },
      handlers: {
        'GET datasets/42': () => ({
          dataset: {
            id: 42,
            full_name: 'tank/users/alice',
            name: 'alice',
            environment: { id: 7, label: 'Production' },
            object_state: 'active',
          },
        }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET datasets/42/plans': () => ({
          plans: [
            {
              id: 2,
              environment_dataset_plan: {
                id: 12,
                label: 'Daily backup',
                dataset_plan: { id: 3, label: 'daily_backup' },
                user_add: true,
                user_remove: true,
              },
            },
          ],
        }),
        'GET environments/7/dataset_plans': () => ({
          dataset_plans: [
            { id: 12, label: 'Daily backup', dataset_plan: { id: 3, label: 'daily_backup' }, user_add: true, user_remove: true },
            { id: 13, label: 'Weekly backup', dataset_plan: { id: 4, label: 'weekly_backup' }, user_add: true, user_remove: false },
          ],
        }),
      },
    });

    await page.goto('/app/datasets/42/plans');
    await expect(page.getByTestId('dataset.plans.summary')).toBeVisible();
    await expect(
      page.getByTestId(testInfo.project.name === 'mobile-chrome' ? 'dataset.plans.card.2' : 'dataset.plans.row.2')
    ).toBeVisible();
  });

  test('renders dataset expansion tab with history', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET datasets/42': () => ({
          dataset: {
            id: 42,
            full_name: 'tank/users/alice',
            name: 'alice',
            environment: { id: 7, label: 'Production' },
            dataset_expansion: { id: 9 },
            object_state: 'active',
            refquota: 20480,
            vps: { id: 300, hostname: 'mail.example.test' },
          },
        }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET dataset_expansions/9': () => ({
          dataset_expansion: {
            id: 9,
            state: 'active',
            added_space: 10240,
            original_refquota: 10240,
            enable_notifications: true,
            enable_shrink: true,
            stop_vps: true,
            over_refquota_seconds: 3600,
            max_over_refquota_seconds: 7200,
            created_at: '2026-02-27T10:00:00Z',
          },
        }),
        'GET dataset_expansions/9/history': () => ({
          histories: [
            {
              id: 1,
              added_space: 10240,
              original_refquota: 10240,
              new_refquota: 20480,
              created_at: '2026-02-27T10:00:00Z',
              admin: { id: 1, login: 'admin' },
            },
          ],
        }),
      },
    });

    await page.goto('/admin/datasets/42/expansion');
    await expect(page.getByTestId('dataset.expansion.summary')).toBeVisible();
    await expect(page.getByTestId('dataset.expansion.history.row.1')).toBeVisible();
  });

  test('hides admin-only temporary expansion entry points from a user without an active expansion', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installHaveApiMock(page, {
      user: { id: 10, login: 'alice', level: 1 },
      handlers: {
        'GET datasets/42': () => ({
          dataset: {
            id: 42,
            full_name: 'tank/users/alice/10802',
            name: '10802',
            environment: { id: 7, label: 'Production' },
            object_state: 'active',
            used: 33 * 1024,
            avail: 210 * 1024,
            refquota: 240 * 1024,
            vps: { id: 300, hostname: 'mail.example.test' },
          },
        }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
      },
    });

    await page.goto('/app/datasets/42');
    await expect(page.getByTestId('dataset.overview.space')).toBeVisible();
    await expect(page.getByTestId('dataset.overview.details')).toHaveCount(0);
    await expect(page.getByTestId('dataset.overview.expansion')).toHaveCount(0);
    await expect(page.locator('a[href="/app/datasets/42/expansion"]')).toHaveCount(0);
  });

  test('creates a temporary expansion from the admin page', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    let payload: Record<string, unknown> | undefined;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET datasets/42': () => ({
          dataset: {
            id: 42,
            full_name: 'tank/users/alice',
            name: 'alice',
            environment: { id: 7, label: 'Production' },
            object_state: 'active',
            refquota: 20480,
            vps: { id: 300, hostname: 'mail.example.test' },
          },
        }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'POST dataset_expansions': (ctx) => {
          payload = ctx.params;
          return { dataset_expansion: { id: 9 } };
        },
      },
    });

    await page.goto('/admin/datasets/42/expansion');
    await expect(page.getByTestId('dataset.expansion.create.form')).toBeVisible();
    await expect(page.getByTestId('dataset.expansion.form.added_space')).toHaveValue('20');
    await expect(page.getByTestId('dataset.expansion.form.max_over')).toHaveValue('30');

    await page.getByTestId('dataset.expansion.create.submit').click();
    await expect.poll(() => (payload?.dataset_expansion as Record<string, unknown> | undefined)).toEqual({
      dataset: 42,
      added_space: 20480,
      enable_notifications: true,
      enable_shrink: true,
      stop_vps: true,
      max_over_refquota_seconds: 2592000,
    });
  });

  test('redirects a user without an active expansion away from the admin-only form', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    let createRequests = 0;

    await installHaveApiMock(page, {
      user: { id: 10, login: 'alice', level: 1 },
      handlers: {
        'GET datasets/42': () => ({
          dataset: {
            id: 42,
            full_name: 'tank/users/alice/10802',
            name: '10802',
            environment: { id: 7, label: 'Production' },
            object_state: 'active',
            refquota: 20480,
          },
        }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'POST dataset_expansions': () => {
          createRequests += 1;
          return { dataset_expansion: { id: 9 } };
        },
      },
    });

    await page.goto('/app/datasets/42/expansion');
    await expect(page).toHaveURL('/app/datasets/42');
    await expect(page.getByTestId('dataset.expansion.create.form')).toHaveCount(0);
    expect(createRequests).toBe(0);
  });

  test('keeps an admin account in user mode read-only for an active expansion', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    const historyIncludes: Array<string | null> = [];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET datasets/42': () => ({
          dataset: {
            id: 42,
            full_name: 'tank/users/alice/10802',
            name: '10802',
            environment: { id: 7, label: 'Production' },
            dataset_expansion: { id: 9 },
            object_state: 'active',
            refquota: 20480,
          },
        }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'GET dataset_expansions/9': () => ({
          dataset_expansion: {
            id: 9,
            state: 'active',
            added_space: 10240,
            original_refquota: 10240,
            enable_notifications: true,
            enable_shrink: true,
            stop_vps: true,
            over_refquota_seconds: 3600,
            max_over_refquota_seconds: 7200,
            created_at: '2026-02-27T10:00:00Z',
          },
        }),
        'GET dataset_expansions/9/history': ({ searchParams }) => {
          historyIncludes.push(searchParams.get('_meta[includes]'));
          return {
            histories: [{
              id: 1,
              added_space: 10240,
              original_refquota: 10240,
              new_refquota: 20480,
              created_at: '2026-02-27T10:00:00Z',
              admin: { id: 1, login: 'must-not-render' },
            }],
          };
        },
      },
    });

    await page.goto('/app/datasets/42/expansion');
    await expect(page.getByTestId('dataset.expansion.summary')).toBeVisible();
    await expect(page.getByTestId('dataset.expansion.history.row.1')).toBeVisible();
    await expect(page.getByTestId('dataset.expansion.add_space.open')).toHaveCount(0);
    await expect(page.getByTestId('dataset.expansion.edit.open')).toHaveCount(0);
    await expect(page.getByText('must-not-render')).toHaveCount(0);
    await expect.poll(() => historyIncludes).toEqual([null]);
  });

  test('keeps support in admin mode away from admin-only expansion creation', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    let createRequests = 0;

    await installHaveApiMock(page, {
      user: { id: 5, login: 'support', level: 50 },
      handlers: {
        'GET datasets/42': () => ({
          dataset: {
            id: 42,
            full_name: 'tank/users/alice/10802',
            name: '10802',
            environment: { id: 7, label: 'Production' },
            object_state: 'active',
            refquota: 20480,
            vps: { id: 300, hostname: 'mail.example.test' },
          },
        }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
        'POST dataset_expansions': () => {
          createRequests += 1;
          return { dataset_expansion: { id: 9 } };
        },
      },
    });

    await page.goto('/admin/datasets/42/expansion');
    await expect(page).toHaveURL('/admin/datasets/42');
    await expect(page.getByTestId('dataset.expansion.create.form')).toHaveCount(0);
    await expect(page.locator('a[href="/admin/datasets/42/expansion"]')).toHaveCount(0);
    expect(createRequests).toBe(0);
  });

  test('keeps an active NAS expansion inside the NAS detail route', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installHaveApiMock(page, {
      user: { id: 10, login: 'alice', level: 1 },
      handlers: {
        'GET datasets/42': () => ({
          dataset: {
            id: 42,
            full_name: 'tank/users/alice/home',
            name: 'home',
            role: 'primary',
            dataset_expansion: { id: 9 },
            object_state: 'active',
            refquota: 20480,
          },
        }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
      },
    });

    await page.goto('/app/nas/42');
    await expect(page.getByTestId('dataset.overview.expansion.open')).toHaveAttribute(
      'href',
      '/app/nas/42/expansion',
    );
  });
});

import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, setUiSettingsLocalStorage } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile admin migration plans keep filters within the API contract', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await setUiSettingsLocalStorage(page, { language: 'en' });

  const migrationPlanRequests: Array<{ pageUrl: string; searchParams: URLSearchParams }> = [];
  let userSearchRequests = 0;

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET migration_plans': (ctx) => {
        migrationPlanRequests.push({
          pageUrl: page.url(),
          searchParams: new URLSearchParams(ctx.searchParams),
        });
        const state = ctx.searchParams.get('migration_plan[state]') ?? 'staged';
        return {
          migration_plans: [
            {
              id: state === 'running' ? 301 : 300,
              state,
              concurrency: 10,
              stop_on_error: true,
              send_mail: true,
              user: { id: 42, login: 'root' },
              created_at: '2026-09-14T00:00:00Z',
            },
          ],
        };
      },
      'GET users': () => {
        userSearchRequests += 1;
        return { users: [] };
      },
    },
  });

  // Establish a real previous history entry so Back/Forward can prove that
  // replace-normalization does not leave the misleading legacy URL behind.
  await page.goto('/admin/migration-plans?state=staged&limit=25');
  await expect(page.getByTestId('admin.migration_plans.page')).toBeVisible();
  await expect.poll(() => migrationPlanRequests.length).toBeGreaterThan(0);
  migrationPlanRequests.length = 0;

  await page.goto(
    '/admin/migration-plans?q=maintenance&q=drain&state=running&user=42&limit=25&from_id=400&page=3'
  );

  await expect(page.getByTestId('admin.migration_plans.page')).toBeVisible();
  await expect.poll(() => migrationPlanRequests.length).toBeGreaterThan(0);

  const firstCanonicalRequest = migrationPlanRequests[0];
  expect(firstCanonicalRequest?.searchParams.has('migration_plan[q]')).toBe(false);
  expect(firstCanonicalRequest?.searchParams.has('migration_plan[from_id]')).toBe(false);
  expect(firstCanonicalRequest?.searchParams.get('migration_plan[state]')).toBe('running');
  expect(firstCanonicalRequest?.searchParams.get('migration_plan[user]')).toBe('42');
  expect(firstCanonicalRequest?.searchParams.get('migration_plan[limit]')).toBe('25');
  const firstRequestPageUrl = new URL(firstCanonicalRequest?.pageUrl ?? 'https://invalid.test');
  expect(firstRequestPageUrl.searchParams.has('q')).toBe(false);
  expect(firstRequestPageUrl.searchParams.has('from_id')).toBe(false);
  expect(firstRequestPageUrl.searchParams.get('page')).not.toBe('3');

  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === '/admin/migration-plans' &&
      !url.searchParams.has('q') &&
      !url.searchParams.has('from_id') &&
      url.searchParams.get('state') === 'running' &&
      url.searchParams.get('user') === '42' &&
      url.searchParams.get('limit') === '25' &&
      url.searchParams.get('page') === '1'
    );
  });
  await expect(page.getByText('Unsupported search was removed', { exact: true })).toBeVisible();
  await expect(page.getByTestId('admin.migration_plans.chip.state')).toBeVisible();
  await expect(page.getByTestId('admin.migration_plans.chip.user')).toBeVisible();
  await expect(page.getByTestId('admin.migration_plans.chip.q')).toHaveCount(0);

  await page.getByRole('button', { name: 'Advanced filters' }).click();
  await expect(page.getByTestId('admin.migration_plans.advanced.drawer')).toBeVisible();
  await expect(page.getByTestId('admin.migration_plans.filter.state')).toBeVisible();
  await expect(page.getByTestId('admin.migration_plans.filter.user')).toBeVisible();
  await expect(page.getByTestId('admin.migration_plans.advanced.q')).toHaveCount(0);
  await page.getByTestId('drawer.close').click();

  await page.goBack();
  await expect(page).toHaveURL((url) => url.searchParams.get('state') === 'staged' && !url.searchParams.has('q'));
  await expect(page.getByTestId('admin.migration_plans.page')).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL((url) => url.searchParams.get('state') === 'running' && !url.searchParams.has('q'));
  await expect(page.getByTestId('admin.migration_plans.page')).toBeVisible();
  expect(
    migrationPlanRequests.every(
      (request) =>
        !request.searchParams.has('migration_plan[q]') &&
        !new URL(request.pageUrl).searchParams.has('q')
    )
  ).toBe(true);

  const smartFilter = page.getByTestId('admin.migration_plans.smart_filter.input');
  await smartFilter.fill('state:done user:42');
  await smartFilter.press('Enter');
  await expect(page).toHaveURL((url) => {
    return url.searchParams.get('state') === 'done' && url.searchParams.get('user') === '42';
  });
  await expect.poll(() => migrationPlanRequests.at(-1)?.searchParams.get('migration_plan[state]')).toBe('done');
  expect(migrationPlanRequests.at(-1)?.searchParams.get('migration_plan[user]')).toBe('42');

  await smartFilter.fill('maintenance');
  await expect.poll(() => userSearchRequests).toBeGreaterThan(0);
  await smartFilter.press('Enter');
  await expect(page.getByTestId('admin.migration_plans.chip.error.0')).toContainText(
    'Use state:, user: or a numeric ID for “maintenance”.'
  );
  expect(new URL(page.url()).searchParams.has('q')).toBe(false);

  // Invalid free text must not push a duplicate copy of the same URL. A
  // single Back therefore reaches the preceding supported-filter state.
  await page.goBack();
  await expect(page).toHaveURL((url) => url.searchParams.get('state') === 'running');
  await page.goForward();
  await expect(page).toHaveURL((url) => url.searchParams.get('state') === 'done');

  await smartFilter.fill('987');
  await expect(page.getByTestId('admin.migration_plans.smart.suggest.open')).toBeVisible();
  await smartFilter.press('Enter');
  await expect(page).toHaveURL(/\/admin\/migration-plans\/987$/);
});

import { expect, test, type Page } from '@playwright/test';
import { bootstrapVpsAdminWindow, installHaveApiMock, setUiSettingsLocalStorage } from '../../fixtures';
import type { VpsUserData } from '../../../src/lib/api/vpsUserData';

const template = (id: number, label = 'nginx'): VpsUserData => ({
  id, label, user: { id: 7 }, format: 'script', content: '#!/bin/sh',
  // Time order deliberately differs from ID order.
  updated_at: id % 2 ? '2026-09-23T12:00:00Z' : '2020-01-01T12:00:00Z',
});

async function setup(page: Page, admin: boolean, language: 'en' | 'cs', getRows: () => VpsUserData[]) {
  const requests: URL[] = [];
  const writes: string[] = [];
  // Observe all origins and methods, including the app shell.
  page.on('request', (req) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method())) writes.push(`${req.method()} ${req.url()}`);
  });
  await bootstrapVpsAdminWindow(page);
  await setUiSettingsLocalStorage(page, { language });
  const mock = await installHaveApiMock(page, {
    authorize: { user: { id: admin ? 1 : 7, login: 'tester', level: admin ? 99 : 1 } },
    handlers: {
      'GET users/7': () => ({ id: 7, login: 'owner', level: 1 }),
      'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
      'GET vps_user_data': ({ url, params }) => {
        requests.push(url);
        expect(params['vps_user_data[q]']).toBeUndefined();
        expect(params['vps_user_data[user]']).toBe(admin ? '7' : undefined);
        const format = params['vps_user_data[format]'];
        const from = Number(params['vps_user_data[from_id]'] ?? 0);
        const limit = Number(params['vps_user_data[limit]']);
        return getRows().filter((row) => row.user?.id === 7 && (!format || row.format === format) && row.id > from)
          .sort((a, b) => a.id - b.id).slice(0, limit);
      },
    },
  });
  return {
    requests, writes, mock,
    path: admin ? '/admin/users/7/user-data' : '/app/profile/user-data',
    prefix: admin ? 'admin.user.user_data' : 'profile.user_data',
  };
}

async function visibleIds(page: Page, prefix: string) {
  return page.locator(`tr[data-testid^="${prefix}.row."]`).evaluateAll((rows) => rows.map((row) =>
    Number(row.getAttribute('data-testid')!.split('.').at(-1))));
}

function expectWrites(page: Page, writes: string[], expected: string[] = []) {
  // The fixture app shell syncs local preferences on each reload. Allow only
  // that exact method/path on this test origin, never a resource mutation.
  const settingsWrite = `PUT ${new URL('/api/v7.0/webui_user_settings', page.url()).href}`;
  expect(writes.filter((request) => request !== settingsWrite)).toEqual(expected);
}

for (const admin of [false, true]) {
  for (const language of ['en', 'cs'] as const) {
    test(`@pr-smoke @pr-smoke-mobile ${admin ? 'admin' : 'member'} ${language}: scoped search, pages, URL history and advanced filters`, async ({ page }, info) => {
      if (info.project.name === 'mobile-chrome') await page.setViewportSize({ width: 390, height: 844 });
      let rows = Array.from({ length: 150 }, (_, i) => template((i + 1) * 3, i < 100 ? 'unrelated' : 'nginx'));
      rows.push({ ...template(9999), user: { id: 8 } }, { ...template(9998), format: 'cloudinit_config' });
      const { requests, writes, path, prefix } = await setup(page, admin, language, () => rows);
      await page.goto(`${path}?q=nginx&format=script&limit=25`);
      const expected = rows.filter((row) => row.label === 'nginx' && row.user?.id === 7 && row.format === 'script');
      const next = page.getByTestId(`${prefix}.pagination.next`);
      const prev = page.getByTestId(`${prefix}.pagination.prev`);
      await expect.poll(() => visibleIds(page, prefix)).toEqual(expected.slice(0, 25).map((row) => row.id));
      await expect(next).toBeEnabled();
      expect(requests.length).toBe(2);
      await next.click();
      await expect.poll(() => visibleIds(page, prefix)).toEqual(expected.slice(25).map((row) => row.id));
      await expect(next).toBeDisabled();
      await expect(page).toHaveURL(/from_id=375/);
      await page.reload();
      await expect(page.getByTestId(`${prefix}.row.378`)).toBeVisible();
      await prev.click();
      await expect(page.getByTestId(`${prefix}.row.303`)).toBeVisible();
      await page.goBack();
      await expect(page.getByTestId(`${prefix}.row.378`)).toBeVisible();
      await page.goForward();
      await expect(page.getByTestId(`${prefix}.row.303`)).toBeVisible();

      // A refreshed preceding page must replace its old forward cursor.
      rows = rows.filter((row) => ![303, 306, 309].includes(row.id));
      await page.reload();
      await expect(page.getByTestId(`${prefix}.row.312`)).toBeVisible();
      await next.click();
      await expect(page).toHaveURL(/from_id=384/);
      await expect(page.getByTestId(`${prefix}.row.387`)).toBeVisible();

      await page.getByTestId(`${prefix}.filters.advanced`).click();
      const search = page.getByTestId(`${prefix}.filters.q.advanced`);
      const format = page.getByTestId(`${prefix}.filters.format`);
      await expect(search).toHaveAccessibleName(language === 'cs' ? 'Vyhledat' : 'Search');
      await expect(format).toHaveAccessibleName(/.+/);
      const count = requests.length;
      await search.fill('a query that should not make requests while typing');
      await search.pressSequentially(' more text');
      expect(requests).toHaveLength(count);
      await search.fill('#450');
      await page.getByTestId(`${prefix}.filters.apply`).click();
      await expect.poll(() => visibleIds(page, prefix)).toEqual([450]);
      await expect(page).not.toHaveURL(/from_id=/);
      await expect(next).toBeDisabled();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      for (const url of requests) expect(url.searchParams.get('vps_user_data[format]')).toBe('script');
      expectWrites(page, writes);
    });
  }
}

test('search cap, inconsistent order and HTTP errors are explicit and retryable', async ({ page }) => {
  let rows = Array.from({ length: 1001 }, (_, i) => template(i + 1, 'unrelated'));
  const { path, prefix, mock, writes } = await setup(page, false, 'en', () => rows);
  await page.goto(`${path}?q=absent`);
  await expect(page.getByTestId(`${prefix}.error`)).toContainText('1,000');
  await expect(page.getByTestId(`${prefix}.empty`)).toHaveCount(0);
  rows = rows.slice(0, 1000);
  await page.getByTestId(`${prefix}.retry`).click();
  await expect(page.getByTestId(`${prefix}.empty`)).toBeVisible();

  mock.addHandler('GET vps_user_data', () => [template(10), template(2)]);
  await page.reload();
  await expect(page.getByTestId(`${prefix}.error`)).toContainText('inconsistent');
  mock.addHandler('GET vps_user_data', () => ({ status: 500, contentType: 'application/json', body: JSON.stringify({ status: false, message: 'Temporarily unavailable' }) }));
  await page.getByTestId(`${prefix}.retry`).click();
  await expect(page.getByTestId(`${prefix}.error`)).toContainText('Temporarily unavailable');
  mock.addHandler('GET vps_user_data', () => []);
  await page.getByTestId(`${prefix}.retry`).click();
  await expect(page.getByTestId(`${prefix}.empty`)).toBeVisible();
  expectWrites(page, writes);
});

test('deleting the only row on the last page returns to a usable preceding page', async ({ page }) => {
  let rows = Array.from({ length: 26 }, (_, i) => template(i + 1));
  const { path, prefix, mock, writes } = await setup(page, false, 'en', () => rows);
  mock.addHandler('DELETE vps_user_data/26', () => { rows = rows.filter((row) => row.id !== 26); return null; });
  await page.goto(`${path}?limit=25`);
  await page.getByTestId(`${prefix}.pagination.next`).click();
  await page.getByTestId(`${prefix}.row.26.delete`).click();
  await page.getByTestId(`${prefix}.delete.confirm.confirm`).click();
  await expect.poll(() => visibleIds(page, prefix)).toEqual(rows.slice(0, 25).map((row) => row.id));
  await expect(page.getByTestId(`${prefix}.pagination.next`)).toBeDisabled();
  await expect(page).not.toHaveURL(/from_id=/);
  expectWrites(page, writes, [`DELETE ${new URL('/api/v7.0/vps_user_data/26', page.url()).href}`]);
});

test('applying a different format aborts the obsolete scan', async ({ page }) => {
  const { path, prefix, mock, requests, writes } = await setup(page, false, 'en', () => []);
  let release: () => void = () => {};
  const heldResponse = new Promise<void>((resolve) => { release = resolve; });
  mock.addHandler('GET vps_user_data', async ({ url, params }) => {
    requests.push(url);
    if (params['vps_user_data[format]'] === 'script') {
      await heldResponse;
      return Array.from({ length: 100 }, (_, i) => template(i + 1, 'old scope'));
    }
    return [{ ...template(2001, 'new scope'), format: 'cloudinit_config' }];
  });
  const initial = page.waitForRequest((req) => req.url().includes('/vps_user_data?'));
  await page.goto(`${path}?q=absent&format=script`);
  const obsolete = await initial;
  await page.getByTestId(`${prefix}.filters.advanced`).click();
  await page.getByTestId(`${prefix}.filters.q.advanced`).fill('new scope');
  await page.getByTestId(`${prefix}.filters.format`).selectOption('cloudinit_config');
  const failed = page.waitForEvent('requestfailed', (req) => req === obsolete);
  try {
    await page.getByTestId(`${prefix}.filters.apply`).click();
    expect((await failed).failure()?.errorText).toContain('ABORTED');
  } finally {
    release();
  }
  await expect(page.getByTestId(`${prefix}.row.2001`)).toBeVisible();
  expect(requests.filter((url) => url.searchParams.get('vps_user_data[format]') === 'script')).toHaveLength(1);
  expectWrites(page, writes);
});

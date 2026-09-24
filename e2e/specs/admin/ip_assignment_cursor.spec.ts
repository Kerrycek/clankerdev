import { expect, test } from '../../fixtures/vpsadmin-window';
import { bootstrapVpsAdminWindow } from '../../fixtures/bootstrap';
import { failEnvelope, installHaveApiMock, jsonFulfill } from '../../fixtures/haveapi';
import { setUiSettingsLocalStorage } from '../../fixtures/uiSettings';

const prefix = 'admin.ip_assignments';
const base = '/admin/networking/ip-address-assignments';
// API44 tuple ordering: timestamps have ties, while IDs are not monotonic.
const assignments = Array.from({ length: 75 }, (_, i) => ({
  id: ((i * 29) % 75) + 1,
  from_date: new Date(Date.UTC(2026, 0, 1, 0, Math.floor(i / 3))).toISOString(),
  ip_addr: '192.0.2.10', ip_prefix: 32,
  user: { id: 7, login: 'fixture-member' },
  vps: { id: 42, hostname: 'fixture-vps' },
}));

for (const language of ['cs', 'en'] as const) {
  for (const order of ['oldest', 'newest'] as const) {
    test(`@pr-smoke @pr-smoke-mobile IP audit traverses tied dates and unrelated IDs (${language}, ${order})`, async ({ page }) => {
      await setUiSettingsLocalStorage(page, { language });
      const rows = [...assignments].sort((a, b) =>
        (a.from_date.localeCompare(b.from_date) || a.id - b.id) * (order === 'oldest' ? 1 : -1));
      const cursors: number[] = [];
      const writes: string[] = [];
      page.on('request', request => {
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())
          && !request.url().endsWith('/webui_user_settings')) writes.push(request.url());
      });
      await installHaveApiMock(page, {
        user: { id: 1, login: 'admin', level: 99 },
        handlers: {
          'GET ip_address_assignments': ({ searchParams }) => {
            const param = (key: string) => searchParams.get(`ip_address_assignment[${key}]`);
            expect(param('order')).toBe(order);
            expect(param('user')).toBe('7');
            expect(param('vps')).toBe('42');
            expect(param('ip_addr')).toBe('192.0.2.10');
            expect(param('active')).toBe('true');
            expect(param('limit')).toBe('26');
            const cursor = Number(param('from_id') ?? 0);
            cursors.push(cursor);
            const start = cursor ? rows.findIndex(row => row.id === cursor) + 1 : 0;
            return { ip_address_assignments: rows.slice(start, start + 26) };
          },
        },
      });
      await bootstrapVpsAdminWindow(page);
      await page.goto(`${base}?limit=25&order=${order}&user=7&vps=42&ip_addr=192.0.2.10&active=true`);
      const visible = () => page.locator(`[data-testid^="${prefix}.row."]:not([data-testid$=".dot"])`);
      for (let p = 0; p < 3; p++) {
        const expected = rows.slice(p * 25, (p + 1) * 25).map(row => `${prefix}.row.${row.id}`);
        await expect(visible()).toHaveCount(25);
        await expect.poll(() => visible().evaluateAll(elements => elements.map(el => el.getAttribute('data-testid')))).toEqual(expected);
        if (p < 2) await page.getByTestId(`${prefix}.pagination.next`).click();
      }
      await expect(page.getByTestId(`${prefix}.pagination.next`)).toBeDisabled();
      expect(cursors).toEqual([0, rows[24].id, rows[49].id]);
      await page.reload();
      await expect(page.getByTestId(`${prefix}.row.${rows[50].id}`)).toBeVisible();
      await expect(page.getByTestId(`${prefix}.pagination.next`)).toBeDisabled();
      await page.getByTestId(`${prefix}.pagination.prev`).click();
      await expect(page.getByTestId(`${prefix}.row.${rows[25].id}`)).toBeVisible();
      await page.goBack();
      await expect(page.getByTestId(`${prefix}.row.${rows[50].id}`)).toBeVisible();
      expect(writes).toEqual([]);
    });
  }

  test(`@pr-smoke @pr-smoke-mobile IP audit recovers cursor errors and keeps filters (${language})`, async ({ page }) => {
    await setUiSettingsLocalStorage(page, { language });
    let fail = true;
    const cursors: number[] = [];
    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 99 },
      handlers: {
        'GET ip_address_assignments': ({ searchParams }) => {
          const param = (key: string) => searchParams.get(`ip_address_assignment[${key}]`);
          expect(param('user')).toBe('7');
          expect(param('active')).toBe('false');
          expect(param('order')).toBe('oldest');
          const cursor = Number(param('from_id') ?? 0);
          cursors.push(cursor);
          if (cursor && fail) return jsonFulfill(failEnvelope('Invalid cursor', { from_id: ['invalid'] }), 400);
          return { ip_address_assignments: cursor ? [] : [assignments[0]] };
        },
      },
    });
    await bootstrapVpsAdminWindow(page);
    await page.goto(`${base}?limit=25&from_id=999&page=2&user=7&active=false&order=oldest`);
    await expect(page.getByTestId(`${prefix}.error`)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.pagination.next`)).toBeDisabled();
    fail = false;
    await page.getByTestId(`${prefix}.error.primary`).click();
    // Empty cursor results retain a way back; the whole pager must not vanish.
    await expect(page.getByTestId(`${prefix}.error`)).toHaveCount(0);
    await expect(page.getByTestId(`${prefix}.pagination.prev`)).toBeEnabled();
    await page.getByTestId(`${prefix}.pagination.prev`).click();
    await expect(page.getByTestId(`${prefix}.row.${assignments[0].id}`)).toBeVisible();
    expect(cursors.at(-1)).toBe(0);
    fail = true;
    await page.goto(`${base}?limit=25&from_id=999&page=2&user=7&active=false&order=oldest`);
    await page.getByTestId(`${prefix}.error.secondary`).click();
    await expect(page.getByTestId(`${prefix}.row.${assignments[0].id}`)).toBeVisible();
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page).toHaveURL(/user=7/);
    await expect(page).toHaveURL(/active=false/);
  });
}

test('@pr-smoke @pr-smoke-mobile IP audit rebuilds a visited forward cursor after a changed first page', async ({ page }) => {
  let rows = [...assignments].sort((a, b) => a.from_date.localeCompare(b.from_date) || a.id - b.id);
  const cursors: number[] = [];
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 99 },
    handlers: {
      'GET ip_address_assignments': ({ searchParams }) => {
        const cursor = Number(searchParams.get('ip_address_assignment[from_id]') ?? 0);
        cursors.push(cursor);
        const start = cursor ? rows.findIndex(row => row.id === cursor) + 1 : 0;
        return { ip_address_assignments: rows.slice(start, start + 26) };
      },
    },
  });
  await bootstrapVpsAdminWindow(page);
  await page.goto(`${base}?limit=25&order=oldest`);
  await page.getByTestId(`${prefix}.pagination.next`).click();
  await expect(page.getByTestId(`${prefix}.row.${rows[25].id}`)).toBeVisible();
  await page.getByTestId(`${prefix}.pagination.prev`).click();
  await expect(page.getByTestId(`${prefix}.row.${rows[0].id}`)).toBeVisible();
  rows = rows.slice(1);
  await page.reload();
  await expect(page.getByTestId(`${prefix}.row.${rows[24].id}`)).toBeVisible();
  await page.getByTestId(`${prefix}.pagination.next`).click();
  await expect(page.getByTestId(`${prefix}.row.${rows[25].id}`)).toBeVisible();
  expect(cursors.at(-1)).toBe(rows[24].id);
});

test('@pr-smoke @pr-smoke-mobile member cannot fetch the administrative IP audit', async ({ page }) => {
  await setUiSettingsLocalStorage(page, { language: 'en' });
  let reads = 0;
  await installHaveApiMock(page, {
    user: { id: 7, login: 'member', level: 1 },
    handlers: {
      'GET ip_address_assignments': () => { reads++; return { ip_address_assignments: [] }; },
    },
  });
  await bootstrapVpsAdminWindow(page);
  await page.goto(base);
  await expect(page.getByTestId(`${prefix}.page`)).toHaveCount(0);
  await expect(page.getByText('Admin access required', { exact: true })).toBeVisible();
  expect(reads).toBe(0);
});

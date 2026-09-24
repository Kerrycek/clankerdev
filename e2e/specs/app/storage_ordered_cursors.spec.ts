import { expect, test } from '../../fixtures/vpsadmin-window';
import { bootstrapVpsAdminWindow } from '../../fixtures/bootstrap';
import { failEnvelope, installHaveApiMock, jsonFulfill } from '../../fixtures/haveapi';
import { setUiSettingsLocalStorage } from '../../fixtures/uiSettings';

const dataset = { id: 10, name: 'fixture', full_name: 'tank/fixture', user: { id: 7, login: 'member' }, object_state: 'active' };
const records = Array.from({ length: 75 }, (_, i) => ({
  id: ((i * 29) % 75) + 100,
  full_name: `tank/${String(i).padStart(3, '0')}`,
  name: `snapshot-${i}`, label: `Snapshot ${i}`,
  created_at: new Date(Date.UTC(2026, 0, 1, 0, Math.floor(i / 3))).toISOString(),
  user: { id: 7, login: 'member' }, object_state: 'active',
}));

for (const kind of ['datasets', 'snapshots'] as const) {
  for (const role of ['admin', 'member'] as const) {
    const language = role === 'admin' ? 'cs' : 'en';
    test(`@pr-smoke @pr-smoke-mobile ${kind} follows ordered anchors with ${role} scope (${language})`, async ({ page }, info) => {
      await setUiSettingsLocalStorage(page, { language });
      await bootstrapVpsAdminWindow(page);
      const mobile = info.project.name === 'mobile-chrome';
      const prefix = kind === 'datasets' ? 'datasets' : 'dataset.snapshots';
      const pager = `${prefix}.pagination.${mobile ? 'mobile' : 'desktop'}`;
      const item = (id: number) => page.getByTestId(`${prefix}.${mobile ? 'card' : 'row'}.${id}`);
      const rows = [...records].sort((a, b) => kind === 'datasets'
        ? a.full_name.localeCompare(b.full_name) || a.id - b.id
        : a.created_at.localeCompare(b.created_at) || a.id - b.id);
      const ns = kind === 'datasets' ? 'dataset' : 'snapshot';
      const cursors: number[] = [];
      let ownerFilterCleared = false;
      await installHaveApiMock(page, {
        user: { id: 7, login: role, level: role === 'admin' ? 99 : 1 },
        handlers: {
          'GET datasets/10': () => dataset,
          [kind === 'datasets' ? 'GET datasets' : 'GET datasets/10/snapshots']: ({ searchParams }) => {
            const cursor = Number(searchParams.get(`${ns}[from_id]`) ?? 0);
            expect(searchParams.get(`${ns}[limit]`)).toBe('26');
            if (kind === 'datasets') {
              expect(searchParams.get('dataset[user]')).toBe(role === 'admin' && !ownerFilterCleared ? '7' : null);
              if (role === 'member') expect(searchParams.get('dataset[role]')).toBe('primary');
            }
            cursors.push(cursor);
            const start = cursor ? rows.findIndex(row => row.id === cursor) + 1 : 0;
            return { [kind]: rows.slice(start, start + 26) };
          },
        },
      });
      const base = kind === 'datasets' && role === 'member' ? '/app/nas'
        : `/${role === 'admin' ? 'admin' : 'app'}/datasets${kind === 'snapshots' ? '/10/snapshots' : ''}`;
      await page.goto(`${base}?limit=25${kind === 'datasets' ? (role === 'admin' ? '&user=7' : '&user=999') : ''}`);
      for (let p = 0; p < 3; p++) {
        await expect(item(rows[p * 25].id)).toBeVisible();
        const visible = page.locator(`[data-testid^="${prefix}.${mobile ? 'card' : 'row'}."]:visible`);
        // Ignore nested status-dot test IDs; compare every actual row in API order.
        const ids = () => visible.evaluateAll(elements => elements.map(el => el.getAttribute('data-testid')).filter(id => /^.*\.(row|card)\.\d+$/.test(id ?? '')));
        await expect.poll(ids).toEqual(rows.slice(p * 25, (p + 1) * 25).map(row => `${prefix}.${mobile ? 'card' : 'row'}.${row.id}`));
        if (p < 2) await page.getByTestId(`${pager}.next`).click();
      }
      await expect(page.getByTestId(`${pager}.next`)).toBeDisabled();
      expect(cursors).toEqual([0, rows[24].id, rows[49].id]);
      await page.reload();
      await expect(item(rows[50].id)).toBeVisible();
      await expect(page.getByTestId(`${pager}.next`)).toBeDisabled();
      await page.getByTestId(`${pager}.prev`).click();
      await expect(item(rows[25].id)).toBeVisible();
      await page.goBack();
      await expect(item(rows[50].id)).toBeVisible();
      if (kind === 'datasets' && role === 'admin') {
        ownerFilterCleared = true;
        await page.getByTestId('datasets.filter.clear').click();
        await expect(page).not.toHaveURL(/from_id=|user=/);
        await expect(item(rows[0].id)).toBeVisible();
        ownerFilterCleared = false;
        await page.goBack();
        await expect(page).toHaveURL(/user=7/);
        await expect(item(rows[50].id)).toBeVisible();
      }
    });
  }

  test(`@pr-smoke @pr-smoke-mobile ${kind} retries invalid anchors and recovers empty pages`, async ({ page }, info) => {
    await setUiSettingsLocalStorage(page, { language: 'en' });
    await bootstrapVpsAdminWindow(page);
    let fail = true;
    const mobile = info.project.name === 'mobile-chrome';
    const prefix = kind === 'datasets' ? 'datasets' : 'dataset.snapshots';
    const error = kind === 'datasets' ? 'datasets.list.error' : 'dataset.snapshots.error';
    const base = `/admin/datasets${kind === 'snapshots' ? '/10/snapshots' : ''}`;
    const url = `${base}?limit=25&from_id=999&page=2${kind === 'datasets' ? '&user=7' : ''}`;
    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 99 },
      handlers: {
        'GET datasets/10': () => dataset,
        [kind === 'datasets' ? 'GET datasets' : 'GET datasets/10/snapshots']: ({ searchParams }) => {
          const cursor = searchParams.get(`${kind === 'datasets' ? 'dataset' : 'snapshot'}[from_id]`);
          if (kind === 'datasets') expect(searchParams.get('dataset[user]')).toBe('7');
          if (cursor && fail) return jsonFulfill(failEnvelope('Invalid pagination cursor'), 400);
          return { [kind]: cursor ? [] : [records[0]] };
        },
      },
    });
    await page.goto(url);
    await expect(page.getByTestId(error)).toBeVisible();
    fail = false;
    await page.getByTestId(`${error}.primary`).click();
    await expect(page.getByTestId(error)).toHaveCount(0);
    if (kind === 'datasets') await page.getByTestId('datasets.pagination.empty.restart').click();
    else await page.getByTestId(`${prefix}.pagination.${mobile ? 'mobile' : 'desktop'}.prev`).click();
    await expect(page.getByTestId(`${prefix}.${mobile ? 'card' : 'row'}.${records[0].id}`)).toBeVisible();
    fail = true;
    await page.goto(url);
    await page.getByTestId(`${error}.secondary`).click();
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId(`${prefix}.${mobile ? 'card' : 'row'}.${records[0].id}`)).toBeVisible();
    if (kind === 'datasets') await expect(page).toHaveURL(/user=7/);
  });
}

for (const kind of ['datasets', 'snapshots'] as const) {
  test(`@pr-smoke @pr-smoke-mobile ${kind} replaces a visited forward edge after refresh`, async ({ page }, info) => {
    await bootstrapVpsAdminWindow(page);
    let rows = [...records].sort((a, b) => kind === 'datasets'
      ? a.full_name.localeCompare(b.full_name) || a.id - b.id
      : a.created_at.localeCompare(b.created_at) || a.id - b.id);
    const mobile = info.project.name === 'mobile-chrome';
    const prefix = kind === 'datasets' ? 'datasets' : 'dataset.snapshots';
    const pager = `${prefix}.pagination.${mobile ? 'mobile' : 'desktop'}`;
    const item = (id: number) => page.getByTestId(`${prefix}.${mobile ? 'card' : 'row'}.${id}`);
    const cursors: number[] = [];
    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 99 },
      handlers: {
        'GET datasets/10': () => dataset,
        [kind === 'datasets' ? 'GET datasets' : 'GET datasets/10/snapshots']: ({ searchParams }) => {
          const cursor = Number(searchParams.get(`${kind === 'datasets' ? 'dataset' : 'snapshot'}[from_id]`) ?? 0);
          cursors.push(cursor);
          const start = cursor ? rows.findIndex(row => row.id === cursor) + 1 : 0;
          return { [kind]: rows.slice(start, start + 26) };
        },
      },
    });
    await page.goto(`/admin/datasets${kind === 'snapshots' ? '/10/snapshots' : ''}?limit=25`);
    await page.getByTestId(`${pager}.next`).click();
    await expect(item(rows[25].id)).toBeVisible();
    await page.getByTestId(`${pager}.prev`).click();
    await expect(item(rows[0].id)).toBeVisible();
    rows = rows.slice(1);
    await page.reload();
    await expect(item(rows[24].id)).toBeVisible();
    await page.getByTestId(`${pager}.next`).click();
    await expect(item(rows[25].id)).toBeVisible();
    expect(cursors.at(-1)).toBe(rows[24].id);
    await page.getByTestId(`${pager}.prev`).click();
    rows = rows.slice(0, 25);
    await page.reload();
    await expect(item(rows[24].id)).toBeVisible();
    await expect(page.getByTestId(`${pager}.next`)).toBeDisabled();
  });
}

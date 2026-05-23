import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke Admin cluster DNS resolvers', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const locations = [
      { id: 1, label: 'Praha' },
      { id: 2, label: 'Brno' },
    ];

    const resolvers: any[] = [
      { id: 1, label: 'Universal', ip_addr: '1.1.1.1,8.8.8.8', is_universal: true, location: null },
      { id: 2, label: 'Praha local', ip_addr: '10.0.0.53', is_universal: false, location: locations[0] },
    ];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET locations': () => ({ locations, _meta: { total_count: locations.length } }),
        'GET dns_resolvers': ({ searchParams }) => {
          const q = (searchParams.get('dns_resolver[q]') || '').toLowerCase();
          const uni = searchParams.get('dns_resolver[is_universal]');
          const loc = searchParams.get('dns_resolver[location]');

          let data = resolvers;
          if (q) data = data.filter((r) => String(r.label).toLowerCase().includes(q) || String(r.ip_addr).toLowerCase().includes(q));
          if (uni === 'true' || uni === 'false') data = data.filter((r) => String(Boolean(r.is_universal)) === uni);
          if (loc) data = data.filter((r) => r.location && String(r.location.id) === String(loc));

          return { dns_resolvers: data, _meta: { total_count: data.length } };
        },
        'POST dns_resolvers': () => {
          const id = resolvers.length + 1;
          const created = { id, label: `New ${id}`, ip_addr: '9.9.9.9', is_universal: true, location: null };
          resolvers.unshift(created);
          return { dns_resolver: created };
        },
        'PUT dns_resolvers/1': () => ({ dns_resolver: resolvers.find((r) => r.id === 1), _meta: { state_id: 123 } }),
        'DELETE dns_resolvers/1': () => ({ _meta: { state_id: 456 } }),
      },
    });
  });

  test('lists and uses namespaced filters', async ({ page }) => {
    const reqs: URL[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET') return;
      const url = new URL(req.url());
      if (!url.pathname.endsWith('/dns_resolvers')) return;
      reqs.push(url);
    });

    await page.goto('/admin/cluster/dns-resolvers');
    await expect(page.getByTestId('admin.cluster.dns_resolvers.page')).toBeVisible();
    await expect(page.getByTestId('admin.cluster.dns_resolvers.row.1')).toBeVisible();

    await page.getByTestId('admin.cluster.dns_resolvers.search.input').fill('praha');
    await page.getByTestId('admin.cluster.dns_resolvers.search.input').press('Enter');
    await expect(page.getByTestId('admin.cluster.dns_resolvers.row.2')).toBeVisible();

    expect(reqs.length).toBeGreaterThan(0);
    const last = reqs[reqs.length - 1];
    expect(last.searchParams.get('dns_resolver[q]')).toBe('praha');
  });

  test('creates, edits and deletes', async ({ page }) => {
    const posts: any[] = [];
    const puts: any[] = [];
    const dels: any[] = [];

    page.on('request', (req) => {
      const url = new URL(req.url());
      if (req.method() === 'POST' && url.pathname.endsWith('/dns_resolvers')) posts.push(req.postDataJSON());
      if (req.method() === 'PUT' && url.pathname.endsWith('/dns_resolvers/1')) puts.push(req.postDataJSON());
      if (req.method() === 'DELETE' && url.pathname.endsWith('/dns_resolvers/1')) dels.push(req.postDataJSON());
    });

    await page.goto('/admin/cluster/dns-resolvers');

    await page.getByTestId('admin.cluster.dns_resolvers.create').click();
    await expect(page.getByTestId('admin.cluster.dns_resolvers.editor')).toBeVisible();

    await page.getByTestId('admin.cluster.dns_resolvers.editor.label').fill('New resolver');
    await page.getByTestId('admin.cluster.dns_resolvers.editor.ip').fill('9.9.9.9');
    await page.getByTestId('admin.cluster.dns_resolvers.editor.save').click();

    expect(posts.length).toBeGreaterThan(0);
    expect(posts[posts.length - 1]).toEqual({ dns_resolver: { ip_addr: '9.9.9.9', label: 'New resolver', is_universal: true } });

    // Edit first resolver
    await page.getByTestId('admin.cluster.dns_resolvers.row.1.edit').click();
    await page.getByTestId('admin.cluster.dns_resolvers.editor.label').fill('Universal edited');
    await page.getByTestId('admin.cluster.dns_resolvers.editor.save').click();

    expect(puts.length).toBeGreaterThan(0);
    expect(puts[puts.length - 1]).toEqual({
      dns_resolver: { ip_addr: '1.1.1.1,8.8.8.8', label: 'Universal edited', is_universal: true },
    });

    await page.getByTestId('admin.cluster.dns_resolvers.row.1.delete').click();
    await expect(page.getByTestId('admin.cluster.dns_resolvers.delete')).toBeVisible();

    await page.getByTestId('admin.cluster.dns_resolvers.delete.force').click();
    await page.getByTestId('admin.cluster.dns_resolvers.delete.confirm').click();

    expect(dels.length).toBeGreaterThan(0);
    expect(dels[dels.length - 1]).toEqual({ dns_resolver: { force: true } });
  });
});

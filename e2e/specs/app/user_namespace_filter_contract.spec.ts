import type { Page } from '@playwright/test';

import { expect, test } from '../../fixtures/bootstrap';
import { setupHaveApiMock, type HaveApiMockUser } from '../../fixtures/haveapi';
import { withAppUrl } from '../../fixtures/url';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

type NamespaceIndexRequest = {
  kind: 'namespace' | 'map';
  fields: Record<string, string>;
  includes: string | null;
};

const USER_NAMESPACE_INDEX_FIELDS = new Set(['limit', 'from_id', 'size', 'user', 'block_count']);
const USER_NAMESPACE_MAP_INDEX_FIELDS = new Set(['limit', 'from_id', 'user', 'user_namespace']);
const READ_ONLY_CHROME_HANDLERS = {
  'GET webui_user_settings': () => ({
    webui_user_settings: [{ id: 1, namespace: 'ui', key: 'settings', value: '{}' }],
  }),
};

function readIndexFields(
  searchParams: URLSearchParams,
  kind: NamespaceIndexRequest['kind']
): Record<string, string> {
  const namespace = kind === 'namespace' ? 'user_namespace' : 'user_namespace_map';
  const allowed = kind === 'namespace' ? USER_NAMESPACE_INDEX_FIELDS : USER_NAMESPACE_MAP_INDEX_FIELDS;
  const fields: Record<string, string> = {};
  const unsupported: string[] = [];

  for (const [key, value] of searchParams.entries()) {
    const match = new RegExp(`^${namespace}\\[([^\\]]+)\\]$`).exec(key);
    if (!match) continue;
    const field = match[1];
    if (!field || !allowed.has(field)) unsupported.push(field || key);
    else fields[field] = value;
  }

  if (unsupported.length > 0) {
    throw new Error(`Unexpected ${namespace} index fields: ${unsupported.sort().join(', ')}`);
  }
  return fields;
}

async function setupNamespaceApi(page: Page, user: HaveApiMockUser, vpsOwnerId = user.id) {
  const requests: NamespaceIndexRequest[] = [];
  const vps = {
    id: 123,
    hostname: 'contract.example',
    object_state: 'active',
    is_running: true,
    enable_network: true,
    manage_hostname: true,
    cpu: 2,
    memory: 2048,
    swap: 0,
    diskspace: 20_480,
    cgroup_version: 'cgroup_any',
    allow_admin_modifications: true,
    user: { id: vpsOwnerId, login: `owner-${vpsOwnerId}` },
    node: { id: 1, domain_name: 'node.example', location: { id: 2, label: 'Prague' } },
    os_template: { id: 6, label: 'Debian 12' },
  };

  await setupHaveApiMock(page, {
    user,
    handlers: {
      ...READ_ONLY_CHROME_HANDLERS,
      'GET user_namespaces': ({ searchParams }) => {
        requests.push({
          kind: 'namespace',
          fields: readIndexFields(searchParams, 'namespace'),
          includes: searchParams.get('_meta[includes]'),
        });
        return { user_namespaces: [] };
      },
      'GET user_namespace_maps': ({ searchParams }) => {
        requests.push({
          kind: 'map',
          fields: readIndexFields(searchParams, 'map'),
          includes: searchParams.get('_meta[includes]'),
        });
        return { user_namespace_maps: [] };
      },
      'GET vpses/123': () => ({ vps }),
      'GET dns_resolvers': () => ({ dns_resolvers: [] }),
    },
  });

  return requests;
}

function requestsOfKind(requests: NamespaceIndexRequest[], kind: NamespaceIndexRequest['kind']) {
  return requests.filter((request) => request.kind === kind);
}

function observeMutations(page: Page): string[] {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
      const url = new URL(request.url());
      writes.push(`${request.method()} ${url.pathname}${url.search}`);
    }
  });
  return writes;
}

test.describe('User namespace index contracts', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const viewport = testInfo.project.name === 'mobile-chrome'
      ? { width: 390, height: 844 }
      : { width: 1_440, height: 1_000 };
    await page.setViewportSize(viewport);
    expect(page.viewportSize()).toEqual(viewport);
  });

  test('@pr-smoke @pr-smoke-mobile ordinary profile canonicalizes stale filters before its first owner-scoped GET', async ({
    page,
  }) => {
    const requests = await setupNamespaceApi(page, { id: 42, login: 'member', level: 1 });

    await page.goto(
      withAppUrl(
        '/app/profile/user-namespaces/namespaces?q=legacy&user=84&size=65536&block_count=3&limit=25&from_id=900&page=4'
      )
    );
    await expect(page.getByTestId('profile.userns.namespaces.empty')).toBeVisible();

    expect(requestsOfKind(requests, 'namespace')).toEqual([
      { kind: 'namespace', fields: { limit: '26', size: '65536' }, includes: null },
    ]);
    const namespaceUrl = new URL(page.url());
    expect(namespaceUrl.searchParams.get('size')).toBe('65536');
    expect(namespaceUrl.searchParams.get('limit')).toBe('25');
    for (const key of ['q', 'user', 'block_count', 'from_id']) {
      expect(namespaceUrl.searchParams.get(key), `${key} must be removed before UserNamespace::Index`).toBeNull();
    }

    await page.getByTestId('profile.userns.namespaces.search.input').fill('q:legacy');
    await page.getByTestId('profile.userns.namespaces.search.input').press('Enter');
    await expect(page.getByTestId('profile.userns.namespaces.filters.chips')).toBeVisible();
    await page.waitForTimeout(100);
    expect(requestsOfKind(requests, 'namespace')).toHaveLength(1);

    await page.goto(
      withAppUrl(
        '/app/profile/user-namespaces/maps?q=default&user=84&user_namespace=101&limit=25&from_id=800&page=4'
      )
    );
    await expect(page.getByTestId('profile.userns.maps.empty')).toBeVisible();

    expect(requestsOfKind(requests, 'map')).toEqual([
      {
        kind: 'map',
        fields: { limit: '26', user_namespace: '101' },
        includes: 'user_namespace',
      },
    ]);
    const mapUrl = new URL(page.url());
    expect(mapUrl.searchParams.get('user_namespace')).toBe('101');
    expect(mapUrl.searchParams.get('limit')).toBe('25');
    for (const key of ['q', 'user', 'from_id']) {
      expect(mapUrl.searchParams.get(key), `${key} must be removed before UserNamespaceMap::Index`).toBeNull();
    }

    await page.getByTestId('profile.userns.maps.search.input').fill('default');
    await page.getByTestId('profile.userns.maps.search.input').press('Enter');
    await expect(page.getByTestId('profile.userns.maps.smart.help')).toBeVisible();
    await page.waitForTimeout(100);
    expect(requestsOfKind(requests, 'map')).toHaveLength(1);
  });

  test('@pr-smoke @pr-smoke-mobile administrator self and global views send the exact owner and supported filters', async ({
    page,
  }) => {
    const requests = await setupNamespaceApi(page, { id: 90, login: 'admin', level: 100 });

    await page.goto(
      withAppUrl(
        '/admin/profile/user-namespaces/namespaces?q=legacy&user=84&size=65536&block_count=3&limit=25&from_id=900&page=4'
      )
    );
    await expect(page.getByTestId('profile.userns.namespaces.empty')).toBeVisible();
    expect(requestsOfKind(requests, 'namespace')).toEqual([
      {
        kind: 'namespace',
        fields: { limit: '26', size: '65536', user: '90' },
        includes: null,
      },
    ]);

    await page.goto(
      withAppUrl(
        '/admin/profile/user-namespaces/maps?q=default&user=84&user_namespace=101&limit=25&from_id=800&page=4'
      )
    );
    await expect(page.getByTestId('profile.userns.maps.empty')).toBeVisible();
    expect(requestsOfKind(requests, 'map')).toEqual([
      {
        kind: 'map',
        fields: { limit: '26', user: '90', user_namespace: '101' },
        includes: 'user_namespace',
      },
    ]);

    await page.goto(
      withAppUrl(
        '/admin/user-namespaces/namespaces?q=legacy&user=42&size=131072&block_count=4&limit=25&from_id=700&page=3'
      )
    );
    await expect(page.getByTestId('admin.userns.namespaces.empty')).toBeVisible();
    expect(requestsOfKind(requests, 'namespace')).toEqual([
      {
        kind: 'namespace',
        fields: { limit: '26', size: '65536', user: '90' },
        includes: null,
      },
      {
        kind: 'namespace',
        fields: { limit: '26', size: '131072', user: '42', block_count: '4' },
        includes: null,
      },
    ]);

    await page.goto(
      withAppUrl(
        '/admin/user-namespaces/maps?q=default&user=42&user_namespace=202&limit=25&from_id=600&page=3'
      )
    );
    await expect(page.getByTestId('admin.userns.maps.empty')).toBeVisible();
    expect(requestsOfKind(requests, 'map')).toEqual([
      {
        kind: 'map',
        fields: { limit: '26', user: '90', user_namespace: '101' },
        includes: 'user_namespace',
      },
      {
        kind: 'map',
        fields: { limit: '26', user: '42', user_namespace: '202' },
        includes: 'user_namespace',
      },
    ]);
  });

  test('@pr-smoke @pr-smoke-mobile ordinary VPS configuration omits the server-managed owner scope', async ({
    page,
  }) => {
    const requests = await setupNamespaceApi(page, { id: 42, login: 'member', level: 1 }, 42);

    await page.goto(withAppUrl('/app/vps/123/config'));
    await expect(page.getByText('Boot preferences')).toBeVisible();

    expect(requestsOfKind(requests, 'map')).toEqual([
      { kind: 'map', fields: { limit: '250' }, includes: null },
    ]);
  });

  test('@pr-smoke @pr-smoke-mobile administrator VPS configuration scopes maps to the foreign owner', async ({
    page,
  }) => {
    const requests = await setupNamespaceApi(page, { id: 90, login: 'admin', level: 100 }, 42);

    await page.goto(withAppUrl('/admin/vps/123/config'));
    await expect(page.getByText('Start menu timeout', { exact: true })).toBeVisible();

    expect(requestsOfKind(requests, 'map')).toEqual([
      { kind: 'map', fields: { limit: '250', user: '42' }, includes: null },
    ]);
  });

  test('@pr-smoke @pr-smoke-mobile namespace pagination follows ascending exclusive cursors without overlap or terminal loops', async ({
    page,
  }) => {
    const allNamespaces = Array.from({ length: 50 }, (_, index) => ({
      id: index + 1,
      size: 65_536,
    }));
    const requestedCursors: number[] = [];
    let pageOneBecameExactTerminal = false;
    const writes = observeMutations(page);

    await setupHaveApiMock(page, {
      user: { id: 42, login: 'member', level: 1 },
      handlers: {
        ...READ_ONLY_CHROME_HANDLERS,
        'GET user_namespaces': ({ searchParams }) => {
          expect(searchParams.get('_meta[includes]')).toBeNull();
          const fields = readIndexFields(searchParams, 'namespace');
          expect(fields['limit']).toBe('26');
          expect(Object.keys(fields).every((key) => ['limit', 'from_id'].includes(key))).toBe(true);
          const fromId = Number(fields['from_id'] ?? 0);
          requestedCursors.push(fromId);
          const matchingRows = allNamespaces.filter((namespace) => namespace.id > fromId);
          if (fromId === 0 && pageOneBecameExactTerminal) {
            return {
              user_namespaces: matchingRows.slice(0, 25).map((namespace, index) => (
                index === 0 ? { ...namespace, size: 77_777 } : namespace
              )),
            };
          }
          return {
            user_namespaces: matchingRows.slice(0, Number(fields['limit'])),
          };
        },
      },
    });

    await page.goto(withAppUrl('/app/profile/user-namespaces/namespaces?limit=25'));

    await expect(page.getByTestId('profile.userns.namespaces.row.1')).toBeVisible();
    await expect(page.getByTestId('profile.userns.namespaces.row.25')).toBeVisible();
    await expect(page.getByTestId('profile.userns.namespaces.row.26')).toHaveCount(0);
    await expect(page.getByTestId(/^profile\.userns\.namespaces\.row\.\d+$/)).toHaveCount(25);
    await expect(page.getByTestId('profile.userns.namespaces.pagination.next')).toBeEnabled();

    await page.getByTestId('profile.userns.namespaces.pagination.next').click();

    await expect(page).toHaveURL(/from_id=25/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('profile.userns.namespaces.row.25')).toHaveCount(0);
    await expect(page.getByTestId('profile.userns.namespaces.row.26')).toBeVisible();
    await expect(page.getByTestId('profile.userns.namespaces.row.50')).toBeVisible();
    await expect(page.getByTestId(/^profile\.userns\.namespaces\.row\.\d+$/)).toHaveCount(25);
    await expect(page.getByTestId('profile.userns.namespaces.pagination.next')).toBeDisabled();
    await expect.poll(() => requestedCursors).toContain(25);

    await page.goBack();
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId('profile.userns.namespaces.row.1')).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/from_id=25/);
    await expect(page.getByTestId('profile.userns.namespaces.row.26')).toBeVisible();

    pageOneBecameExactTerminal = true;
    await page.getByTestId('profile.userns.namespaces.pagination.prev').click();
    await expect(page).not.toHaveURL(/from_id=/);
    await page.reload();
    await expect(page.getByTestId('profile.userns.namespaces.row.1')).toContainText('77777');
    await expect(page.getByTestId('profile.userns.namespaces.pagination.next')).toBeEnabled();
    await expect(page.getByTestId('profile.userns.namespaces.pagination.page.2')).toBeEnabled();
    await page.getByTestId('profile.userns.namespaces.pagination.next').click();
    await expect(page).toHaveURL(/from_id=25/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('profile.userns.namespaces.row.26')).toBeVisible();
    expect([...new Set(requestedCursors.filter((cursor) => cursor > 0))]).toEqual([25]);
    expect(requestedCursors).not.toContain(1);
    expect(writes).toEqual([]);
    await expectNoDocumentHorizontalOverflow(page);
  });

  test('@pr-smoke @pr-smoke-mobile map pagination expands namespaces and stops on a below-limit terminal page', async ({
    page,
  }) => {
    const allMaps = Array.from({ length: 31 }, (_, index) => {
      const id = index + 1;
      return {
        id,
        label: `map-${id}`,
        user_namespace: {
          id: 1_000 + id,
          size: 65_536 + id,
          user: { id: 42, login: 'owner-42' },
        },
      };
    });
    const requestedCursors: number[] = [];
    const requestedIncludes: Array<string | null> = [];
    let pageOneBecameExactTerminal = false;
    const writes = observeMutations(page);

    await setupHaveApiMock(page, {
      user: { id: 90, login: 'admin', level: 100 },
      handlers: {
        ...READ_ONLY_CHROME_HANDLERS,
        'GET user_namespace_maps': ({ searchParams }) => {
          const fields = readIndexFields(searchParams, 'map');
          expect(fields['limit']).toBe('26');
          expect(fields['user']).toBe('42');
          expect(Object.keys(fields).every((key) => ['limit', 'from_id', 'user'].includes(key))).toBe(true);
          const fromId = Number(fields['from_id'] ?? 0);
          const includes = searchParams.get('_meta[includes]');
          requestedCursors.push(fromId);
          requestedIncludes.push(includes);
          const matchingRows = allMaps.filter((map) => map.id > fromId);
          const pageRows = fromId === 0 && pageOneBecameExactTerminal
            ? matchingRows.slice(0, 25).map((map, index) => (
                index === 0 ? { ...map, label: 'map-1-refreshed' } : map
              ))
            : matchingRows.slice(0, Number(fields['limit']));

          return {
            user_namespace_maps: includes === 'user_namespace'
              ? pageRows
              : pageRows.map((map) => ({
                  id: map.id,
                  label: map.label,
                  user_namespace: { id: map.user_namespace.id },
                })),
          };
        },
      },
    });

    await page.goto(withAppUrl('/admin/user-namespaces/maps?user=42&limit=25'));

    await expect(page.getByTestId('admin.userns.maps.row.1')).toBeVisible();
    await expect(page.getByTestId('admin.userns.maps.row.25')).toBeVisible();
    await expect(page.getByTestId('admin.userns.maps.row.26')).toHaveCount(0);
    await expect(page.getByTestId(/^admin\.userns\.maps\.row\.\d+$/)).toHaveCount(25);
    await expect(page.getByText('#1001 (Size 65537)', { exact: true })).toBeVisible();
    await expect(page.getByText('owner-42', { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId('admin.userns.maps.pagination.next')).toBeEnabled();

    await page.getByTestId('admin.userns.maps.pagination.next').click();

    await expect(page).toHaveURL(/from_id=25/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('admin.userns.maps.row.25')).toHaveCount(0);
    await expect(page.getByTestId('admin.userns.maps.row.26')).toBeVisible();
    await expect(page.getByTestId('admin.userns.maps.row.31')).toBeVisible();
    await expect(page.getByTestId(/^admin\.userns\.maps\.row\.\d+$/)).toHaveCount(6);
    await expect(page.getByTestId('admin.userns.maps.pagination.next')).toBeDisabled();

    await page.goBack();
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId('admin.userns.maps.row.1')).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/from_id=25/);
    await expect(page.getByTestId('admin.userns.maps.row.26')).toBeVisible();

    pageOneBecameExactTerminal = true;
    await page.getByTestId('admin.userns.maps.pagination.prev').click();
    await expect(page).not.toHaveURL(/from_id=/);
    await page.reload();
    await expect(page.getByTestId('admin.userns.maps.row.1')).toContainText('map-1-refreshed');
    await expect(page.getByTestId('admin.userns.maps.pagination.next')).toBeEnabled();
    await expect(page.getByTestId('admin.userns.maps.pagination.page.2')).toBeEnabled();
    await page.getByTestId('admin.userns.maps.pagination.next').click();
    await expect(page).toHaveURL(/from_id=25/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('admin.userns.maps.row.26')).toBeVisible();
    expect([...new Set(requestedCursors.filter((cursor) => cursor > 0))]).toEqual([25]);
    expect(requestedCursors).not.toContain(1);
    expect(requestedIncludes).not.toContain(null);
    expect(new Set(requestedIncludes)).toEqual(new Set(['user_namespace']));
    expect(writes).toEqual([]);
    await expectNoDocumentHorizontalOverflow(page);
  });

  test('@pr-smoke @pr-smoke-mobile an empty map cursor page can return safely through Prev', async ({
    page,
  }) => {
    const maps = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      label: `map-${index + 1}`,
      user_namespace: { id: 101, size: 65_536 },
    }));
    const requestedCursors: number[] = [];
    const writes = observeMutations(page);

    await setupHaveApiMock(page, {
      user: { id: 42, login: 'member', level: 1 },
      handlers: {
        ...READ_ONLY_CHROME_HANDLERS,
        'GET user_namespace_maps': ({ searchParams }) => {
          expect(searchParams.get('_meta[includes]')).toBe('user_namespace');
          const fields = readIndexFields(searchParams, 'map');
          expect(fields['limit']).toBe('26');
          const fromId = Number(fields['from_id'] ?? 0);
          requestedCursors.push(fromId);
          return {
            user_namespace_maps: maps
              .filter((map) => map.id > fromId)
              .slice(0, Number(fields['limit'])),
          };
        },
      },
    });

    await page.goto(
      withAppUrl('/app/profile/user-namespaces/maps?from_id=25&page=2&limit=25')
    );

    await expect(page.getByTestId('profile.userns.maps.empty')).toBeVisible();
    await expect(page.getByTestId('profile.userns.maps.pagination.prev')).toBeEnabled();
    await expect(page.getByTestId('profile.userns.maps.pagination.next')).toBeDisabled();
    await page.getByTestId('profile.userns.maps.pagination.prev').click();

    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page).toHaveURL(/page=1/);
    await expect(page.getByTestId('profile.userns.maps.row.1')).toBeVisible();
    await expect(page.getByTestId('profile.userns.maps.row.25')).toBeVisible();
    await expect(page.getByTestId('profile.userns.maps.pagination.next')).toBeEnabled();
    await page.getByTestId('profile.userns.maps.pagination.next').click();

    await expect(page).toHaveURL(/from_id=25/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId('profile.userns.maps.empty')).toBeVisible();
    await expect(page.getByTestId('profile.userns.maps.pagination.prev')).toBeEnabled();
    await expect(page.getByTestId('profile.userns.maps.pagination.next')).toBeDisabled();
    expect(requestedCursors).not.toContain(1);
    expect(requestedCursors.every((cursor) => cursor === 0 || cursor === 25)).toBe(true);
    expect(writes).toEqual([]);
    await expectNoDocumentHorizontalOverflow(page);
  });

  test('@pr-smoke @pr-smoke-mobile support admin routes omit owner filters and administrator-only columns', async ({
    page,
  }) => {
    const requests: NamespaceIndexRequest[] = [];
    const writes = observeMutations(page);

    await setupHaveApiMock(page, {
      user: { id: 50, login: 'support', level: 50 },
      handlers: {
        ...READ_ONLY_CHROME_HANDLERS,
        'GET user_namespaces': ({ searchParams }) => {
          requests.push({
            kind: 'namespace',
            fields: readIndexFields(searchParams, 'namespace'),
            includes: searchParams.get('_meta[includes]'),
          });
          return { user_namespaces: [{ id: 1, size: 65_536 }] };
        },
        'GET user_namespace_maps': ({ searchParams }) => {
          requests.push({
            kind: 'map',
            fields: readIndexFields(searchParams, 'map'),
            includes: searchParams.get('_meta[includes]'),
          });
          return {
            user_namespace_maps: [{
              id: 1,
              label: 'support-map',
              user_namespace: { id: 101, size: 65_536 },
            }],
          };
        },
      },
    });

    await page.goto(withAppUrl('/admin/user-namespaces/namespaces?user=42&block_count=3&limit=25'));
    await expect(page.getByTestId('admin.userns.namespaces.row.1')).toBeVisible();
    expect(requestsOfKind(requests, 'namespace')).toEqual([
      { kind: 'namespace', fields: { limit: '26' }, includes: null },
    ]);
    await expect(page.getByRole('columnheader', { name: 'User', exact: true })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Blocks', exact: true })).toHaveCount(0);

    await page.getByTestId('admin.userns.namespaces.filters.advanced').click();
    const namespaceDrawer = page.getByTestId('admin.userns.namespaces.filters.advanced.drawer');
    await expect(namespaceDrawer.getByRole('textbox', { name: 'Size', exact: true })).toBeVisible();
    await expect(namespaceDrawer.getByRole('textbox', { name: 'User', exact: true })).toHaveCount(0);
    await expect(namespaceDrawer.getByRole('textbox', { name: 'Blocks', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.goto(withAppUrl('/admin/user-namespaces/maps?user=42&limit=25'));
    await expect(page.getByTestId('admin.userns.maps.row.1')).toBeVisible();
    expect(requestsOfKind(requests, 'map')).toEqual([
      { kind: 'map', fields: { limit: '26' }, includes: 'user_namespace' },
    ]);
    await expect(page.getByRole('columnheader', { name: 'User', exact: true })).toHaveCount(0);
    await page.getByTestId('admin.userns.maps.filters.advanced').click();
    const mapDrawer = page.getByTestId('admin.userns.maps.filters.advanced.drawer');
    await expect(mapDrawer.getByRole('textbox', { name: 'Namespace', exact: true })).toBeVisible();
    await expect(mapDrawer.getByRole('textbox', { name: 'User', exact: true })).toHaveCount(0);
    expect(writes).toEqual([]);
    await expectNoDocumentHorizontalOverflow(page);
  });

  test('@pr-smoke @pr-smoke-mobile advanced and create drawers expose programmatic field names without overflow', async ({
    page,
  }) => {
    const writes = observeMutations(page);

    await setupHaveApiMock(page, {
      user: { id: 90, login: 'admin', level: 100 },
      handlers: {
        ...READ_ONLY_CHROME_HANDLERS,
        'GET user_namespaces': () => ({
          user_namespaces: [
            { id: 101, size: 65_536, user: { id: 90, login: 'admin' }, block_count: 1 },
            { id: 102, size: 65_536, user: { id: 90, login: 'admin' }, block_count: 1 },
          ],
        }),
        'GET user_namespace_maps': ({ searchParams }) => ({
          user_namespace_maps: searchParams.get('_meta[includes]') === 'user_namespace'
            ? [{
                id: 501,
                label: 'default',
                user_namespace: { id: 101, size: 65_536, user: { id: 90, login: 'admin' } },
              }]
            : [{ id: 501, label: 'default', user_namespace: { id: 101 } }],
        }),
      },
    });

    await page.goto(withAppUrl('/admin/user-namespaces/namespaces'));
    await page.getByTestId('admin.userns.namespaces.filters.advanced').click();
    const namespaceDrawer = page.getByTestId('admin.userns.namespaces.filters.advanced.drawer');
    await expect(namespaceDrawer.getByRole('textbox', { name: 'Size', exact: true })).toBeVisible();
    await expect(namespaceDrawer.getByRole('textbox', { name: 'User', exact: true })).toBeVisible();
    await expect(namespaceDrawer.getByRole('textbox', { name: 'Blocks', exact: true })).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
    await page.keyboard.press('Escape');

    await page.goto(withAppUrl('/admin/user-namespaces/maps'));
    await page.getByTestId('admin.userns.maps.filters.advanced').click();
    const mapDrawer = page.getByTestId('admin.userns.maps.filters.advanced.drawer');
    await expect(mapDrawer.getByRole('textbox', { name: 'Namespace', exact: true })).toBeVisible();
    await expect(mapDrawer.getByRole('textbox', { name: 'User', exact: true })).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
    await page.keyboard.press('Escape');

    await page.getByTestId('admin.userns.maps.create').click();
    const adminCreateDrawer = page.getByTestId('admin.userns.maps.create.drawer');
    await expect(adminCreateDrawer.getByRole('textbox', { name: 'Label', exact: true })).toBeVisible();
    await expect(adminCreateDrawer.getByRole('textbox', { name: 'Namespace', exact: true })).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
    await page.keyboard.press('Escape');

    await page.goto(withAppUrl('/admin/profile/user-namespaces/maps'));
    await page.getByTestId('profile.userns.maps.create').click();
    const profileCreateDrawer = page.getByTestId('profile.userns.maps.create.drawer');
    await expect(profileCreateDrawer.getByRole('textbox', { name: 'Label', exact: true })).toBeVisible();
    await expect(profileCreateDrawer.getByRole('combobox', { name: 'Namespace', exact: true })).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
    expect(writes).toEqual([]);
  });
});

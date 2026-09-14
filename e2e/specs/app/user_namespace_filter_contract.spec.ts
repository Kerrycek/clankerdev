import type { Page } from '@playwright/test';

import { expect, test } from '../../fixtures/bootstrap';
import { setupHaveApiMock, type HaveApiMockUser } from '../../fixtures/haveapi';
import { withAppUrl } from '../../fixtures/url';

type NamespaceIndexRequest = {
  kind: 'namespace' | 'map';
  fields: Record<string, string>;
};

const USER_NAMESPACE_INDEX_FIELDS = new Set(['limit', 'from_id', 'size', 'user', 'block_count']);
const USER_NAMESPACE_MAP_INDEX_FIELDS = new Set(['limit', 'from_id', 'user', 'user_namespace']);

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
      'GET user_namespaces': ({ searchParams }) => {
        requests.push({ kind: 'namespace', fields: readIndexFields(searchParams, 'namespace') });
        return { user_namespaces: [] };
      },
      'GET user_namespace_maps': ({ searchParams }) => {
        requests.push({ kind: 'map', fields: readIndexFields(searchParams, 'map') });
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

test.describe('User namespace index contracts', () => {
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
      { kind: 'namespace', fields: { limit: '25', size: '65536' } },
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
      { kind: 'map', fields: { limit: '25', user_namespace: '101' } },
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
      { kind: 'namespace', fields: { limit: '25', size: '65536', user: '90' } },
    ]);

    await page.goto(
      withAppUrl(
        '/admin/profile/user-namespaces/maps?q=default&user=84&user_namespace=101&limit=25&from_id=800&page=4'
      )
    );
    await expect(page.getByTestId('profile.userns.maps.empty')).toBeVisible();
    expect(requestsOfKind(requests, 'map')).toEqual([
      { kind: 'map', fields: { limit: '25', user: '90', user_namespace: '101' } },
    ]);

    await page.goto(
      withAppUrl(
        '/admin/user-namespaces/namespaces?q=legacy&user=42&size=131072&block_count=4&limit=25&from_id=700&page=3'
      )
    );
    await expect(page.getByTestId('admin.userns.namespaces.empty')).toBeVisible();
    expect(requestsOfKind(requests, 'namespace')).toEqual([
      { kind: 'namespace', fields: { limit: '25', size: '65536', user: '90' } },
      {
        kind: 'namespace',
        fields: { limit: '25', size: '131072', user: '42', block_count: '4' },
      },
    ]);

    await page.goto(
      withAppUrl(
        '/admin/user-namespaces/maps?q=default&user=42&user_namespace=202&limit=25&from_id=600&page=3'
      )
    );
    await expect(page.getByTestId('admin.userns.maps.empty')).toBeVisible();
    expect(requestsOfKind(requests, 'map')).toEqual([
      { kind: 'map', fields: { limit: '25', user: '90', user_namespace: '101' } },
      { kind: 'map', fields: { limit: '25', user: '42', user_namespace: '202' } },
    ]);
  });

  test('@pr-smoke @pr-smoke-mobile ordinary VPS configuration omits the server-managed owner scope', async ({
    page,
  }) => {
    const requests = await setupNamespaceApi(page, { id: 42, login: 'member', level: 1 }, 42);

    await page.goto(withAppUrl('/app/vps/123/config'));
    await expect(page.getByText('Boot preferences')).toBeVisible();

    expect(requestsOfKind(requests, 'map')).toEqual([
      { kind: 'map', fields: { limit: '250' } },
    ]);
  });

  test('@pr-smoke @pr-smoke-mobile administrator VPS configuration scopes maps to the foreign owner', async ({
    page,
  }) => {
    const requests = await setupNamespaceApi(page, { id: 90, login: 'admin', level: 100 }, 42);

    await page.goto(withAppUrl('/admin/vps/123/config'));
    await expect(page.getByText('Start menu timeout', { exact: true })).toBeVisible();

    expect(requestsOfKind(requests, 'map')).toEqual([
      { kind: 'map', fields: { limit: '250', user: '42' } },
    ]);
  });
});

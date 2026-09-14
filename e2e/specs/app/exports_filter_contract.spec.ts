import type { Page, TestInfo } from '@playwright/test';

import { test, expect } from '../../fixtures/bootstrap';
import { setupHaveApiMock, type HaveApiMockUser } from '../../fixtures/haveapi';
import { withAppUrl } from '../../fixtures/url';

const EXPORT_INDEX_FIELDS = new Set(['limit', 'from_id', 'user']);

type ExportListRequest = {
  includes: string | null;
  fields: Record<string, string>;
};

type ExportMockOptions = {
  user: HaveApiMockUser;
  ownerLabel: string;
  allowArbitraryUser?: boolean;
  expectedImplicitUserId?: number;
  includeUserRelation?: boolean;
  ownerLabelByUser?: boolean;
};

function readExportIndexFields(searchParams: URLSearchParams): Record<string, string> {
  const fields: Record<string, string> = {};
  const unsupported: string[] = [];

  for (const [key, value] of searchParams.entries()) {
    const match = /^export\[([^\]]+)\]$/.exec(key);
    if (!match) continue;

    const field = match[1];
    if (!field || !EXPORT_INDEX_FIELDS.has(field)) {
      unsupported.push(field || key);
      continue;
    }

    fields[field] = value;
  }

  if (unsupported.length > 0) {
    throw new Error(`Unexpected Export::Index fields: ${unsupported.sort().join(', ')}`);
  }

  return fields;
}

function exportRow(id: number, ownerLabel: string, userId: number) {
  return {
    id,
    dataset: { id: 10_000 + id, name: `dataset-${id}`, full_name: `tank/${ownerLabel}/dataset-${id}` },
    snapshot: null,
    user: { id: userId, login: `${ownerLabel}-owner` },
    host_ip_address: { id: 20_000 + id, addr: `198.51.100.${(id % 200) + 1}` },
    path: `/tank/${ownerLabel}/dataset-${id}`,
    all_vps: false,
    rw: true,
    sync: true,
    subtree_check: false,
    root_squash: false,
    threads: 8,
    enabled: true,
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
  };
}

async function setupExportsApi(page: Page, options: ExportMockOptions): Promise<ExportListRequest[]> {
  const requests: ExportListRequest[] = [];

  await setupHaveApiMock(page, {
    user: options.user,
    handlers: {
      'GET users': () => ({ users: [] }),
      'GET exports': ({ searchParams }) => {
        const fields = readExportIndexFields(searchParams);
        const includes = searchParams.get('_meta[includes]');
        requests.push({ includes, fields });

        if (!options.allowArbitraryUser && options.expectedImplicitUserId === undefined && fields.user !== undefined) {
          throw new Error(`Owner-scoped Export::Index must not send export[user], got ${fields.user}`);
        }

        if (options.expectedImplicitUserId !== undefined && fields.user !== String(options.expectedImplicitUserId)) {
          throw new Error(
            `Expected implicit export[user]=${options.expectedImplicitUserId}, got ${fields.user ?? '<missing>'}`
          );
        }

        const hasUserInclude = includes?.split(',').includes('user') ?? false;
        if (hasUserInclude !== Boolean(options.includeUserRelation)) {
          throw new Error(
            `${options.includeUserRelation ? 'Expected' : 'Unexpected'} user include in ${includes ?? '<missing includes>'}`
          );
        }

        const limit = Number(fields.limit ?? '50') || 50;
        const fromId = Number(fields.from_id ?? '0') || 0;
        const ownerId = fields.user ? Number(fields.user) : options.user.id;
        const ownerLabel = options.ownerLabelByUser ? `${options.ownerLabel}-${ownerId}` : options.ownerLabel;
        const rows = Array.from({ length: Math.min(limit, 25) }, (_, index) =>
          exportRow(fromId + index + 1, ownerLabel, ownerId)
        );

        return { exports: rows, _meta: { total_count: 125 } };
      },
    },
  });

  return requests;
}

function exportSurface(page: Page, testInfo: TestInfo, id: number) {
  return page.getByTestId(
    testInfo.project.name.includes('mobile') ? `exports.card.${id}` : `exports.row.${id}`
  );
}

function paginationNext(page: Page, testInfo: TestInfo) {
  const layout = testInfo.project.name.includes('mobile') ? 'mobile' : 'desktop';
  return page.getByTestId(`exports.pagination.${layout}.next`);
}

function lastRequest(requests: ExportListRequest[]): ExportListRequest {
  const request = requests[requests.length - 1];
  if (!request) throw new Error('Expected at least one Export::Index request');
  return request;
}

async function expectNoNewListRequest(page: Page, requests: ExportListRequest[], previousCount: number) {
  await page.waitForTimeout(200);
  expect(requests).toHaveLength(previousCount);
}

test.describe('Export list filter contract', () => {
  test('@pr-smoke @pr-smoke-mobile admin filters by user and paginates the ascending API order', async ({
    page,
  }, testInfo) => {
    const requests = await setupExportsApi(page, {
      user: { id: 90, login: 'admin', level: 100 },
      ownerLabel: 'global',
      allowArbitraryUser: true,
      includeUserRelation: true,
    });

    await page.goto(withAppUrl('/admin/exports?user=not-an-id&from_id=900&page=2&limit=25'));

    await expect(exportSurface(page, testInfo, 1)).toBeVisible();
    await expect(exportSurface(page, testInfo, 25)).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.fields).toEqual({ limit: '25' });
    expect(requests[0]?.includes).toBe('dataset,snapshot,host_ip_address,user');
    const normalized = new URL(page.url()).searchParams;
    expect(normalized.get('user')).toBeNull();
    expect(normalized.get('from_id')).toBeNull();
    expect(normalized.get('page')).toBe('1');

    const input = page.getByTestId('exports.smart_filter.input');
    for (const unsupported of ['dataset name', 'q:needle', 'dataset:20', 'enabled:true', 'mystery:value']) {
      const previousCount = requests.length;
      await input.fill(unsupported);
      await input.press('Enter');
      await expect(page.getByTestId('exports.chip.err.0')).toBeVisible();
      await expectNoNewListRequest(page, requests, previousCount);
    }

    await input.fill('user:42');
    await input.press('Enter');

    await expect.poll(() => lastRequest(requests).fields.user).toBe('42');
    expect(lastRequest(requests).fields).toEqual({ limit: '25', user: '42' });
    await expect(exportSurface(page, testInfo, 1)).toContainText('global-owner');

    await paginationNext(page, testInfo).click();

    await expect(exportSurface(page, testInfo, 26)).toBeVisible();
    await expect(exportSurface(page, testInfo, 50)).toBeVisible();
    expect(lastRequest(requests).fields).toEqual({ limit: '25', from_id: '25', user: '42' });
  });

  test('@pr-smoke @pr-smoke-mobile browser history always drives the owner-scoped query', async ({
    page,
  }, testInfo) => {
    const requests = await setupExportsApi(page, {
      user: { id: 90, login: 'admin', level: 100 },
      ownerLabel: 'history',
      allowArbitraryUser: true,
      includeUserRelation: true,
      ownerLabelByUser: true,
    });

    await page.goto(withAppUrl('/admin/exports?user=42&from_id=25&page=2&limit=25'));
    await expect(exportSurface(page, testInfo, 26)).toContainText('history-42-owner');
    expect(lastRequest(requests).fields).toEqual({ limit: '25', from_id: '25', user: '42' });

    await page.evaluate(() => {
      window.history.pushState(window.history.state, '', '/admin/exports?user=84&limit=25');
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    });

    await expect.poll(() => lastRequest(requests).fields.user).toBe('84');
    await expect(page).toHaveURL(/\/admin\/exports\?user=84&limit=25(?:&page=1)?$/);
    await expect(exportSurface(page, testInfo, 1)).toContainText('history-84-owner');

    await page.goBack();

    await expect(page).toHaveURL(/\/admin\/exports\?user=42&from_id=25&page=2&limit=25$/);
    await expect(page.getByTestId('exports.chip.user')).toContainText('#42');
    await expect(exportSurface(page, testInfo, 26)).toContainText('history-42-owner');

    await page.goForward();

    await expect(page).toHaveURL(/\/admin\/exports\?user=84&limit=25(?:&page=1)?$/);
    await expect(page.getByTestId('exports.chip.user')).toContainText('#84');
    await expect(exportSurface(page, testInfo, 1)).toContainText('history-84-owner');
  });

  test('@pr-smoke @pr-smoke-mobile support admin view removes stale and unauthorized URL filters before its first GET', async ({
    page,
  }, testInfo) => {
    const requests = await setupExportsApi(page, {
      user: { id: 21, login: 'support', level: 30 },
      ownerLabel: 'support',
    });

    await page.goto(
      withAppUrl(
        '/admin/exports?q=needle&enabled=true&dataset=20&snapshot=30&host_ip_address=40&user=999&from_id=25&page=2&limit=25'
      )
    );

    await expect(exportSurface(page, testInfo, 1)).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.fields).toEqual({ limit: '25' });
    expect(requests[0]?.includes).toBe('dataset,snapshot,host_ip_address');

    const normalized = new URL(page.url()).searchParams;
    for (const key of ['q', 'enabled', 'dataset', 'snapshot', 'host_ip_address', 'user', 'from_id']) {
      expect(normalized.get(key), `${key} must be removed before Export::Index runs`).toBeNull();
    }
    expect(normalized.get('page')).toBe('1');
    expect(normalized.get('limit')).toBe('25');
    await expect(page.getByTestId('exports.smart_filter.advanced')).toHaveCount(0);
    await expect(exportSurface(page, testInfo, 1)).not.toContainText('support-owner');
  });

  test('@pr-smoke @pr-smoke-mobile admin My view replaces a stale arbitrary owner with the signed-in user', async ({
    page,
  }, testInfo) => {
    const requests = await setupExportsApi(page, {
      user: { id: 90, login: 'admin', level: 100 },
      ownerLabel: 'admin-mine',
      expectedImplicitUserId: 90,
    });

    await page.goto(withAppUrl('/app/exports?user=999&from_id=25&page=2&limit=25'));

    await expect(exportSurface(page, testInfo, 1)).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.fields).toEqual({ limit: '25', user: '90' });
    expect(requests[0]?.includes).toBe('dataset,snapshot,host_ip_address');

    const normalized = new URL(page.url()).searchParams;
    expect(normalized.get('user')).toBeNull();
    expect(normalized.get('from_id')).toBeNull();
    expect(normalized.get('page')).toBe('1');
    await expect(page.getByTestId('exports.smart_filter.advanced')).toHaveCount(0);
    await expect(exportSurface(page, testInfo, 1)).not.toContainText('admin-mine-owner');
  });

  test('@pr-smoke @pr-smoke-mobile dataset export tab resolves Dataset.export with Export::Show and never calls Export::Index', async ({
    page,
  }, testInfo) => {
    let exportIndexCalls = 0;
    const exportShowRequests: Array<{ id: number; includes: string | null }> = [];
    const datasetShowIncludes: Array<string | null> = [];

    await setupHaveApiMock(page, {
      user: { id: 7, login: 'member', level: 1 },
      handlers: {
        'GET datasets/20': ({ searchParams }) => {
          datasetShowIncludes.push(searchParams.get('_meta[includes]'));
          return {
            dataset: {
              id: 20,
              name: 'source',
              full_name: 'tank/member/source',
              user: { id: 7, login: 'member' },
              export: { id: 700, path: '/tank/member/source' },
              export_count: 99,
              object_state: 'active',
            },
          };
        },
        'GET exports': () => {
          exportIndexCalls += 1;
          throw new Error('Dataset export tab must not call Export::Index');
        },
        'GET exports/700': ({ searchParams }) => {
          exportShowRequests.push({ id: 700, includes: searchParams.get('_meta[includes]') });
          return { export: exportRow(700, 'member', 7) };
        },
      },
    });

    await page.goto(withAppUrl('/app/datasets/20/exports'));

    await expect(page.getByTestId('dataset.exports.page')).toBeVisible();
    await expect(exportSurface(page, testInfo, 700)).toBeVisible();
    await expect(page.getByTestId('dataset.exports.create.open')).toHaveCount(0);
    expect(datasetShowIncludes).toEqual(['vps,environment,dataset_expansion,user,parent']);
    expect(exportShowRequests).toEqual([
      { id: 700, includes: 'dataset,snapshot,host_ip_address' },
    ]);
    expect(exportIndexCalls).toBe(0);
    await expect(page.getByTestId('dataset.exports.pagination.desktop')).toHaveCount(0);
    await expect(page.getByTestId('dataset.exports.pagination.mobile')).toHaveCount(0);
  });

  test('@pr-smoke @pr-smoke-mobile dataset without a persistent export offers the create flow without calling Export::Index', async ({
    page,
  }) => {
    let exportIndexCalls = 0;

    await setupHaveApiMock(page, {
      user: { id: 7, login: 'member', level: 1 },
      handlers: {
        'GET datasets/21': () => ({
          dataset: {
            id: 21,
            name: 'empty-source',
            full_name: 'tank/member/empty-source',
            user: { id: 7, login: 'member' },
            export: null,
            object_state: 'active',
          },
        }),
        'GET exports': () => {
          exportIndexCalls += 1;
          throw new Error('Dataset export tab must not call Export::Index');
        },
      },
    });

    await page.goto(withAppUrl('/app/datasets/21/exports'));

    await expect(page.getByTestId('dataset.exports.empty')).toBeVisible();
    await expect(page.getByTestId('dataset.exports.create.open')).toBeVisible();
    expect(exportIndexCalls).toBe(0);
  });

  test('@pr-smoke @pr-smoke-mobile admin My create flow verifies exact dataset IDs, rejects a foreign ID, and posts the exact Create contract', async ({
    page,
  }) => {
    const exportIndexRequests: Array<Record<string, string>> = [];
    const datasetShowRequests: Array<{ id: number; includes: string | null }> = [];
    const createBodies: unknown[] = [];
    const createRequestOrder: Array<'show-own-dataset' | 'create-export'> = [];
    let foreignSnapshotRequests = 0;

    const ownDataset = {
      id: 20,
      name: 'owned-source',
      full_name: 'tank/admin/owned-source',
      user: { id: 90, login: 'admin' },
      object_state: 'active',
    };
    const foreignDataset = {
      id: 999,
      name: 'foreign-source',
      full_name: 'tank/other/foreign-source',
      user: { id: 7, login: 'other' },
      object_state: 'active',
    };

    await setupHaveApiMock(page, {
      user: { id: 90, login: 'admin', level: 100 },
      handlers: {
        'GET exports': ({ searchParams }) => {
          const fields = readExportIndexFields(searchParams);
          exportIndexRequests.push(fields);
          if (searchParams.get('_meta[includes]') !== 'dataset,snapshot,host_ip_address') {
            throw new Error('Admin My Export::Index must not request the user relation');
          }
          return { exports: [], _meta: { total_count: 0 } };
        },
        'GET datasets/999': ({ searchParams }) => {
          datasetShowRequests.push({ id: 999, includes: searchParams.get('_meta[includes]') });
          return { dataset: foreignDataset };
        },
        'GET datasets/20': ({ searchParams }) => {
          datasetShowRequests.push({ id: 20, includes: searchParams.get('_meta[includes]') });
          createRequestOrder.push('show-own-dataset');
          return { dataset: ownDataset };
        },
        'GET datasets/999/snapshots': () => {
          foreignSnapshotRequests += 1;
          throw new Error('A foreign dataset must not enable dependent snapshot requests');
        },
        'GET datasets/20/snapshots': () => ({ snapshots: [], _meta: { total_count: 0 } }),
        'POST exports': ({ reqJson }) => {
          createBodies.push(reqJson);
          createRequestOrder.push('create-export');
          return { export: { ...exportRow(700, 'admin', 90), dataset: ownDataset } };
        },
        'GET exports/700': () => ({ export: { ...exportRow(700, 'admin', 90), dataset: ownDataset } }),
        'GET exports/700/hosts': () => ({ hosts: [], _meta: { total_count: 0 } }),
      },
    });

    await page.goto(withAppUrl('/app/exports'));

    await expect(page.getByTestId('exports.empty')).toBeVisible();
    expect(exportIndexRequests[0]).toEqual({ limit: '50', user: '90' });
    await page.getByTestId('exports.create.open').click();
    await expect(page.getByTestId('exports.create')).toBeVisible();

    const datasetInput = page.getByTestId('exports.create.dataset');
    await datasetInput.fill('#999');
    await datasetInput.press('Enter');

    await expect.poll(() => datasetShowRequests.some((request) => request.id === 999)).toBe(true);
    expect(datasetShowRequests.find((request) => request.id === 999)?.includes).toBe('user');
    await expect(page.getByTestId('exports.create.submit')).toBeDisabled();
    expect(createBodies).toHaveLength(0);
    expect(foreignSnapshotRequests).toBe(0);

    await datasetInput.fill('');
    await datasetInput.fill('#20');

    await expect.poll(() => datasetShowRequests.some((request) => request.id === 20)).toBe(true);
    expect(datasetShowRequests.find((request) => request.id === 20)?.includes).toBe('user');
    await expect(page.getByTestId('exports.create.submit')).toBeEnabled();
    await expect(page.getByTestId('exports.create.host_ip')).toHaveCount(0);
    await page.getByTestId('exports.create.submit').click();

    await expect.poll(() => createRequestOrder.indexOf('create-export')).toBeGreaterThanOrEqual(0);
    expect(createBodies).toHaveLength(1);

    // Creating an export invalidates the active dataset query and can append a
    // post-create detail request. Scope the ordering contract to the first POST:
    // the selection lookup and fresh owner check must precede it, with the fresh
    // owner check immediately adjacent to Create.
    const createRequestIndex = createRequestOrder.indexOf('create-export');
    const requestsBeforeCreate = createRequestOrder.slice(0, createRequestIndex);
    expect(requestsBeforeCreate.filter((event) => event === 'show-own-dataset').length).toBeGreaterThanOrEqual(2);
    expect(requestsBeforeCreate[requestsBeforeCreate.length - 1]).toBe('show-own-dataset');
    expect(createBodies[0]).toEqual({
      export: {
        dataset: 20,
        all_vps: true,
        rw: true,
        sync: true,
        subtree_check: false,
        root_squash: false,
        threads: 8,
        enabled: true,
      },
    });
    expect(JSON.stringify(createBodies[0])).not.toContain('host_ip_address');
  });

  test('@pr-smoke @pr-smoke-mobile support detail omits admin output and update fields', async ({ page }, testInfo) => {
    const showIncludes: Array<string | null> = [];
    const updateBodies: unknown[] = [];
    const supportExport = { ...exportRow(501, 'support', 21), user: undefined };

    await setupHaveApiMock(page, {
      user: { id: 21, login: 'support', level: 30 },
      handlers: {
        'GET exports/501': ({ searchParams }) => {
          const includes = searchParams.get('_meta[includes]');
          showIncludes.push(includes);
          if (includes?.split(',').includes('user')) {
            throw new Error('Support Export::Show must not request the admin-only user relation');
          }
          return { export: supportExport };
        },
        'GET exports/501/hosts': () => ({ hosts: [], _meta: { total_count: 0 } }),
        'PUT exports/501': ({ reqJson }) => {
          updateBodies.push(reqJson);
          const payload = (reqJson as { export?: Record<string, unknown> } | undefined)?.export;
          if (payload && Object.prototype.hasOwnProperty.call(payload, 'threads')) {
            throw new Error('Support Export::Update must not send export[threads]');
          }
          return { export: { ...supportExport, rw: false } };
        },
      },
    });

    await page.goto(withAppUrl('/admin/exports/501'));

    await expect(page.getByTestId('exports.detail.page')).toBeVisible();
    expect(showIncludes[0]).toBe('dataset,snapshot,host_ip_address');
    await page.getByTestId('exports.detail.edit.open').click();
    await expect(page.getByTestId('exports.detail.edit.drawer')).toBeVisible();
    await expect(page.getByTestId('exports.edit.threads')).toHaveCount(0);
    await expect(page.getByTestId('exports.edit.rw')).toBeChecked();
    await page.getByTestId('exports.edit.rw').click();
    const saveButton = page.getByTestId('exports.edit.submit');
    if (testInfo.project.name.includes('mobile')) {
      const scrollBody = page.getByTestId('exports.detail.edit.drawer').locator('.overflow-y-auto');
      await scrollBody.evaluate((element) => {
        const spacer = document.createElement('div');
        spacer.style.height = '1200px';
        spacer.setAttribute('aria-hidden', 'true');
        element.prepend(spacer);
      });
      await expect.poll(async () => scrollBody.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
      await expect(saveButton).toBeInViewport({ ratio: 1 });
    }
    await saveButton.click();

    await expect.poll(() => updateBodies.length).toBe(1);
    expect(updateBodies[0]).toEqual({
      export: {
        all_vps: false,
        rw: false,
        sync: true,
        subtree_check: false,
        root_squash: false,
        enabled: true,
      },
    });
    expect(showIncludes.every((includes) => includes === 'dataset,snapshot,host_ip_address')).toBe(true);
  });

  test('@pr-smoke @pr-smoke-mobile admin My foreign detail fails closed before hosts and links to the admin route', async ({
    page,
  }) => {
    const showIncludes: Array<string | null> = [];
    let hostRequests = 0;

    await setupHaveApiMock(page, {
      user: { id: 90, login: 'admin', level: 100 },
      handlers: {
        'GET exports/610': ({ searchParams }) => {
          showIncludes.push(searchParams.get('_meta[includes]'));
          return { export: exportRow(610, 'foreign', 7) };
        },
        'GET exports/610/hosts': () => {
          hostRequests += 1;
          throw new Error('A foreign My-view export must not load its hosts');
        },
      },
    });

    await page.goto(withAppUrl('/app/exports/610?source=direct#proof'));

    await expect(page.getByTestId('exports.scope-mismatch')).toBeVisible();
    expect(showIncludes).toEqual(['dataset,snapshot,host_ip_address,user']);
    await expect(page.getByTestId('scope.mismatch.open-admin')).toHaveAttribute(
      'href',
      '/admin/exports/610?source=direct#proof'
    );
    await page.waitForTimeout(200);
    expect(hostRequests).toBe(0);
  });
});

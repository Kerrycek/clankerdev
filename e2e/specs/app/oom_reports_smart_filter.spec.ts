import type { Page, TestInfo } from '@playwright/test';

import { test, expect } from '../../fixtures/bootstrap';
import { setupHaveApiMock, type HaveApiMockUser } from '../../fixtures/haveapi';
import { withAppUrl } from '../../fixtures/url';

const OOM_REPORT_FIELDS = new Set([
  'limit',
  'from_id',
  'vps',
  'user',
  'node',
  'location',
  'environment',
  'oom_report_rule',
  'cgroup',
  'since',
  'until',
]);

type OomListRequest = {
  url: string;
  includes: string | null;
  fields: Record<string, string>;
};

type OomMockOptions = {
  user: HaveApiMockUser;
  ownerLabel: string;
  allowArbitraryUser?: boolean;
  expectedImplicitUserId?: number;
  includeUserRelation?: boolean;
};

function readOomFields(searchParams: URLSearchParams): Record<string, string> {
  const fields: Record<string, string> = {};
  const unknown: string[] = [];

  for (const [key, value] of searchParams.entries()) {
    const match = /^oom_report\[([^\]]+)\]$/.exec(key);
    if (!match) continue;

    const field = match[1];
    if (!field || !OOM_REPORT_FIELDS.has(field)) {
      unknown.push(field || key);
      continue;
    }

    fields[field] = value;
  }

  if (unknown.length > 0) {
    throw new Error(`Unexpected oom_report fields: ${unknown.sort().join(', ')}`);
  }

  return fields;
}

async function setupOomApi(page: Page, options: OomMockOptions): Promise<OomListRequest[]> {
  const requests: OomListRequest[] = [];

  await setupHaveApiMock(page, {
    user: options.user,
    handlers: {
      'GET nodes': async () => ({
        nodes: [
          {
            id: 1,
            domain_name: 'node1.example.test',
            location: { id: 1, label: 'PRG' },
          },
        ],
      }),
      'GET environments': async () => ({ environments: [{ id: 1, label: 'prod' }] }),
      'GET locations': async () => ({ locations: [{ id: 1, label: 'PRG' }] }),
      'GET oom_reports': async ({ request }) => {
        const fields = readOomFields(request.searchParams);
        const includes = request.searchParams.get('_meta[includes]');
        requests.push({ url: request.toString(), includes, fields });

        if (!options.allowArbitraryUser && options.expectedImplicitUserId === undefined && fields.user !== undefined) {
          throw new Error(`Owner-scoped OOM request must not send oom_report[user], got ${fields.user}`);
        }

        if (options.expectedImplicitUserId !== undefined && fields.user !== String(options.expectedImplicitUserId)) {
          throw new Error(
            `Expected implicit oom_report[user]=${options.expectedImplicitUserId}, got ${fields.user ?? '<missing>'}`
          );
        }

        const hasUserInclude = includes?.split(',').includes('vps__user') ?? false;
        if (hasUserInclude !== Boolean(options.includeUserRelation)) {
          throw new Error(
            `${options.includeUserRelation ? 'Expected' : 'Unexpected'} vps__user include in ${includes ?? '<missing includes>'}`
          );
        }

        const limit = Number(fields.limit ?? '25') || 25;
        const fromId = fields.from_id ? Number(fields.from_id) : 0;
        const cgroup = fields.cgroup ?? '/default.slice';
        const start = fromId > 0 ? fromId - 1 : 125;
        const count = Math.min(limit, 25);

        const oom_reports = Array.from({ length: count }, (_, i) => {
          const id = start - i;
          return {
            id,
            created_at: '2026-03-01T10:00:00Z',
            vps: {
              id: 1000 + id,
              hostname: `${options.ownerLabel}-vps-${id}.example.test`,
              user: { id: options.user.id, login: `${options.ownerLabel}-owner` },
              node: { id: 1, domain_name: 'node1.example.test', location: { id: 1, label: 'PRG' } },
            },
            cgroup,
            killed_name: 'nginx',
            killed_pid: 1234,
            invoked_by_name: 'systemd',
            invoked_by_pid: 1,
            count: 1,
            oom_report_rule: { id: 1, action: 'notify' },
          };
        });

        return { oom_reports, _meta: { total_count: 125 } };
      },
      'GET oom_reports/777': async () => ({
        oom_report: {
          id: 777,
          created_at: '2026-03-01T10:00:00Z',
          vps: {
            id: 1777,
            hostname: `${options.ownerLabel}-detail.example.test`,
            user: { id: options.user.id, login: `${options.ownerLabel}-owner` },
            node: { id: 1, domain_name: 'node1.example.test' },
          },
          cgroup: '/detail.slice',
          killed_name: 'nginx',
          killed_pid: 1234,
          count: 1,
          oom_report_rule: { id: 1, action: 'notify' },
        },
      }),
    },
  });

  return requests;
}

function reportSurface(page: Page, testInfo: TestInfo, id: number) {
  return page.getByTestId(
    testInfo.project.name.includes('mobile') ? `oom.list.card.${id}` : `oom.list.row.${id}`
  );
}

function lastRequest(requests: OomListRequest[]): OomListRequest {
  const request = requests[requests.length - 1];
  if (!request) throw new Error('Expected at least one OOM list request');
  return request;
}

async function expectNoNewListRequest(page: Page, requests: OomListRequest[], previousCount: number) {
  await page.waitForTimeout(150);
  expect(requests).toHaveLength(previousCount);
}

test.describe('OOM report list filter contract', () => {
  test('@pr-smoke @pr-smoke-mobile admin normalizes stale search before the first GET and keeps exact filters through pagination', async ({
    page,
  }, testInfo) => {
    const requests = await setupOomApi(page, {
      user: { id: 90, login: 'admin', level: 100 },
      ownerLabel: 'global',
      allowArbitraryUser: true,
      includeUserRelation: true,
    });

    await page.goto(
      withAppUrl('/admin/oom-reports?q=nginx&from_id=101&page=2&limit=25&cgroup=%2Fpreserved.slice')
    );

    await expect.poll(() => requests.length).toBeGreaterThan(0);
    expect(requests[0]?.fields).toMatchObject({ limit: '25', cgroup: '/preserved.slice' });
    expect(requests[0]?.fields).not.toHaveProperty('from_id');
    expect(requests[0]?.fields).not.toHaveProperty('q');
    await expect(page).toHaveURL(/\/admin\/oom-reports\?/);
    expect(new URL(page.url()).searchParams.get('q')).toBeNull();
    expect(new URL(page.url()).searchParams.get('from_id')).toBeNull();
    expect(new URL(page.url()).searchParams.get('page')).toBe('1');
    expect(new URL(page.url()).searchParams.get('cgroup')).toBe('/preserved.slice');

    await expect(reportSurface(page, testInfo, 125)).toBeVisible();
    await expect(reportSurface(page, testInfo, 125)).toContainText('/preserved.slice');
    await expect(page.getByTestId('oom.list.table').locator('th')).toHaveCount(10);

    const input = page.getByTestId('oom.smart_filter.input');
    for (const unsupported of ['nginx', 'q:', 'q:nginx', 'search:nginx', 'process:nginx']) {
      const previousCount = requests.length;
      await input.fill(unsupported);
      await input.press('Enter');
      await expect(page.getByTestId('oom.chip.err.0')).toBeVisible();
      await expectNoNewListRequest(page, requests, previousCount);
    }

    await input.fill(
      'vps:7 user:42 node:1 location:1 environment:1 rule:6 cgroup:/system.slice since:2026-03-01 until:2026-03-02'
    );
    await input.press('Enter');

    await expect.poll(() => lastRequest(requests).fields.cgroup).toBe('/system.slice');

    const exactRequest = lastRequest(requests);
    expect(exactRequest.fields).toMatchObject({
      limit: '25',
      vps: '7',
      user: '42',
      node: '1',
      location: '1',
      environment: '1',
      oom_report_rule: '6',
      cgroup: '/system.slice',
    });
    expect(exactRequest.fields.since).toBeTruthy();
    expect(exactRequest.fields.until).toBeTruthy();
    expect(exactRequest.fields).not.toHaveProperty('from_id');
    await expect(reportSurface(page, testInfo, 125)).toContainText('/system.slice');

    await page.getByTestId('oom.list.pagination.next').click();
    await expect(reportSurface(page, testInfo, 100)).toBeVisible();
    expect(lastRequest(requests).fields).toMatchObject({
      from_id: '101',
      vps: '7',
      user: '42',
      node: '1',
      location: '1',
      environment: '1',
      oom_report_rule: '6',
      cgroup: '/system.slice',
    });

    const pushCgroupHistory = async (cgroup: string) => {
      await page.evaluate((nextCgroup) => {
        const next = new URL(window.location.href);
        next.searchParams.set('cgroup', nextCgroup);
        next.searchParams.delete('from_id');
        next.searchParams.set('page', '1');
        window.history.pushState({}, '', `${next.pathname}?${next.searchParams.toString()}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, cgroup);
      await expect.poll(() => lastRequest(requests).fields.cgroup).toBe(cgroup);
      await expect(reportSurface(page, testInfo, 125)).toContainText(cgroup);
    };

    await pushCgroupHistory('/history-one.slice');
    await pushCgroupHistory('/history-two.slice');

    const beforeBack = requests.length;
    await page.goBack();
    await expect.poll(() => new URL(page.url()).searchParams.get('cgroup')).toBe('/history-one.slice');
    await expect(page.getByTestId('oom.chip.cgroup')).toContainText('cgroup:/history-one.slice');
    await expect(reportSurface(page, testInfo, 125)).toContainText('/history-one.slice');
    await page.waitForTimeout(250);
    expect(requests).toHaveLength(beforeBack);

    const beforeForward = requests.length;
    await page.goForward();
    await expect.poll(() => new URL(page.url()).searchParams.get('cgroup')).toBe('/history-two.slice');
    await expect(page.getByTestId('oom.chip.cgroup')).toContainText('cgroup:/history-two.slice');
    await expect(reportSurface(page, testInfo, 125)).toContainText('/history-two.slice');
    await page.waitForTimeout(250);
    expect(requests).toHaveLength(beforeForward);

    await input.fill('777');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/admin\/oom-reports\/777$/);
  });

  test('@pr-smoke @pr-smoke-mobile support admin view relies on owner scope and hides arbitrary-user UI', async ({
    page,
  }, testInfo) => {
    const requests = await setupOomApi(page, {
      user: { id: 21, login: 'support', level: 30 },
      ownerLabel: 'support',
    });

    await page.goto(withAppUrl('/admin/oom-reports?q=nginx&user=999&from_id=101&page=2&limit=25'));

    await expect(reportSurface(page, testInfo, 125)).toBeVisible();
    expect(requests[0]?.fields).toEqual({ limit: '25' });
    expect(requests[0]?.includes).not.toContain('vps__user');
    const normalized = new URL(page.url()).searchParams;
    expect(normalized.get('q')).toBeNull();
    expect(normalized.get('user')).toBeNull();
    expect(normalized.get('from_id')).toBeNull();
    expect(normalized.get('page')).toBe('1');

    await page.getByTestId('oom.filters.advanced').click();
    await expect(page.getByTestId('oom.filters.drawer')).toBeVisible();
    await expect(page.getByTestId('oom.advanced.user')).toHaveCount(0);
    await expect(page.getByTestId('oom.list.table').locator('th')).toHaveCount(9);
    await expect(reportSurface(page, testInfo, 125)).not.toContainText('support-owner');
  });

  test('@pr-smoke @pr-smoke-mobile admin My view replaces arbitrary user scope with the signed-in user', async ({
    page,
  }, testInfo) => {
    const requests = await setupOomApi(page, {
      user: { id: 90, login: 'admin', level: 100 },
      ownerLabel: 'admin-mine',
      expectedImplicitUserId: 90,
    });

    await page.goto(withAppUrl('/app/oom-reports?user=999&from_id=101&page=2&limit=25'));

    await expect(reportSurface(page, testInfo, 125)).toBeVisible();
    expect(requests[0]?.fields).toEqual({ limit: '25', user: '90' });
    expect(requests[0]?.includes).not.toContain('vps__user');
    const normalized = new URL(page.url()).searchParams;
    expect(normalized.get('user')).toBeNull();
    expect(normalized.get('from_id')).toBeNull();
    expect(normalized.get('page')).toBe('1');

    await page.getByTestId('oom.filters.advanced').click();
    await expect(page.getByTestId('oom.advanced.user')).toHaveCount(0);
    await expect(page.getByTestId('oom.list.table').locator('th')).toHaveCount(9);
    await expect(reportSurface(page, testInfo, 125)).not.toContainText('admin-mine-owner');
  });

  for (const account of [
    { name: 'regular user', path: '/app/oom-reports', user: { id: 7, login: 'member', level: 1 }, ownerLabel: 'member' },
    { name: 'support My view', path: '/app/oom-reports', user: { id: 21, login: 'support', level: 30 }, ownerLabel: 'support-mine' },
  ]) {
    test(`@pr-smoke @pr-smoke-mobile ${account.name} relies on backend owner scope without a user parameter`, async ({
      page,
    }, testInfo) => {
      const requests = await setupOomApi(page, {
        user: account.user,
        ownerLabel: account.ownerLabel,
      });

      await page.goto(withAppUrl(`${account.path}?user=999&from_id=101&page=2&limit=25`));

      const surface = reportSurface(page, testInfo, 125);
      await expect(surface).toBeVisible();
      await expect(surface).toContainText(`${account.ownerLabel}-vps-125.example.test`);
      expect(requests[0]?.fields).toEqual({ limit: '25' });
      expect(requests[0]?.includes).not.toContain('vps__user');
      const normalized = new URL(page.url()).searchParams;
      expect(normalized.get('user')).toBeNull();
      expect(normalized.get('from_id')).toBeNull();
      expect(normalized.get('page')).toBe('1');

      await page.getByTestId('oom.filters.advanced').click();
      await expect(page.getByTestId('oom.advanced.user')).toHaveCount(0);
      await expect(page.getByTestId('oom.list.table').locator('th')).toHaveCount(9);
      await expect(surface).not.toContainText(`${account.ownerLabel}-owner`);
    });
  }
});

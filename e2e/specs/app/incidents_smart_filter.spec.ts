import type { Locator, Page } from '@playwright/test';

import { test, expect } from '../../fixtures/bootstrap';
import { setupHaveApiMock } from '../../fixtures/haveapi';
import { withAppUrl } from '../../fixtures/url';

type Actor = {
  id: number;
  login: string;
  level: number;
  path: '/app/incidents' | '/admin/incidents';
  label: string;
};

type IncidentScenario = {
  listRequests: URLSearchParams[];
  violations: string[];
  mailboxRequests: number;
};

const commonFields = new Set(['limit', 'from_id', 'vps', 'ip_address_assignment', 'ip_addr', 'codename']);
const adminFields = new Set(['user', 'filed_by', 'mailbox']);

function incidentField(params: URLSearchParams, key: string) {
  return params.get(`incident_report[${key}]`);
}

function includes(params: URLSearchParams) {
  return params.get('_meta[includes]');
}

async function installIncidentScenario(page: Page, actor: Actor): Promise<IncidentScenario> {
  const hasAdminRole = actor.level >= 90;
  const isGlobalAdminView = hasAdminRole && actor.path === '/admin/incidents';
  const implicitOwnUserId = actor.level >= 21 && actor.path === '/app/incidents' ? actor.id : undefined;
  const scenario: IncidentScenario = { listRequests: [], violations: [], mailboxRequests: 0 };

  const reports = Array.from({ length: 75 }, (_, index) => {
    const id = 125 - index;
    const exact = id >= 76;
    const matchedOwnerId = actor.path === '/app/incidents' || !hasAdminRole ? actor.id : 42;
    const ownerId = exact ? matchedOwnerId : matchedOwnerId + 1_000;

    return {
      id,
      detected_at: '2025-01-01T00:00:00Z',
      vps_action: 'suspend',
      subject: `Incident ${id}`,
      codename: exact ? 'abuse' : 'other',
      vps: { id: exact ? 7 : 8, hostname: exact ? 'matched.example.test' : 'other.example.test' },
      user: { id: ownerId, login: `owner${ownerId}` },
      ip_address_assignment: {
        id: exact ? 55 : 56,
        ip_addr: exact ? '203.0.113.10' : '203.0.113.11',
      },
      filed_by: { id: exact ? 1 : 2, login: exact ? 'reporter1' : 'reporter2' },
      mailbox: { id: exact ? 9 : 10, label: exact ? 'abuse' : 'other' },
    };
  });

  await setupHaveApiMock(page, {
    user: { id: actor.id, login: actor.login, level: actor.level },
    handlers: {
      'GET mailboxes': async () => {
        scenario.mailboxRequests += 1;
        return { mailboxes: [{ id: 9, label: 'abuse', user: { id: 1, login: 'reporter1' } }] };
      },
      'GET incident_reports': async ({ searchParams }) => {
        const snapshot = new URLSearchParams(searchParams.toString());
        scenario.listRequests.push(snapshot);

        for (const key of snapshot.keys()) {
          const match = /^incident_report\[([^\]]+)\]$/.exec(key);
          if (!match) continue;

          const field = match[1] ?? '';
          if (!commonFields.has(field) && !adminFields.has(field)) {
            scenario.violations.push(`unsupported incident_report field: ${field}`);
          }
          if (adminFields.has(field) && !isGlobalAdminView) {
            const ownScope = field === 'user' && implicitOwnUserId !== undefined;
            if (!ownScope || incidentField(snapshot, field) !== String(implicitOwnUserId)) {
              scenario.violations.push(`arbitrary admin-only incident_report field: ${field}`);
            }
          }
        }

        const exact = (field: string, value: unknown) => {
          const requested = incidentField(snapshot, field);
          return requested === null || requested === String(value);
        };

        // Mirror the backend authorization contract: every non-admin role is
        // owner-restricted before request filters and pagination are applied.
        const ownerScoped = hasAdminRole ? reports : reports.filter((report) => report.user.id === actor.id);
        const filtered = ownerScoped.filter((report) => {
          return (
            exact('vps', report.vps.id) &&
            exact('user', report.user.id) &&
            exact('filed_by', report.filed_by.id) &&
            exact('ip_address_assignment', report.ip_address_assignment.id) &&
            exact('ip_addr', report.ip_address_assignment.ip_addr) &&
            exact('codename', report.codename) &&
            exact('mailbox', report.mailbox.id)
          );
        });

        const fromId = Number(incidentField(snapshot, 'from_id') ?? '0');
        const limit = Number(incidentField(snapshot, 'limit') ?? '50');
        const pageRows = filtered.filter((report) => !fromId || report.id < fromId).slice(0, limit);

        return {
          incident_reports: pageRows.map((report) => {
            if (hasAdminRole) return report;
            const { user: _user, mailbox: _mailbox, ...visible } = report;
            return visible;
          }),
          _meta: { total_count: filtered.length },
        };
      },
    },
  });

  return scenario;
}

function listItem(page: Page, mobile: boolean, id: number): Locator {
  return page.getByTestId(`incidents.list.${mobile ? 'card' : 'row'}.${id}`);
}

async function expectFilterBarContained(page: Page) {
  const filterBar = page.getByTestId('incidents.list.filters');
  await expect(filterBar).toBeVisible();
  const box = await filterBar.boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

function expectNoForbiddenRequests(
  scenario: IncidentScenario,
  options: { allowArbitraryAdminFilters?: boolean; ownUserId?: number } = {}
) {
  expect(scenario.violations).toEqual([]);
  for (const request of scenario.listRequests) {
    expect(incidentField(request, 'q')).toBeNull();
    expect(incidentField(request, 'query')).toBeNull();
    expect(incidentField(request, 'search')).toBeNull();
    expect(incidentField(request, 'text')).toBeNull();
    expect(incidentField(request, 'subject')).toBeNull();
    if (!options.allowArbitraryAdminFilters) {
      expect(incidentField(request, 'user')).toBe(options.ownUserId === undefined ? null : String(options.ownUserId));
      expect(incidentField(request, 'filed_by')).toBeNull();
      expect(incidentField(request, 'mailbox')).toBeNull();
    }
  }
}

test.describe('Incident reports - exact Smart Filter contract', () => {
  test('admin normalizes stale q before the first GET, rejects full text, and retains exact filters across pages @pr-smoke @pr-smoke-mobile', async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile-chrome';
    const scenario = await installIncidentScenario(page, {
      id: 1,
      login: 'admin',
      level: 100,
      path: '/admin/incidents',
      label: 'admin',
    });

    await page.goto(withAppUrl('/admin/incidents?q=legacy&from_id=101&page=2&limit=25'));
    await expect(listItem(page, mobile, 125)).toBeVisible();
    await expect(page.getByTestId('incidents.list.new')).toBeVisible();
    if (!mobile) await expect(listItem(page, mobile, 125).locator('td')).toHaveCount(9);
    await expect.poll(() => scenario.listRequests.length).toBeGreaterThan(0);

    const first = scenario.listRequests[0]!;
    expect(incidentField(first, 'q')).toBeNull();
    expect(incidentField(first, 'from_id')).toBeNull();
    expect(incidentField(first, 'limit')).toBe('25');
    expect(includes(first)).toBe('user,vps,ip_address_assignment,filed_by,mailbox');

    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get('from_id')).toBeNull();
    await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('1');
    await expectFilterBarContained(page);

    const input = page.getByTestId('incidents.smart_filter.input');
    for (const unsupported of ['network outage', 'q:network', 'subject:network']) {
      const before = scenario.listRequests.length;
      await input.fill(unsupported);
      await input.press('Enter');
      await expect(page.getByTestId('incidents.chip.err.0')).toContainText(
        unsupported.startsWith('subject:') ? /unknown key|neznámý klíč/i : /full-text|plnotextové|key:value|klíč:hodnota/i
      );
      await page.waitForTimeout(200);
      expect(scenario.listRequests).toHaveLength(before);
    }

    await input.fill('vps:7 user:42 filed_by:1 ip:203.0.113.10 assignment:55 codename:abuse mailbox:9');
    await input.press('Enter');
    await expect(listItem(page, mobile, 125)).toBeVisible();
    await expect(page.getByTestId('incidents.chip.codename')).toContainText('codename:abuse');

    await expect.poll(() => new URL(page.url()).searchParams.get('vps')).toBe('7');
    const appliedUrl = new URL(page.url());
    expect(appliedUrl.searchParams.get('user')).toBe('42');
    expect(appliedUrl.searchParams.get('filed_by')).toBe('1');
    expect(appliedUrl.searchParams.get('ip_addr')).toBe('203.0.113.10');
    expect(appliedUrl.searchParams.get('ip_address_assignment')).toBe('55');
    expect(appliedUrl.searchParams.get('codename')).toBe('abuse');
    expect(appliedUrl.searchParams.get('mailbox')).toBe('9');
    expect(appliedUrl.searchParams.get('q')).toBeNull();
    expect(appliedUrl.searchParams.get('from_id')).toBeNull();
    expect(appliedUrl.searchParams.get('page')).toBe('1');

    const applied = scenario.listRequests.at(-1)!;
    expect(incidentField(applied, 'vps')).toBe('7');
    expect(incidentField(applied, 'user')).toBe('42');
    expect(incidentField(applied, 'filed_by')).toBe('1');
    expect(incidentField(applied, 'ip_addr')).toBe('203.0.113.10');
    expect(incidentField(applied, 'ip_address_assignment')).toBe('55');
    expect(incidentField(applied, 'codename')).toBe('abuse');
    expect(incidentField(applied, 'mailbox')).toBe('9');

    await page.getByTestId('incidents.list.pagination.next').click();
    await expect(listItem(page, mobile, 100)).toBeVisible();
    await expect.poll(() => incidentField(scenario.listRequests.at(-1)!, 'from_id')).toBe('101');
    const secondPage = scenario.listRequests.at(-1)!;
    expect(incidentField(secondPage, 'codename')).toBe('abuse');
    expect(incidentField(secondPage, 'user')).toBe('42');
    expect(new URL(page.url()).searchParams.get('page')).toBe('2');

    expectNoForbiddenRequests(scenario, { allowArbitraryAdminFilters: true });

    const pushSupportedFilter = async (codename: string) => {
      await page.evaluate((nextCodename) => {
        const next = `/admin/incidents?limit=25&codename=${encodeURIComponent(nextCodename)}`;
        window.history.pushState({}, '', next);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, codename);
      await expect.poll(() => new URL(page.url()).searchParams.get('codename')).toBe(codename);
      await expect.poll(() => incidentField(scenario.listRequests.at(-1)!, 'codename')).toBe(codename);
    };

    await pushSupportedFilter('abuse');
    await expect(listItem(page, mobile, 125)).toBeVisible();
    await pushSupportedFilter('other');
    await expect(listItem(page, mobile, 75)).toBeVisible();

    await page.goBack();
    await expect.poll(() => new URL(page.url()).searchParams.get('codename')).toBe('abuse');
    await expect(listItem(page, mobile, 125)).toBeVisible();
    await expect(page.getByTestId('incidents.chip.codename')).toContainText('codename:abuse');
    const afterBack = scenario.listRequests.length;
    await page.waitForTimeout(250);
    expect(new URL(page.url()).searchParams.get('codename')).toBe('abuse');
    expect(scenario.listRequests).toHaveLength(afterBack);

    await page.goForward();
    await expect.poll(() => new URL(page.url()).searchParams.get('codename')).toBe('other');
    await expect(listItem(page, mobile, 75)).toBeVisible();
    await expect(page.getByTestId('incidents.chip.codename')).toContainText('codename:other');
    const afterForward = scenario.listRequests.length;
    await page.waitForTimeout(250);
    expect(new URL(page.url()).searchParams.get('codename')).toBe('other');
    expect(scenario.listRequests).toHaveLength(afterForward);

    const beforeOpen = scenario.listRequests.length;
    await input.fill('124');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/admin\/incidents\/124(?:\?|$)/);
    expect(scenario.listRequests).toHaveLength(beforeOpen);
  });

  for (const actor of [
    { id: 41, login: 'member', level: 1, path: '/app/incidents', label: 'regular user' },
    { id: 21, login: 'support', level: 21, path: '/admin/incidents', label: 'support role' },
  ] satisfies Actor[]) {
    test(`${actor.label} strips stale and admin-only URL fields before the first GET and stays exact across pages @pr-smoke @pr-smoke-mobile`, async ({ page }, testInfo) => {
      const mobile = testInfo.project.name === 'mobile-chrome';
      const scenario = await installIncidentScenario(page, actor);
      const directUrl = `${actor.path}?q=legacy&from_id=101&page=2&limit=25&user=42&filed_by=1&mailbox=9&codename=abuse`;

      await page.goto(withAppUrl(directUrl));
      await expect(listItem(page, mobile, 125)).toBeVisible();
      await expect(page.getByTestId('incidents.list.new')).toHaveCount(0);
      if (!mobile) await expect(listItem(page, mobile, 125).locator('td')).toHaveCount(7);
      await expect.poll(() => scenario.listRequests.length).toBeGreaterThan(0);

      const first = scenario.listRequests[0]!;
      expect(incidentField(first, 'from_id')).toBeNull();
      expect(incidentField(first, 'limit')).toBe('25');
      expect(incidentField(first, 'codename')).toBe('abuse');
      expect(includes(first)).toBe('vps,ip_address_assignment,filed_by');

      await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('1');
      const normalizedUrl = new URL(page.url());
      for (const key of ['q', 'from_id', 'user', 'filed_by', 'mailbox']) {
        expect(normalizedUrl.searchParams.get(key)).toBeNull();
      }
      expect(normalizedUrl.searchParams.get('codename')).toBe('abuse');

      await page.getByTestId('incidents.filters.advanced').click();
      await expect(page.getByTestId('incidents.advanced.vps')).toBeVisible();
      await expect(page.getByTestId('incidents.advanced.codename')).toBeVisible();
      for (const id of ['q', 'user', 'filed_by', 'mailbox']) {
        await expect(page.getByTestId(`incidents.advanced.${id}`)).toHaveCount(0);
      }
      await page.getByTestId('incidents.advanced.done').click();

      const input = page.getByTestId('incidents.smart_filter.input');
      const before = scenario.listRequests.length;
      await input.fill('user:42 filed_by:1 mailbox:9');
      await input.press('Enter');
      await expect(page.getByTestId('incidents.chip.err.0')).toContainText(/admin|administr/i);
      await page.waitForTimeout(200);
      expect(scenario.listRequests).toHaveLength(before);

      await page.getByTestId('incidents.list.pagination.next').click();
      await expect(listItem(page, mobile, 100)).toBeVisible();
      await expect.poll(() => incidentField(scenario.listRequests.at(-1)!, 'from_id')).toBe('101');
      expect(incidentField(scenario.listRequests.at(-1)!, 'codename')).toBe('abuse');

      expect(scenario.mailboxRequests).toBe(0);
      expectNoForbiddenRequests(scenario);
      await expectFilterBarContained(page);
    });
  }

  for (const actor of [
    { id: 1, login: 'admin', level: 100, path: '/app/incidents', label: 'admin My view' },
    { id: 21, login: 'support', level: 21, path: '/app/incidents', label: 'support My view' },
  ] satisfies Actor[]) {
    test(`${actor.label} replaces arbitrary URL scope with its own implicit user before the first GET @pr-smoke @pr-smoke-mobile`, async ({ page }, testInfo) => {
      const mobile = testInfo.project.name === 'mobile-chrome';
      const scenario = await installIncidentScenario(page, actor);

      await page.goto(
        withAppUrl(
          `${actor.path}?q=legacy&from_id=101&page=2&limit=25&user=999&filed_by=999&mailbox=999&codename=abuse`
        )
      );
      await expect(listItem(page, mobile, 125)).toBeVisible();
      await expect(page.getByTestId('incidents.list.new')).toHaveCount(0);
      if (mobile) {
        await expect(listItem(page, mobile, 125)).not.toContainText(`owner${actor.id}`);
      } else {
        await expect(listItem(page, mobile, 125).locator('td')).toHaveCount(7);
      }
      await expect.poll(() => scenario.listRequests.length).toBeGreaterThan(0);

      const first = scenario.listRequests[0]!;
      expect(incidentField(first, 'user')).toBe(String(actor.id));
      expect(incidentField(first, 'from_id')).toBeNull();
      expect(incidentField(first, 'codename')).toBe('abuse');
      expect(includes(first)).toBe('vps,ip_address_assignment,filed_by');

      await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('1');
      const normalizedUrl = new URL(page.url());
      for (const key of ['q', 'from_id', 'user', 'filed_by', 'mailbox']) {
        expect(normalizedUrl.searchParams.get(key)).toBeNull();
      }

      await page.getByTestId('incidents.filters.advanced').click();
      for (const id of ['q', 'user', 'filed_by', 'mailbox']) {
        await expect(page.getByTestId(`incidents.advanced.${id}`)).toHaveCount(0);
      }
      await page.getByTestId('incidents.advanced.done').click();

      await page.getByTestId('incidents.list.pagination.next').click();
      await expect(listItem(page, mobile, 100)).toBeVisible();
      await expect.poll(() => incidentField(scenario.listRequests.at(-1)!, 'from_id')).toBe('101');
      expect(incidentField(scenario.listRequests.at(-1)!, 'user')).toBe(String(actor.id));

      expect(scenario.mailboxRequests).toBe(0);
      expectNoForbiddenRequests(scenario, { ownUserId: actor.id });
      await expectFilterBarContained(page);
    });
  }
});

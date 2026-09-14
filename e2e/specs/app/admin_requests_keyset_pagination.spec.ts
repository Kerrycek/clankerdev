import { test, expect, type Page, type TestInfo } from '@playwright/test';

import { bootstrapVpsAdminWindow } from '../../fixtures/bootstrap';
import { installHaveApiMock } from '../../fixtures/haveapi';
import { withAppUrl } from '../../fixtures/url';

function makeRegistration(id: number) {
  return {
    id,
    state: id === 299 ? 'denied' : 'awaiting',
    label: `Registration #${id}`,
    user: { id: 1000 + id, login: `user${id}` },
    api_ip_addr: '203.0.113.10',
    client_ip_addr: '198.51.100.20',
    created_at: '2026-02-14T10:00:00Z',
    // fraud scores to exercise the risk badge
    ip_fraud_score: id % 100,
    mail_fraud_score: (id + 10) % 100,
  };
}

function makeChange(id: number) {
  return {
    id,
    state: 'awaiting',
    label: `Change #${id}`,
    user: { id: 2000 + id, login: `user${id}` },
    api_ip_addr: '203.0.113.10',
    client_ip_addr: '198.51.100.20',
    created_at: '2026-02-14T10:00:00Z',
  };
}

function pageSlice(descIds: number[], fromId: number | null, limit: number): number[] {
  const filtered = fromId ? descIds.filter((id) => id < fromId) : descIds;
  return filtered.slice(0, limit);
}

function requestRows(page: Page, testInfo: TestInfo) {
  return testInfo.project.name === 'mobile-chrome'
    ? page.locator('[data-testid^="admin.requests.mobile.row."]')
    : page.locator('tbody > tr[data-testid^="admin.requests.row."]');
}

async function requestKeys(page: Page, testInfo: TestInfo): Promise<string[]> {
  const prefix = testInfo.project.name === 'mobile-chrome'
    ? 'admin.requests.mobile.row.'
    : 'admin.requests.row.';
  const testIds = await requestRows(page, testInfo).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-testid') ?? '')
  );
  return testIds.map((testId) => testId.slice(prefix.length));
}

function paginationPrefix(testInfo: TestInfo): string {
  return `admin.requests.pagination.${testInfo.project.name === 'mobile-chrome' ? 'mobile' : 'desktop'}`;
}

test('@pr-smoke @pr-smoke-mobile @smoke @smoke-mobile admin requests: an exactly full terminal page does not offer an empty next page', async ({ page }, testInfo) => {
  await bootstrapVpsAdminWindow(page);
  const haveApiMock = await installHaveApiMock(page, { user: { id: 1, login: 'admin', level: 100 } });
  const registrationCalls: Array<{ limit: number; fromId: number | null; state: string | null }> = [];
  let changeCalls = 0;
  const registrations = Array.from({ length: 25 }, (_, index) => 125 - index);

  haveApiMock.addHandler('GET user_request/registrations', ({ searchParams }) => {
    const limit = Number(searchParams.get('registration[limit]') ?? 25);
    const rawFromId = searchParams.get('registration[from_id]');
    const fromId = rawFromId ? Number(rawFromId) : null;
    registrationCalls.push({ limit, fromId, state: searchParams.get('registration[state]') });
    return { registrations: pageSlice(registrations, fromId, limit).map(makeRegistration) };
  });
  haveApiMock.addHandler('GET user_request/changes', () => {
    changeCalls += 1;
    return { changes: [] };
  });

  await page.goto(withAppUrl('/admin/requests?type=registration&limit=25'));

  const rows = requestRows(page, testInfo);
  await expect(rows).toHaveCount(25);
  await expect.poll(() => requestKeys(page, testInfo)).toEqual(
    registrations.map((id) => `registration.${id}`)
  );
  await expect.poll(() => registrationCalls.some((call) =>
    call.limit === 26 && call.fromId === null && call.state === 'awaiting'
  )).toBe(true);
  expect(changeCalls).toBe(0);

  const pagination = paginationPrefix(testInfo);
  await expect(page.getByTestId(`${pagination}.prev`)).toBeDisabled();
  await expect(page.getByTestId(`${pagination}.next`)).toBeDisabled();
});

test('@pr-smoke @pr-smoke-mobile @smoke @smoke-mobile admin requests: keyset pagination merges registrations + changes without gaps', async ({ page }, testInfo) => {
  await bootstrapVpsAdminWindow(page);
  const haveApiMock = await installHaveApiMock(page, { user: { id: 1, login: 'admin', level: 100 } });
  const registrationCalls: Array<{ limit: number; fromId: number | null; state: string | null }> = [];
  const changeCalls: Array<{ limit: number; fromId: number | null; state: string | null }> = [];

  // Interleaved ids: registrations are even, changes are odd.
  const registrations = Array.from({ length: 60 }, (_, i) => 300 - i).filter((id) => id % 2 === 0);
  const changes = Array.from({ length: 60 }, (_, i) => 300 - i).filter((id) => id % 2 === 1);

  haveApiMock.addHandler('GET user_request/registrations', ({ searchParams }) => {
    const limit = Number(searchParams.get('registration[limit]') ?? 25);
    const fromIdRaw = searchParams.get('registration[from_id]');
    const fromId = fromIdRaw ? Number(fromIdRaw) : null;
    registrationCalls.push({ limit, fromId, state: searchParams.get('registration[state]') });

    const ids = pageSlice(registrations, fromId, limit);
    return {
      status: true,
      response: {
        registrations: ids.map(makeRegistration),
      },
    };
  });

  haveApiMock.addHandler('GET user_request/changes', ({ searchParams }) => {
    const limit = Number(searchParams.get('change[limit]') ?? 25);
    const fromIdRaw = searchParams.get('change[from_id]');
    const fromId = fromIdRaw ? Number(fromIdRaw) : null;
    changeCalls.push({ limit, fromId, state: searchParams.get('change[state]') });

    const ids = pageSlice(changes, fromId, limit);
    return {
      status: true,
      response: {
        changes: ids.map(makeChange),
      },
    };
  });

  await page.goto(withAppUrl('/admin/requests?limit=25'));

  const expectedKeys = Array.from({ length: 60 }, (_, index) => {
    const id = 300 - index;
    return `${id % 2 === 0 ? 'registration' : 'change'}.${id}`;
  });
  const visitedKeys: string[] = [];
  const pagination = paginationPrefix(testInfo);

  await expect.poll(() => registrationCalls.some((call) =>
    call.limit === 26 && call.fromId === null && call.state === 'awaiting'
  )).toBe(true);
  await expect.poll(() => changeCalls.some((call) =>
    call.limit === 26 && call.fromId === null && call.state === 'awaiting'
  )).toBe(true);
  await expect.poll(() => requestKeys(page, testInfo)).toEqual(expectedKeys.slice(0, 25));
  visitedKeys.push(...await requestKeys(page, testInfo));
  await expect(page.getByTestId(`${pagination}.next`)).toBeEnabled();

  await page.getByTestId(`${pagination}.next`).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('from_id')).toBe('276');
  await expect.poll(() => registrationCalls.some((call) => call.limit === 26 && call.fromId === 276)).toBe(true);
  await expect.poll(() => changeCalls.some((call) => call.limit === 26 && call.fromId === 276)).toBe(true);
  await expect.poll(() => requestKeys(page, testInfo)).toEqual(expectedKeys.slice(25, 50));
  visitedKeys.push(...await requestKeys(page, testInfo));
  await expect(page.getByTestId(`${pagination}.next`)).toBeEnabled();

  await page.getByTestId(`${pagination}.next`).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('from_id')).toBe('251');
  await expect.poll(() => requestKeys(page, testInfo)).toEqual(expectedKeys.slice(50));
  visitedKeys.push(...await requestKeys(page, testInfo));
  await expect(page.getByTestId(`${pagination}.next`)).toBeDisabled();
  await expect(page.getByTestId(`${pagination}.prev`)).toBeEnabled();

  expect(visitedKeys).toEqual(expectedKeys);
  expect(new Set(visitedKeys).size).toBe(expectedKeys.length);
});

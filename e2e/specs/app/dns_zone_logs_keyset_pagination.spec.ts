import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('DNS zone logs filters and keyset pagination', () => {
  let recordLogRequestQueries: string[];

  const listRequestQueries = () =>
    recordLogRequestQueries
      .map((query) => new URLSearchParams(query))
      .filter((query) => query.get('dns_record_log[limit]') !== '5');

  const latestListRequest = () => {
    const requests = listRequestQueries();
    return requests.length > 0 ? requests[requests.length - 1] : undefined;
  };

  test.beforeEach(async ({ page }) => {
    recordLogRequestQueries = [];
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const zone = {
      id: 10,
      name: 'zone10.example',
      role: 'primary',
      enabled: true,
      dnssec_enabled: false,
      serial: 2026012601,
      default_ttl: 3600,
    };
    const changeTypes = ['create_record', 'update_record', 'delete_record'] as const;
    const recordTypes = ['A', 'AAAA', 'TXT'] as const;
    const logs = Array.from({ length: 100 }, (_, i) => 300 - i).map((id) => ({
      id,
      created_at: '2026-01-26T00:00:00.000Z',
      change_type: id === 297 ? 'future_record' : changeTypes[(300 - id) % changeTypes.length],
      name: id === 300 ? 'www' : id === 299 ? 'mail' : `host${id}`,
      type: recordTypes[(300 - id) % recordTypes.length],
      attr_changes: { content: { old: null, new: '...' } },
      transaction_chain: { id: 9000 + id },
    }));

    await installHaveApiMock(page, {
      user: { id: 1, login: 'test', level: 1 },
      handlers: {
        'GET dns_zones/10': () => zone,
        'GET dns_record_logs': ({ searchParams }) => {
          recordLogRequestQueries.push(searchParams.toString());

          const allowedParams = new Set([
            'dns_record_log[dns_zone]',
            'dns_record_log[from_id]',
            'dns_record_log[limit]',
            'dns_record_log[name]',
            'dns_record_log[type]',
            'dns_record_log[change_type]',
          ]);
          const unsupportedParams = Array.from(searchParams.keys()).filter(
            (key) => key.startsWith('dns_record_log[') && !allowedParams.has(key)
          );

          // A strict mock prevents browser coverage from inventing filters that
          // the real HaveAPI resource would silently discard.
          if (unsupportedParams.length > 0) {
            return { status: false, message: `Unsupported parameters: ${unsupportedParams.join(', ')}`, response: null };
          }

          if (searchParams.get('dns_record_log[dns_zone]') !== '10') {
            return { dns_record_logs: [], _meta: { total_count: 0 } };
          }

          const name = searchParams.get('dns_record_log[name]');
          const type = searchParams.get('dns_record_log[type]');
          const changeType = searchParams.get('dns_record_log[change_type]');
          const fromId = Number(searchParams.get('dns_record_log[from_id]') || '0');
          const limit = Number(searchParams.get('dns_record_log[limit]') || '50');
          const filtered = logs.filter(
            (log) =>
              (!name || log.name === name) &&
              (!type || log.type === type) &&
              (!changeType || log.change_type === changeType)
          );
          const afterCursor = fromId > 0 ? filtered.filter((log) => log.id < fromId) : filtered;

          return {
            dns_record_logs: afterCursor.slice(0, limit),
            _meta: { total_count: filtered.length },
          };
        },
      },
    });
  });

  test('@pr-smoke @pr-smoke-mobile renders real change badges and keeps pagination inside the viewport', async ({
    page,
  }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile-chrome';
    const itemKind = mobile ? 'card' : 'row';
    const pagination = `dns.logs.pagination.${mobile ? 'mobile' : 'desktop'}`;

    await page.goto('/app/dns/zones/10/logs');
    await expect(page.getByTestId('dns.logs.list')).toBeVisible();
    await expect(page.getByTestId(`dns.logs.${itemKind}.300`)).toBeVisible();
    await expect(page.getByTestId(`dns.logs.${itemKind}.300.change`)).toHaveText(/Created|Vytvořeno/);
    await expect(page.getByTestId(`dns.logs.${itemKind}.299.change`)).toHaveText(/Updated|Aktualizováno/);
    await expect(page.getByTestId(`dns.logs.${itemKind}.298.change`)).toHaveText(/Deleted|Smazáno/);
    await expect(page.getByTestId(`dns.logs.${itemKind}.297.change`)).toHaveText('future_record');

    const containment = await page.getByTestId('dns.logs.filters').evaluate((filters) => {
      const rect = filters.getBoundingClientRect();
      return {
        filtersInsideViewport: rect.left >= 0 && rect.right <= document.documentElement.clientWidth + 1,
        pageHasNoHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      };
    });
    expect(containment).toEqual({ filtersInsideViewport: true, pageHasNoHorizontalOverflow: true });

    await page.getByTestId(`${pagination}.next`).click();
    await expect(page).toHaveURL((url) => url.searchParams.get('from_id') === '251' && url.searchParams.get('page') === '2');
    await expect(page.getByTestId(`dns.logs.${itemKind}.250`)).toBeVisible();

    await page.getByTestId(`${pagination}.prev`).click();
    await expect(page).toHaveURL((url) => !url.searchParams.has('from_id') && url.searchParams.get('page') === '1');
    await expect(page.getByTestId(`dns.logs.${itemKind}.300`)).toBeVisible();
    expect(recordLogRequestQueries.every((query) => !new URLSearchParams(query).has('dns_record_log[q]'))).toBe(true);
  });

  test('@pr-smoke @pr-smoke-mobile applies exact supported filters, clears them, and resets pagination', async ({
    page,
  }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile-chrome';
    const itemKind = mobile ? 'card' : 'row';
    const pagination = `dns.logs.pagination.${mobile ? 'mobile' : 'desktop'}`;

    // Simulate a stale bookmark with the old q filter, invalid structured
    // values and a cursor. Normalization must happen before the first list GET.
    await page.goto(
      '/app/dns/zones/10/logs?q=legacy&name=%20%20&type=BOGUS&change_type=create&from_id=251&page=2'
    );
    await expect(page.getByTestId(`dns.logs.${itemKind}.300`)).toBeVisible();
    await expect(page).toHaveURL((url) =>
      !url.searchParams.has('q') &&
      !url.searchParams.has('name') &&
      !url.searchParams.has('type') &&
      !url.searchParams.has('change_type') &&
      !url.searchParams.has('from_id') &&
      url.searchParams.get('page') === '1'
    );
    await expect.poll(() => listRequestQueries().length).toBeGreaterThan(0);
    const normalizedRequest = listRequestQueries()[0];
    expect(normalizedRequest.has('dns_record_log[from_id]')).toBe(false);
    expect(normalizedRequest.has('dns_record_log[q]')).toBe(false);
    expect(normalizedRequest.has('dns_record_log[name]')).toBe(false);
    expect(normalizedRequest.has('dns_record_log[type]')).toBe(false);
    expect(normalizedRequest.has('dns_record_log[change_type]')).toBe(false);

    await page.getByTestId(`${pagination}.next`).click();
    await expect(page).toHaveURL((url) => url.searchParams.get('from_id') === '251' && url.searchParams.get('page') === '2');

    const requestsBeforeDraft = listRequestQueries().length;
    await page.getByTestId('dns.logs.filter.name').fill('www');
    await page.getByTestId('dns.logs.filter.type').selectOption('A');
    await page.getByTestId('dns.logs.filter.change_type').selectOption('create_record');
    await page.waitForTimeout(250);

    expect(listRequestQueries()).toHaveLength(requestsBeforeDraft);
    await expect(page).toHaveURL((url) =>
      !url.searchParams.has('q') &&
      !url.searchParams.has('name') &&
      !url.searchParams.has('type') &&
      !url.searchParams.has('change_type')
    );

    await page.getByTestId('dns.logs.filter.apply').click();
    await expect(page).toHaveURL((url) =>
      url.searchParams.get('name') === 'www' &&
      url.searchParams.get('type') === 'A' &&
      url.searchParams.get('change_type') === 'create_record' &&
      !url.searchParams.has('q') &&
      !url.searchParams.has('from_id') &&
      url.searchParams.get('page') === '1'
    );
    await expect(page.getByTestId(`dns.logs.${itemKind}.300`)).toBeVisible();
    await expect(page.getByTestId(`dns.logs.${itemKind}.299`)).toHaveCount(0);

    await expect.poll(() => latestListRequest()?.get('dns_record_log[name]')).toBe('www');
    const appliedRequest = latestListRequest();
    expect(appliedRequest?.get('dns_record_log[dns_zone]')).toBe('10');
    expect(appliedRequest?.get('dns_record_log[type]')).toBe('A');
    expect(appliedRequest?.get('dns_record_log[change_type]')).toBe('create_record');
    expect(appliedRequest?.has('dns_record_log[from_id]')).toBe(false);
    expect(appliedRequest?.has('dns_record_log[q]')).toBe(false);
    expect(appliedRequest?.has('dns_record_log[user]')).toBe(false);
    expect(appliedRequest?.has('dns_record_log[dns_zone_name]')).toBe(false);

    const requestsBeforeClear = listRequestQueries().length;
    await page.getByTestId('dns.logs.filter.clear').click();
    await expect(page).toHaveURL((url) =>
      !url.searchParams.has('name') &&
      !url.searchParams.has('type') &&
      !url.searchParams.has('change_type') &&
      !url.searchParams.has('q') &&
      !url.searchParams.has('from_id') &&
      url.searchParams.get('page') === '1'
    );
    await expect(page.getByTestId(`dns.logs.${itemKind}.299`)).toBeVisible();
    // The unfiltered first page can be served from React Query's fresh cache.
    // Refresh once so the cleared wire contract is asserted deterministically.
    await page.getByTestId('dns.logs.refresh').click();
    await expect.poll(() => listRequestQueries().length).toBeGreaterThan(requestsBeforeClear);
    await expect.poll(() => latestListRequest()?.has('dns_record_log[name]')).toBe(false);

    const clearedRequest = latestListRequest();
    expect(clearedRequest?.has('dns_record_log[type]')).toBe(false);
    expect(clearedRequest?.has('dns_record_log[change_type]')).toBe(false);
    expect(recordLogRequestQueries.every((query) => !new URLSearchParams(query).has('dns_record_log[q]'))).toBe(true);
  });
});

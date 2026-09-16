import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile profile session transaction link filters the app transaction chains by user_session', async ({ page }) => {
  const sessionId = 77;
  const matchingChainId = 8101;
  const unrelatedChainId = 8102;
  const chains = [
    {
      id: matchingChainId,
      label: 'Firefox login activity',
      name: 'user_session_activity',
      state: 'done',
      size: 1,
      progress: 1,
      created_at: '2026-09-14T08:00:00Z',
      concerns: [],
      user_session: { id: sessionId },
    },
    {
      id: unrelatedChainId,
      label: 'Other session activity',
      name: 'user_session_activity',
      state: 'done',
      size: 1,
      progress: 1,
      created_at: '2026-09-14T07:00:00Z',
      concerns: [],
      user_session: { id: 88 },
    },
  ];

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_SESSION' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'e2e', level: 1 },
    handlers: {
      'GET user_sessions': () => ({
        user_sessions: [
          {
            id: sessionId,
            label: 'Firefox',
            auth_type: 'oauth2',
            created_at: '2026-09-14T06:00:00Z',
            last_request_at: '2026-09-14T08:00:00Z',
            closed_at: null,
            api_ip_addr: '203.0.113.10',
            client_ip_addr: '203.0.113.10',
            user_agent: 'Playwright',
            client_version: 'e2e',
            request_count: 2,
            scope: 'all',
          },
        ],
      }),
      'GET transaction_chains': ({ searchParams }) => {
        const requestedSessionId = searchParams.get('transaction_chain[user_session]');
        return {
          transaction_chains: requestedSessionId
            ? chains.filter((chain) => String(chain.user_session.id) === requestedSessionId)
            : chains,
        };
      },
    },
  });

  await page.goto('/app/profile/sessions');

  const transactionLink = page
    .getByTestId(`profile.sessions.row.${sessionId}.transactions`)
    .filter({ visible: true });
  await expect(transactionLink).toHaveAttribute('href', `/app/transactions?user_session=${sessionId}`);

  const filteredRequest = page.waitForRequest(
    (request) => {
      if (request.method() !== 'GET') return false;
      const url = new URL(request.url());
      return (
        url.pathname.endsWith('/transaction_chains') &&
        url.searchParams.get('transaction_chain[user_session]') === String(sessionId)
      );
    },
    { timeout: 15_000 }
  );

  await transactionLink.click();
  const request = await filteredRequest;

  expect(new URL(request.url()).searchParams.get('transaction_chain[user_session]')).toBe(String(sessionId));
  await expect(page).toHaveURL((url) => {
    return url.pathname === '/app/transactions' && url.searchParams.get('user_session') === String(sessionId);
  });
  await expect(page.getByText(`session:${sessionId}`, { exact: true })).toBeVisible();
  await expect(page.getByTestId(`transactions.row.${matchingChainId}`)).toBeVisible();
  await expect(page.getByTestId(`transactions.row.${unrelatedChainId}`)).toHaveCount(0);
});

test('@pr-smoke @pr-smoke-mobile app transaction filters apply user_session from smart and advanced controls', async ({ page }) => {
  const firstSessionId = 77;
  const secondSessionId = 88;
  const firstChainId = 8301;
  const secondChainId = 8302;
  const chains = [
    {
      id: firstChainId,
      label: 'First session activity',
      name: 'user_session_activity',
      state: 'done',
      size: 1,
      progress: 1,
      created_at: '2026-09-14T08:00:00Z',
      concerns: [],
      user_session: { id: firstSessionId },
    },
    {
      id: secondChainId,
      label: 'Second session activity',
      name: 'user_session_activity',
      state: 'done',
      size: 1,
      progress: 1,
      created_at: '2026-09-14T07:00:00Z',
      concerns: [],
      user_session: { id: secondSessionId },
    },
  ];

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_SESSION' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'e2e', level: 1 },
    handlers: {
      'GET transaction_chains': ({ searchParams }) => {
        const requestedSessionId = searchParams.get('transaction_chain[user_session]');
        return {
          transaction_chains: requestedSessionId
            ? chains.filter((chain) => String(chain.user_session.id) === requestedSessionId)
            : chains,
        };
      },
    },
  });

  await page.goto('/app/transactions');
  await expect(page.getByTestId(`transactions.row.${firstChainId}`)).toBeVisible();
  await expect(page.getByTestId(`transactions.row.${secondChainId}`)).toBeVisible();

  const smartRequest = page.waitForRequest((request) => {
    if (request.method() !== 'GET') return false;
    const url = new URL(request.url());
    return (
      url.pathname.endsWith('/transaction_chains') &&
      url.searchParams.get('transaction_chain[user_session]') === String(firstSessionId)
    );
  });
  const smartInput = page.getByTestId('transactions.chains.smart_filter.input');
  await smartInput.fill(`session:${firstSessionId}`);
  await smartInput.press('Escape');
  await smartInput.press('Enter');
  const appliedSmartRequest = await smartRequest;

  expect(new URL(appliedSmartRequest.url()).searchParams.get('transaction_chain[user_session]')).toBe(
    String(firstSessionId)
  );
  await expect(page).toHaveURL((url) => {
    return url.pathname === '/app/transactions' && url.searchParams.get('user_session') === String(firstSessionId);
  });
  await expect(page.getByText(`session:${firstSessionId}`, { exact: true })).toBeVisible();
  await expect(page.getByTestId(`transactions.row.${firstChainId}`)).toBeVisible();
  await expect(page.getByTestId(`transactions.row.${secondChainId}`)).toHaveCount(0);

  await page.getByTestId('transactions.chains.advanced.open').click();
  const advancedSession = page.getByTestId('transactions.chains.advanced.session');
  await expect(advancedSession).toBeVisible();
  await expect(advancedSession).toHaveAccessibleName('Session');
  await expect(advancedSession).toHaveValue(String(firstSessionId));

  const advancedRequest = page.waitForRequest((request) => {
    if (request.method() !== 'GET') return false;
    const url = new URL(request.url());
    return (
      url.pathname.endsWith('/transaction_chains') &&
      url.searchParams.get('transaction_chain[user_session]') === String(secondSessionId)
    );
  });
  await advancedSession.fill(String(secondSessionId));
  const appliedAdvancedRequest = await advancedRequest;

  expect(new URL(appliedAdvancedRequest.url()).searchParams.get('transaction_chain[user_session]')).toBe(
    String(secondSessionId)
  );
  await expect(page).toHaveURL((url) => {
    return url.pathname === '/app/transactions' && url.searchParams.get('user_session') === String(secondSessionId);
  });
  await expect(page.getByText(`session:${secondSessionId}`, { exact: true })).toBeVisible();
  await expect(page.getByTestId(`transactions.row.${firstChainId}`)).toHaveCount(0);
  await expect(page.getByTestId(`transactions.row.${secondChainId}`)).toBeVisible();
});

test('@pr-smoke @pr-smoke-mobile invalid user_session is removed before the page requests unfiltered transaction chains', async ({ page }) => {
  let unfilteredPageRequests = 0;

  await page.addInitScript(() => {
    const instrumentedWindow = window as typeof window & { __unfilteredTransactionChainRequestLocations?: string[] };
    instrumentedWindow.__unfilteredTransactionChainRequestLocations = [];
    const originalFetch = window.fetch.bind(window);

    window.fetch = (...args: Parameters<typeof window.fetch>) => {
      const input = args[0];
      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const requestUrl = new URL(rawUrl, window.location.href);
      const isPageRequest = requestUrl.searchParams.get('transaction_chain[limit]') === '51';
      const isUnfiltered = !requestUrl.searchParams.has('transaction_chain[user_session]');

      if (requestUrl.pathname.endsWith('/transaction_chains') && isPageRequest && isUnfiltered) {
        instrumentedWindow.__unfilteredTransactionChainRequestLocations?.push(window.location.href);
      }

      return originalFetch(...args);
    };
  });

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_SESSION' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'e2e', level: 1 },
    handlers: {
      'GET transaction_chains': ({ searchParams }) => {
        const isPageRequest = searchParams.get('transaction_chain[limit]') === '51';
        const isUnfiltered = !searchParams.has('transaction_chain[user_session]');

        if (isPageRequest && isUnfiltered) {
          unfilteredPageRequests += 1;
        }

        return {
          transaction_chains: [
            {
              id: 8201,
              label: 'Unfiltered activity',
              name: 'user_activity',
              state: 'done',
              size: 1,
              progress: 1,
              created_at: '2026-09-14T08:00:00Z',
              concerns: [],
            },
          ],
        };
      },
    },
  });

  await page.goto('/app/transactions?user_session=not-a-number');

  await expect(page).toHaveURL((url) => {
    return url.pathname === '/app/transactions' && !url.searchParams.has('user_session');
  });
  await expect(page.getByTestId('transactions.row.8201')).toBeVisible();
  await expect.poll(() => unfilteredPageRequests).toBeGreaterThan(0);
  const requestLocations = await page.evaluate(() => {
    return (window as typeof window & { __unfilteredTransactionChainRequestLocations?: string[] })
      .__unfilteredTransactionChainRequestLocations ?? [];
  });
  expect(requestLocations.length).toBeGreaterThan(0);
  expect(requestLocations.filter((location) => new URL(location).searchParams.has('user_session'))).toEqual([]);
});

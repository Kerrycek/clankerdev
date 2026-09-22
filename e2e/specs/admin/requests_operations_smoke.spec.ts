import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock } from '../../fixtures';

function registration(id: number, state = 'awaiting') {
  return {
    id,
    state,
    label: `Registration #${id}`,
    user: { id: 42, login: 'alice' },
    admin: { id: 1, login: 'admin' },
    login: 'alice',
    full_name: 'Alice Example',
    org_name: 'Example Foundation',
    org_id: 'CZ12345678',
    email: 'alice@example.test',
    address: 'Stodolní 138/44, 14400 Ostrava, Česko',
    year_of_birth: 1990,
    how: 'Community recommendation',
    note: 'Runs public mirrors',
    os_template: { id: 5, label: 'Debian 13', cgroup_version: 'cgroup_v2' },
    location: { id: 7, label: 'Prague' },
    currency: 'czk',
    language: { id: 2, code: 'cs', label: 'Čeština' },
    time_zone: 'Europe/Prague',
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T11:00:00Z',
    api_ip_addr: '203.0.113.10',
    client_ip_addr: '198.51.100.20',
    ip_fraud_score: 87,
    ip_checked: true,
    ip_success: true,
    ip_request_id: 'ip-check-123',
    ip_proxy: true,
    ip_crawler: false,
    ip_recent_abuse: true,
    ip_vpn: true,
    ip_tor: false,
    mail_checked: true,
    mail_success: false,
    mail_request_id: 'mail-check-123',
    mail_errors: 'Provider timeout',
    mail_valid: false,
    mail_disposable: true,
    mail_timed_out: true,
    mail_deliverability: 'low',
    mail_catch_all: false,
    mail_leaked: true,
    mail_suspect: true,
    mail_smtp_score: 12,
    mail_overall_score: 19,
    mail_fraud_score: 100,
    mail_dns_valid: false,
    mail_honeypot: false,
    mail_spam_trap_score: 'high',
    mail_recent_abuse: true,
    mail_frequent_complainer: true,
    action_state_id: 77,
    transaction_chain_id: 88,
    transaction_id: 99,
  };
}

async function installOsmMapMock(page: Page, options: { empty?: boolean; failFirst?: boolean } = {}) {
  let requests = 0;

  await page.route(/^https:\/\/nominatim\.openstreetmap\.org\/search(?:\?|$)/, async (route) => {
    requests += 1;
    if (options.failFirst && requests === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: '[]' });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(options.empty ? [] : [{ lat: '49.8356441', lon: '18.2843426' }]),
    });
  });

  await page.route(/^https:\/\/www\.openstreetmap\.org\/export\/embed\.html(?:\?|$)/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Map</title>' });
  });

  return { requestCount: () => requests };
}

test('@workflow-matrix @smoke admin requests: one list row opens the canonical detail with return context', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const osm = await installOsmMapMock(page);

  const states: Array<string | null> = [];
  const resolveBodies: unknown[] = [];
  let current = registration(123);

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': ({ searchParams }) => {
        states.push(searchParams.get('registration[state]'));
        return { registrations: [current] };
      },
      'GET user_request/changes': () => ({ changes: [] }),
      'GET user_request/registrations/123': () => ({ registration: current }),
      'GET nodes': () => ({ nodes: [] }),
      'POST user_request/registrations/123/resolve': ({ reqJson }) => {
        resolveBodies.push(reqJson);
        current = { ...current, state: 'approved', action_state_id: 177 };
        return { registration: current, _meta: { action_state_id: 177 } };
      },
    },
  });

  await page.goto('/admin/requests');
  await expect(page.getByTestId('admin.requests.table')).toBeVisible();
  const desktopRow = page.getByTestId('admin.requests.row.registration.123');
  await expect(desktopRow).not.toHaveAttribute('tabindex');
  await expect(desktopRow.getByRole('link', { name: '#123' })).toBeVisible();

  await expect.poll(() => states.includes('awaiting')).toBeTruthy();
  expect(new URL(page.url()).searchParams.get('state')).toBeNull();
  await expect(page.getByTestId('admin.requests.quick.awaiting')).toHaveAttribute('aria-pressed', 'true');

  await desktopRow.getByRole('link', { name: '#123' }).press('Enter');
  await expect(page).toHaveURL(/\/admin\/requests\/registration\/123\?returnTo=/);
  const returnTo = new URL(page.url()).searchParams.get('returnTo');
  expect(new URL(returnTo ?? '/', 'https://example.test').pathname).toBe('/admin/requests');
  await expect(page.getByTestId('admin.requests.resolve.action.approve')).toBeVisible();
  await expect(page.getByTestId('admin.requests.resolve.action.deny')).toBeVisible();
  await expect(page.getByTestId('admin.requests.resolve.action.ignore')).toBeVisible();
  await expect(page.getByTestId('admin.requests.resolve.action.request_correction')).toBeVisible();
  await expect(page.getByTestId('admin.requests.detail.risk.ip.status')).toContainText(/completed|dokončena/i);
  await expect(page.getByTestId('admin.requests.detail.risk.mail.status')).toContainText(/failed|selhala/i);
  await expect(page.getByTestId('admin.requests.detail.registration.fields')).toContainText('Alice Example');
  await expect(page.getByTestId('admin.requests.detail.registration.fields')).toContainText('1990');
  await expect(page.getByTestId('admin.requests.detail.registration.fields')).toContainText('Community recommendation');
  await expect(page.getByTestId('admin.requests.detail.registration.fields')).toContainText('Runs public mirrors');
  await expect(page.getByTestId('admin.requests.detail.registration.fields')).toContainText('Debian 13');
  await expect(page.getByTestId('admin.requests.detail.registration.fields')).toContainText('Prague');
  await expect(page.getByTestId('admin.requests.detail.registration.fields')).toContainText('CZK');
  await expect(page.getByTestId('admin.requests.detail.registration.fields')).toContainText('Čeština');
  await expect(page.getByTestId('admin.requests.detail.registration.fields')).toContainText('Europe/Prague');
  await page.getByTestId('admin.requests.detail.risk.mail.details').locator('summary').click();
  await expect(page.getByTestId('admin.requests.detail.risk.mail.details')).toContainText('Provider timeout');

  await page.getByTestId('admin.requests.resolve.action.approve').click();
  await expect(page.getByTestId('admin.requests.resolve.modal')).toBeVisible();
  await expect.poll(() => resolveBodies.length).toBe(0);
  await page.getByTestId('admin.requests.resolve.submit').click();
  await expect.poll(() => resolveBodies.length).toBe(1);
  expect(resolveBodies[0]).toEqual({
    registration: {
      action: 'approve',
      create_vps: true,
      activate: true,
    },
  });
  await page.goto('/admin/requests/registration/123');
  await expect(page).toHaveURL('/admin/requests/registration/123');
  await expect(page.getByTestId('admin.requests.detail.ops.action_state')).toHaveAttribute('href', '/admin/action-states/177');
  await expect(page.getByTestId('admin.requests.detail.ops.chain')).toHaveAttribute('href', '/admin/transactions/88');
  await expect(page.getByTestId('admin.requests.detail.ops.transaction')).toHaveAttribute('href', '/admin/transactions/items/99');
  const mapCard = page.getByTestId('admin.requests.detail.registration.address.map');
  await expect(mapCard).toBeVisible();
  const mapPreview = mapCard.getByTestId('admin.requests.detail.registration.address.map.preview');
  await expect(mapPreview).toHaveCount(0);
  await expect.poll(osm.requestCount).toBe(0);
  await mapCard.getByTestId('admin.requests.detail.registration.address.map.load').click();
  await expect(mapPreview).toBeVisible();
  await expect.poll(osm.requestCount).toBe(1);
  await expect(mapCard.getByTestId('admin.requests.detail.registration.address.map.retry')).toHaveCount(0);
  await expect(mapPreview).toHaveAttribute('loading', 'eager');
  await expect(mapPreview).toHaveAttribute(
    'src',
    /https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?.*marker=49\.835644%2C18\.284343/
  );
  const mapLink = page.getByTestId('admin.requests.detail.registration.address.map.link');
  await expect(mapLink).toHaveAttribute('target', '_blank');
  await expect(mapLink).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(mapLink).toHaveAttribute(
    'href',
    'https://www.openstreetmap.org/search?query=Stodoln%C3%AD+138%2F44%2C+14400+Ostrava%2C+%C4%8Cesko'
  );
  await expect(page.getByTestId('admin.requests.resolve.in_progress')).toBeVisible();
  await expect(page.getByTestId('admin.requests.resolve.action.deny')).toHaveCount(0);
});

test('@workflow-matrix @pr-smoke @pr-smoke-mobile @smoke admin requests: successful detail review returns to the overview', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const osm = await installOsmMapMock(page);

  let current = registration(125);
  current = { ...current, os_template: { id: 5, label: 'Debian 13' } };
  let resolveCalls = 0;
  let nodeQuery: URLSearchParams | null = null;
  let finishResolve!: () => void;
  const resolveGate = new Promise<void>((resolve) => {
    finishResolve = resolve;
  });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [current] }),
      'GET user_request/changes': () => ({ changes: [] }),
      'GET user_request/registrations/125': () => ({ registration: current }),
      'GET nodes': ({ searchParams }) => {
        nodeQuery = new URLSearchParams(searchParams);
        const location = searchParams.get('node[location]');
        return {
          nodes: [
            {
              id: location === '8' ? 10 : 9,
              domain_name: location === '8' ? 'node10.example.test' : 'node9.example.test',
              cgroup_version: 'cgroup_v2',
            },
            { id: 11, domain_name: 'incompatible.example.test', cgroup_version: 'cgroup_v1' },
          ],
        };
      },
      'GET locations': () => ({ locations: [{ id: 7, label: 'Prague' }, { id: 8, label: 'Brno' }] }),
      'GET os_templates': () => ({ os_templates: [{ id: 5, label: 'Debian 13', cgroup_version: 'cgroup_v2' }] }),
      'GET languages': () => ({ languages: [{ id: 2, label: 'Čeština' }] }),
      'POST user_request/registrations/125/resolve': async ({ reqJson }) => {
        resolveCalls += 1;
        expect(reqJson).toEqual({
          registration: {
            action: 'approve',
            create_vps: false,
            activate: true,
            location: 8,
            note: '',
          },
        });
        await resolveGate;
        current = { ...current, state: 'approved' };
        return { registration: current };
      },
    },
  });

  await page.goto('/admin/requests/registration/125?returnTo=%2Fadmin%2Frequests%3Fstate%3Dignored');
  const mapCard = page.getByTestId('admin.requests.detail.registration.address.map');
  await expect(mapCard.getByTestId('admin.requests.detail.registration.address.map.preview')).toHaveCount(0);
  await expect.poll(osm.requestCount).toBe(0);
  await mapCard.getByTestId('admin.requests.detail.registration.address.map.load').click();
  await expect(mapCard.getByTestId('admin.requests.detail.registration.address.map.preview')).toBeVisible();
  await expect.poll(osm.requestCount).toBe(1);
  const metadataChevron = page.getByTestId('admin.requests.detail.metadata.chevron');
  await expect(metadataChevron).toBeVisible();
  await expect(metadataChevron).toHaveCSS('rotate', 'none');
  await page.getByTestId('admin.requests.detail.metadata.toggle').click();
  await expect(page.getByTestId('admin.requests.detail.metadata').locator('details')).toHaveAttribute('open', '');
  await expect(metadataChevron).toHaveCSS('rotate', '90deg');
  await page.getByTestId('admin.requests.resolve.action.approve').click();
  await expect(page.getByTestId('admin.requests.resolve.modal')).toContainText(/approve request|schválit žádost/i);
  await expect(page.getByTestId('admin.requests.resolve.action_select')).toHaveCount(0);
  await expect(page.getByTestId('admin.requests.resolve.node_field')).toBeVisible();
  await expect.poll(() => nodeQuery?.get('node[state]')).toBe('active');
  expect(nodeQuery?.get('node[type]')).toBe('node');
  expect(nodeQuery?.get('node[hypervisor_type]')).toBe('vpsadminos');
  expect(nodeQuery?.get('node[location]')).toBe('7');
  await expect(page.getByTestId('admin.requests.resolve.node').locator('option[value="11"]')).toHaveCount(0);
  await page.getByTestId('admin.requests.resolve.node').selectOption('9');
  await page.getByTestId('admin.requests.resolve.overrides').locator('summary').click();
  await expect(page.getByTestId('admin.requests.resolve.override.note')).toHaveValue('Runs public mirrors');
  const locationOverride = page.getByTestId('admin.requests.resolve.override.location');
  await locationOverride.selectOption('');
  await expect(page.getByTestId('admin.requests.resolve.submit')).toBeDisabled();
  await expect(locationOverride).toHaveAttribute('aria-invalid', 'true');
  await expect(locationOverride).toHaveAttribute('aria-describedby', 'admin.requests.resolve.override.numeric.error');
  const numericError = page.getByTestId('admin.requests.resolve.override.numeric.error');
  await expect(numericError).toContainText(/cannot be cleared|nelze je vymazat/i);
  await expect(page.getByTestId('admin.requests.resolve.review')).not.toContainText(/location:.*clear|lokalita:.*vymazat/i);
  await page.getByTestId('admin.requests.resolve.overrides').locator('summary').click();
  await expect(numericError).toBeVisible();
  await page.getByTestId('admin.requests.resolve.overrides').locator('summary').click();
  await page.getByTestId('admin.requests.resolve.override.note').fill('');
  await locationOverride.selectOption('8');
  await expect(numericError).toHaveCount(0);
  await expect.poll(() => nodeQuery?.get('node[location]')).toBe('8');
  await expect(page.getByTestId('admin.requests.resolve.node')).toHaveValue('');
  await expect(page.getByTestId('admin.requests.resolve.node').locator('option[value="10"]')).toHaveCount(1);
  await page.getByTestId('admin.requests.resolve.create_vps').uncheck();
  await expect(page.getByTestId('admin.requests.resolve.node_field')).toHaveCount(0);
  await page.getByTestId('admin.requests.resolve.submit').click();

  await expect.poll(() => resolveCalls).toBe(1);
  await expect(page).toHaveURL('/admin/requests/registration/125?returnTo=%2Fadmin%2Frequests%3Fstate%3Dignored');

  finishResolve();

  await expect(page).toHaveURL('/admin/requests?state=ignored');
  await expect(page.getByTestId('admin.requests.chip.state')).toBeVisible();
});

test('@workflow-matrix @pr-smoke @pr-smoke-mobile @smoke admin requests: closing without a response is a single-step action', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  await installOsmMapMock(page);

  let current = registration(129);
  let resolveBody: unknown;

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations/129': () => ({ registration: current }),
      'POST user_request/registrations/129/resolve': ({ reqJson }) => {
        resolveBody = reqJson;
        current = { ...current, state: 'ignored' };
        return { registration: current };
      },
    },
  });

  await page.goto('/admin/requests/registration/129');
  const ignore = page.getByTestId('admin.requests.resolve.action.ignore');
  await expect(ignore).toBeVisible();
  await ignore.click();

  await expect(page.getByTestId('admin.requests.resolve.modal')).toHaveCount(0);
  await expect.poll(() => resolveBody).toEqual({ registration: { action: 'ignore' } });
});

test('@workflow-matrix @smoke admin requests: detail correction exposes and submits all legacy overrides', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  await installOsmMapMock(page);
  let resolveBody: unknown;
  let lookupCalls = 0;

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations/128': () => ({ registration: registration(128) }),
      'GET locations': () => { lookupCalls += 1; return { locations: [{ id: 7, label: 'Prague' }] }; },
      'GET os_templates': () => { lookupCalls += 1; return { os_templates: [{ id: 5, label: 'Debian 13' }] }; },
      'GET languages': () => { lookupCalls += 1; return { languages: [{ id: 2, label: 'Čeština' }] }; },
      'POST user_request/registrations/128/resolve': ({ reqJson }) => {
        resolveBody = reqJson;
        return { registration: { ...registration(128), state: 'pending_correction' } };
      },
    },
  });

  await page.goto('/admin/requests/registration/128');
  await page.getByTestId('admin.requests.resolve.action.request_correction').click();
  await expect(page.getByTestId('admin.requests.resolve.action_select')).toHaveCount(0);
  expect(lookupCalls).toBe(0);
  await page.getByTestId('admin.requests.resolve.overrides').locator('summary').click();
  await expect.poll(() => lookupCalls).toBe(3);
  await expect(page.getByTestId('admin.requests.resolve.override.year_of_birth')).toHaveValue('1990');
  await expect(page.getByTestId('admin.requests.resolve.override.os_template')).toHaveValue('5');
  await expect(page.getByTestId('admin.requests.resolve.override.location')).toHaveValue('7');
  await expect(page.getByTestId('admin.requests.resolve.override.language')).toHaveValue('2');
  await expect(page.getByTestId('admin.requests.resolve.override.time_zone')).toHaveValue('Europe/Prague');
  await expect(page.getByTestId('admin.requests.resolve.submit')).toBeDisabled();
  await page.getByTestId('admin.requests.resolve.override.full_name').fill('Alice Corrected');
  await page.getByTestId('admin.requests.resolve.override.note').fill('');
  await page.getByTestId('admin.requests.resolve.override.time_zone').fill('Europe/London');
  await page.getByTestId('admin.requests.resolve.reason').fill('Please confirm the submitted data');
  await page.getByTestId('admin.requests.resolve.submit').click();

  await expect.poll(() => resolveBody).toBeTruthy();
  expect(resolveBody).toEqual({
    registration: {
      action: 'request_correction',
      reason: 'Please confirm the submitted data',
      login: 'alice',
      full_name: 'Alice Corrected',
      org_name: 'Example Foundation',
      org_id: 'CZ12345678',
      email: 'alice@example.test',
      address: 'Stodolní 138/44, 14400 Ostrava, Česko',
      year_of_birth: 1990,
      how: 'Community recommendation',
      note: '',
      os_template: 5,
      location: 7,
      currency: 'czk',
      language: 2,
      time_zone: 'Europe/London',
    },
  });
});

test('@workflow-matrix @smoke admin requests: change detail compares current and requested values with a safe fallback', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const requested = {
    id: 701,
    state: 'awaiting',
    user: { id: 42, login: 'alice' },
    full_name: 'Alice New',
    email: 'new@example.test',
    address: 'New address',
    change_reason: 'Moved office',
  };

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/changes/701': () => ({ change: requested }),
      'GET users/42': () => ({ user: { id: 42, login: 'alice', level: 1, full_name: 'Alice Old', email: 'old@example.test', address: 'Old address' } }),
    },
  });

  await page.goto('/admin/requests/change/701?returnTo=https%3A%2F%2Fevil.example%2Fadmin%2Frequests');
  await expect(page.getByTestId('admin.requests.detail.change.full_name')).toContainText('Alice Old');
  await expect(page.getByTestId('admin.requests.detail.change.full_name')).toContainText('Alice New');
  await expect(page.getByTestId('admin.requests.detail.change.email')).toContainText('old@example.test');
  await expect(page.getByTestId('admin.requests.detail.change.email')).toContainText('new@example.test');
  await expect(page.getByTestId('admin.requests.detail.back')).toHaveAttribute('href', '/admin/requests');
  await expect(page.getByTestId('admin.requests.resolve.action.request_correction')).toHaveCount(0);

  await page.route(/\/api\/v7\.0\/users\/42(?:\?|$)/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(failEnvelope('profile unavailable')) });
  });
  await page.reload();
  await expect(page.getByTestId('admin.requests.detail.change.current_fallback')).toBeVisible();
  await expect(page.getByTestId('admin.requests.detail.change.full_name')).toContainText('Alice New');
});

test('@workflow-matrix @smoke admin requests: change detail distinguishes no change, clearing, and an empty current value', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const requested = {
    id: 702,
    state: 'awaiting',
    user: { id: 42, login: 'alice' },
    full_name: '',
    email: 'new@example.test',
    change_reason: 'Remove public name',
  };

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/changes/702': () => ({ change: requested }),
      'GET users/42': () => ({
        user: { id: 42, login: 'alice', level: 1, full_name: 'Alice Old', email: 'old@example.test', address: '' },
      }),
    },
  });

  await page.goto('/admin/requests/change/702');
  await expect(page.getByTestId('admin.requests.detail.change.full_name.requested')).toContainText(/clear this value|vymazat tuto hodnotu/i);
  await expect(page.getByTestId('admin.requests.detail.change.address.requested')).toContainText(/no change|beze změny/i);
  await expect(page.getByTestId('admin.requests.detail.change.address.current')).toContainText(/empty value|prázdná hodnota/i);
});

test('@workflow-matrix @pr-smoke @pr-smoke-mobile @smoke admin requests: address map requires consent and can retry a failed lookup', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const osm = await installOsmMapMock(page, { failFirst: true });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations/126': () => ({ registration: registration(126) }),
    },
  });

  await page.goto('/admin/requests/registration/126');
  const mapCard = page.getByTestId('admin.requests.detail.registration.address.map');
  const retry = mapCard.getByTestId('admin.requests.detail.registration.address.map.retry');

  await expect(retry).toHaveCount(0);
  await expect.poll(osm.requestCount).toBe(0);
  await mapCard.getByTestId('admin.requests.detail.registration.address.map.load').click();
  await expect(retry).toBeVisible();
  await expect.poll(osm.requestCount).toBe(1);
  await retry.click();
  await expect(mapCard.getByTestId('admin.requests.detail.registration.address.map.preview')).toBeVisible();
  await expect.poll(osm.requestCount).toBe(2);
});

test('@workflow-matrix @pr-smoke @smoke admin requests: requested address map distinguishes an unknown address', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const osm = await installOsmMapMock(page, { empty: true });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations/127': () => ({ registration: registration(127) }),
    },
  });

  await page.goto('/admin/requests/registration/127');
  const mapCard = page.getByTestId('admin.requests.detail.registration.address.map');

  await expect.poll(osm.requestCount).toBe(0);
  await mapCard.getByTestId('admin.requests.detail.registration.address.map.load').click();
  await expect(mapCard.getByText('The address was not found in OpenStreetMap.')).toBeVisible();
  await expect(mapCard.getByTestId('admin.requests.detail.registration.address.map.retry')).toHaveCount(0);
  await expect(mapCard.getByTestId('admin.requests.detail.registration.address.map.preview')).toHaveCount(0);
  await expect.poll(osm.requestCount).toBe(1);
});

test('@workflow-matrix @smoke admin requests: rejected action error is visible', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  await installOsmMapMock(page);

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [registration(124)] }),
      'GET user_request/changes': () => ({ changes: [] }),
      'GET user_request/registrations/124': () => ({ registration: registration(124) }),
      'POST user_request/registrations/124/resolve': () => failEnvelope('Cannot approve this request'),
    },
  });

  await page.goto('/admin/requests/registration/124');
  await expect(page.getByTestId('admin.requests.resolve.action.approve')).toBeVisible();
  await page.getByTestId('admin.requests.resolve.action.approve').click();
  await expect(page.getByTestId('admin.requests.resolve.modal')).toBeVisible();
  await page.getByTestId('admin.requests.resolve.submit').click();
  await expect(page.getByRole('alert')).toContainText('Cannot approve this request');
  await expect(page).toHaveURL('/admin/requests/registration/124');
});

test('@workflow-matrix @smoke admin requests: correction uses the canonical detail and registration bulk approval is blocked', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const resolveBodies: unknown[] = [];

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [registration(401), registration(400)] }),
      'GET user_request/changes': () => ({ changes: [] }),
      'GET user_request/registrations/401': () => ({ registration: registration(401) }),
      'POST user_request/registrations/401/resolve': ({ reqJson }) => {
        resolveBodies.push(reqJson);
        return { registration: { ...registration(401), state: 'pending_correction' } };
      },
      'POST user_request/registrations/400/resolve': ({ reqJson }) => {
        resolveBodies.push(reqJson);
        return { registration: { ...registration(400), state: 'approved' } };
      },
    },
  });

  await page.goto('/admin/requests');
  await expect(page.getByTestId('admin.requests.table')).toBeVisible();

  await page.getByTestId('admin.requests.row.registration.401').getByRole('link', { name: '#401' }).press('Enter');
  await expect(page).toHaveURL(/\/admin\/requests\/registration\/401\?returnTo=/);
  await page.getByTestId('admin.requests.resolve.action.request_correction').click();
  await expect(page.getByTestId('admin.requests.resolve.override.login')).toHaveValue('alice');
  await expect(page.getByTestId('admin.requests.resolve.override.full_name')).toHaveValue('Alice Example');
  await page.getByTestId('admin.requests.resolve.reason').fill('Please fix the address');
  await page.getByTestId('admin.requests.resolve.submit').click();
  await expect.poll(() => resolveBodies.length).toBe(1);
  expect(resolveBodies[0]).toEqual({
    registration: {
      action: 'request_correction',
      reason: 'Please fix the address',
      login: 'alice',
      full_name: 'Alice Example',
      org_name: 'Example Foundation',
      org_id: 'CZ12345678',
      email: 'alice@example.test',
      address: 'Stodolní 138/44, 14400 Ostrava, Česko',
      year_of_birth: 1990,
      how: 'Community recommendation',
      note: 'Runs public mirrors',
      os_template: 5,
      location: 7,
      currency: 'czk',
      language: 2,
      time_zone: 'Europe/Prague',
    },
  });

  await expect(page.getByTestId('admin.requests.table')).toBeVisible();
  await expect(page.getByTestId('admin.requests.bulk')).toHaveCount(0);
  await page.getByTestId('admin.requests.bulk.selection_mode').click();
  await page.getByTestId('admin.requests.bulk.select.registration.400').check();
  await expect(page.getByTestId('admin.requests.bulk')).toBeVisible();
  await expect(page.getByTestId('admin.requests.bulk.registration_approve_blocked')).toBeVisible();
  await expect(page.getByTestId('admin.requests.bulk.action').locator('option[value="approve"]')).toHaveCount(0);
  await expect.poll(() => resolveBodies.length).toBe(1);
});

test('@workflow-matrix @smoke admin requests: bulk writes require confirmation and failed rows stay selected', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const resolveBodies: unknown[] = [];
  let failedCalls = 0;
  const changes = [402, 401].map((id) => ({
    id,
    state: 'awaiting',
    label: `Change #${id}`,
    user: { id, login: `user${id}` },
    change_reason: 'Update profile',
    created_at: '2026-03-01T09:00:00Z',
  }));

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [] }),
      'GET user_request/changes': () => ({ changes }),
      'GET user_request/changes/402': () => ({ change: changes[0] }),
      'GET user_request/changes/401': () => ({ change: changes[1] }),
      'POST user_request/changes/402/resolve': ({ reqJson }) => {
        resolveBodies.push(reqJson);
        return { change: { ...changes[0], state: 'ignored' } };
      },
      'POST user_request/changes/401/resolve': () => {
        failedCalls += 1;
        return failEnvelope('Temporary failure');
      },
    },
  });

  await page.goto('/admin/requests');
  await page.getByTestId('admin.requests.bulk.selection_mode').click();
  await page.getByTestId('admin.requests.bulk.select.change.402').check();
  await expect(page.getByTestId('admin.requests.bulk.select_all')).toHaveAttribute('aria-checked', 'mixed');
  await expect(page.getByTestId('admin.requests.bulk.select_all')).toHaveJSProperty('indeterminate', true);
  await page.getByTestId('admin.requests.bulk.select.change.401').check();
  await page.getByTestId('admin.requests.bulk.action').selectOption('deny');
  await expect(page.getByTestId('admin.requests.bulk.apply')).toBeDisabled();
  await page.getByTestId('admin.requests.bulk.reason').fill('Duplicate request');
  await page.getByTestId('admin.requests.bulk.apply').click();

  await expect(page.getByTestId('admin.requests.bulk.confirm')).toBeVisible();
  await expect(page.getByTestId('admin.requests.bulk.confirm.targets')).toContainText('#402');
  await expect(page.getByTestId('admin.requests.bulk.confirm.targets')).toContainText('#401');
  await expect(page.getByTestId('admin.requests.bulk.confirm.reason')).toContainText('Duplicate request');
  expect(resolveBodies).toEqual([]);
  expect(failedCalls).toBe(0);
  await page.getByTestId('admin.requests.bulk.confirm.confirm').click();

  await expect.poll(() => resolveBodies.length).toBe(1);
  await expect.poll(() => failedCalls).toBe(1);
  expect(resolveBodies[0]).toEqual({ change: { action: 'deny', reason: 'Duplicate request' } });
  await expect(page.getByTestId('admin.requests.bulk.select.change.401')).toBeChecked();
  await expect(page.getByTestId('admin.requests.bulk.select.change.402')).not.toBeChecked();
});

test('@workflow-matrix @smoke admin requests: visible state and type segments keep the list simple', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [registration(201), registration(200)] }),
      'GET user_request/changes': () => ({
        changes: [
          {
            id: 199,
            state: 'awaiting',
            label: 'Change #199',
            user: { id: 42, login: 'alice' },
            full_name: 'Alice Changed',
            email: 'alice-new@example.test',
            change_reason: 'Update profile',
            created_at: '2026-03-01T09:00:00Z',
          },
        ],
      }),
    },
  });

  await page.goto('/admin/requests');
  await expect(page.getByTestId('admin.requests.table')).toBeVisible();

  await expect(page.getByTestId('admin.requests.state_segments')).toBeVisible();
  await expect(page.getByTestId('admin.requests.type_segments')).toBeVisible();
  await expect(page.getByTestId('admin.requests.row.registration.201.full_name')).toHaveText('Alice Example');
  await expect(page.locator('[data-testid^="admin.requests.expanded_row."]')).toHaveCount(0);
  await page.getByTestId('admin.requests.expand_all').click();
  await expect(page.getByTestId('admin.requests.expanded_row.registration.201')).toBeVisible();
  await expect(page.getByTestId('admin.requests.expanded_row.change.199')).toBeVisible();
  await expect(page.getByTestId('admin.requests.expand_all')).toHaveText(/collapse all|sbalit vše/i);
  await page.getByTestId('admin.requests.expand_all').click();
  await expect(page.locator('[data-testid^="admin.requests.expanded_row."]')).toHaveCount(0);

  await page.getByTestId('admin.requests.type.change').click();
  await expect(page.getByTestId('admin.requests.row.change.199')).toBeVisible();
  await expect(page.getByTestId('admin.requests.row.registration.201')).toHaveCount(0);
  await expect(page).toHaveURL(/type=change/);

  await page.getByTestId('admin.requests.type.registration').click();
  await expect(page.getByTestId('admin.requests.row.registration.201')).toBeVisible();
  await expect(page.getByTestId('admin.requests.row.change.199')).toHaveCount(0);
  await expect(page).toHaveURL(/type=registration/);
});

test('@workflow-matrix @smoke @smoke-mobile admin requests: sequential review opens the next request after each decision', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  let first = { ...registration(302), user: undefined, login: 'first-user', full_name: 'First Applicant' };
  let second = { ...registration(301), user: undefined, login: 'second-user', full_name: 'Second Applicant' };
  const third = { ...registration(300), user: undefined, login: 'third-user', full_name: 'Third Applicant' };
  const resolveBodies: unknown[] = [];

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': ({ searchParams }) => {
        const state = searchParams.get('registration[state]');
        const registrations = [first, second, third];
        return { registrations: state ? registrations.filter((request) => request.state === state) : registrations };
      },
      'GET user_request/changes': () => ({ changes: [] }),
      'GET user_request/registrations/302': () => ({ registration: first }),
      'GET user_request/registrations/301': () => ({ registration: second }),
      'GET user_request/registrations/300': () => ({ registration: third }),
      'POST user_request/registrations/302/resolve': ({ reqJson }) => {
        resolveBodies.push(reqJson);
        first = { ...first, state: 'denied' };
        return { registration: first };
      },
      'POST user_request/registrations/301/resolve': ({ reqJson }) => {
        resolveBodies.push(reqJson);
        second = { ...second, state: 'ignored' };
        return { registration: second };
      },
    },
  });

  await page.goto('/admin/requests');
  await expect(page.locator(
    '[data-testid="admin.requests.row.registration.302.full_name"]:visible, [data-testid="admin.requests.mobile.row.registration.302.full_name"]:visible',
  )).toHaveText('First Applicant');
  await expect(page.getByTestId('admin.requests.review.start')).toContainText('3');
  await page.getByTestId('admin.requests.review.start').click();

  await expect(page).toHaveURL(/\/admin\/requests\/registration\/302/);
  await expect(page.getByTestId('admin.requests.review.continue')).toBeChecked();
  await expect(page.getByTestId('admin.requests.review.queue')).toContainText(/3/);

  await page.getByTestId('admin.requests.resolve.action.deny').click();
  await page.getByTestId('admin.requests.resolve.reason').fill('Does not meet the requirements');
  await page.getByTestId('admin.requests.resolve.submit').click();

  await expect(page).toHaveURL(/\/admin\/requests\/registration\/301/);
  await expect(page.getByTestId('admin.requests.review.queue')).toContainText(/2/);
  await expect(page.getByTestId('admin.requests.review.continue')).toBeChecked();

  await page.getByTestId('admin.requests.review.continue').uncheck();
  await page.getByTestId('admin.requests.resolve.action.ignore').click();
  await expect(page).toHaveURL(/\/admin\/requests(?:\?|$)/);
  await expect(page.locator(
    '[data-testid="admin.requests.row.registration.300"]:visible, [data-testid="admin.requests.mobile.row.registration.300"]:visible',
  )).toBeVisible();
  expect(resolveBodies).toEqual([
    { registration: { action: 'deny', reason: 'Does not meet the requirements' } },
    { registration: { action: 'ignore' } },
  ]);
});

test('@workflow-matrix @smoke admin requests: main input opens a typed ID or selects an applicant without request q', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  await installOsmMapMock(page);

  const registrationQ: Array<string | null> = [];
  const changeQ: Array<string | null> = [];
  const registrationUsers: Array<string | null> = [];

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': ({ searchParams }) => {
        registrationQ.push(searchParams.get('registration[q]'));
        registrationUsers.push(searchParams.get('registration[user]'));
        return {
          registrations: [{
            ...registration(779),
            user: undefined,
            login: 'newperson',
            email: 'newperson@example.test',
          }],
        };
      },
      'GET user_request/changes': ({ searchParams }) => {
        changeQ.push(searchParams.get('change[q]'));
        return { changes: [] };
      },
      // Both typed Show routes currently return HTTP 200 in the deployed API.
      // Only the response shape identifies the canonical change request.
      'GET user_request/registrations/777': () => ({
        registration: {
          id: 777,
          state: 'awaiting',
          change_reason: 'Update profile',
          login: null,
          year_of_birth: null,
          os_template: null,
          location: null,
          ip_fraud_score: null,
          mail_fraud_score: null,
        },
      }),
      'GET user_request/changes/777': () => ({
        change: { id: 777, state: 'awaiting', change_reason: 'Update profile', user: { id: 42, login: 'alice' } },
      }),
      'GET user_request/registrations/779': () => ({
        registration: { ...registration(779), user: undefined, login: 'newperson', email: 'newperson@example.test' },
      }),
      'GET users': () => ({ users: [{ id: 42, login: 'alice', full_name: 'Alice Example', level: 1 }] }),
      'POST cluster/search': () => ({ cluster: [] }),
    },
  });

  await page.goto('/admin/requests?q=legacy&state=all');
  await expect.poll(() => new URL(page.url()).searchParams.has('q')).toBe(false);
  await expect.poll(() => registrationQ.length).toBeGreaterThan(0);
  await expect.poll(() => changeQ.length).toBeGreaterThan(0);
  expect(registrationQ.every((value) => value === null)).toBe(true);
  expect(changeQ.every((value) => value === null)).toBe(true);

  const input = page.getByTestId('admin.requests.smart_filter.input');
  await input.fill('777');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/admin\/requests\/change\/777\?returnTo=/);
  const returnTo = new URL(page.url()).searchParams.get('returnTo') ?? '';
  expect(new URL(returnTo, 'https://example.test').searchParams.get('state')).toBe('all');
  expect(new URL(returnTo, 'https://example.test').searchParams.has('q')).toBe(false);

  await page.goto('/admin/requests');
  await input.fill('newp');
  await page.getByTestId('admin.requests.smart.suggest.request.registration.779').click();
  await expect(page).toHaveURL(/\/admin\/requests\/registration\/779\?returnTo=/);

  await page.goto('/admin/requests');
  await input.fill('ali');
  await page.getByTestId('admin.requests.smart.suggest.user.42').click();
  await expect(page).toHaveURL(/user=42/);
  await expect.poll(() => registrationUsers.includes('42')).toBe(true);
});

test('@workflow-matrix @smoke admin requests: direct id lookup reports an API outage instead of not found', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [] }),
      'GET user_request/changes': () => ({ changes: [] }),
      'GET user_request/registrations/778': () => ({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify(failEnvelope('Service unavailable')),
      }),
      'GET user_request/changes/778': () => ({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify(failEnvelope('Service unavailable')),
      }),
    },
  });

  await page.goto('/admin/requests');
  const input = page.getByTestId('admin.requests.smart_filter.input');
  await input.fill('778');
  await input.press('Enter');
  await expect(page.getByRole('alert')).toContainText(/unable to verify request|nepodařilo ověřit/i);
  await expect(page.getByRole('alert')).not.toContainText(/not found|nenalezena/i);
  await expect(input).toBeEnabled();
  expect(new URL(page.url()).pathname).toBe('/admin/requests');
});

test('@workflow-matrix @smoke admin requests: advanced filters are keyboard-safe and the default queue only includes awaiting requests', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const registrationStates: Array<string | null> = [];
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': ({ searchParams }) => {
        registrationStates.push(searchParams.get('registration[state]'));
        return { registrations: [registration(301, 'awaiting'), registration(302, 'ignored')] };
      },
      'GET user_request/changes': () => ({ changes: [] }),
    },
  });

  await page.goto('/admin/requests');
  await expect(page.getByTestId('admin.requests.table')).toBeVisible();
  await expect(page.getByTestId('admin.requests.row.registration.301')).toBeVisible();
  await expect(page.getByTestId('admin.requests.row.registration.302')).toHaveCount(0);

  const advancedToggle = page.getByTestId('admin.requests.advanced.toggle');
  await advancedToggle.click();
  const advanced = page.getByTestId('admin.requests.advanced_filters');
  await expect(advanced).toBeVisible();
  await expect(advanced).toHaveAttribute('role', 'dialog');
  await expect(advanced).toHaveAttribute('aria-modal', 'true');
  await expect(page.getByTestId('admin.requests.advanced.close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(advanced).toHaveCount(0);
  await expect(advancedToggle).toBeFocused();

  await advancedToggle.click();
  await expect(advanced).toBeVisible();

  await advanced.getByLabel(/stav|state/i).selectOption('ignored');
  await expect(page).toHaveURL(/state=ignored/);
  await expect.poll(() => registrationStates.at(-1)).toBe('ignored');
  await expect(page.getByTestId('admin.requests.row.registration.301')).toHaveCount(0);
  await expect(page.getByTestId('admin.requests.row.registration.302')).toBeVisible();
});

test('@workflow-matrix @smoke @smoke-mobile admin requests: correction queue stays outside the default admin work queue', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const registrationStates: Array<string | null> = [];
  const changeStates: Array<string | null> = [];
  let correctionState = 'pending_correction';
  const visibleRegistration = (id: number) => page.locator(
    `[data-testid="admin.requests.row.registration.${id}"]:visible, [data-testid="admin.requests.mobile.row.registration.${id}"]:visible`,
  );

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': ({ searchParams }) => {
        const state = searchParams.get('registration[state]');
        registrationStates.push(state);
        const registrations = [registration(501, 'awaiting'), registration(500, correctionState)];
        return { registrations: state ? registrations.filter((request) => request.state === state) : registrations };
      },
      'GET user_request/changes': ({ searchParams }) => {
        const state = searchParams.get('change[state]');
        changeStates.push(state);
        return { changes: [] };
      },
    },
  });

  await page.goto('/admin/requests');
  await expect(visibleRegistration(501)).toBeVisible();
  await expect(visibleRegistration(500)).toHaveCount(0);
  await expect.poll(() => registrationStates.at(-1)).toBe('awaiting');
  await expect.poll(() => changeStates.at(-1)).toBe('awaiting');
  expect(new URL(page.url()).searchParams.get('state')).toBeNull();

  await page.getByTestId('admin.requests.quick.pending_correction').click();
  await expect(page).toHaveURL(/state=pending_correction/);
  await expect(visibleRegistration(500)).toBeVisible();
  await expect(visibleRegistration(501)).toHaveCount(0);
  await expect.poll(() => registrationStates.at(-1)).toBe('pending_correction');
  await expect.poll(() => changeStates.at(-1)).toBe('pending_correction');
  await expect(page.getByTestId('admin.requests.quick.pending_correction')).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(visibleRegistration(500)).toBeVisible();
  await expect(page).toHaveURL(/state=pending_correction/);

  await expect(page.getByTestId('admin.requests.expand_all')).toBeVisible();
  await expect(page.getByTestId('admin.requests.bulk.selection_mode')).toHaveCount(0);

  correctionState = 'awaiting';
  await page.getByTestId('admin.requests.quick.awaiting').click();
  await expect.poll(() => registrationStates.at(-1)).toBe('awaiting');
  await expect(visibleRegistration(500)).toBeVisible();
  await expect(visibleRegistration(501)).toBeVisible();
  await expect(page.getByTestId('admin.requests.bulk.selection_mode')).toBeVisible();
  await expect(page).not.toHaveURL(/[?&]state=/);
});

test('@workflow-matrix @smoke @smoke-mobile admin requests: all states is explicit, shareable, and clears back to the work queue', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const registrationStates: Array<string | null> = [];
  const changeStates: Array<string | null> = [];
  const registrations = [registration(603, 'awaiting'), registration(602, 'pending_correction'), registration(601, 'denied')];
  const visibleRegistration = (id: number) => page.locator(
    `[data-testid="admin.requests.row.registration.${id}"]:visible, [data-testid="admin.requests.mobile.row.registration.${id}"]:visible`,
  );

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': ({ searchParams }) => {
        const state = searchParams.get('registration[state]');
        registrationStates.push(state);
        return { registrations: state ? registrations.filter((request) => request.state === state) : registrations };
      },
      'GET user_request/changes': ({ searchParams }) => {
        changeStates.push(searchParams.get('change[state]'));
        return { changes: [] };
      },
    },
  });

  await page.goto('/admin/requests?state=all&from_id=700&page=2');
  await expect.poll(() => registrationStates.at(-1)).toBeNull();
  await expect.poll(() => changeStates.at(-1)).toBeNull();
  await expect(visibleRegistration(603)).toBeVisible();
  await expect(visibleRegistration(602)).toBeVisible();
  await expect(visibleRegistration(601)).toBeVisible();
  await expect(page.getByTestId('admin.requests.quick.all')).toHaveAttribute('aria-pressed', 'true');

  const correctionHref = await visibleRegistration(602).evaluate((element) => {
    const link = element.closest('a') ?? element.querySelector('a');
    return link?.getAttribute('href') ?? '';
  });
  expect(correctionHref).toContain('/admin/requests/registration/602');

  await page.getByTestId('admin.requests.bulk.selection_mode').click();
  const awaitingCheckbox = page.locator(
    '[data-testid="admin.requests.bulk.select.registration.603"]:visible, [data-testid="admin.requests.bulk.select.mobile.registration.603"]:visible',
  );
  const correctionCheckbox = page.locator(
    '[data-testid="admin.requests.bulk.select.registration.602"]:visible, [data-testid="admin.requests.bulk.select.mobile.registration.602"]:visible',
  );
  const deniedCheckbox = page.locator(
    '[data-testid="admin.requests.bulk.select.registration.601"]:visible, [data-testid="admin.requests.bulk.select.mobile.registration.601"]:visible',
  );
  await expect(awaitingCheckbox).toBeEnabled();
  await expect(correctionCheckbox).toBeDisabled();
  await expect(deniedCheckbox).toBeDisabled();
  await expect(correctionCheckbox).toHaveAttribute('title', /awaiting review|čekající na posouzení/i);
  await awaitingCheckbox.check();
  await expect(page.getByTestId('admin.requests.bulk')).toBeVisible();
  await expect(page.getByTestId('admin.requests.bulk.no_common_action')).toHaveCount(0);
  await expect(page.getByTestId('admin.requests.bulk.action').locator('option[value="ignore"]')).toHaveCount(1);
  await expect(correctionCheckbox).not.toBeChecked();
  await expect(deniedCheckbox).not.toBeChecked();
  await page.getByTestId('admin.requests.bulk.selection_mode').click();

  const registrationCalls = registrationStates.length;
  await page.reload();
  await expect.poll(() => registrationStates.length).toBeGreaterThan(registrationCalls);
  await expect(page).toHaveURL(/state=all/);
  await expect(visibleRegistration(601)).toBeVisible();

  await page.getByRole('button', { name: /^(Vymazat filtry|Clear filters)$/ }).click();
  await expect.poll(() => registrationStates.at(-1)).toBe('awaiting');
  await expect.poll(() => changeStates.at(-1)).toBe('awaiting');
  await expect(page).not.toHaveURL(/[?&](?:state|from_id)=/);
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('1');
  await expect(visibleRegistration(603)).toBeVisible();
  await expect(visibleRegistration(602)).toHaveCount(0);
  await expect(visibleRegistration(601)).toHaveCount(0);
});

test('@workflow-matrix @smoke admin requests: support role cannot enter the admin review queue', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  let requestCalls = 0;
  await installHaveApiMock(page, {
    user: { id: 2, login: 'support', level: 50 },
    handlers: {
      'GET user_request/registrations': () => { requestCalls += 1; return { registrations: [] }; },
      'GET user_request/changes': () => { requestCalls += 1; return { changes: [] }; },
    },
  });

  await page.goto('/admin/requests');
  await expect(page).toHaveURL('/app');
  expect(requestCalls).toBe(0);
  await expect(page.getByTestId('admin.requests.list')).toHaveCount(0);
});

test('@workflow-matrix @smoke admin requests: typed detail fails closed when the backend returns another request type', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  let resolveCalls = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations/909': () => ({
        registration: {
          id: 909,
          state: 'awaiting',
          change_reason: 'This is actually a change request',
          login: null,
          year_of_birth: null,
          os_template: null,
          location: null,
          ip_fraud_score: null,
          mail_fraud_score: null,
        },
      }),
      'POST user_request/registrations/909/resolve': () => { resolveCalls += 1; return {}; },
    },
  });

  await page.goto('/admin/requests/registration/909');
  await expect(page.getByText(/request id or type did not match|id nebo typ žádosti/i).first()).toBeVisible();
  await expect(page.locator('[data-testid^="admin.requests.resolve.action."]')).toHaveCount(0);
  expect(resolveCalls).toBe(0);
});

test('@workflow-matrix @smoke admin requests: typed detail also fails closed when the backend returns another id', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  let resolveCalls = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations/908': () => ({ registration: registration(907) }),
      'POST user_request/registrations/908/resolve': () => { resolveCalls += 1; return {}; },
    },
  });

  await page.goto('/admin/requests/registration/908');
  await expect(page.getByText(/request id or type did not match|id nebo typ žádosti/i).first()).toBeVisible();
  await expect(page.locator('[data-testid^="admin.requests.resolve.action."]')).toHaveCount(0);
  expect(resolveCalls).toBe(0);
});

test('@workflow-matrix @smoke admin requests: typed detail rejects non-integer ids before an API read', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  let showCalls = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations/2': () => {
        showCalls += 1;
        return { registration: registration(2) };
      },
    },
  });

  await page.goto('/admin/requests/registration/2.9');
  await expect(page.getByText(/invalid request|neplatná žádost/i).first()).toBeVisible();
  expect(showCalls).toBe(0);
});

test('@workflow-matrix @smoke admin requests: stale detail is rechecked immediately before resolve', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  await installOsmMapMock(page);
  const awaiting = registration(911);
  let showCalls = 0;
  let resolveCalls = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations/911': () => {
        showCalls += 1;
        return { registration: showCalls === 1 ? awaiting : { ...awaiting, state: 'approved' } };
      },
      'GET nodes': () => ({ nodes: [] }),
      'GET locations': () => ({ locations: [{ id: 7, label: 'Prague' }] }),
      'GET os_templates': () => ({ os_templates: [{ id: 5, label: 'Debian 13', cgroup_version: 'cgroup_v2' }] }),
      'POST user_request/registrations/911/resolve': () => { resolveCalls += 1; return {}; },
    },
  });

  await page.goto('/admin/requests/registration/911');
  await page.getByTestId('admin.requests.resolve.action.approve').click();
  await page.getByTestId('admin.requests.resolve.submit').click();
  await expect(page.getByTestId('admin.requests.resolve.modal')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText(/changed before submission|před odesláním změnila/i);
  expect(resolveCalls).toBe(0);
});

test('@workflow-matrix @smoke admin requests: a failed detail preflight never creates an uncertain mutation lock', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  await installOsmMapMock(page);
  const request = registration(912);
  let showCalls = 0;
  let resolveCalls = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations/912': () => {
        showCalls += 1;
        if (showCalls === 2) {
          return {
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify(failEnvelope('Preflight unavailable')),
          };
        }
        return { registration: request };
      },
      'GET nodes': () => ({ nodes: [] }),
      'GET locations': () => ({ locations: [{ id: 7, label: 'Prague' }] }),
      'GET os_templates': () => ({ os_templates: [{ id: 5, label: 'Debian 13', cgroup_version: 'cgroup_v2' }] }),
      'POST user_request/registrations/912/resolve': () => { resolveCalls += 1; return {}; },
    },
  });

  await page.goto('/admin/requests/registration/912');
  await page.getByTestId('admin.requests.resolve.action.approve').click();
  await page.getByTestId('admin.requests.resolve.submit').click();
  await expect.poll(() => showCalls).toBe(2);
  await expect(page.getByRole('alert')).toContainText('Preflight unavailable');
  await expect(page.getByTestId('admin.requests.resolve.uncertain')).toHaveCount(0);
  expect(resolveCalls).toBe(0);

  await page.getByRole('button', { name: /cancel|zrušit/i }).click();
  await page.reload();
  await expect(page.getByTestId('admin.requests.resolve.action.approve')).toBeVisible();
  await expect(page.getByTestId('admin.requests.resolve.uncertain')).toHaveCount(0);
  expect(resolveCalls).toBe(0);
});

test('@workflow-matrix @smoke admin requests: pending fraud checks are never presented as successful', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const pending = {
    ...registration(910),
    ip_checked: false,
    ip_success: true,
    mail_checked: false,
    mail_success: true,
  };
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations/910': () => ({ registration: pending }),
    },
  });

  await page.goto('/admin/requests/registration/910');
  await expect(page.getByTestId('admin.requests.detail.risk.ip.status')).toContainText(/waiting|čeká/i);
  await expect(page.getByTestId('admin.requests.detail.risk.mail.status')).toContainText(/waiting|čeká/i);
  await expect(page.getByTestId('admin.requests.detail.risk.ip')).toContainText(/no result|výsledek zatím/i);
});

test('@workflow-matrix @smoke admin requests: ambiguous detail mutation is durably locked against blind retry', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  let resolveCalls = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations/812': () => ({ registration: registration(812) }),
      'GET nodes': () => ({ nodes: [] }),
      'POST user_request/registrations/812/resolve': () => {
        resolveCalls += 1;
        return {
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify(failEnvelope('Gateway timeout')),
        };
      },
    },
  });

  await page.goto('/admin/requests/registration/812');
  await page.getByTestId('admin.requests.resolve.action.approve').click();
  await page.getByTestId('admin.requests.resolve.submit').click();
  await expect.poll(() => resolveCalls).toBe(1);
  await expect(page.getByTestId('admin.requests.resolve.uncertain')).toBeVisible();
  await expect(page.getByTestId('admin.requests.resolve.action.approve')).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId('admin.requests.resolve.uncertain')).toBeVisible();
  expect(resolveCalls).toBe(1);

  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByTestId('admin.requests.resolve.uncertain.open_tasks').click();
  await expect(page.getByTestId('tasks.drawer')).toBeVisible();
  await page.getByTestId('tasks.close-button').click();
  await page.getByTestId('admin.requests.resolve.uncertain.check').click();
  const retryButton = page.getByTestId('admin.requests.resolve.uncertain.confirm.confirm');
  await expect(retryButton).toBeVisible();
  expect(await retryButton.evaluate((button) => button.scrollHeight <= button.clientHeight)).toBe(true);
});

test('@workflow-matrix @smoke admin requests: ambiguous bulk mutation stops before untouched targets', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const changes = [820, 819].map((id) => ({
    id,
    state: 'awaiting',
    user: { id, login: `user${id}` },
    change_reason: 'Update profile',
  }));
  let uncertainCalls = 0;
  let untouchedCalls = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [] }),
      'GET user_request/changes': () => ({ changes }),
      'GET user_request/changes/820': () => ({ change: changes[0] }),
      'GET user_request/changes/819': () => ({ change: changes[1] }),
      'POST user_request/changes/820/resolve': () => {
        uncertainCalls += 1;
        return {
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify(failEnvelope('Gateway timeout')),
        };
      },
      'POST user_request/changes/819/resolve': () => {
        untouchedCalls += 1;
        return { change: { ...changes[1], state: 'ignored' } };
      },
    },
  });

  await page.goto('/admin/requests');
  await page.getByTestId('admin.requests.bulk.selection_mode').click();
  await page.getByTestId('admin.requests.bulk.select.change.820').check();
  await page.getByTestId('admin.requests.bulk.select.change.819').check();
  await page.getByTestId('admin.requests.bulk.action').selectOption('ignore');
  await page.getByTestId('admin.requests.bulk.apply').click();
  await page.getByTestId('admin.requests.bulk.confirm.confirm').click();

  await expect.poll(() => uncertainCalls).toBe(1);
  expect(untouchedCalls).toBe(0);
  await expect(page.getByTestId('admin.requests.bulk.select.change.820')).toBeDisabled();
  await expect(page.getByTestId('admin.requests.bulk.select.change.820')).not.toBeChecked();
  await expect(page.getByTestId('admin.requests.bulk.select.change.819')).toBeChecked();
  await expect(page.getByTestId('admin.requests.bulk')).toContainText(/Selected: 1|Vybráno: 1/);
});

test('@workflow-matrix @smoke admin requests: stale bulk row is not posted and remains selected', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const change = {
    id: 821,
    state: 'awaiting',
    user: { id: 821, login: 'user821' },
    change_reason: 'Update profile',
  };
  let resolveCalls = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [] }),
      'GET user_request/changes': () => ({ changes: [change] }),
      'GET user_request/changes/821': () => ({ change: { ...change, state: 'approved' } }),
      'POST user_request/changes/821/resolve': () => { resolveCalls += 1; return {}; },
    },
  });

  await page.goto('/admin/requests');
  await page.getByTestId('admin.requests.bulk.selection_mode').click();
  await page.getByTestId('admin.requests.bulk.select.change.821').check();
  await page.getByTestId('admin.requests.bulk.action').selectOption('ignore');
  await page.getByTestId('admin.requests.bulk.apply').click();
  await page.getByTestId('admin.requests.bulk.confirm.confirm').click();

  await expect(page.getByTestId('admin.requests.bulk.select.change.821')).toBeChecked();
  await expect(page.getByRole('alert')).toContainText(/changed before submission|před odesláním změnila/i);
  expect(resolveCalls).toBe(0);
});

test('@workflow-matrix @smoke admin requests: a failed bulk preflight stays retryable and does not stop untouched targets', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const changes = [824, 823].map((id) => ({
    id,
    state: 'awaiting',
    user: { id, login: `user${id}` },
    change_reason: 'Update profile',
  }));
  let failedTargetPosts = 0;
  let nextTargetPosts = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [] }),
      'GET user_request/changes': () => ({ changes }),
      'GET user_request/changes/824': () => ({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify(failEnvelope('Preflight unavailable')),
      }),
      'GET user_request/changes/823': () => ({ change: changes[1] }),
      'POST user_request/changes/824/resolve': () => {
        failedTargetPosts += 1;
        return {};
      },
      'POST user_request/changes/823/resolve': () => {
        nextTargetPosts += 1;
        return { change: { ...changes[1], state: 'ignored' } };
      },
    },
  });

  await page.goto('/admin/requests');
  await page.getByTestId('admin.requests.bulk.selection_mode').click();
  await page.getByTestId('admin.requests.bulk.select.change.824').check();
  await page.getByTestId('admin.requests.bulk.select.change.823').check();
  await page.getByTestId('admin.requests.bulk.action').selectOption('ignore');
  await page.getByTestId('admin.requests.bulk.apply').click();
  await page.getByTestId('admin.requests.bulk.confirm.confirm').click();

  await expect.poll(() => nextTargetPosts).toBe(1);
  expect(failedTargetPosts).toBe(0);
  await expect(page.getByTestId('admin.requests.bulk.select.change.824')).toBeChecked();
  await expect(page.getByTestId('admin.requests.bulk.select.change.824')).toBeEnabled();
  await expect(page.getByTestId('admin.requests.bulk.select.change.823')).not.toBeChecked();
});

test('@workflow-matrix @smoke admin requests: switching a bulk action cannot leak its previous reason', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  const request = registration(822);
  let resolveBody: unknown;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [request] }),
      'GET user_request/changes': () => ({ changes: [] }),
      'GET user_request/registrations/822': () => ({ registration: request }),
      'POST user_request/registrations/822/resolve': ({ reqJson }) => {
        resolveBody = reqJson;
        return { registration: { ...request, state: 'ignored' } };
      },
    },
  });

  await page.goto('/admin/requests');
  await page.getByTestId('admin.requests.bulk.selection_mode').click();
  await page.getByTestId('admin.requests.bulk.select.registration.822').check();
  await page.getByTestId('admin.requests.bulk.action').selectOption('deny');
  await page.getByTestId('admin.requests.bulk.reason').fill('Must never leak');
  await page.getByTestId('admin.requests.bulk.action').selectOption('request_correction');
  await expect(page.getByTestId('admin.requests.bulk.reason')).toHaveValue('');
  await page.getByTestId('admin.requests.bulk.reason').fill('This belongs only to correction');
  await page.getByTestId('admin.requests.bulk.action').selectOption('ignore');
  await expect(page.getByTestId('admin.requests.bulk.reason')).toHaveValue('');
  await page.getByTestId('admin.requests.bulk.apply').click();
  await expect(page.getByTestId('admin.requests.bulk.confirm.reason')).toHaveCount(0);
  await page.getByTestId('admin.requests.bulk.confirm.confirm').click();
  await expect.poll(() => resolveBody).toEqual({ registration: { action: 'ignore' } });
});

test('@workflow-matrix @smoke-mobile admin requests: responsive row opens the decision-first detail', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await bootstrapVpsAdminWindow(page);
  await installOsmMapMock(page);
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [registration(920)] }),
      'GET user_request/changes': () => ({ changes: [] }),
      'GET user_request/registrations/920': () => ({ registration: registration(920) }),
    },
  });

  await page.goto('/admin/requests');
  await page.locator(
    '[data-testid="admin.requests.mobile.row.registration.920"]:visible, [data-testid="admin.requests.row.registration.920"]:visible',
  ).click();
  await expect(page).toHaveURL(/\/admin\/requests\/registration\/920\?returnTo=/);
  await expect(page.getByTestId('admin.requests.detail.decision')).toBeVisible();
  await expect(page.getByTestId('admin.requests.resolve.action.approve')).toBeVisible();
  await page.getByTestId('admin.requests.resolve.action.request_correction').click();
  await expect(page.getByTestId('admin.requests.resolve.modal')).toHaveClass(/rounded-none/);
  const submit = page.getByTestId('admin.requests.resolve.submit');
  const cancel = page.getByRole('button', { name: /cancel|zrušit/i });
  await expect(submit).toBeVisible();
  await expect(cancel).toBeVisible();
  const cancelBox = await cancel.boundingBox();
  const submitBox = await submit.boundingBox();
  expect(cancelBox).not.toBeNull();
  expect(submitBox).not.toBeNull();
  expect(cancelBox?.y ?? 0).toBeLessThan(submitBox?.y ?? 0);
});

test('@workflow-matrix @smoke admin requests: filter segments stay contained at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await bootstrapVpsAdminWindow(page);
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [registration(930)] }),
      'GET user_request/changes': () => ({ changes: [] }),
    },
  });

  await page.goto('/admin/requests');
  for (const testId of ['admin.requests.state_segments', 'admin.requests.type_segments']) {
    const box = await page.getByTestId(testId).boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

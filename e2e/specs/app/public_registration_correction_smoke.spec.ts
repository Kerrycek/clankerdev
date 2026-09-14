import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock } from '../../fixtures';

const preview = {
  id: 123,
  state: 'pending_correction',
  admin_response: 'Please correct your details and resubmit.',
  login: 'alice',
  full_name: 'Alice Example',
  org_name: 'Example Org',
  org_id: '12345678',
  email: 'alice@example.test',
  address: 'Example street',
  year_of_birth: 1990,
  how: 'Friend',
  note: 'Hello',
  os_template: { id: 5, label: 'Debian 12' },
  location: { id: 7, label: 'Prague' },
  currency: 'eur',
  language: { id: 2, label: 'English' },
  time_zone: 'Europe/Prague',
};

test('@workflow-matrix @pr-smoke @pr-smoke-mobile public registration correction previews and resubmits a changed time zone', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await bootstrapVpsAdminWindow(page, { webuiNext: { serverTimeZone: 'Europe/Prague' } });

  await installHaveApiMock(page, {
    handlers: {
      'GET user_request/registrations/123/abc': () => ({ registration: preview }),
      'PUT user_request/registrations/123/abc': ({ reqJson }) => {
        putBodies.push(reqJson);
        return {
          registration: {
            ...preview,
            full_name: 'Alice Example Corrected',
            time_zone: 'America/New_York',
          },
        };
      },
      'GET locations': () => ({ locations: [{ id: 7, label: 'Prague' }] }),
      'GET os_templates': () => ({ os_templates: [{ id: 5, label: 'Debian 12' }] }),
      'GET languages': () => ({ languages: [{ id: 2, label: 'English' }] }),
    },
  });

  await page.goto('/requests/registrations/123/abc');

  await expect(page.getByTestId('public.requests.correction.page')).toBeVisible();
  await expect(page.getByText('Please correct your details and resubmit.')).toBeVisible();
  await expect(page.getByTestId('public.requests.correction.time_zone')).toHaveValue(
    'Europe/Prague'
  );
  await expect(page.getByTestId('public.requests.correction.time_zone.help')).toContainText('IANA');

  await page.getByTestId('public.requests.correction.full_name').fill('Alice Example Corrected');
  await page.getByTestId('public.requests.correction.time_zone').selectOption('America/New_York');
  await page.getByTestId('public.requests.correction.submit').click();

  await expect(
    page.getByText('Your corrected registration request has been sent for review again.')
  ).toBeVisible();
  expect(putBodies).toEqual([{
    registration: {
      login: 'alice',
      full_name: 'Alice Example Corrected',
      org_name: 'Example Org',
      org_id: '12345678',
      email: 'alice@example.test',
      address: 'Example street',
      year_of_birth: 1990,
      how: 'Friend',
      note: 'Hello',
      os_template: 5,
      location: 7,
      currency: 'eur',
      language: 2,
      time_zone: 'America/New_York',
    },
  }]);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
  ).toBe(false);
});

test('public registration correction sends an own null key for server-default time zone', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await bootstrapVpsAdminWindow(page, { webuiNext: { serverTimeZone: 'Europe/Prague' } });

  await installHaveApiMock(page, {
    handlers: {
      'GET user_request/registrations/123/abc': () => ({ registration: preview }),
      'PUT user_request/registrations/123/abc': ({ reqJson }) => {
        putBodies.push(reqJson);
        return { registration: { ...preview, time_zone: null } };
      },
      'GET locations': () => ({ locations: [{ id: 7, label: 'Prague' }] }),
      'GET os_templates': () => ({ os_templates: [{ id: 5, label: 'Debian 12' }] }),
      'GET languages': () => ({ languages: [{ id: 2, label: 'English' }] }),
    },
  });

  await page.goto('/requests/registrations/123/abc');

  const timeZone = page.getByTestId('public.requests.correction.time_zone');
  await expect(timeZone).toHaveValue('Europe/Prague');
  await expect(timeZone.locator('option[value=""]')).toHaveText(
    'Server default (Europe/Prague; clear preference)'
  );
  await timeZone.selectOption('');
  await expect(timeZone).toHaveValue('');
  await page.getByTestId('public.requests.correction.submit').click();

  await expect(
    page.getByText('Your corrected registration request has been sent for review again.')
  ).toBeVisible();
  expect(putBodies).toHaveLength(1);
  const registration = (putBodies[0] as { registration: Record<string, unknown> }).registration;
  expect(Object.prototype.hasOwnProperty.call(registration, 'time_zone')).toBe(true);
  expect(registration.time_zone).toBeNull();
});

test('public registration correction keeps an invalid or expired token fail-closed', async ({
  page,
}) => {
  let putCalls = 0;
  await bootstrapVpsAdminWindow(page);

  await installHaveApiMock(page, {
    handlers: {
      'GET user_request/registrations/123/expired': () => failEnvelope('not found'),
      'PUT user_request/registrations/123/expired': () => {
        putCalls += 1;
        return { registration: preview };
      },
      'GET locations': () => ({ locations: [{ id: 7, label: 'Prague' }] }),
      'GET os_templates': () => ({ os_templates: [{ id: 5, label: 'Debian 12' }] }),
      'GET languages': () => ({ languages: [{ id: 2, label: 'English' }] }),
    },
  });

  await page.goto('/requests/registrations/123/expired');

  await expect(page.getByText('Correction link is no longer valid')).toBeVisible();
  await expect(page.getByTestId('public.requests.correction.page')).toHaveCount(0);
  await expect(page.getByTestId('public.requests.correction.submit')).toHaveCount(0);
  expect(putCalls).toBe(0);
});

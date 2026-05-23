import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

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
};

test('public registration correction page previews and resubmits the request', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  await installHaveApiMock(page, {
    handlers: {
      'GET user_request/registrations/123/abc': () => ({ registration: preview }),
      'PUT user_request/registrations/123/abc': () => ({ registration: preview }),
      'GET locations': () => ({ locations: [{ id: 7, label: 'Prague' }] }),
      'GET os_templates': () => ({ os_templates: [{ id: 5, label: 'Debian 12' }] }),
      'GET languages': () => ({ languages: [{ id: 2, label: 'English' }] }),
    },
  });

  await page.goto('/requests/registrations/123/abc');

  await expect(page.getByTestId('public.requests.correction.page')).toBeVisible();
  await expect(page.getByText('Please correct your details and resubmit.')).toBeVisible();

  await page.getByTestId('public.requests.correction.full_name').fill('Alice Example Corrected');
  await page.getByTestId('public.requests.correction.submit').click();

  await expect(page.getByText('Your corrected registration request has been sent for review again.')).toBeVisible();
});

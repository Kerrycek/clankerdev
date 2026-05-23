import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

function reg(id: number) {
  return {
    id,
    state: 'pending_correction',
    label: `Registration #${id}`,
    user: { id: 10, login: 'alice' },
    admin: { id: 1, login: 'admin' },
    admin_response: 'Please fix your address.',
    login: 'alice',
    full_name: 'Alice Example',
    email: 'alice@example.test',
    address: 'Example street',
    year_of_birth: 1990,
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T11:00:00Z',
    api_ip_addr: '203.0.113.10',
    client_ip_addr: '198.51.100.20',
  };
}

test('user requests: list and detail are available without admin controls', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [reg(123)] }),
      'GET user_request/changes': () => ({ changes: [] }),
      'GET user_request/registrations/123': () => ({ registration: reg(123) }),
    },
  });

  await page.goto('/app/requests');

  await expect(page.getByTestId('admin.requests.smart_filter.input')).toBeVisible();
  await expect(page.getByTestId('admin.requests.row.registration.123')).toBeVisible();
  await page.getByTestId('admin.requests.row.registration.123').click();

  await expect(page).toHaveURL('/app/requests/registration/123');
  await expect(page.getByTestId('admin.requests.detail.registration.123.dot')).toBeVisible();
  await expect(page.getByTestId('admin.requests.resolve.open')).toHaveCount(0);
  await expect(page.getByText('Please fix your address.')).toBeVisible();
});

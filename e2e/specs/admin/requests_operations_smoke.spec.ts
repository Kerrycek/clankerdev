import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

function registration(id: number, state = 'awaiting') {
  return {
    id,
    state,
    label: `Registration #${id}`,
    user: { id: 42, login: 'alice' },
    admin: { id: 1, login: 'admin' },
    login: 'alice',
    full_name: 'Alice Example',
    email: 'alice@example.test',
    address: 'Example street',
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T11:00:00Z',
    api_ip_addr: '203.0.113.10',
    client_ip_addr: '198.51.100.20',
    action_state_id: 77,
    transaction_chain_id: 88,
    transaction_id: 99,
  };
}

test('@workflow-matrix @smoke admin requests: pending quick filters and operational links are visible', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const states: Array<string | null> = [];

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': ({ searchParams }) => {
        const state = searchParams.get('state') || searchParams.get('registration[state]');
        states.push(state);
        return { registrations: [registration(123, state || 'awaiting')] };
      },
      'GET user_request/changes': () => ({ changes: [] }),
      'GET user_request/registrations/123': () => ({ registration: registration(123) }),
    },
  });

  await page.goto('/admin/requests');
  await expect(page.getByTestId('admin.requests.table')).toBeVisible();

  await page.getByTestId('admin.requests.quick.awaiting').click();
  await expect(page).not.toHaveURL(/state=/);
  await expect.poll(() => states.includes('awaiting')).toBeTruthy();

  await page.getByTestId('admin.requests.row.registration.123').click();
  await expect(page).toHaveURL('/admin/requests/registration/123');
  await expect(page.getByTestId('admin.requests.detail.ops')).toBeVisible();
  await expect(page.getByTestId('admin.requests.detail.ops.action_state')).toHaveAttribute('href', '/admin/action-states/77');
  await expect(page.getByTestId('admin.requests.detail.ops.chain')).toHaveAttribute('href', '/admin/transactions/88');
  await expect(page.getByTestId('admin.requests.detail.ops.transaction')).toHaveAttribute('href', '/admin/transactions/items/99');
  await expect(page.getByTestId('admin.requests.resolve.open')).toBeVisible();
});

test('@workflow-matrix @smoke admin requests: advanced filters stay inline and closed requests are hidden by default', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [registration(123, 'awaiting'), registration(124, 'ignored')] }),
      'GET user_request/changes': () => ({ changes: [] }),
    },
  });

  await page.goto('/admin/requests');
  await expect(page.getByTestId('admin.requests.table')).toBeVisible();
  await expect(page.getByTestId('admin.requests.row.registration.123')).toBeVisible();
  await expect(page.getByTestId('admin.requests.row.registration.124')).toHaveCount(0);

  await page.getByRole('button', { name: /pokročilé|advanced/i }).click();
  const advanced = page.getByTestId('admin.requests.advanced_filters');
  await expect(advanced).toBeVisible();
  await expect(advanced).toHaveCSS('position', 'absolute');
  await expect(page.locator('[data-testid="admin.requests.advanced_filters"] [role="dialog"]')).toHaveCount(0);

  await advanced.getByLabel(/stav|state/i).selectOption('ignored');
  await expect(page).toHaveURL(/state=ignored/);
});

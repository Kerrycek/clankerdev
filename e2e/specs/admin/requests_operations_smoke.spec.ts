import { expect, test } from '@playwright/test';

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

test('@workflow-matrix @smoke admin requests: detail actions, inline expansion, and operational links', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

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

  await page.getByTestId('admin.requests.quick.awaiting').click();
  await expect(page).toHaveURL(/state=awaiting/);
  await expect.poll(() => states.includes('awaiting')).toBeTruthy();

  await page.getByTestId('admin.requests.expand.registration.123').click();
  await expect(page.getByTestId('admin.requests.expanded.registration.123')).toBeVisible();
  await expect(page.getByTestId('admin.requests.expanded.registration.123.resolve.action.approve')).toBeVisible();

  await page.getByTestId('admin.requests.expanded.registration.123.resolve.action.approve').click();
  await page.getByTestId('admin.requests.expanded.registration.123.resolve.submit').click();
  await expect.poll(() => resolveBodies.length).toBe(1);
  expect(resolveBodies[0]).toEqual({
    registration: {
      action: 'approve',
      create_vps: true,
      activate: true,
    },
  });
  await expect(page.getByTestId('admin.requests.expanded.registration.123.resolve.actions.none')).toBeVisible();

  await page.getByTestId('admin.requests.row.registration.123').click();
  await expect(page).toHaveURL('/admin/requests/registration/123');
  await expect(page.getByTestId('admin.requests.detail.ops')).toBeVisible();
  await expect(page.getByTestId('admin.requests.detail.ops.action_state')).toHaveAttribute('href', '/admin/action-states/177');
  await expect(page.getByTestId('admin.requests.detail.ops.chain')).toHaveAttribute('href', '/admin/transactions/88');
  await expect(page.getByTestId('admin.requests.detail.ops.transaction')).toHaveAttribute('href', '/admin/transactions/items/99');
  await expect(page.getByTestId('admin.requests.resolve.actions.none')).toBeVisible();
});

test('@workflow-matrix @smoke admin requests: rejected action error is visible', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

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
  await page.getByTestId('admin.requests.resolve.submit').click();
  await expect(page.getByRole('alert')).toContainText('Cannot approve this request');
});

test('@workflow-matrix @smoke admin requests: expand all and collapse all affect visible rows', async ({ page }) => {
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

  await page.getByTestId('admin.requests.expand_all').click();
  await expect(page.getByTestId('admin.requests.expanded.registration.201')).toBeVisible();
  await expect(page.getByTestId('admin.requests.expanded.registration.200')).toBeVisible();
  await expect(page.getByTestId('admin.requests.expanded.change.199')).toBeVisible();

  await page.getByTestId('admin.requests.collapse_all').click();
  await expect(page.getByTestId('admin.requests.expanded.registration.201')).toHaveCount(0);
  await expect(page.getByTestId('admin.requests.expanded.registration.200')).toHaveCount(0);
  await expect(page.getByTestId('admin.requests.expanded.change.199')).toHaveCount(0);
});

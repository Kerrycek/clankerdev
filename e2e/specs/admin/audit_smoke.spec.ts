import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke Admin audit', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    const events = [
      {
        id: 200,
        user: { id: 1, login: 'admin' },
        user_session: { id: 55, api_ip_addr: '203.0.113.10' },
        object: 'Vps',
        object_id: 123,
        event_type: 'delete',
        event_data: { reason: 'cleanup', dry_run: false },
        created_at: '2025-01-01T12:00:00Z',
      },
      {
        id: 199,
        user: { id: 2, login: 'support' },
        user_session: { id: 56, api_ip_addr: '203.0.113.11' },
        object: 'DnsZone',
        object_id: 42,
        event_type: 'update',
        event_data: { field: 'records', count: 2 },
        created_at: '2025-01-01T11:00:00Z',
      },
    ];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET object_histories': () => ({ object_histories: events, _meta: { total_count: events.length } }),
        'GET object_histories/200': () => ({ object_history: events[0] }),
        'GET object_histories/199': () => ({ object_history: events[1] }),
      },
    });
  });

  test('lists events and opens detail', async ({ page }) => {
    await page.goto('/admin/audit');

    await expect(page.getByTestId('admin.audit.page')).toBeVisible();
    await expect(page.getByTestId('admin.audit.row.200')).toBeVisible();
    await expect(page.getByTestId('admin.audit.row.200')).toHaveAttribute('data-row-variant', 'danger');
    await expect(page.getByTestId('admin.audit.row.200.dot')).toBeVisible();

    await page.getByTestId('admin.audit.row.200').click();

    await expect(page).toHaveURL(/\/admin\/audit\/200/);
    await expect(page.getByTestId('admin.audit.detail')).toBeVisible();
    await expect(page.getByTestId('admin.audit.detail.header')).toContainText('delete');
    await expect(page.getByTestId('admin.audit.detail.json')).toContainText('cleanup');
  });
});

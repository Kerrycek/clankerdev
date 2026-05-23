import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke Admin user history', () => {
  test('admin user history: shows events and supports view toggle', async ({ page }) => {
    await bootstrapVpsAdminWindow(page);
  
    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET users/42': () => ({
          user: {
            id: 42,
            login: 'alice',
            level: 1,
            full_name: 'Alice Example',
            email: 'alice@example.test',
            created_at: '2026-02-01T00:00:00.000Z',
            last_activity_at: '2026-02-02T00:00:00.000Z',
            address: 'Example street\nExample city',
          },
        }),
        'GET object_histories': () => ({
          object_histories: [
            {
              id: 5001,
              created_at: '2026-02-10T12:00:00.000Z',
              event_type: 'user.update',
              user: { id: 1, login: 'admin' },
              user_session: { id: 100, api_ip_addr: '1.2.3.4' },
              object: 'User',
              object_id: 42,
              event_data: { email: ['old', 'new'] },
            },
          ],
        }),
      },
    });
  
    await page.goto('/admin/users/42/history');
  
    await expect(page.getByTestId('admin.user.history.filters')).toBeVisible();
    await expect(page.getByTestId('admin.user.history.smart_filter.input')).toBeVisible();
    await expect(page.getByTestId('admin.user.history.table')).toBeVisible();
    await expect(page.getByTestId('admin.user.history.row.5001')).toBeVisible();
    await expect(page.getByTestId('admin.user.history.row.5001.dot')).toBeVisible();
  
    // Toggle view (sanity check).
    await page.getByTestId('admin.user.history.view.actions').click();
    await expect(page.getByTestId('admin.user.history.row.5001')).toBeVisible();
  
    await expect(page.getByTestId('admin.user.history.open_audit')).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Admin news', () => {
  test('creates a news item with the API namespace', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let createPayload: unknown;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET news_logs': () => ({ news_logs: [] }),
        'POST news_logs': async ({ request }) => {
          createPayload = await request.postDataJSON();
          return {
            news_log: {
              id: 42,
              message: 'Planned maintenance',
              published_at: '2026-07-12T18:00:00.000Z',
            },
          };
        },
      },
    });

    await page.goto('/admin/content/news');
    await expect(page.getByTestId('admin.newslog.page')).toBeVisible();

    await page.getByTestId('admin.newslog.create').click();
    await page.getByTestId('admin.newslog.editor.message').fill('Planned maintenance');
    await page.getByTestId('admin.newslog.editor.save').click();

    await expect.poll(() => createPayload).toEqual({
      news_log: {
        message: 'Planned maintenance',
        published_at: expect.any(String),
      },
    });
  });
});

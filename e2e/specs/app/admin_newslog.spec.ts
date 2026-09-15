import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Admin news', () => {
  test('@pr-smoke creates a news item with the API namespace', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    let createPayload: unknown;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET news_logs': () => ({
          news_logs: [{
            id: 7,
            message: 'Existing maintenance notice',
            published_at: '2026-07-12T18:00:00.000Z',
          }],
        }),
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
    await expect(page.getByTestId('admin.newslog.table')).toBeVisible();
    await expect(page.getByTestId('admin.newslog.edit.7')).toBeVisible();

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

  test('@pr-smoke-mobile @smoke-mobile keeps news actions directly reachable at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET news_logs': () => ({
          news_logs: [{
            id: 7,
            message: 'Planned maintenance affecting several clusters and customer services',
            published_at: '2030-07-12T18:00:00.000Z',
          }],
        }),
      },
    });

    await page.goto('/admin/content/news');

    const card = page.getByTestId('admin.newslog.card.7');
    const edit = page.getByTestId('admin.newslog.card.7.edit');
    const remove = page.getByTestId('admin.newslog.card.7.delete');
    await expect(card).toBeVisible();
    await expect(page.getByTestId('admin.newslog.table')).toBeHidden();
    await expect(card.getByText('Planned maintenance affecting several clusters and customer services', { exact: true })).toBeVisible();
    await expect(card.getByText('#7', { exact: true })).toBeVisible();
    await expect(card.getByText('Scheduled', { exact: true })).toBeVisible();

    const documentOverflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(documentOverflows).toBe(false);
    await expect.poll(() => card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

    const viewportWidth = page.viewportSize()?.width ?? 0;
    for (const action of [edit, remove]) {
      const box = await action.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await edit.click();
    await expect(page.getByTestId('admin.newslog.editor')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('admin.newslog.editor')).toBeHidden();

    await remove.click();
    const confirmation = page.getByTestId('admin.newslog.delete_confirm');
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByTestId('admin.newslog.delete_confirm.confirm')).toBeVisible();
  });
});

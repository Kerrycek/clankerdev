import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('Admin content deletion feedback', () => {
  test('keeps a rejected news deletion in context and supports retry', async ({ page }, testInfo) => {
    const deleteActionTestId =
      testInfo.project.name === 'mobile-chrome'
        ? 'admin.newslog.card.42.delete'
        : 'admin.newslog.delete.42';
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const newsLogs: any[] = [
      {
        id: 42,
        message: 'Planned maintenance for the storage cluster',
        published_at: '2026-09-22T06:00:00.000Z',
      },
    ];
    let deleteAttempts = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET news_logs': () => ({ news_logs: [...newsLogs] }),
        'DELETE news_logs/42': () => {
          deleteAttempts += 1;
          if (deleteAttempts === 1) {
            return {
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({
                status: false,
                message: 'News item is still referenced by an active notification.',
                response: null,
              }),
            };
          }

          newsLogs.splice(0, newsLogs.length);
          return { status: true, response: null };
        },
      },
    });

    await page.goto('/admin/content/news');
    await page.getByTestId(deleteActionTestId).click();

    const dialog = page.getByTestId('admin.newslog.delete_confirm');
    await expect(dialog).toContainText('Planned maintenance for the storage cluster');

    await dialog.getByRole('button', { name: /delete|smazat/i }).click();
    await expect(page.getByTestId('admin.newslog.delete_confirm.error')).toContainText(
      'News item is still referenced by an active notification.'
    );
    await expect(dialog).toContainText('Planned maintenance for the storage cluster');

    await dialog.getByRole('button', { name: /delete|smazat/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId(deleteActionTestId)).toHaveCount(0);
    expect(deleteAttempts).toBe(2);
  });

  test('keeps a rejected help box deletion in context and supports retry', async ({ page }, testInfo) => {
    const deleteActionTestId =
      testInfo.project.name === 'mobile-chrome'
        ? 'admin.help_boxes.card.73.delete'
        : 'admin.help_boxes.delete.73';
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const helpBoxes: any[] = [
      {
        id: 73,
        page: 'vps',
        action: 'overview',
        language: null,
        order: 10,
        content: '<p>Storage usage guidance</p>',
      },
    ];
    let deleteAttempts = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET languages': () => ({ languages: [] }),
        'GET help_boxes': () => ({ help_boxes: [...helpBoxes] }),
        'DELETE help_boxes/73': () => {
          deleteAttempts += 1;
          if (deleteAttempts === 1) {
            return {
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({
                status: false,
                message: 'Help box changed on the server. Review it before retrying.',
                response: null,
              }),
            };
          }

          helpBoxes.splice(0, helpBoxes.length);
          return { status: true, response: null };
        },
      },
    });

    await page.goto('/admin/content/help-boxes');
    await page.getByTestId(deleteActionTestId).click();

    const dialog = page.getByTestId('admin.help_boxes.delete_confirm');
    await expect(dialog).toContainText('Storage usage guidance');

    await dialog.getByRole('button', { name: /delete|smazat/i }).click();
    await expect(page.getByTestId('admin.help_boxes.delete_confirm.error')).toContainText(
      'Help box changed on the server. Review it before retrying.'
    );
    await expect(dialog).toContainText('Storage usage guidance');

    await dialog.getByRole('button', { name: /delete|smazat/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId(deleteActionTestId)).toHaveCount(0);
    expect(deleteAttempts).toBe(2);
  });
});

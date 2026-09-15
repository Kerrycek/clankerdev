import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('@pr-smoke @pr-smoke-mobile @smoke-mobile admin help-box actions stay reachable on mobile', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  if (mobile) await page.setViewportSize({ width: 320, height: 900 });

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET languages': () => ({ languages: [{ id: 1, code: 'en', label: 'English' }] }),
      'GET help_boxes': () => ({
        help_boxes: [
          {
            id: 42,
            page: 'very-long-help-page-name-without-breaks',
            action: 'very-long-help-action-name-without-breaks',
            language: { id: 1, code: 'en', label: 'English' },
            order: 7,
            content: 'A long operator-facing help-box preview that must wrap safely inside a narrow card without hiding any management action.',
          },
        ],
      }),
    },
  });

  await page.goto('/admin/content/help-boxes');

  const table = page.getByTestId('admin.help_boxes.table');
  const card = page.getByTestId('admin.help_boxes.card.42');

  const desktopEntry = table.locator('tbody tr').filter({ has: page.getByTestId('admin.help_boxes.preview.42') });
  const entry = mobile ? card : desktopEntry;
  const actionIds = mobile
    ? {
        preview: 'admin.help_boxes.card.42.preview',
        edit: 'admin.help_boxes.card.42.edit',
        delete: 'admin.help_boxes.card.42.delete',
      }
    : {
        preview: 'admin.help_boxes.preview.42',
        edit: 'admin.help_boxes.edit.42',
        delete: 'admin.help_boxes.delete.42',
      };

  await expect(entry).toBeVisible();
  await expect(entry).toContainText('very-long-help-page-name-without-breaks');
  await expect(entry).toContainText('very-long-help-action-name-without-breaks');
  await expect(entry).toContainText('English');
  await expect(entry).toContainText('A long operator-facing help-box preview');
  await expect(entry).toContainText('#42');
  await expect(entry).toContainText('7');

  if (mobile) {
    await expect(page.getByTestId('admin.help_boxes.cards')).toBeVisible();
    await expect(table).toBeHidden();
    await card.scrollIntoViewIfNeeded();
    await expectNoDocumentHorizontalOverflow(page);

    const cardMetrics = await card.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(cardMetrics.scrollWidth).toBeLessThanOrEqual(cardMetrics.clientWidth);

    for (const [name, testId] of Object.entries(actionIds)) {
      const action = page.getByTestId(testId);
      await expect(action).toBeInViewport();
      const box = await action.boundingBox();
      expect(box, `${name} action has a bounding box`).not.toBeNull();
      expect(box?.height ?? 0, `${name} action is at least 44px tall`).toBeGreaterThanOrEqual(44);
      expect(box?.x ?? -1, `${name} action starts inside the viewport`).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0), `${name} action ends inside the viewport`).toBeLessThanOrEqual(320);
    }

    await expect(page.getByTestId(actionIds.preview)).toHaveAccessibleName('Preview: #42');
    await expect(page.getByTestId(actionIds.edit)).toHaveAccessibleName('Edit: #42');
    await expect(page.getByTestId(actionIds.delete)).toHaveAccessibleName('Delete: #42');
  } else {
    await expect(page.getByTestId('admin.help_boxes.cards')).toBeHidden();
    await expect(table).toBeVisible();
  }

  await page.getByTestId(actionIds.preview).click();
  await expect(page.getByTestId('admin.help_boxes.preview')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByTestId(actionIds.edit).click();
  await expect(page.getByTestId('admin.help_boxes.editor')).toBeVisible();
  await expect(page.getByTestId('admin.help_boxes.editor.page')).toHaveValue('very-long-help-page-name-without-breaks');
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByTestId(actionIds.delete).click();
  await expect(page.getByTestId('admin.help_boxes.delete_confirm')).toBeVisible();
  await page.getByTestId('admin.help_boxes.delete_confirm.cancel').click();
});

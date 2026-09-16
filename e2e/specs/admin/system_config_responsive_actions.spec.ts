import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('@pr-smoke @pr-smoke-mobile @smoke-mobile admin system-config editing stays directly reachable on mobile', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  if (mobile) await page.setViewportSize({ width: 320, height: 900 });

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET system_configs': () => ({
        system_configs: [
          {
            category: 'core',
            name: 'api_url',
            type: 'String',
            value: 'https://api-with-a-very-long-mobile-hostname.example.test/v7',
            label: 'API URL with a long operator-facing label',
            description: 'Base API endpoint',
            min_user_level: 90,
          },
          {
            category: 'core',
            name: 'transaction_key',
            type: 'String',
            value: 'super-secret-must-never-render-in-the-list',
            label: 'Transaction key',
            description: 'Used to authenticate transaction callbacks',
            min_user_level: 90,
          },
        ],
      }),
    },
  });

  await page.goto('/admin/cluster/system-config');

  const table = page.getByTestId('admin.cluster.system_config.table');
  const card = page.getByTestId('admin.cluster.system_config.card.core.api_url');

  const entry = mobile ? card : page.getByTestId('admin.cluster.system_config.row.core.api_url');
  const editAction = page.getByTestId(
    mobile
      ? 'admin.cluster.system_config.card.core.api_url.edit'
      : 'admin.cluster.system_config.row.core.api_url.edit',
  );

  await expect(entry).toBeVisible();
  await expect(entry).toContainText('core');
  await expect(entry).toContainText('api_url');
  await expect(entry).toContainText('API URL with a long operator-facing label');
  await expect(entry).toContainText('https://api-with-a-very-long-mobile-hostname.example.test/v7');
  await expect(entry).toContainText('String');
  await expect(page.getByText('super-secret-must-never-render-in-the-list', { exact: true })).toHaveCount(0);

  if (mobile) {
    await expect(page.getByTestId('admin.cluster.system_config.cards')).toBeVisible();
    await expect(table).toBeHidden();
    await expectNoDocumentHorizontalOverflow(page);

    const cardMetrics = await card.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(cardMetrics.scrollWidth).toBeLessThanOrEqual(cardMetrics.clientWidth);

    const box = await editAction.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);

    const secretCard = page.getByTestId('admin.cluster.system_config.card.core.transaction_key');
    await expect(secretCard).toContainText('••••••••••••');
    await expect(editAction).toHaveAccessibleName('Edit: API URL with a long operator-facing label');
  } else {
    await expect(page.getByTestId('admin.cluster.system_config.cards')).toBeHidden();
    await expect(table).toBeVisible();
    await expect(editAction).toHaveAccessibleName('Edit');
  }

  await editAction.click();
  await expect(page.getByTestId('admin.cluster.system_config.edit')).toBeVisible();
  await expect(page.getByTestId('admin.cluster.system_config.edit.value')).toHaveValue(
    'https://api-with-a-very-long-mobile-hostname.example.test/v7',
  );
});

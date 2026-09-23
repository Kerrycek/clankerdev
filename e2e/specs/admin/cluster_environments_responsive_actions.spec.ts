import { expect, test } from '@playwright/test';

import {
  bootstrapVpsAdminWindow,
  installHaveApiMock,
  setUiSettingsLocalStorage,
} from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('@pr-smoke @pr-smoke-mobile @smoke-mobile environment actions stay reachable without horizontal scrolling', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  await page.setViewportSize({ width: mobile ? 320 : 1280, height: 900 });

  const environment = {
    id: 4,
    label: 'Production environment with a deliberately long operator-facing label',
    description: 'Primary cluster environment with a description that must wrap on a narrow phone.',
    domain: 'production-environment-with-a-long-domain-name.example.test',
    can_create_vps: true,
    can_destroy_vps: false,
    vps_lifetime: 5400,
    max_vps_count: 17,
    user_ip_ownership: false,
    maintenance_lock: 'no',
    maintenance_lock_reason: '',
  };
  let maintenanceRequests = 0;
  let environmentUpdates = 0;

  await setUiSettingsLocalStorage(page, { language: 'en' });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'ENVIRONMENT_RESPONSIVE_ACTIONS' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET environments': () => ({ environments: [environment], _meta: { total_count: 1 } }),
      'PUT environments/4': () => {
        environmentUpdates += 1;
        return { environment };
      },
      'POST environments/4/set_maintenance': () => {
        maintenanceRequests += 1;
        return {};
      },
    },
  });

  await page.goto('/admin/cluster/environments');

  const itemPrefix = mobile ? 'admin.cluster.environments.card.4' : 'admin.cluster.environments.row.4';
  const entry = page.getByTestId(itemPrefix);
  const edit = page.getByTestId(`${itemPrefix}.edit`);
  const maintenance = page.getByTestId(`${itemPrefix}.maintenance.lock`);

  await expect(entry).toBeVisible();
  await expect(entry).toContainText(environment.label);
  await expect(entry).toContainText(environment.description);
  await expect(entry).toContainText(environment.domain);
  await expect(entry).toContainText('17');
  await expect(entry).toContainText('1h 30m');
  await expect(entry.getByText('Yes', { exact: true })).toHaveCount(1);
  await expect(entry.getByText('No', { exact: true })).toHaveCount(2);

  const listSurface = mobile ? entry : page.getByTestId('admin.cluster.environments.table');
  await expect(listSurface).toContainText('Create VPS');
  await expect(listSurface).toContainText('Destroy VPS');
  await expect(listSurface).toContainText('Max VPS/user');
  await expect(listSurface).toContainText('Lifetime');
  await expect(listSurface).toContainText('User owns IP');
  await expectNoDocumentHorizontalOverflow(page);

  if (mobile) {
    await expect(page.getByTestId('admin.cluster.environments.cards')).toBeVisible();
    await expect(page.getByTestId('admin.cluster.environments.table')).toBeHidden();
    await entry.scrollIntoViewIfNeeded();

    const cardMetrics = await entry.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(cardMetrics.scrollWidth).toBeLessThanOrEqual(cardMetrics.clientWidth);

    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
    for (const [name, action] of [['edit', edit], ['maintenance', maintenance]] as const) {
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport();
      const box = await action.boundingBox();
      expect(box, `${name} action has a bounding box`).not.toBeNull();
      expect(box?.width ?? 0, `${name} action is at least 44px wide`).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, `${name} action is at least 44px tall`).toBeGreaterThanOrEqual(44);
      expect(box?.x ?? -1, `${name} action starts inside the viewport`).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0), `${name} action ends inside the viewport`).toBeLessThanOrEqual(
        viewportWidth,
      );
    }

    await expect(edit).toHaveAccessibleName(`Edit: ${environment.label}`);
  } else {
    await expect(page.getByTestId('admin.cluster.environments.cards')).toBeHidden();
    await expect(page.getByTestId('admin.cluster.environments.table')).toBeVisible();
    await expect(edit).toHaveAccessibleName('Edit');
  }

  await edit.click();
  await expect(page.getByTestId('admin.cluster.environments.editor')).toBeVisible();
  await expect(page.getByTestId('admin.cluster.environments.editor.label')).toHaveValue(environment.label);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('admin.cluster.environments.editor')).toBeHidden();
  expect(environmentUpdates).toBe(0);

  await maintenance.click();
  const maintenanceDialog = page.getByTestId(`${itemPrefix}.maintenance.lock_dialog`);
  await expect(maintenanceDialog).toBeVisible();
  await maintenanceDialog.getByTestId(`${itemPrefix}.maintenance.lock_dialog.cancel`).click();
  await expect(maintenanceDialog).toBeHidden();
  expect(maintenanceRequests).toBe(0);
});

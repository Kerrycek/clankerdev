import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('@pr-smoke @pr-smoke-mobile @smoke-mobile admin OS-template actions stay reachable on mobile', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  if (mobile) await page.setViewportSize({ width: 320, height: 900 });

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET os_families': () => ({ os_families: [{ id: 1, label: 'A very long Debian family label' }] }),
      'GET os_templates': () => ({
        os_templates: [
          {
            id: 11,
            os_family: { id: 1, label: 'A very long Debian family label' },
            label: 'A very long Debian 12 operator-facing template label',
            distribution: 'debian-with-a-long-distribution-name',
            version: '12.7-long-version',
            enabled: true,
            supported: true,
            order: 10,
            uses_count: 0,
            hypervisor_type: 'vpsadminos',
            cgroup_version: 'cgroup_v2',
            manage_hostname: true,
            manage_dns_resolver: true,
            enable_script: true,
            enable_cloud_init: true,
            vendor: 'debian',
            variant: 'default',
            arch: 'x86_64',
            config: 'image: debian-12',
          },
          {
            id: 12,
            os_family: { id: 1, label: 'A very long Debian family label' },
            label: 'Debian template currently in use',
            distribution: 'debian',
            version: '13',
            enabled: true,
            supported: true,
            order: 20,
            uses_count: 3,
          },
        ],
      }),
    },
  });

  await page.goto('/admin/cluster/os-templates');

  const table = page.getByTestId('admin.cluster.os_templates.table');
  const card = page.getByTestId('admin.cluster.os_templates.card.11');

  const desktopEntry = table.locator('tbody tr').filter({ has: page.getByTestId('admin.cluster.os_templates.row.11.edit') });
  const entry = mobile ? card : desktopEntry;
  const edit = page.getByTestId(
    mobile ? 'admin.cluster.os_templates.card.11.edit' : 'admin.cluster.os_templates.row.11.edit',
  );
  const remove = page.getByTestId(
    mobile ? 'admin.cluster.os_templates.card.11.delete' : 'admin.cluster.os_templates.row.11.delete',
  );
  const blockedRemove = page.getByTestId(
    mobile ? 'admin.cluster.os_templates.card.12.delete' : 'admin.cluster.os_templates.row.12.delete',
  );

  await expect(entry).toBeVisible();
  await expect(entry).toContainText('A very long Debian 12 operator-facing template label');
  await expect(entry).toContainText('debian-with-a-long-distribution-name 12.7-long-version');
  await expect(entry).toContainText('A very long Debian family label');
  await expect(entry).toContainText('Enabled');
  await expect(entry).toContainText('Supported');
  await expect(entry).toContainText('10');

  if (mobile) {
    await expect(page.getByTestId('admin.cluster.os_templates.cards')).toBeVisible();
    await expect(table).toBeHidden();
    await card.scrollIntoViewIfNeeded();
    await expectNoDocumentHorizontalOverflow(page);

    const cardMetrics = await card.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(cardMetrics.scrollWidth).toBeLessThanOrEqual(cardMetrics.clientWidth);

    for (const [name, action] of [['edit', edit], ['delete', remove]] as const) {
      await expect(action).toBeInViewport();
      const box = await action.boundingBox();
      expect(box, `${name} action has a bounding box`).not.toBeNull();
      expect(box?.height ?? 0, `${name} action is at least 44px tall`).toBeGreaterThanOrEqual(44);
      expect(box?.x ?? -1, `${name} action starts inside the viewport`).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0), `${name} action ends inside the viewport`).toBeLessThanOrEqual(320);
    }

    await expect(edit).toHaveAccessibleName('Edit: A very long Debian 12 operator-facing template label');
    await expect(remove).toHaveAccessibleName('Delete: A very long Debian 12 operator-facing template label');
  } else {
    await expect(page.getByTestId('admin.cluster.os_templates.cards')).toBeHidden();
    await expect(table).toBeVisible();
  }

  await expect(blockedRemove).toBeDisabled();
  await expect(blockedRemove).toHaveAttribute('title', 'Cannot delete: template is in use.');

  await edit.click();
  await expect(page.getByTestId('admin.cluster.os_templates.editor')).toBeVisible();
  await expect(page.getByTestId('admin.cluster.os_templates.editor.label')).toHaveValue(
    'A very long Debian 12 operator-facing template label',
  );
  await page.getByRole('button', { name: 'Cancel' }).click();

  await remove.click();
  await expect(page.getByTestId('admin.cluster.os_templates.delete')).toBeVisible();
  await page.getByTestId('admin.cluster.os_templates.delete.cancel').click();
});

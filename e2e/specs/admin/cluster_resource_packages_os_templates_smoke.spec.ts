import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke Admin cluster OS templates and resource packages', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  });

  test('OS templates list, filter and editor use namespaced API payloads', async ({ page }) => {
    const families = [{ id: 1, label: 'Debian' }];
    const templates: any[] = [
      {
        id: 11,
        os_family: families[0],
        label: 'Debian 12',
        distribution: 'debian',
        version: '12',
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
    ];
    const gets: URL[] = [];
    const puts: any[] = [];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET os_families': () => ({ os_families: families, _meta: { total_count: families.length } }),
        'GET os_templates': ({ url }) => {
          gets.push(url);
          return { os_templates: templates, _meta: { total_count: templates.length } };
        },
        'PUT os_templates/11': ({ json }) => {
          puts.push(json);
          templates[0] = { ...templates[0], ...((json as any)?.os_template ?? {}) };
          return { os_template: templates[0] };
        },
      },
    });

    await page.goto('/admin/cluster/os-templates');
    await expect(page.getByTestId('admin.cluster.os_templates.page')).toBeVisible();
    await expect(page.getByTestId('admin.cluster.os_templates.table')).toContainText('Debian 12');

    await page.getByTestId('admin.cluster.os_templates.advanced').click();
    await page.getByTestId('admin.cluster.os_templates.filter.enabled').selectOption('true');
    await expect
      .poll(() => gets.some((url) => url.searchParams.get('os_template[enabled]') === 'true'))
      .toBeTruthy();
    await page.getByTestId('admin.cluster.os_templates.advanced.drawer').getByRole('button', { name: /hotovo|done/i }).click();

    await page.getByTestId('admin.cluster.os_templates.row.11.edit').click();
    await expect(page.getByTestId('admin.cluster.os_templates.editor')).toBeVisible();
    await page.getByTestId('admin.cluster.os_templates.editor.label').fill('Debian 12 LTS');
    await page.getByTestId('admin.cluster.os_templates.editor.save').click();

    expect(puts.length).toBeGreaterThan(0);
    expect(puts[puts.length - 1]).toEqual({
      os_template: expect.objectContaining({
        label: 'Debian 12 LTS',
        enabled: true,
        supported: true,
        hypervisor_type: 'vpsadminos',
        cgroup_version: 'cgroup_v2',
      }),
    });
  });

  test('resource packages list, detail items and assignments work', async ({ page }) => {
    const environments = [{ id: 1, label: 'Production' }];
    const users = [{ id: 7, login: 'alice' }];
    const clusterResources = [
      { id: 3, label: 'Memory', name: 'memory' },
      { id: 4, label: 'CPU', name: 'cpu' },
    ];
    const packages: any[] = [
      { id: 21, label: 'Standard Production', environment: environments[0], is_personal: false },
    ];
    const items: any[] = [{ id: 31, cluster_resource: clusterResources[0], value: 4096 }];
    const assignments: any[] = [
      {
        id: 41,
        environment: environments[0],
        user: users[0],
        cluster_resource_package: packages[0],
        comment: 'Initial import',
        added_by: { id: 1, login: 'admin' },
      },
    ];
    const posts: any[] = [];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET environments': () => ({ environments, _meta: { total_count: environments.length } }),
        'GET users': () => ({ users, _meta: { total_count: users.length } }),
        'GET cluster_resources': () => ({ cluster_resources: clusterResources, _meta: { total_count: clusterResources.length } }),
        'GET cluster_resource_packages': () => ({ cluster_resource_packages: packages, _meta: { total_count: packages.length } }),
        'GET cluster_resource_packages/21': () => ({ cluster_resource_package: packages[0] }),
        'GET cluster_resource_packages/21/items': () => ({
          items,
          _meta: { total_count: items.length },
        }),
        'POST cluster_resource_packages/21/items': ({ json }) => {
          posts.push(json);
          const created = { id: 32, cluster_resource: clusterResources[1], value: (json as any)?.item?.value };
          items.push(created);
          return { item: created };
        },
        'GET user_cluster_resource_packages': () => ({
          user_cluster_resource_packages: assignments,
          _meta: { total_count: assignments.length },
        }),
        'POST user_cluster_resource_packages': ({ json }) => {
          posts.push(json);
          const created = {
            id: 42,
            environment: environments[0],
            user: users[0],
            cluster_resource_package: packages[0],
            comment: (json as any)?.user_cluster_resource_package?.comment,
          };
          assignments.push(created);
          return { user_cluster_resource_package: created };
        },
      },
    });

    await page.goto('/admin/cluster/resource-packages');
    await expect(page.getByTestId('admin.cluster.resource_packages.table')).toContainText('Standard Production');
    await page.getByTestId('admin.cluster.resource_packages.row.21.open').click();
    await expect(page).toHaveURL(/\/admin\/cluster\/resource-packages\/21/);
    await expect(page.getByTestId('admin.cluster.resource_package_detail.header')).toContainText('Standard Production');

    await page.getByTestId('admin.cluster.resource_package_detail.items.add').click();
    await expect(page.getByTestId('admin.cluster.resource_package_detail.item_editor')).toBeVisible();
    await page.getByTestId('admin.cluster.resource_package_detail.item_editor.resource').selectOption('4');
    await page.getByTestId('admin.cluster.resource_package_detail.item_editor.value').fill('8');
    await page.getByTestId('admin.cluster.resource_package_detail.item_editor.save').click();

    await page.getByTestId('admin.cluster.resource_package_detail.assign.add').click();
    await expect(page.getByTestId('admin.cluster.resource_package_detail.assign_editor')).toBeVisible();
    await page.getByTestId('admin.cluster.resource_package_detail.assign_editor.environment').selectOption('1');
    await page.getByTestId('admin.cluster.resource_package_detail.assign_editor.user').fill('7');
    await page.getByTestId('admin.cluster.resource_package_detail.assign_editor.comment').fill('Smoke assignment');
    await page.getByTestId('admin.cluster.resource_package_detail.assign_editor.save').click();

    expect(posts).toContainEqual({
      item: {
        cluster_resource: 4,
        value: 8,
      },
    });
    expect(posts).toContainEqual({
      user_cluster_resource_package: {
        environment: 1,
        user: 7,
        cluster_resource_package: 21,
        comment: 'Smoke assignment',
        from_personal: false,
      },
    });
  });

  test('resource package deletion keeps a rejected target in context and supports retry', async ({ page }) => {
    const packages: any[] = [
      { id: 21, label: 'Standard Production', is_personal: false },
    ];
    let deleteAttempts = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET environments': () => ({ environments: [], _meta: { total_count: 0 } }),
        'GET users': () => ({ users: [], _meta: { total_count: 0 } }),
        'GET cluster_resource_packages': () => ({ cluster_resource_packages: packages, _meta: { total_count: packages.length } }),
        'GET user_cluster_resource_packages': () => ({ user_cluster_resource_packages: [], _meta: { total_count: 0 } }),
        'DELETE cluster_resource_packages/21': () => {
          deleteAttempts += 1;
          if (deleteAttempts === 1) {
            return {
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({ status: false, message: 'Package is still assigned' }),
            };
          }
          packages.splice(0, 1);
          return { cluster_resource_package: { id: 21 } };
        },
      },
    });

    await page.goto('/admin/cluster/resource-packages');
    await page.getByTestId('admin.cluster.resource_packages.row.21.delete').click();
    const dialog = page.getByTestId('admin.cluster.resource_packages.delete_confirm');
    await expect(dialog).toContainText('Standard Production');

    await dialog.getByRole('button', { name: /delete|smazat/i }).click();
    await expect(page.getByTestId('admin.cluster.resource_packages.delete_confirm.error')).toContainText('Package is still assigned');
    await expect(dialog).toContainText('Standard Production');

    await dialog.getByRole('button', { name: /delete|smazat/i }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('admin.cluster.resource_packages.row.21')).toHaveCount(0);
    expect(deleteAttempts).toBe(2);
  });

  test('resource package detail keeps a rejected deletion in context and supports retry', async ({ page }) => {
    const resourcePackage = { id: 21, label: 'Standard Production', is_personal: false };
    const items: any[] = [{ id: 31, cluster_resource: { id: 3, label: 'Memory', name: 'memory' }, value: 4096 }];
    const assignments: any[] = [{
      id: 41,
      environment: { id: 1, label: 'Production' },
      user: { id: 7, login: 'alice' },
      cluster_resource_package: resourcePackage,
      comment: '',
    }];
    let packageDeleteAttempts = 0;
    let itemDeleteAttempts = 0;
    let assignmentDeleteAttempts = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET environments': () => ({ environments: [], _meta: { total_count: 0 } }),
        'GET cluster_resources': () => ({ cluster_resources: [], _meta: { total_count: 0 } }),
        'GET cluster_resource_packages/21': () => ({ cluster_resource_package: resourcePackage }),
        'GET cluster_resource_packages/21/items': () => ({ items, _meta: { total_count: items.length } }),
        'GET user_cluster_resource_packages': () => ({ user_cluster_resource_packages: assignments, _meta: { total_count: assignments.length } }),
        'DELETE cluster_resource_packages/21/items/31': () => {
          itemDeleteAttempts += 1;
          if (itemDeleteAttempts === 1) {
            return {
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({ status: false, message: 'Resource item is still in use' }),
            };
          }
          items.splice(0, 1);
          return { item: { id: 31 } };
        },
        'DELETE user_cluster_resource_packages/41': () => {
          assignmentDeleteAttempts += 1;
          if (assignmentDeleteAttempts === 1) {
            return {
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({ status: false, message: 'Assignment changed on the server' }),
            };
          }
          assignments.splice(0, 1);
          return { user_cluster_resource_package: { id: 41 } };
        },
        'DELETE cluster_resource_packages/21': () => {
          packageDeleteAttempts += 1;
          if (packageDeleteAttempts === 1) {
            return {
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({ status: false, message: 'Package is still assigned' }),
            };
          }
          return { cluster_resource_package: { id: 21 } };
        },
      },
    });

    await page.goto('/admin/cluster/resource-packages/21');

    await page.getByTestId('admin.cluster.resource_package_detail.items.row.31.delete').click();
    const itemDialog = page.getByTestId('admin.cluster.resource_package_detail.item_delete_confirm');
    await expect(itemDialog).toContainText('Memory');
    await expect(itemDialog).toContainText('4096');
    await itemDialog.getByRole('button', { name: /delete|smazat/i }).click();
    await expect(page.getByTestId('admin.cluster.resource_package_detail.item_delete_confirm.error')).toContainText('Resource item is still in use');
    await itemDialog.getByRole('button', { name: /delete|smazat/i }).click();
    await expect(itemDialog).toBeHidden();
    await expect(page.getByTestId('admin.cluster.resource_package_detail.items.row.31')).toHaveCount(0);

    await page.getByTestId('admin.cluster.resource_package_detail.assign.row.41.delete').click();
    const assignmentDialog = page.getByTestId('admin.cluster.resource_package_detail.assign_delete_confirm');
    await expect(assignmentDialog).toContainText('alice');
    await expect(assignmentDialog).toContainText('Production');
    await assignmentDialog.getByRole('button', { name: /delete|smazat/i }).click();
    await expect(page.getByTestId('admin.cluster.resource_package_detail.assign_delete_confirm.error')).toContainText('Assignment changed on the server');
    await assignmentDialog.getByRole('button', { name: /delete|smazat/i }).click();
    await expect(assignmentDialog).toBeHidden();
    await expect(page.getByTestId('admin.cluster.resource_package_detail.assign.row.41')).toHaveCount(0);

    await page.getByTestId('admin.cluster.resource_package_detail.delete').click();
    const dialog = page.getByTestId('admin.cluster.resource_package_detail.delete_confirm');
    await expect(dialog).toContainText('Standard Production');
    await expect(dialog).toContainText('#21');

    await dialog.getByRole('button', { name: /delete|smazat/i }).click();
    await expect(page.getByTestId('admin.cluster.resource_package_detail.delete_confirm.error')).toContainText('Package is still assigned');
    await expect(dialog).toContainText('Standard Production');

    await dialog.getByRole('button', { name: /delete|smazat/i }).click();
    await expect(dialog).toBeHidden();
    expect(itemDeleteAttempts).toBe(2);
    expect(assignmentDeleteAttempts).toBe(2);
    expect(packageDeleteAttempts).toBe(2);
  });
});

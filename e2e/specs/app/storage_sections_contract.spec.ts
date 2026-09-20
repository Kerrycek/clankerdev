import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('User storage section contract', () => {
  test('@pr-smoke @pr-smoke-mobile separates VPS disks and NAS while keeping the backup hub cross-storage', async ({ page }, testInfo) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const requestedRoles: Array<string | null> = [];
    const vpsDataset = {
      id: 101,
      role: 'hypervisor',
      name: 'root',
      full_name: 'tank/vps/mail/root',
      vps: { id: 20, hostname: 'mail.example' },
      user: { id: 1, login: 'storage-user' },
      object_state: 'active',
    };
    const nasDataset = {
      id: 202,
      role: 'primary',
      name: 'archive',
      full_name: 'tank/nas/archive',
      user: { id: 1, login: 'storage-user' },
      object_state: 'active',
    };

    await installHaveApiMock(page, {
      user: { id: 1, login: 'storage-user', level: 1 },
      handlers: {
        'GET datasets': ({ searchParams }) => {
          const role = searchParams.get('dataset[role]');
          requestedRoles.push(role);
          const datasets = role === 'hypervisor'
            ? [vpsDataset]
            : role === 'primary'
              ? [nasDataset]
              : [vpsDataset, nasDataset];
          return { datasets, _meta: { total_count: datasets.length } };
        },
        'GET datasets/101': () => vpsDataset,
        'GET datasets/202': () => nasDataset,
        'GET datasets/101/snapshots': () => ({ snapshots: [], _meta: { total_count: 0 } }),
        'GET datasets/202/snapshots': () => ({ snapshots: [], _meta: { total_count: 0 } }),
        'GET snapshot_downloads': () => ({ snapshot_downloads: [], _meta: { total_count: 0 } }),
        'GET transaction_chains': () => ({ transaction_chains: [], _meta: { total_count: 0 } }),
      },
    });

    const mobile = testInfo.project.name === 'mobile-chrome';

    await page.goto('/app/datasets');
    await expect(page.getByTestId('datasets.list.header')).toContainText('VPS disks');
    await expect(page.getByTestId('nav.sidebar.datasets')).toContainText('VPS disks');
    await expect.poll(() => requestedRoles).toEqual(['hypervisor']);
    await expect(page.getByTestId(`datasets.${mobile ? 'card' : 'row'}.101`)).toBeVisible();
    await expect(page.getByTestId('datasets.row.202')).toHaveCount(0);
    await expect(page.getByTestId('datasets.card.202')).toHaveCount(0);

    const vpsListEntry = page.getByTestId(`datasets.${mobile ? 'card' : 'row'}.101`);
    await expect(vpsListEntry.getByRole('link', { name: 'tank/vps/mail/root' })).toHaveAttribute(
      'href',
      '/app/datasets/101',
    );
    await vpsListEntry.getByRole('link', { name: 'tank/vps/mail/root' }).click();
    await expect(page).toHaveURL('/app/datasets/101');
    await expect(page.getByTestId('dataset.header')).toContainText('VPS disks');
    await expect(page.getByRole('link', { name: 'Snapshots' })).toHaveAttribute(
      'href',
      '/app/datasets/101/snapshots',
    );

    requestedRoles.length = 0;
    await page.goto('/app/nas');
    await expect(page.getByTestId('datasets.list.header')).toContainText('NAS');
    await expect.poll(() => requestedRoles).toEqual(['primary']);
    await expect(page.getByTestId(`datasets.${mobile ? 'card' : 'row'}.202`)).toBeVisible();
    await expect(page.getByTestId('datasets.row.101')).toHaveCount(0);
    await expect(page.getByTestId('datasets.card.101')).toHaveCount(0);

    const nasListEntry = page.getByTestId(`datasets.${mobile ? 'card' : 'row'}.202`);
    await expect(nasListEntry.getByRole('link', { name: 'tank/nas/archive' })).toHaveAttribute(
      'href',
      '/app/nas/202',
    );
    await nasListEntry.getByRole('link', { name: 'tank/nas/archive' }).click();
    await expect(page).toHaveURL('/app/nas/202');
    await expect(page.getByTestId('dataset.header')).toContainText('NAS');
    await expect(page.getByRole('link', { name: 'Snapshots' })).toHaveAttribute(
      'href',
      '/app/nas/202/snapshots',
    );

    requestedRoles.length = 0;
    await page.goto('/app/backups');
    await expect(page.getByTestId('backups.stats.datasets')).toContainText('Storage in the account');
    await expect(page.getByTestId('backups.stats.datasets')).toContainText('2');
    await expect.poll(() => requestedRoles).toEqual([null]);

    await page.getByTestId('backups.tab.snapshots').click();
    await expect(page.getByText(
      'Choose a dataset and manage its snapshots here. Only the selected dataset is loaded.',
      { exact: true },
    )).toBeVisible();
    await expect(page.getByText(/on the left/i)).toHaveCount(0);
    await expect(page.getByTestId('backups.snapshots.row.101')).toContainText('VPS disk');
    await expect(page.getByTestId('backups.snapshots.row.202')).toContainText('NAS');

    await page.getByTestId('backups.snapshots.row.101').click();
    await expect(page.getByRole('link', { name: 'Open full detail' })).toHaveAttribute(
      'href',
      '/app/datasets/101/snapshots',
    );

    await page.getByTestId('backups.snapshots.row.202').click();
    await expect(page.getByRole('link', { name: 'Open full detail' })).toHaveAttribute(
      'href',
      '/app/nas/202/snapshots',
    );
  });
});

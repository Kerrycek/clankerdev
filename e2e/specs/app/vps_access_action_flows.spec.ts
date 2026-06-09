import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const vps = {
  id: 123,
  hostname: 'vps123.example',
  object_state: 'active',
  is_running: true,
  enable_network: true,
  cpus: 2,
  memory: 2048,
  swap: 0,
  diskspace: 20480,
  used_memory: 768,
  used_swap: 0,
  used_diskspace: 5120,
  uptime: 12345,
  loadavg1: 0.12,
  node: { id: 1, domain_name: 'node1.example', location: { label: 'dc1' } },
  user: { id: 7, login: 'owner' },
  os_template: { id: 6, label: 'Debian 12' },
  dns_resolver: 'inherit',
};

function actionState(id: number, label: string) {
  return {
    id,
    label,
    status: true,
    finished: true,
    current: 1,
    total: 1,
    created_at: '2026-06-09T08:00:00Z',
    updated_at: '2026-06-09T08:00:01Z',
  };
}

async function installAccessMock(page: Page) {
  await installHaveApiMock(page, {
    user: { id: 7, login: 'owner', level: 1 },
    handlers: {
      'GET vpses/123': () => ({ vps }),
      'GET ip_addresses': () => ({ ip_addresses: [] }),
      'GET vpses/123/statuses': () => ({ statuses: [] }),
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'GET users/7/public_keys': () => ({
        public_keys: [
          {
            id: 17,
            label: 'Laptop key',
            fingerprint: 'SHA256:e2etest',
            comment: 'workstation',
            auto_add: false,
          },
        ],
      }),
      'POST vpses/123/passwd': () => ({
        status: true,
        response: {
          vps: { password: 'GeneratedRoot42!' },
          _meta: { action_state_id: 8801 },
        },
      }),
      'POST vpses/123/deploy_public_key': () => ({
        status: true,
        response: {
          _meta: { action_state_id: 8802 },
        },
      }),
      'GET action_states/8801': () => ({ action_state: actionState(8801, 'Generate root password') }),
      'GET action_states/8802': () => ({ action_state: actionState(8802, 'Deploy SSH public key') }),
      'GET action_states': () => ({
        action_states: [
          actionState(8802, 'Deploy SSH public key'),
          actionState(8801, 'Generate root password'),
        ],
      }),
    },
  });
}

test.describe('@workflow-matrix @smoke VPS access workflows', () => {
  test('root password action shows the generated result and tracks the task', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installAccessMock(page);

    await page.goto('/app/vps/123/access');
    await expect(page.getByText('Root password reset')).toBeVisible();

    await page.getByTestId('vps.access.password.type').selectOption('simple');

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/passwd')
    );

    await page.getByTestId('vps.access.password.generate').click();
    await page.getByTestId('vps.access.password.confirm.confirm').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({ vps: { type: 'simple' } });

    await expect(page.getByText('Generated root password')).toBeVisible();
    await expect(page.getByDisplayValue('GeneratedRoot42!')).toBeVisible();

    await page.getByTestId('tasks.open-button').click();
    await expect(page.getByTestId('tasks.drawer')).toBeVisible();
    await expect(page.getByTestId('tasks.row.8801')).toContainText('Generate root password');
  });

  test('SSH key deploy stays on the access page and tracks the task in the drawer', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installAccessMock(page);

    await page.goto('/app/vps/123/access');
    await expect(page.getByText('SSH public key deployment')).toBeVisible();
    await expect(page.getByTestId('vps.access.ssh.key')).toContainText('Laptop key');

    const reqPromise = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/deploy_public_key')
    );

    await page.getByTestId('vps.access.ssh.deploy').click();
    await page.getByTestId('vps.access.ssh.confirm.confirm').click();

    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({ vps: { public_key: 17 } });

    await expect(page).toHaveURL(/\/app\/vps\/123\/access$/);
    await expect(page.getByText('SSH public key deployment')).toBeVisible();
    await expect(page.getByText(/Public key deployed: Laptop key/)).toBeVisible();

    await page.getByTestId('tasks.open-button').click();
    await expect(page.getByTestId('tasks.drawer')).toHaveAttribute('aria-modal', 'false');
    await expect(page.getByTestId('tasks.row.8802')).toContainText('Deploy SSH public key');
    await expect(page.getByText('SSH public key deployment')).toBeVisible();
  });
});

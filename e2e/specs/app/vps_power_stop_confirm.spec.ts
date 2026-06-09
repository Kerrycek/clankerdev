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
  user: { id: 42, login: 'user' },
  os_template: { label: 'debian' },
  dns_resolver: 'inherit',
};

async function installPowerMock(
  page: Page,
  opts: {
    vpsOverride?: Record<string, unknown>;
    actionId: number;
    actionLabel: string;
    actionPath: 'start' | 'stop' | 'restart';
  }
) {
  await installHaveApiMock(page, {
    user: { id: 42, login: 'user', level: 1 },
    handlers: {
      'GET vpses/123': () => ({ vps: { ...vps, ...opts.vpsOverride } }),
      'GET ip_addresses': () => ({
        ip_addresses: [
          {
            id: 1,
            addr: '198.51.100.10',
            vps: { id: 123 },
            network: { role: 'public', purpose: 'public' },
          },
        ],
      }),
      'GET vpses/123/statuses': () => ({ statuses: [] }),
      [`POST vpses/123/${opts.actionPath}`]: () => ({ _meta: { action_state_id: opts.actionId } }),
      [`GET action_states/${opts.actionId}`]: () => ({
        action_state: {
          id: opts.actionId,
          label: opts.actionLabel,
          status: true,
          finished: false,
          current: 1,
          total: 2,
          created_at: '2026-02-04T00:00:00Z',
          updated_at: '2026-02-04T00:00:01Z',
        },
      }),
      'GET action_states': () => ({
        action_states: [
          {
            id: opts.actionId,
            label: opts.actionLabel,
            status: true,
            finished: false,
            current: 1,
            total: 2,
            created_at: '2026-02-04T00:00:00Z',
            updated_at: '2026-02-04T00:00:01Z',
          },
        ],
      }),
    },
  });
}

test('@smoke VPS detail stop action uses confirm dialog and sends POST with force', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installPowerMock(page, { actionId: 777, actionLabel: 'Stop', actionPath: 'stop' });

  await page.goto('/app/vps/123');

  await expect(page.getByTestId('vps.header')).toBeVisible();

  const stopBtn = page.getByTestId('vps.action.stop');
  await expect(stopBtn).toBeVisible();
  await expect(stopBtn).toHaveAttribute('aria-disabled', 'false');

  await stopBtn.click();

  await expect(page.getByTestId('vps.action.stop_confirm')).toBeVisible();

  // Enable the force option to validate request body structure.
  await page.getByTestId('vps.action.stop_confirm.force').click();

  const reqPromise = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/stop')
  );

  await page.getByTestId('vps.action.stop_confirm.confirm').click();

  const req = await reqPromise;
  expect(req.postDataJSON()).toEqual({ vps: { force: true } });

  await expect(page.getByTestId('vps.action.stop_confirm')).toBeHidden();
});

test('@workflow-matrix @smoke VPS detail start action opens blocking progress and is tracked in tasks', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installPowerMock(page, {
    vpsOverride: { is_running: false, uptime: 0 },
    actionId: 778,
    actionLabel: 'Start VPS',
    actionPath: 'start',
  });

  await page.goto('/app/vps/123');

  await page.getByTestId('vps.action.start').click();
  await expect(page.getByTestId('modal.action_progress')).toBeVisible();
  await page.getByTestId('modal.action_progress.continue').click();

  await page.getByTestId('tasks.open-button').click();
  await expect(page.getByTestId('tasks.drawer')).toBeVisible();
  await expect(page.getByTestId('tasks.row.778')).toContainText('Start VPS');
});

test('@workflow-matrix @smoke VPS detail restart action sends force payload and tracks action state', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installPowerMock(page, { actionId: 779, actionLabel: 'Restart VPS', actionPath: 'restart' });

  await page.goto('/app/vps/123');

  await page.getByTestId('vps.action.restart').click();
  await expect(page.getByTestId('vps.action.restart_confirm')).toBeVisible();
  await page.getByTestId('vps.action.restart_confirm.force').click();

  const reqPromise = page.waitForRequest(
    (r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/restart')
  );

  await page.getByTestId('vps.action.restart_confirm.confirm').click();

  const req = await reqPromise;
  expect(req.postDataJSON()).toEqual({ vps: { force: true } });

  await expect(page.getByTestId('modal.action_progress')).toBeVisible();
  await page.getByTestId('modal.action_progress.continue').click();
  await page.getByTestId('tasks.open-button').click();
  await expect(page.getByTestId('tasks.row.779')).toContainText('Restart VPS');
});

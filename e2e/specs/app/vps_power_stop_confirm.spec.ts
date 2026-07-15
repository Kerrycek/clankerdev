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

function runningActionState(id: number, label: string) {
  return {
    action_state: {
      id,
      label,
      status: true,
      finished: false,
      current: 1,
      total: 2,
      created_at: '2026-07-15T12:00:00Z',
      updated_at: '2026-07-15T12:00:01Z',
    },
  };
}

async function installPowerMock(
  page: Page,
  options: { action: 'start' | 'stop' | 'restart'; actionStateId: number; isRunning: boolean }
) {
  const label = `${options.action[0].toUpperCase()}${options.action.slice(1)} VPS`;

  await installHaveApiMock(page, {
    user: { id: 42, login: 'user', level: 1 },
    handlers: {
      'GET vpses/123': () => ({ vps: { ...vps, is_running: options.isRunning } }),
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
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      [`POST vpses/123/${options.action}`]: () => ({
        _meta: { action_state_id: options.actionStateId },
      }),
      [`GET action_states/${options.actionStateId}`]: () =>
        runningActionState(options.actionStateId, label),
    },
  });
}

async function expectTrackedTask(page: Page, actionStateId: number, label: string) {
  await expect(page.getByTestId('modal.action_progress')).toBeVisible();
  await page.getByTestId('modal.action_progress.open_tasks').click();
  await expect(page.getByTestId('tasks.drawer')).toHaveAttribute('aria-modal', 'false');
  await expect(page.getByTestId(`tasks.row.${actionStateId}`)).toContainText(label);
  await expect(page.getByTestId('vps.header')).toBeVisible();
}

test.describe('@workflow-matrix @pr-smoke @smoke VPS detail power actions', () => {
  test('starts a stopped VPS and tracks the returned action state', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installPowerMock(page, { action: 'start', actionStateId: 776, isRunning: false });

    await page.goto('/app/vps/123');

    const reqPromise = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/api/v7.0/vpses/123/start')
    );
    await page.getByTestId('vps.action.start').click();

    const request = await reqPromise;
    expect(request.postDataJSON()).toEqual({});
    await expectTrackedTask(page, 776, 'Start VPS');
  });

  test('stops a running VPS with force and tracks the returned action state', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installPowerMock(page, { action: 'stop', actionStateId: 777, isRunning: true });

    await page.goto('/app/vps/123');

    const actionsMenu = page.getByTestId('vps.actions.menu');
    await expect(actionsMenu).toBeVisible();
    await expect(actionsMenu.locator('option[value="action:stop"]')).toBeEnabled();
    await actionsMenu.selectOption('action:stop');

    await expect(page.getByTestId('vps.action.stop_confirm')).toBeVisible();
    await page.getByTestId('vps.action.stop_confirm.force').click();

    const reqPromise = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/api/v7.0/vpses/123/stop')
    );
    await page.getByTestId('vps.action.stop_confirm.confirm').click();

    const request = await reqPromise;
    expect(request.postDataJSON()).toEqual({ vps: { force: true } });
    await expect(page.getByTestId('vps.action.stop_confirm')).toBeHidden();
    await expectTrackedTask(page, 777, 'Stop VPS');
  });

  test('restarts a running VPS with force and tracks the returned action state', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installPowerMock(page, { action: 'restart', actionStateId: 778, isRunning: true });

    await page.goto('/app/vps/123');
    await page.getByTestId('vps.actions.menu').selectOption('action:restart');

    await expect(page.getByTestId('vps.action.restart_confirm')).toBeVisible();
    await page.getByTestId('vps.action.restart_confirm.force').click();

    const reqPromise = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/api/v7.0/vpses/123/restart')
    );
    await page.getByTestId('vps.action.restart_confirm.confirm').click();

    const request = await reqPromise;
    expect(request.postDataJSON()).toEqual({ vps: { force: true } });
    await expectTrackedTask(page, 778, 'Restart VPS');
  });
});

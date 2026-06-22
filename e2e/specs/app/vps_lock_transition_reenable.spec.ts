import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const baseVps = {
  id: 123,
  hostname: 'vps-lock.example',
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

test('@smoke VPS busy lock disables actions; completion releases lock and re-enables start', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  let vpsRunning = true;
  let chainPhase: 'none' | 'active' | 'done' = 'none';
  let shouldFinish = false;

  await installHaveApiMock(page, {
    user: { id: 42, login: 'user', level: 1 },
    handlers: {
      'GET vpses/123': () => ({ vps: { ...baseVps, is_running: vpsRunning } }),
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
      // Overview tab fetches metrics even in advanced mode; keep it quiet.
      'GET vpses/123/statuses': () => ({ statuses: [] }),

      // Busy lock source for VPS gating: transaction chains filtered by class/row.
      'GET transaction_chains': (ctx) => {
        const cls = ctx.searchParams.get('transaction_chain[class_name]') ?? '';
        const rowId = Number(ctx.searchParams.get('transaction_chain[row_id]') ?? Number.NaN);

        if (cls !== 'Vps' || rowId !== 123) return { transaction_chains: [] };

        if (chainPhase === 'none') return { transaction_chains: [] };
        if (chainPhase === 'active') {
          return {
            transaction_chains: [
              {
                id: 1000,
                state: 'queued',
                progress: 0,
                size: 1,
                name: 'stop',
                created_at: '2026-02-04T00:00:00Z',
              },
            ],
          };
        }

        // done
        return {
          transaction_chains: [
            {
              id: 1000,
              state: 'done',
              progress: 1,
              size: 1,
              name: 'stop',
              created_at: '2026-02-04T00:00:00Z',
              finished_at: '2026-02-04T00:00:05Z',
            },
          ],
        };
      },

      // Stop action: immediately creates a busy chain and returns an action_state_id.
      'POST vpses/123/stop': () => {
        chainPhase = 'active';
        return { _meta: { action_state_id: 900 }, vps: null };
      },

      // Action state: remains running until the test flips `shouldFinish`.
      'GET action_states/900': () => {
        if (!shouldFinish) {
          return {
            action_state: {
              id: 900,
              label: 'Stop',
              status: true,
              finished: false,
              current: 0,
              total: 1,
              created_at: '2026-02-04T00:00:00Z',
              updated_at: '2026-02-04T00:00:01Z',
            },
          };
        }

        // Completion: backend state converges.
        vpsRunning = false;
        chainPhase = 'done';
        return {
          action_state: {
            id: 900,
            label: 'Stop',
            status: true,
            finished: true,
            current: 1,
            total: 1,
            created_at: '2026-02-04T00:00:00Z',
            updated_at: '2026-02-04T00:00:05Z',
          },
        };
      },

      // We click start after stop completion to prove the busy lock was released.
      'POST vpses/123/start': () => ({ _meta: { action_state_id: 901 }, vps: null }),
      'GET action_states/901': () => ({
        action_state: {
          id: 901,
          label: 'Start',
          status: true,
          finished: true,
          current: 1,
          total: 1,
          created_at: '2026-02-04T00:00:06Z',
          updated_at: '2026-02-04T00:00:06Z',
        },
      }),
    },
  });

  await page.goto('/app/vps/123');
  await expect(page.getByTestId('vps.header')).toBeVisible();

  const actionsMenu = page.getByTestId('vps.actions.menu');
  const stopOption = page.locator('[data-testid="vps.actions.menu"] option[value="action:stop"]');
  const restartOption = page.locator('[data-testid="vps.actions.menu"] option[value="action:restart"]');

  // Initial: running and not busy -> stop/restart available from the More menu.
  await expect(actionsMenu).toBeVisible();
  await expect(stopOption).toBeEnabled();
  await expect(restartOption).toBeEnabled();

  // Trigger stop.
  await actionsMenu.selectOption('action:stop');
  await expect(page.getByTestId('vps.action.stop_confirm')).toBeVisible();
  await page.getByTestId('vps.action.stop_confirm.confirm').click();

  // Busy lock should show up quickly (chainPhase becomes active and chains are refetched).
  await expect(page.getByTestId('modal.action_progress')).toBeVisible();
  await expect(restartOption).toBeDisabled();

  // Allow the mocked action to finish; progress modal closes when action_state finishes.
  shouldFinish = true;

  // Wait for completion: progress modal closes when action_state finishes.
  await expect(page.getByTestId('modal.action_progress')).toBeHidden();

  // After completion the VPS becomes stopped; start becomes the primary action and stop stays unavailable.
  const startBtn = page.getByTestId('vps.action.start');
  await expect(startBtn).toHaveAttribute('aria-disabled', 'false');
  await expect(stopOption).toBeDisabled();

  // Prove the busy lock was released by starting the VPS (preflight would block if still busy).
  const startReq = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes('/api/v7.0/vpses/123/start'));
  await startBtn.click();
  await startReq;
});

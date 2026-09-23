import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../../fixtures/playwright';
import { bootstrapVpsAdminWindow } from '../../fixtures/bootstrap';
import { installHaveApiMock } from '../../fixtures/haveapi';

function makeVps() {
  return {
    id: 300,
    hostname: 'retry-vps.example',
    object_state: 'active',
    is_running: true,
    uptime: 12345,
    cpu: 4,
    memory: 4096,
    diskspace: 200_000,
    node: { id: 1, domain_name: 'node1', location: { id: 1, label: 'Praha' } },
    user: { id: 42, login: 'owner' },
  };
}

function rejected(message: string) {
  return {
    status: 409,
    contentType: 'application/json',
    body: JSON.stringify({ status: false, message }),
  };
}

async function actionPrefix(page: Page): Promise<string> {
  const viewport = page.viewportSize();
  const item: Locator = !viewport || viewport.width >= 768
    ? page.getByTestId('vps.row.300')
    : page.getByTestId('vps.card.300');
  await expect(item).toBeVisible();
  return !viewport || viewport.width >= 768 ? 'vps.row.300' : 'vps.card.300';
}

test('@pr-smoke @pr-smoke-mobile rejected VPS stop stays in its confirmation and allows retry', async ({ page }) => {
  const vps = makeVps();
  let stopCalls = 0;

  await installHaveApiMock(page, {
    user: { id: 42, login: 'owner', level: 1 },
    handlers: {
      'GET vpses': () => ({ vpses: [vps] }),
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'POST vpses/300/stop': () => {
        stopCalls += 1;
        return stopCalls === 1
          ? rejected('The VPS could not be stopped')
          : { _meta: { action_state_id: 901 } };
      },
    },
  });
  await bootstrapVpsAdminWindow(page);
  await page.goto('/app/vps');

  const prefix = await actionPrefix(page);
  await page.getByTestId(`${prefix}.action.stop`).click();
  const dialog = page.getByTestId('vps.list.power_confirm');
  await dialog.getByTestId('vps.list.power_confirm.confirm').click();

  await expect(dialog.getByTestId('vps.list.power_confirm.error')).toContainText('The VPS could not be stopped');
  await expect(dialog.getByTestId('vps.list.power_confirm.target')).toContainText('retry-vps.example');
  await expect(dialog).toBeVisible();

  await dialog.getByTestId('vps.list.power_confirm.confirm').click();

  await expect(dialog).toBeHidden();
  expect(stopCalls).toBe(2);
});

test('@pr-smoke @pr-smoke-mobile rejected VPS deletion stays in its confirmation and allows retry', async ({ page }) => {
  const vps = makeVps();
  let deleteCalls = 0;

  await installHaveApiMock(page, {
    user: { id: 42, login: 'owner', level: 1 },
    handlers: {
      'GET vpses': () => ({ vpses: [vps] }),
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'DELETE vpses/300': () => {
        deleteCalls += 1;
        return deleteCalls === 1
          ? rejected('The VPS could not be deleted')
          : { _meta: { action_state_id: 902 } };
      },
    },
  });
  await bootstrapVpsAdminWindow(page);
  await page.goto('/app/vps');

  const prefix = await actionPrefix(page);
  await page.getByTestId(`${prefix}.action.delete`).click();
  const dialog = page.getByTestId('vps.list.delete_confirm');
  await dialog.getByTestId('vps.list.delete_confirm.confirm').click();

  await expect(dialog.getByTestId('vps.list.delete_confirm.error')).toContainText('The VPS could not be deleted');
  await expect(dialog).toContainText('retry-vps.example');
  await expect(dialog).toBeVisible();

  await dialog.getByTestId('vps.list.delete_confirm.confirm').click();

  await expect(dialog).toBeHidden();
  expect(deleteCalls).toBe(2);
});

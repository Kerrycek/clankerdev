import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock } from '../../fixtures';

const monitoredEvent = {
  id: 201,
  label: 'Production probe',
  monitor: 'production-probe',
  state: 'confirmed',
  created_at: '2026-08-30T18:00:00.000Z',
  updated_at: '2026-08-30T18:01:00.000Z',
};

test('@pr-smoke @pr-smoke-mobile rejected monitoring decisions stay in their dialog for retry', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'MONITORING_ACTION_RETRY' });

  let acknowledgeAttempts = 0;
  let ignoreAttempts = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'user', level: 1 },
    handlers: {
      'GET monitored_events/201': () => ({ monitored_event: monitoredEvent }),
      'GET monitored_events/201/logs': () => ({ logs: [] }),
      'POST monitored_events/201/acknowledge': () => {
        acknowledgeAttempts += 1;
        if (acknowledgeAttempts === 1) return failEnvelope('Acknowledgement was rejected');
        return {};
      },
      'POST monitored_events/201/ignore': () => {
        ignoreAttempts += 1;
        if (ignoreAttempts === 1) return failEnvelope('Ignore request was rejected');
        return {};
      },
    },
  });

  await page.goto('/app/monitoring/201');

  await page.getByTestId('monitoring.event.ack.open').click();
  const acknowledgeDialog = page.getByTestId('monitoring.event.ack');
  await acknowledgeDialog.getByRole('button', { name: /acknowledge|potvrdit/i }).click();
  await expect(acknowledgeDialog.getByTestId('monitoring.event.ack.error')).toContainText('Acknowledgement was rejected');
  await expect(acknowledgeDialog).toBeVisible();
  await acknowledgeDialog.getByRole('button', { name: /acknowledge|potvrdit/i }).click();
  await expect(acknowledgeDialog).toHaveCount(0);

  await page.getByTestId('monitoring.event.ignore.open').click();
  const ignoreDialog = page.getByTestId('monitoring.event.ignore');
  await ignoreDialog.getByRole('button', { name: /ignore|ignorovat/i }).click();
  await expect(ignoreDialog.getByTestId('monitoring.event.ignore.error')).toContainText('Ignore request was rejected');
  await expect(ignoreDialog).toBeVisible();
  await ignoreDialog.getByRole('button', { name: /ignore|ignorovat/i }).click();
  await expect(ignoreDialog).toHaveCount(0);

  expect(acknowledgeAttempts).toBe(2);
  expect(ignoreAttempts).toBe(2);
});

import { test, expect } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, type HaveApiRequestCtx } from '../../fixtures';

function metricsTokenPayload(ctx: HaveApiRequestCtx): Record<string, unknown> {
  const body = ctx.reqJson;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};

  const payload = (body as Record<string, unknown>).metrics_access_token;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};

  return payload as Record<string, unknown>;
}

test('@smoke profile: metrics token review and revoke guards', async ({ page }) => {
  const user = { id: 1, login: 'e2e', level: 1 };
  let tokens = [
    {
      id: 3,
      metric_prefix: 'active_',
      access_token: 'active-token-secret',
      use_count: 5,
      last_use: '2026-07-05T12:00:00Z',
      created_at: '2026-07-01T12:00:00Z',
    },
    {
      id: 2,
      metric_prefix: 'stale_',
      access_token: 'stale-token-secret',
      use_count: 2,
      last_use: '2026-02-01T12:00:00Z',
      created_at: '2026-01-01T12:00:00Z',
    },
    {
      id: 1,
      metric_prefix: 'unused_',
      use_count: 0,
      created_at: '2026-07-02T12:00:00Z',
    },
  ];

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user,
    handlers: {
      'GET metrics_access_tokens': () => ({ metrics_access_tokens: tokens }),
      'POST metrics_access_tokens': (ctx) => {
        const payload = metricsTokenPayload(ctx);
        const created = {
          id: 4,
          metric_prefix: String(payload.metric_prefix ?? ''),
          access_token: 'new-token-secret',
          use_count: 0,
          created_at: '2026-07-06T12:00:00Z',
        };
        tokens = [created, ...tokens];
        return { metrics_access_token: created };
      },
      'DELETE metrics_access_tokens/2': () => {
        tokens = tokens.filter((token) => token.id !== 2);
        return { ok: true };
      },
    },
  });

  await page.goto('/app/profile/metrics');

  await expect(page.getByTestId('profile.metrics.security_notice')).toBeVisible();
  await expect(page.getByTestId('profile.metrics.summary')).toContainText('Total tokens');
  await expect(page.getByTestId('profile.metrics.row.3.state')).toHaveText('Active');
  await expect(page.getByTestId('profile.metrics.row.2.state')).toHaveText('Stale');
  await expect(page.getByTestId('profile.metrics.row.1.state')).toHaveText('Unused');
  await expect(page.getByTestId('profile.metrics.row.1.token.unavailable')).toBeVisible();

  await page.getByTestId('profile.metrics.create').click();
  await expect(page.getByTestId('profile.metrics.create_modal')).toBeVisible();
  await page.getByTestId('profile.metrics.create_modal.prefix').fill(' bad prefix ');
  await expect(page.getByTestId('profile.metrics.create_modal.review')).toContainText('bad prefix');
  await expect(
    page.getByTestId('profile.metrics.create_modal.review.warning.profile.metrics.review.warning.characters')
  ).toBeVisible();

  const createReqP = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes('/metrics_access_tokens'));
  await page.getByTestId('profile.metrics.create_modal.create').click();
  const createBody = (await createReqP).postDataJSON() as { metrics_access_token: Record<string, unknown> };
  expect(createBody.metrics_access_token.metric_prefix).toBe('bad prefix');

  await expect(page.getByTestId('profile.metrics.created_modal')).toBeVisible();
  await page.getByTestId('profile.metrics.created_modal.done').click();

  await page.getByTestId('profile.metrics.row.2.delete').click();
  await expect(page.getByTestId('profile.metrics.delete_dialog')).toBeVisible();
  await expect(page.getByTestId('profile.metrics.delete_dialog.review')).toContainText('stale_');
  await expect(page.getByTestId('profile.metrics.delete_dialog.confirm')).toBeDisabled();
  await page.getByTestId('profile.metrics.delete_dialog.input').fill('REVOKE');

  const deleteReqP = page.waitForRequest((r) => r.method() === 'DELETE' && r.url().includes('/metrics_access_tokens/2'));
  await page.getByTestId('profile.metrics.delete_dialog.confirm').click();
  await deleteReqP;
});

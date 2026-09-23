import { test, expect, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, type HaveApiRequestCtx } from '../../fixtures';

const longMetricPrefix = `stale_${'metrics'.repeat(24)}`;

function metricsTokenPayload(ctx: HaveApiRequestCtx): Record<string, unknown> {
  const body = ctx.reqJson;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};

  const payload = (body as Record<string, unknown>).metrics_access_token;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};

  return payload as Record<string, unknown>;
}

function metricsTokens() {
  return [
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
      metric_prefix: longMetricPrefix,
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
}

async function expectMobileCardContained(page: Page, testId: string) {
  const card = page.getByTestId(testId);
  const geometry = await card.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      cardFitsViewport: rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1,
      cardHasNoOverflow: element.scrollWidth <= element.clientWidth + 1,
      pageHasNoOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    };
  });

  expect(geometry).toEqual({
    cardFitsViewport: true,
    cardHasNoOverflow: true,
    pageHasNoOverflow: true,
  });
}

async function expectFullWidthTouchTarget(page: Page, cardTestId: string, buttonTestId: string) {
  const card = page.getByTestId(cardTestId);
  const button = page.getByTestId(buttonTestId);
  const buttonBox = await button.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(buttonBox!.height).toBeGreaterThanOrEqual(44);

  const widths = await card.evaluate((element, targetTestId) => {
    const target = element.querySelector<HTMLElement>(`[data-testid="${targetTestId}"]`);
    const style = getComputedStyle(element);
    return {
      content: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
      button: target?.getBoundingClientRect().width ?? 0,
    };
  }, buttonTestId);
  expect(Math.abs(widths.button - widths.content)).toBeLessThanOrEqual(1);
}

test('@pr-smoke @smoke profile: metrics token review and revoke guards', async ({ page }) => {
  const user = { id: 1, login: 'e2e', level: 1 };
  let tokens = metricsTokens();

  await page.setViewportSize({ width: 1280, height: 900 });
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

  await expect(page.getByTestId('profile.metrics.table')).toBeVisible();
  await expect(page.getByTestId('profile.metrics.cards')).toBeHidden();
  await expect(page.getByTestId('profile.metrics.row.2')).toBeVisible();
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
  await expect(page.getByTestId('profile.metrics.delete_dialog.confirm')).toBeEnabled();

  const deleteReqP = page.waitForRequest(
    (r) => r.method() === 'DELETE' && new URL(r.url()).pathname === '/api/v7.0/metrics_access_tokens/2'
  );
  await page.getByTestId('profile.metrics.delete_dialog.confirm').click();
  await deleteReqP;
});

test('@pr-smoke-mobile @smoke-mobile profile: metrics token cards keep secrets and revoke reachable at 320px', async ({ page }) => {
  let tokens = metricsTokens();

  await page.setViewportSize({ width: 320, height: 740 });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'e2e', level: 1 },
    handlers: {
      'GET metrics_access_tokens': () => ({ metrics_access_tokens: tokens }),
      'DELETE metrics_access_tokens/2': () => {
        tokens = tokens.filter((token) => token.id !== 2);
        return { ok: true };
      },
    },
  });

  await page.goto('/app/profile/metrics');

  await expect(page.getByTestId('profile.metrics.table')).toBeHidden();
  await expect(page.getByTestId('profile.metrics.cards')).toBeVisible();
  await expect(page.getByTestId('profile.metrics.row.2')).toBeHidden();

  const cardId = 'profile.metrics.card.2';
  const card = page.getByTestId(cardId);
  await expect(card).toBeVisible();
  await expect(page.getByTestId(`${cardId}.id`)).toHaveText('#2');
  await expect(page.getByTestId(`${cardId}.prefix`)).toHaveText(longMetricPrefix);
  await expect(page.getByTestId(`${cardId}.state`)).toHaveText('Stale');
  await expect(page.getByTestId(`${cardId}.use_count`)).toContainText('2');
  await expect(page.getByTestId(`${cardId}.last_use`)).toContainText('2026');
  await expect(page.getByTestId(`${cardId}.created`)).toContainText('2026');
  await expect(page.getByTestId(`${cardId}.token.field`)).toHaveValue('stal…cret');
  await expect(page.getByTestId(`${cardId}.token.toggle`)).toBeVisible();
  await expect(page.getByTestId('profile.metrics.card.1.token.unavailable')).toBeVisible();
  await expect(page.getByTestId('profile.metrics.card.1.token.toggle')).toHaveCount(0);
  await expect(page.getByTestId('profile.metrics.card.1.token.copy')).toHaveCount(0);

  await page.getByTestId(`${cardId}.token.toggle`).click();
  await expect(page.getByTestId(`${cardId}.token.field`)).toHaveValue('stale-token-secret');
  await page.getByTestId(`${cardId}.token.toggle`).click();
  await expect(page.getByTestId(`${cardId}.token.field`)).toHaveValue('stal…cret');

  await expectMobileCardContained(page, cardId);
  await expectFullWidthTouchTarget(page, cardId, `${cardId}.delete`);

  await page.getByTestId(`${cardId}.delete`).click();
  await expect(page.getByTestId('profile.metrics.delete_dialog')).toBeVisible();
  await expect(page.getByTestId('profile.metrics.delete_dialog.review')).toContainText('stale_');

  const deleteReqP = page.waitForRequest(
    (r) => r.method() === 'DELETE' && new URL(r.url()).pathname === '/api/v7.0/metrics_access_tokens/2'
  );
  await page.getByTestId('profile.metrics.delete_dialog.confirm').click();
  await deleteReqP;
  await expect(page.getByTestId(cardId)).toHaveCount(0);
});

test('@pr-smoke-mobile @smoke-mobile admin: user metrics token cards preserve owner scope and revoke at 320px', async ({ page }) => {
  let tokens = metricsTokens();
  const listScopes: Array<string | null> = [];

  await page.setViewportSize({ width: 320, height: 740 });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_ADMIN' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/42': () => ({ user: { id: 42, login: 'alice', level: 1 } }),
      'GET metrics_access_tokens': ({ searchParams }) => {
        listScopes.push(searchParams.get('metrics_access_token[user]'));
        return { metrics_access_tokens: tokens };
      },
      'DELETE metrics_access_tokens/2': () => {
        tokens = tokens.filter((token) => token.id !== 2);
        return { ok: true };
      },
    },
  });

  await page.goto('/admin/users/42/metrics');

  await expect(page.getByTestId('admin.user.metrics.table')).toBeHidden();
  await expect(page.getByTestId('admin.user.metrics.cards')).toBeVisible();
  await expect.poll(() => listScopes).toContain('42');

  const cardId = 'admin.user.metrics.card.2';
  await expect(page.getByTestId(cardId)).toBeVisible();
  await expect(page.getByTestId(`${cardId}.token.field`)).toHaveValue('stal…cret');
  await expectMobileCardContained(page, cardId);
  await expectFullWidthTouchTarget(page, cardId, `${cardId}.delete`);

  await page.getByTestId(`${cardId}.delete`).click();
  await expect(page.getByTestId('admin.user.metrics.delete_dialog')).toBeVisible();
  await expect(page.getByTestId('admin.user.metrics.delete_dialog.review')).toContainText('stale_');

  const deleteReqP = page.waitForRequest(
    (r) => r.method() === 'DELETE' && new URL(r.url()).pathname === '/api/v7.0/metrics_access_tokens/2'
  );
  await page.getByTestId('admin.user.metrics.delete_dialog.confirm').click();
  const deleteRequest = await deleteReqP;
  expect(new URL(deleteRequest.url()).search).toBe('');
  await expect(page.getByTestId(cardId)).toHaveCount(0);
});

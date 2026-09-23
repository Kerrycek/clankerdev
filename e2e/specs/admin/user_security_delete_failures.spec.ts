import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

function rejected(message: string) {
  return {
    status: 409,
    contentType: 'application/json',
    body: JSON.stringify({ status: false, message, response: null }),
  };
}

test('@pr-smoke @pr-smoke-mobile admin user security removals keep failures in context and allow retry', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  if (mobile) await page.setViewportSize({ width: 320, height: 900 });

  let keyDeleteCalls = 0;
  let tokenDeleteCalls = 0;
  let sessionCloseCalls = 0;

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 99, login: 'admin', level: 90 },
    handlers: {
      'GET users/1': () => ({ user: { id: 1, login: 'member', level: 1 } }),
      'GET users/1/public_keys': () => ({
        public_keys: [{
          id: 2,
          label: 'Member laptop',
          fingerprint: 'SHA256:member-key',
          auto_add: true,
          created_at: '2026-09-20T12:00:00Z',
        }],
      }),
      'DELETE users/1/public_keys/2': () => {
        keyDeleteCalls += 1;
        return keyDeleteCalls === 1 ? rejected('SSH key is still attached') : {};
      },
      'GET metrics_access_tokens': () => ({
        metrics_access_tokens: [{
          id: 3,
          metric_prefix: 'member_',
          use_count: 2,
          last_use: '2026-09-20T12:00:00Z',
          created_at: '2026-09-19T12:00:00Z',
        }],
      }),
      'DELETE metrics_access_tokens/3': () => {
        tokenDeleteCalls += 1;
        return tokenDeleteCalls === 1 ? rejected('Metrics token revoke was denied') : {};
      },
      'GET user_sessions': () => ({
        user_sessions: [{
          id: 4,
          label: 'Member browser',
          auth_type: 'oauth2',
          created_at: '2026-09-20T12:00:00Z',
          last_request_at: '2026-09-21T12:00:00Z',
          closed_at: null,
          api_ip_addr: '192.0.2.44',
          client_ip_addr: '192.0.2.44',
          user_agent: 'Browser',
          request_count: 4,
          current: false,
        }],
      }),
      'POST user_sessions/4': () => {
        sessionCloseCalls += 1;
        return sessionCloseCalls === 1 ? rejected('Session close was denied') : {};
      },
    },
  });

  await page.goto('/admin/users/1/keys');
  await page.locator('[data-testid="admin.user.keys.row.2.delete"]:visible').click();
  const keyDialog = page.getByTestId('admin.user.keys.delete_dialog');
  await keyDialog.getByTestId('admin.user.keys.delete_dialog.confirm').click();
  await expect(keyDialog.getByTestId('admin.user.keys.delete_dialog.error')).toContainText('SSH key is still attached');
  await expect(keyDialog).toBeVisible();
  await keyDialog.getByTestId('admin.user.keys.delete_dialog.confirm').click();
  await expect(keyDialog).toBeHidden();
  expect(keyDeleteCalls).toBe(2);

  await page.goto('/admin/users/1/metrics');
  const metricsDeleteAction = mobile
    ? page.getByTestId('admin.user.metrics.card.3.delete')
    : page.getByTestId('admin.user.metrics.row.3.delete');
  await metricsDeleteAction.click();
  const tokenDialog = page.getByTestId('admin.user.metrics.delete_dialog');
  await tokenDialog.getByTestId('admin.user.metrics.delete_dialog.confirm').click();
  await expect(tokenDialog.getByTestId('admin.user.metrics.delete_dialog.error')).toContainText('Metrics token revoke was denied');
  await expect(tokenDialog).toBeVisible();
  await tokenDialog.getByTestId('admin.user.metrics.delete_dialog.confirm').click();
  await expect(tokenDialog).toBeHidden();
  expect(tokenDeleteCalls).toBe(2);

  await page.goto('/admin/users/1/sessions');
  await page.locator('[data-testid="admin.user.sessions.row.4.close"]:visible').click();
  const sessionDialog = page.getByTestId('admin.user.sessions.close_dialog');
  await sessionDialog.getByTestId('admin.user.sessions.close_dialog.confirm').click();
  await expect(sessionDialog.getByTestId('admin.user.sessions.close_dialog.error')).toContainText('Session close was denied');
  await expect(sessionDialog).toBeVisible();
  await sessionDialog.getByTestId('admin.user.sessions.close_dialog.confirm').click();
  await expect(sessionDialog).toBeHidden();
  expect(sessionCloseCalls).toBe(2);
});

import { test, expect } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, type HaveApiRequestCtx } from '../../fixtures';

function userPayload(ctx: HaveApiRequestCtx): Record<string, unknown> {
  const body = ctx.reqJson;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};

  const payload = (body as Record<string, unknown>).user;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};

  return payload as Record<string, unknown>;
}

test('@smoke profile: security review guards password and auth setting changes', async ({ page }) => {
  const user = {
    id: 1,
    login: 'e2e',
    level: 1,
    enable_basic_auth: true,
    enable_token_auth: true,
    enable_oauth2_auth: false,
    enable_single_sign_on: true,
    enable_new_login_notification: true,
    preferred_session_length: 20 * 60,
    preferred_logout_all: false,
  };

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    user,
    handlers: {
      'GET users/current': () => ({ user }),
      'PUT users/1': (ctx) => {
        const payload = userPayload(ctx);
        Object.assign(user, payload);
        return { user };
      },
    },
  });

  await page.goto('/app/profile/security');

  await expect(page.getByTestId('profile.security.password.review')).toHaveCount(0);
  await expect(page.getByTestId('profile.security.password.save')).toBeDisabled();

  await page.getByTestId('profile.security.password.current').fill('old-secret');
  await page.getByTestId('profile.security.password.new').fill('new-secret');
  await page.getByTestId('profile.security.password.new2').fill('new-secret');
  await expect(page.getByTestId('profile.security.password.save')).toBeEnabled();

  const passwordReqP = page.waitForRequest((r) => r.method() === 'PUT' && r.url().includes('/users/1'));
  await page.getByTestId('profile.security.password.save').click();
  const passwordBody = passwordReqP.then((req) => req.postDataJSON() as { user: Record<string, unknown> });
  await expect.poll(async () => (await passwordBody).user.new_password).toBe('new-secret');
  expect((await passwordBody).user.password).toBe('old-secret');
  expect((await passwordBody).user.logout_sessions).toBe(true);

  await page.getByTestId('profile.security.settings.basic').click();
  await page.getByTestId('profile.security.settings.sso').click();
  await page.getByTestId('profile.security.settings.new_login').click();
  await page.getByTestId('profile.security.settings.logout_all').click();
  await page.getByTestId('profile.security.settings.session_length.input').fill('60');

  await expect(page.getByTestId('profile.security.settings.review.warning.security.settings.review.warning.no_interactive_login')).toBeVisible();
  await expect(page.getByTestId('profile.security.settings.review.change.basic')).toBeVisible();
  await expect(page.getByTestId('profile.security.settings.review.change.sessMin')).toContainText('60 minutes');

  const settingsReqP = page.waitForRequest((r) => r.method() === 'PUT' && r.url().includes('/users/1'));
  await page.getByTestId('profile.security.settings.save').click();
  const settingsBody = (await settingsReqP).postDataJSON() as { user: Record<string, unknown> };

  expect(settingsBody.user).toMatchObject({
    enable_basic_auth: false,
    enable_single_sign_on: false,
    enable_new_login_notification: false,
    preferred_logout_all: true,
    preferred_session_length: 3600,
  });
});

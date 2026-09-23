import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, type HaveApiRequestCtx } from '../../fixtures';

function userPayload(ctx: HaveApiRequestCtx): Record<string, unknown> {
  const body = ctx.reqJson;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};

  const payload = (body as Record<string, unknown>).user;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};

  return payload as Record<string, unknown>;
}

test('@pr-smoke @pr-smoke-mobile profile security settings keep failures in context and allow retry', async ({
  page,
}) => {
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
  let settingsAttempts = 0;
  let oauthAttempts = 0;

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user,
    handlers: {
      'GET users/current': () => ({ user }),
      'PUT users/1': (ctx) => {
        const payload = userPayload(ctx);

        if (payload.enable_oauth2_auth === true) {
          oauthAttempts += 1;
          if (oauthAttempts === 1) {
            return {
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({ status: false, message: 'OAuth enable was rejected', response: null }),
            };
          }
        } else {
          settingsAttempts += 1;
          if (settingsAttempts === 1) {
            return {
              status: 409,
              contentType: 'application/json',
              body: JSON.stringify({ status: false, message: 'Security settings changed on the server', response: null }),
            };
          }
        }

        Object.assign(user, payload);
        return { user };
      },
    },
  });

  await page.goto('/app/profile/security');

  const basicAuth = page.getByTestId('profile.security.settings.basic');
  const save = page.getByTestId('profile.security.settings.save');

  await basicAuth.click();
  await save.click();

  const saveError = page.getByTestId('profile.security.settings.save_error');
  await expect(saveError).toContainText('Security settings changed on the server');
  await expect(basicAuth).not.toBeChecked();
  await expect(save).toBeEnabled();

  await save.click();

  await expect(saveError).toHaveCount(0);
  await expect(basicAuth).not.toBeChecked();
  await expect(save).toBeDisabled();
  expect(settingsAttempts).toBe(2);

  const oauthEnable = page.getByTestId('profile.security.settings.oauth2.enable');
  await oauthEnable.click();

  const oauthError = page.getByTestId('profile.security.settings.oauth2.error');
  await expect(oauthError).toContainText('OAuth enable was rejected');
  await expect(oauthEnable).toBeEnabled();

  await oauthEnable.click();

  await expect(oauthError).toHaveCount(0);
  await expect(oauthEnable).toHaveCount(0);
  expect(oauthAttempts).toBe(2);
});

import { test, expect } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, setUiSettingsLocalStorage } from '../../fixtures';

test('@smoke profile: WebAuthn credentials edit and delete flows', async ({ page }) => {
  const user = {
    id: 1,
    login: 'e2e',
    level: 1,
    enable_multi_factor_auth: true,
  };

  let webauthnCredentials = [
    {
      id: 20,
      label: 'Security key',
      enabled: true,
      use_count: 1,
      created_at: '2026-02-02T12:00:00Z',
      last_use_at: '2026-02-03T12:00:00Z',
    },
  ];

  await setUiSettingsLocalStorage(page, { language: 'en' });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    handlers: {
      'GET users/current': () => ({ user }),
      'GET users/1/totp_devices': () => ({ totp_devices: [] }),
      'GET users/1/webauthn_credentials': () => ({ webauthn_credentials: webauthnCredentials }),
      'GET users/1/known_devices': () => ({ known_devices: [] }),
      'PUT users/1/webauthn_credentials/20': ({ reqJson }) => {
        const body = reqJson as { webauthn_credential?: { label?: string; enabled?: boolean } };
        const update = body.webauthn_credential ?? {};
        webauthnCredentials = webauthnCredentials.map((credential) =>
          credential.id === 20 ? { ...credential, ...update } : credential,
        );
        return { webauthn_credential: webauthnCredentials.find((credential) => credential.id === 20) };
      },
      'DELETE users/1/webauthn_credentials/20': () => {
        webauthnCredentials = [];
        return { ok: true };
      },
    },
  });

  await page.goto('/app/profile/mfa');

  const table = page.getByTestId('profile.mfa.webauthn.table');
  await expect(table.getByTestId('profile.mfa.webauthn.row.20')).toBeVisible();

  await table.getByTestId('profile.mfa.webauthn.row.20.edit').click();
  await expect(page.getByTestId('profile.mfa.webauthn.edit')).toBeVisible();
  await page.getByTestId('profile.mfa.webauthn.edit.label').fill('Security key renamed');

  const updateReqP = page.waitForRequest((request) =>
    request.method() === 'PUT' && request.url().includes('/users/1/webauthn_credentials/20'),
  );
  await page.getByTestId('profile.mfa.webauthn.edit.save').click();
  const updateReq = await updateReqP;
  const updateBody = updateReq.postDataJSON();
  expect(updateBody.webauthn_credential.label).toBe('Security key renamed');
  expect(updateBody.webauthn_credential.enabled).toBe(true);

  await expect(table.getByTestId('profile.mfa.webauthn.row.20')).toContainText('Security key renamed');

  await table.getByTestId('profile.mfa.webauthn.row.20.delete').click();
  await expect(page.getByTestId('profile.mfa.webauthn.delete.confirm')).toBeVisible();

  const deleteReqP = page.waitForRequest((request) =>
    request.method() === 'DELETE' && request.url().includes('/users/1/webauthn_credentials/20'),
  );
  await page.getByTestId('profile.mfa.webauthn.delete.confirm.confirm').click();
  await deleteReqP;

  await expect(page.getByTestId('profile.mfa.webauthn.empty')).toBeVisible();
});

test('@pr-smoke @pr-smoke-mobile profile: security dialogs do not retain errors from a previous target', async ({
  page,
}) => {
  const user = {
    id: 1,
    login: 'e2e',
    level: 1,
    enable_multi_factor_auth: true,
  };
  const webauthnCredential = {
    id: 20,
    label: 'Security key',
    enabled: true,
    use_count: 1,
  };
  const knownDevice = {
    id: 30,
    api_ip_addr: '203.0.113.10',
    client_ip_addr: '203.0.113.10',
    user_agent: 'Mozilla/5.0 Chrome/120.0.0.0',
  };

  await setUiSettingsLocalStorage(page, { language: 'en' });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    handlers: {
      'GET users/current': () => ({ user }),
      'GET users/1/totp_devices': () => ({ totp_devices: [] }),
      'GET users/1/webauthn_credentials': () => ({ webauthn_credentials: [webauthnCredential] }),
      'GET users/1/known_devices': () => ({ known_devices: [knownDevice] }),
      'PUT users/1/webauthn_credentials/20': () => ({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ status: false, message: 'Credential update rejected' }),
      }),
      'DELETE users/1/known_devices/30': () => ({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ status: false, message: 'Device removal rejected' }),
      }),
    },
  });

  await page.goto('/app/profile/mfa');

  const editCredential = page.locator('[data-testid="profile.mfa.webauthn.row.20.edit"]:visible');
  await editCredential.click();
  await page.getByTestId('profile.mfa.webauthn.edit.save').click();
  await expect(page.getByTestId('profile.mfa.webauthn.edit.error')).toBeVisible();
  await page.getByTestId('profile.mfa.webauthn.edit.cancel').click();

  await editCredential.click();
  await expect(page.getByTestId('profile.mfa.webauthn.edit.error')).toHaveCount(0);
  await page.getByTestId('profile.mfa.webauthn.edit.cancel').click();

  const forgetDevice = page.locator('[data-testid="profile.mfa.known_devices.forget.30"]:visible');
  await forgetDevice.click();
  await page.getByTestId('profile.mfa.known_devices.forget.confirm.confirm').click();
  await expect(page.getByTestId('profile.mfa.known_devices.forget.error')).toBeVisible();
  await page.getByTestId('profile.mfa.known_devices.forget.confirm.cancel').click();

  await forgetDevice.click();
  await expect(page.getByTestId('profile.mfa.known_devices.forget.error')).toHaveCount(0);
});

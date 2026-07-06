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

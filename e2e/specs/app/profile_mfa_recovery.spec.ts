import { test, expect } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, setUiSettingsLocalStorage } from '../../fixtures';

test('@smoke profile: MFA recovery readiness summary', async ({ page }) => {
  const user = {
    id: 1,
    login: 'e2e',
    level: 1,
    enable_multi_factor_auth: true,
  };

  const totpDevices = [
    {
      id: 10,
      label: 'Phone',
      confirmed: true,
      enabled: true,
      use_count: 3,
      created_at: '2026-02-01T12:00:00Z',
      last_use_at: '2026-02-03T12:00:00Z',
    },
    {
      id: 11,
      label: 'Old phone',
      confirmed: true,
      enabled: false,
      use_count: 0,
      created_at: '2026-01-01T12:00:00Z',
    },
  ];

  const webauthnCredentials = [
    {
      id: 20,
      label: 'Security key',
      enabled: true,
      use_count: 1,
      created_at: '2026-02-02T12:00:00Z',
      last_use_at: '2026-02-03T12:00:00Z',
    },
  ];

  const knownDevices = [
    {
      id: 30,
      api_ip_addr: '203.0.113.10',
      client_ip_addr: '203.0.113.10',
      user_agent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0',
      skip_multi_factor_auth_until: '2099-01-01T00:00:00Z',
      last_seen_at: '2026-02-04T12:00:00Z',
    },
  ];

  await setUiSettingsLocalStorage(page, { language: 'en' });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    handlers: {
      'GET users/current': () => ({ user }),
      'GET users/1/totp_devices': () => ({ totp_devices: totpDevices }),
      'GET users/1/webauthn_credentials': () => ({ webauthn_credentials: webauthnCredentials }),
      'GET users/1/known_devices': () => ({ known_devices: knownDevices }),
    },
  });

  await page.goto('/app/profile/mfa');

  await expect(page.getByTestId('profile.mfa.recovery.ready')).toBeVisible();
  await expect(page.getByTestId('profile.mfa.recovery.status')).toHaveText('Ready');
  await expect(page.getByTestId('profile.mfa.recovery.ready')).toContainText('Recovery posture looks ready');
  await expect(page.getByTestId('profile.mfa.recovery.metrics')).toHaveCount(0);
  await expect(page.getByTestId('profile.mfa.recovery.checklist')).toHaveCount(0);
  await expect(page.getByTestId('profile.mfa.known_devices.summary')).toContainText('Trusted for MFA');
  await expect(page.getByTestId('profile.mfa.mfa_master.status')).toContainText('Active');
});

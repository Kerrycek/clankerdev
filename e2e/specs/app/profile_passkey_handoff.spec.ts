import { test, expect } from '@playwright/test';
import { bootstrapVpsAdminWindow, installHaveApiMock, setUiSettingsLocalStorage } from '../../fixtures';

// These are fixture UI routing tests, not WebAuthn/API integration evidence.
for (const language of ['cs', 'en'] as const) {
  test(`passkey handoff and safe return (${language})`, async ({ page }) => {
    await setUiSettingsLocalStorage(page, { language });
    await bootstrapVpsAdminWindow(page, { webuiNext: { passkeyRegistrationUrl: '/oauth/passkey' } });
    await page.addInitScript(() => { window.vpsAdmin!.accessToken = 'FIXTURE_OAUTH'; });
    await installHaveApiMock(page, { handlers: {
      'GET users/current': () => ({ user: { id: 1, login: 'fixture', level: 1 } }),
      'GET users/1/totp_devices': () => ({ totp_devices: [] }),
      'GET users/1/known_devices': () => ({ known_devices: [] }),
      'GET users/1/webauthn_credentials': () => ({ webauthn_credentials: [] }),
    } });
    const directRegistrations: string[] = [];
    page.on('request', (request) => {
      if (/webauthn\/registration\/(begin|finish)/.test(request.url())) directRegistrations.push(request.url());
    });
    await page.route('**/oauth/passkey?*', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Fixture handoff</h1>' }));
    await page.goto('/app/profile/mfa');
    await page.getByTestId('profile.mfa.webauthn.add').click();
    await expect(page).toHaveURL(new RegExp(`/oauth/passkey\\?lang=${language}$`));
    for (const status of ['1', '0', 'unexpected']) {
      await page.goto(`/app/profile/mfa?registerStatus=${status}&registerMessage=%3Cscript%3Eevil-provider-message%3C/script%3E`);
      const notice = page.getByTestId('profile.mfa.webauthn.return');
      await expect(notice).toContainText(status === '1'
        ? (language === 'cs' ? 'Registrace byla dokončena' : 'Registration finished')
        : (language === 'cs' ? 'Registrace byla zrušena' : 'Registration was cancelled'));
      await expect(page).toHaveURL(/\/app\/profile\/mfa$/);
      await expect(page.locator('body')).not.toContainText('evil-provider-message');
    }
    expect(directRegistrations).toEqual([]);
  });
}

test('token sessions cannot hand the underlying OAuth account to registration', async ({ page }) => {
  await setUiSettingsLocalStorage(page, { language: 'en' });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'IMPERSONATION_FIXTURE', webuiNext: { passkeyRegistrationUrl: '/oauth/passkey' } });
  await installHaveApiMock(page, { handlers: {
    'GET users/current': () => ({ user: { id: 1, login: 'fixture', level: 1 } }),
    'GET users/1/totp_devices': () => ({ totp_devices: [] }),
    'GET users/1/known_devices': () => ({ known_devices: [] }),
    'GET users/1/webauthn_credentials': () => ({ webauthn_credentials: [] }),
  } });
  await page.goto('/app/profile/mfa');
  await expect(page.getByTestId('profile.mfa.webauthn.card')).toBeVisible();
  await expect(page.getByTestId('profile.mfa.webauthn.add')).toHaveCount(0);
});

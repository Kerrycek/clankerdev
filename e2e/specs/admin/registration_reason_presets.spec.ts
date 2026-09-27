import { expect, test, type Page } from '@playwright/test';
import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock, setUiSettingsLocalStorage } from '../../fixtures';

const prefix = 'admin.requests.resolve';
async function setup(page: Page, language: 'cs' | 'en', options: { fail?: boolean; languageIdOnly?: boolean } = {}) {
  await bootstrapVpsAdminWindow(page);
  await setUiSettingsLocalStorage(page, { language: language === 'cs' ? 'en' : 'cs', theme: language === 'cs' ? 'light' : 'dark' });
  await page.route(/^https:\/\/nominatim\.openstreetmap\.org\//, route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  const request = {
    id: 123, type: 'registration', state: 'awaiting', login: 'example', full_name: 'Example Applicant',
    email: 'applicant@example.test', address: 'Example 1, Example City', year_of_birth: 1990,
    os_template: { id: 5 }, location: { id: 7 }, currency: 'EUR',
    language: options.languageIdOnly ? { id: 57 } : { id: 57, code: language },
  };
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations/123': () => ({ registration: request }),
      'GET languages': () => ({ languages: [{ id: 57, code: language }] }),
      'POST user_request/registrations/123/resolve': () => options.fail
        ? failEnvelope('Review failed')
        : { registration: { ...request, state: 'denied' } },
    },
  });
  await page.goto('/admin/requests/registration/123');
}

for (const language of ['cs', 'en'] as const) {
  for (const action of ['deny', 'request_correction'] as const) {
    test(`@pr-smoke @pr-smoke-mobile ${action} preset uses applicant ${language}, independent of UI language`, async ({ page }, testInfo) => {
      await setup(page, language, { languageIdOnly: language === 'cs' });
      await page.getByTestId(`${prefix}.action.${action}`).click();
      const picker = page.getByTestId(`${prefix}.reason_preset`);
      await expect(picker).toBeEnabled();
      await expect(picker.locator('option')).toHaveCount(action === 'deny' ? 5 : 4);
      const reason = page.getByTestId(`${prefix}.reason`);
      if (action === 'deny') {
        await picker.selectOption('application_incorrect');
        await expect(reason).toHaveValue(language === 'cs'
          ? 'Přihlášku zamítáme, protože není korektně vyplněná.'
          : 'We are rejecting your application because it has not been filled in correctly.');
      } else {
        await picker.selectOption('address_unverified');
        await expect(reason).toHaveValue(language === 'cs'
          ? /odkaz na mapu, na které bude označen tvůj dům/
          : /link to a map with your house marked/);
      }
      const text = await reason.inputValue();
      await expect(page.getByTestId(`${prefix}.review`)).toContainText(text);
      await expect(page.getByTestId(`${prefix}.submit`)).toBeEnabled();
      await page.getByTestId(`${prefix}.modal`).screenshot({ path: testInfo.outputPath(`${action}-${language}.png`) });
      const sent = page.waitForRequest(r => r.method() === 'POST' && r.url().includes('/registrations/123/resolve'));
      await page.getByTestId(`${prefix}.submit`).click();
      const payload = (await sent).postDataJSON().registration;
      expect(payload).toMatchObject({ action, reason: text });
      if (action === 'request_correction') expect(payload.language).toBe(57);
    });
  }
}

test('@pr-smoke @pr-smoke-mobile own reason is preserved on a rejected submission', async ({ page }) => {
  await setup(page, 'en', { fail: true });
  await page.getByTestId(`${prefix}.action.deny`).click();
  await page.getByTestId(`${prefix}.reason_preset`).selectOption('existing_membership');
  const reason = page.getByTestId(`${prefix}.reason`);
  const edited = `${await reason.inputValue()} Please use password recovery if needed.`;
  await reason.fill(edited);
  await expect(page.getByTestId(`${prefix}.reason_preset`)).toHaveValue('');
  const sent = page.waitForRequest(r => r.method() === 'POST' && r.url().includes('/registrations/123/resolve'));
  await page.getByTestId(`${prefix}.submit`).click();
  expect((await sent).postDataJSON().registration).toEqual({ action: 'deny', reason: edited });
  await expect(page.getByTestId(`${prefix}.modal`)).toBeVisible();
  await expect(reason).toHaveValue(edited);
});

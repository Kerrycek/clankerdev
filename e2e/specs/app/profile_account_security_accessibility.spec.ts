import { test, expect, type Locator } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

async function expectMinimumTouchHeight(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, 'control should have a rendered touch target').not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

test('@pr-smoke @pr-smoke-mobile profile account-security forms expose labels, help and validation', async ({
  page,
}, testInfo) => {
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
  const existingKey = {
    id: 7,
    label: 'Laptop',
    fingerprint: 'SHA256:AAAA',
    auto_add: true,
    created_at: '2026-02-01T12:00:00Z',
  };
  let createRequests = 0;
  let updatePayload: Record<string, unknown> | null = null;

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user,
    handlers: {
      'GET users/current': () => ({ user }),
      'GET users/1/public_keys': () => ({ public_keys: [existingKey] }),
      'POST users/1/public_keys': () => {
        createRequests += 1;
        return { public_key: existingKey };
      },
      'PUT users/1/public_keys/7': (ctx) => {
        const body = ctx.reqJson as { public_key?: Record<string, unknown> };
        updatePayload = body.public_key ?? null;
        return { public_key: existingKey };
      },
      'GET user_sessions': () => ({ user_sessions: [] }),
    },
  });

  await page.goto('/app/profile/sessions');

  const filters = page.getByRole('group', { name: 'Session history filters' });
  const state = filters.getByRole('combobox', { name: 'State' });
  const authType = filters.getByRole('combobox', { name: 'Authentication type' });
  const exactId = filters.getByRole('spinbutton', { name: 'Exact ID' });
  const search = filters.getByRole('textbox', { name: 'Search' });
  const userAgent = filters.getByRole('textbox', { name: 'User agent' });
  const clientVersion = filters.getByRole('textbox', { name: 'Client version' });
  const token = filters.getByRole('textbox', { name: 'Token' });

  await expect(filters).toBeVisible();
  await expect(state).toBeVisible();
  await expect(authType).toBeVisible();
  await expect(exactId).toBeVisible();
  await expect(search).toHaveAccessibleDescription(
    'IP search is sent to the server; other text also filters the loaded rows locally.'
  );
  await expect(userAgent).toBeVisible();
  await expect(clientVersion).toBeVisible();
  await expect(token).toHaveAccessibleDescription('Matches from the beginning of the token fragment.');

  await state.focus();
  await page.keyboard.press('Tab');
  await expect(authType).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(exactId).toBeFocused();

  if (testInfo.project.name === 'mobile-chrome') {
    for (const control of [state, authType, exactId, search, userAgent, clientVersion, token]) {
      await expectMinimumTouchHeight(control);
    }
  }

  await page.goto('/app/profile/keys');
  await page.getByRole('button', { name: 'Add key' }).click();

  const keyModal = page.getByTestId('profile.keys.modal');
  const keyLabel = keyModal.getByRole('textbox', { name: 'Label' });
  const publicKey = keyModal.getByRole('textbox', { name: 'Public key', exact: true });
  const keySave = keyModal.getByRole('button', { name: 'Save' });

  await expect(keyLabel).toBeVisible();
  await expect(publicKey).toHaveAccessibleDescription('Paste an OpenSSH public key.');

  await keyModal.getByText('Label', { exact: true }).click();
  await expect(keyLabel).toBeFocused();
  await keyModal.getByText('Public key', { exact: true }).click();
  await expect(publicKey).toBeFocused();

  await keySave.click();
  await expect(keyLabel).toBeFocused();
  await expect(keyLabel).toHaveAttribute('aria-invalid', 'true');
  await expect(keyLabel).toHaveAccessibleDescription('Label is required.');
  await expect(publicKey).toHaveAttribute('aria-invalid', 'true');
  await expect(publicKey).toHaveAccessibleDescription('Paste an OpenSSH public key. Public key is required.');
  await expect(keyModal.getByRole('alert')).toHaveCount(2);

  await keyLabel.fill('Laptop');
  await keySave.click();
  await expect(publicKey).toBeFocused();
  expect(createRequests).toBe(0);

  await publicKey.fill('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA TEST');
  await expect(keyLabel).toHaveAttribute('aria-invalid', 'false');
  await expect(publicKey).toHaveAttribute('aria-invalid', 'false');
  await expect(publicKey).toHaveAccessibleDescription('Paste an OpenSSH public key.');

  if (testInfo.project.name === 'mobile-chrome') {
    await expectMinimumTouchHeight(keyLabel);
    await expectMinimumTouchHeight(keySave);
  }

  await keyModal.getByRole('button', { name: 'Cancel' }).click();

  await page.locator('[data-testid="profile.keys.row.7.edit"]:visible').click();
  await expect(publicKey).toHaveValue('');
  await expect(publicKey).toHaveAttribute('aria-invalid', 'false');
  await expect(publicKey).toHaveAccessibleDescription(
    'Paste an OpenSSH public key. Leave empty to keep the existing key.'
  );
  await keySave.click();
  await expect.poll(() => updatePayload).not.toBeNull();
  expect(updatePayload).not.toHaveProperty('key');
  expect(createRequests).toBe(0);

  await page.goto('/app/profile/security');

  const sessionLength = page.getByRole('spinbutton', { name: 'Preferred session length' });
  const sessionPresets = page.getByRole('group', { name: 'Preferred session length' });
  const sixtyMinutes = sessionPresets.getByRole('button', { name: '60 min' });

  await expect(sessionLength).toHaveAccessibleDescription(
    'How long sessions stay valid before re-authentication is required. minutes'
  );
  await page.getByText('Preferred session length', { exact: true }).click();
  await expect(sessionLength).toBeFocused();

  await sessionLength.fill('-1');
  await expect(sessionLength).toHaveAttribute('aria-invalid', 'true');
  await expect(sessionLength).toHaveAccessibleDescription(
    'How long sessions stay valid before re-authentication is required. minutes Fix the session length Session length must be zero or a positive number of minutes.'
  );

  await sixtyMinutes.click();
  await expect(sessionLength).toHaveValue('60');
  await expect(sessionLength).toHaveAttribute('aria-invalid', 'false');
  await expect(sixtyMinutes).toHaveAttribute('aria-pressed', 'true');

  if (testInfo.project.name === 'mobile-chrome') {
    await expectMinimumTouchHeight(sessionLength);
    await expectMinimumTouchHeight(sixtyMinutes);
  }
});

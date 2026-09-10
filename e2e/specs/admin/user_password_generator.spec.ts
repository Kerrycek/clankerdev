import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, type HaveApiRequestCtx } from '../../fixtures';

const PASSWORD_LENGTH = 20;
const LOWERCASE = 'abcdefghijkmnpqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%&*-';
const ALLOWED_PASSWORD_CHARACTERS = `${LOWERCASE}${UPPERCASE}${DIGITS}${SYMBOLS}`;

type ClipboardProbe = {
  writes: string[];
  execCommandCalls: string[];
};

async function installClipboardProbe(page: Page, options?: { failWrite?: boolean }) {
  await page.addInitScript(
    ({ failWrite }) => {
      const probe: ClipboardProbe = { writes: [], execCommandCalls: [] };
      const testWindow = window as typeof window & { __passwordClipboardProbe?: ClipboardProbe };
      testWindow.__passwordClipboardProbe = probe;

      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            probe.writes.push(text);
            if (failWrite) throw new DOMException('Clipboard write intentionally failed', 'NotAllowedError');
          },
        },
      });

      Object.defineProperty(document, 'execCommand', {
        configurable: true,
        value: (command: string) => {
          probe.execCommandCalls.push(command);
          return false;
        },
      });
    },
    { failWrite: options?.failWrite ?? false }
  );
}

async function readClipboardProbe(page: Page): Promise<ClipboardProbe> {
  return page.evaluate(() => {
    const testWindow = window as typeof window & { __passwordClipboardProbe?: ClipboardProbe };
    return testWindow.__passwordClipboardProbe ?? { writes: [], execCommandCalls: [] };
  });
}

function readUserPayload(ctx: HaveApiRequestCtx): Record<string, unknown> {
  if (!ctx.reqJson || typeof ctx.reqJson !== 'object' || Array.isArray(ctx.reqJson)) return {};
  const user = (ctx.reqJson as { user?: unknown }).user;
  if (!user || typeof user !== 'object' || Array.isArray(user)) return {};
  return user as Record<string, unknown>;
}

function expectGeneratedPassword(password: string) {
  expect(password).toHaveLength(PASSWORD_LENGTH);
  expect([...password].every((character) => ALLOWED_PASSWORD_CHARACTERS.includes(character))).toBe(true);
  expect([...password].some((character) => LOWERCASE.includes(character))).toBe(true);
  expect([...password].some((character) => UPPERCASE.includes(character))).toBe(true);
  expect([...password].some((character) => DIGITS.includes(character))).toBe(true);
  expect([...password].some((character) => SYMBOLS.includes(character))).toBe(true);
}

function targetUser() {
  return {
    id: 42,
    login: 'alice',
    level: 1,
    full_name: 'Alice Example',
    email: 'alice@example.test',
    enable_basic_auth: true,
    enable_token_auth: true,
    enable_oauth2_auth: false,
    enable_single_sign_on: false,
    enable_new_login_notification: true,
    preferred_session_length: 20 * 60,
    preferred_logout_all: false,
  };
}

test('@pr-smoke @pr-smoke-mobile admin user password: generates, copies and saves the existing API payload', async ({
  page,
}) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'PASSWORD_GENERATOR_SUCCESS' });
  await installClipboardProbe(page);

  const user = targetUser();
  const updates: unknown[] = [];

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET users/42': () => ({ user }),
      'PUT users/42': (ctx) => {
        const payload = readUserPayload(ctx);
        updates.push(ctx.reqJson);
        return { user: { ...user, ...payload } };
      },
    },
  });

  await page.goto('/admin/users/42/security');

  const newPassword = page.getByTestId('admin.user.security.password.new');
  const repeatedPassword = page.getByTestId('admin.user.security.password.new2');
  const save = page.getByTestId('admin.user.security.password.save');

  await expect(page.getByTestId('admin.user.security.password.generate')).toBeVisible();
  await expect(save).toBeDisabled();
  await page.getByTestId('admin.user.security.password.generate').click();

  await expect(newPassword).not.toHaveValue('');
  const generatedPassword = await newPassword.inputValue();
  expectGeneratedPassword(generatedPassword);
  await expect(repeatedPassword).toHaveValue(generatedPassword);
  await expect(page.getByTestId('admin.user.security.password.copy')).toBeVisible();
  await expect(save).toBeEnabled();

  expect(await readClipboardProbe(page)).toMatchObject({ writes: [generatedPassword] });
  expect(updates).toEqual([]);

  const generateToast = page.getByTestId('toast.viewport');
  await expect(generateToast).toBeVisible();
  await expect(generateToast).not.toContainText(generatedPassword);

  await save.click();

  await expect.poll(() => updates.length).toBe(1);
  expect(updates).toEqual([
    {
      user: {
        new_password: generatedPassword,
        logout_sessions: true,
      },
    },
  ]);
  expect((updates[0] as { user: Record<string, unknown> }).user).not.toHaveProperty('password');

  await expect(newPassword).toHaveValue('');
  await expect(repeatedPassword).toHaveValue('');
  await expect(page.getByTestId('admin.user.security.password.copy')).toHaveCount(0);
});

test('@pr-smoke @pr-smoke-mobile admin user password: keeps generated fields usable when clipboard copying fails', async ({
  page,
}) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'PASSWORD_GENERATOR_CLIPBOARD_FAILURE' });
  await installClipboardProbe(page, { failWrite: true });

  const user = targetUser();
  let updateCount = 0;

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET users/42': () => ({ user }),
      'PUT users/42': () => {
        updateCount += 1;
        return { user };
      },
    },
  });

  await page.goto('/admin/users/42/security');
  await page.getByTestId('admin.user.security.password.generate').click();

  const newPassword = page.getByTestId('admin.user.security.password.new');
  const generatedPassword = await newPassword.inputValue();
  expectGeneratedPassword(generatedPassword);
  await expect(page.getByTestId('admin.user.security.password.new2')).toHaveValue(generatedPassword);
  await expect(page.getByTestId('admin.user.security.password.save')).toBeEnabled();
  await expect(page.getByTestId('admin.user.security.password.copy')).toBeVisible();

  const probe = await readClipboardProbe(page);
  expect(probe.writes).toEqual([generatedPassword]);
  expect(probe.execCommandCalls).toEqual(['copy']);
  expect(updateCount).toBe(0);

  const failureToast = page.getByTestId('toast.viewport');
  await expect(failureToast).toBeVisible();
  await expect(failureToast).toContainText(/copy|clipboard|kopírov|schránk/i);
  await expect(failureToast).not.toContainText(generatedPassword);
});

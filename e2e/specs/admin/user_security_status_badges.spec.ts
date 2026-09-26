import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const scenarios = [
  {
    id: 41,
    lockout: false,
    passwordReset: false,
    lockoutState: 'unlocked',
    passwordResetState: 'not-required',
  },
  {
    id: 42,
    lockout: true,
    passwordReset: false,
    lockoutState: 'locked',
    passwordResetState: 'not-required',
  },
  {
    id: 43,
    lockout: 0,
    passwordReset: 1,
    lockoutState: 'unlocked',
    passwordResetState: 'required',
  },
  {
    id: 44,
    lockout: 1,
    passwordReset: 1,
    lockoutState: 'locked',
    passwordResetState: 'required',
  },
] as const;

test('@pr-smoke @pr-smoke-mobile admin user header shows lockout and password reset status on every detail tab', async ({
  page,
}) => {
  await bootstrapVpsAdminWindow(page);

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: Object.fromEntries(
      scenarios.map((scenario) => [
        `GET users/${scenario.id}`,
        () => ({
          user: {
            id: scenario.id,
            login: `status-user-${scenario.id}`,
            level: 1,
            lockout: scenario.lockout,
            password_reset: scenario.passwordReset,
          },
        }),
      ])
    ),
  });

  const mutations: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/v7.0/') || ['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return;
    // Opening a detail route persists UI navigation preferences. It must not be
    // confused with a mutation of the inspected user or another product object.
    if (request.method() === 'PUT' && url.pathname === '/api/v7.0/webui_user_settings/ui/settings') return;
    mutations.push(`${request.method()} ${url.pathname}`);
  });

  for (const scenario of scenarios) {
    for (const suffix of ['', '/security']) {
      await page.goto(`/admin/users/${scenario.id}${suffix}`);

      await expect(page.getByTestId('admin.user.status.lockout')).toBeVisible();
      await expect(page.getByTestId('admin.user.status.lockout')).toHaveAttribute(
        'data-state',
        scenario.lockoutState
      );
      await expect(page.getByTestId('admin.user.status.lockout')).toHaveAttribute(
        'href',
        `/admin/users/${scenario.id}/security`
      );
      await expect(page.getByTestId('admin.user.status.password_reset')).toBeVisible();
      await expect(page.getByTestId('admin.user.status.password_reset')).toHaveAttribute(
        'data-state',
        scenario.passwordResetState
      );
      await expect(page.getByTestId('admin.user.status.password_reset')).toHaveAttribute(
        'href',
        `/admin/users/${scenario.id}/security`
      );
    }
  }

  expect(mutations).toEqual([]);
});

test('@pr-smoke @pr-smoke-mobile failed admin account-flag updates restore the server state', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const user = {
    id: 42,
    login: 'flag-user',
    level: 1,
    lockout: false,
    password_reset: false,
  };
  let updates = 0;

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/42': () => ({ user }),
      'PUT users/42': () => {
        updates += 1;
        return {
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ status: false, message: 'Flag update rejected' }),
        };
      },
    },
  });

  await page.goto('/admin/users/42/security');

  const passwordReset = page.getByTestId('admin.user.security.flags.password_reset').locator('input');
  await expect(passwordReset).not.toBeChecked();
  await passwordReset.click();

  await expect.poll(() => updates).toBe(1);
  await expect(passwordReset).not.toBeChecked();
  await expect(page.getByTestId('toast.viewport').getByText('Failed to update flags')).toBeVisible();
});

test('@pr-smoke @pr-smoke-mobile rejected account lockout stays in context and can be retried', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const user = {
    id: 42,
    login: 'flag-user',
    level: 1,
    lockout: false,
    password_reset: false,
  };
  let updates = 0;

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/42': () => ({ user }),
      'PUT users/42': () => {
        updates += 1;
        if (updates === 1) {
          return {
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ status: false, message: 'Account is protected' }),
          };
        }
        user.lockout = true;
        return { user };
      },
    },
  });

  await page.goto('/admin/users/42/security');

  const lockout = page.getByTestId('admin.user.security.flags.lockout').locator('input');
  await lockout.click();
  const dialog = page.getByTestId('admin.user.security.flags.lockout.confirm');
  await dialog.getByTestId('admin.user.security.flags.lockout.confirm.confirm').click();

  await expect(dialog.getByTestId('admin.user.security.flags.lockout.confirm.error')).toContainText(
    'Account is protected'
  );
  await expect(dialog).toBeVisible();
  await expect(lockout).not.toBeChecked();

  await dialog.getByTestId('admin.user.security.flags.lockout.confirm.confirm').click();

  await expect(dialog).toBeHidden();
  await expect(lockout).toBeChecked();
  expect(updates).toBe(2);
});

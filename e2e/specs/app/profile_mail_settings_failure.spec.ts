import { expect, test } from '@playwright/test';

import { setupHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile profile mail settings keep a failed save in context and allow retry', async ({
  page,
}) => {
  let saveAttempts = 0;
  let mailerEnabled = true;

  await setupHaveApiMock(page, {
    user: { id: 1, login: 'member', level: 1 },
    handlers: {
      'GET users/1': () => ({
        user: {
          id: 1,
          login: 'member',
          level: 1,
          email: 'member@example.test',
          mailer_enabled: mailerEnabled,
          language: { id: 1, label: 'English' },
        },
      }),
      'GET languages': () => ({ languages: [{ id: 1, label: 'English' }] }),
      'GET users/1/mail_role_recipients': () => ({ mail_role_recipients: [] }),
      'GET users/1/mail_template_recipients': () => ({ mail_template_recipients: [] }),
      'PUT users/1': ({ reqJson }) => {
        saveAttempts += 1;

        if (saveAttempts === 1) {
          return {
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              status: false,
              message: 'Mail settings changed on the server',
              response: null,
            }),
          };
        }

        const userPayload = (reqJson as { user?: { mailer_enabled?: boolean } } | undefined)?.user;
        mailerEnabled = userPayload?.mailer_enabled ?? mailerEnabled;
        return { user: { id: 1, mailer_enabled: mailerEnabled } };
      },
    },
  });

  await page.goto('/app/profile/mail');

  const enabled = page.getByTestId('mail.settings.enabled');
  const save = page.getByTestId('mail.settings.save');

  await enabled.uncheck();
  await save.click();

  const error = page.getByTestId('mail.settings.save_error');
  await expect(error).toContainText('Mail settings changed on the server');
  await expect(enabled).not.toBeChecked();
  await expect(save).toBeEnabled();

  await save.click();

  await expect(error).toHaveCount(0);
  await expect(enabled).not.toBeChecked();
  await expect(save).toBeDisabled();
  expect(saveAttempts).toBe(2);
});

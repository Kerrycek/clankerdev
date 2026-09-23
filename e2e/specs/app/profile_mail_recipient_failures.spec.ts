import { expect, test } from '@playwright/test';

import { setupHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile mail recipient save failures stay with their row and allow retry', async ({
  page,
}) => {
  const roleRecipients = [
    {
      id: 'account',
      label: 'Account messages',
      description: 'Messages related to the account.',
      to: 'account@example.test',
    },
  ];
  const templateRecipients = [
    {
      id: 'vps_created',
      label: 'VPS created',
      description: 'Sent after a VPS has been created.',
      roles: 'account',
      to: 'created@example.test',
      enabled: true,
    },
  ];
  let roleAttempts = 0;
  let templateAttempts = 0;

  await setupHaveApiMock(page, {
    user: { id: 1, login: 'member', level: 1 },
    handlers: {
      'GET users/1': () => ({
        user: {
          id: 1,
          login: 'member',
          level: 1,
          email: 'member@example.test',
          mailer_enabled: true,
          language: { id: 1, label: 'English' },
        },
      }),
      'GET languages': () => ({ languages: [{ id: 1, label: 'English' }] }),
      'GET users/1/mail_role_recipients': () => ({ mail_role_recipients: roleRecipients }),
      'GET users/1/mail_template_recipients': () => ({ mail_template_recipients: templateRecipients }),
      'PUT users/1/mail_role_recipients/account': ({ reqJson }) => {
        roleAttempts += 1;
        if (roleAttempts === 1) {
          return {
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ status: false, message: 'Role recipient changed on the server', response: null }),
          };
        }

        const payload = (reqJson as { mail_role_recipient?: { to?: string } } | undefined)?.mail_role_recipient;
        roleRecipients[0] = { ...roleRecipients[0], to: payload?.to ?? roleRecipients[0].to };
        return { mail_role_recipient: roleRecipients[0] };
      },
      'PUT users/1/mail_template_recipients/vps_created': ({ reqJson }) => {
        templateAttempts += 1;
        if (templateAttempts === 1) {
          return {
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ status: false, message: 'Template recipient changed on the server', response: null }),
          };
        }

        const payload = (
          reqJson as { mail_template_recipient?: { to?: string; enabled?: boolean } } | undefined
        )?.mail_template_recipient;
        templateRecipients[0] = {
          ...templateRecipients[0],
          to: payload?.to ?? templateRecipients[0].to,
          enabled: payload?.enabled ?? templateRecipients[0].enabled,
        };
        return { mail_template_recipient: templateRecipients[0] };
      },
    },
  });

  await page.goto('/app/profile/mail');

  const roleInput = page.getByTestId('mail.roles.to.account');
  const roleSave = page.getByTestId('mail.roles.save.account');
  await roleInput.fill('next-account@example.test');
  await roleSave.click();

  const roleError = page.getByTestId('mail.roles.save_error.account');
  await expect(roleError).toContainText('Role recipient changed on the server');
  await expect(roleInput).toHaveValue('next-account@example.test');
  await expect(roleSave).toBeEnabled();

  await roleSave.click();
  await expect(roleError).toHaveCount(0);
  await expect(roleSave).toBeDisabled();
  expect(roleAttempts).toBe(2);

  const templateInput = page.getByTestId('mail.templates.to.vps_created');
  const templateSave = page.getByTestId('mail.templates.save.vps_created');
  await templateInput.fill('next-template@example.test');
  await templateSave.click();

  const templateError = page.getByTestId('mail.templates.save_error.vps_created');
  await expect(templateError).toContainText('Template recipient changed on the server');
  await expect(templateInput).toHaveValue('next-template@example.test');
  await expect(templateSave).toBeEnabled();

  await templateSave.click();
  await expect(templateError).toHaveCount(0);
  await expect(templateSave).toBeDisabled();
  expect(templateAttempts).toBe(2);
});

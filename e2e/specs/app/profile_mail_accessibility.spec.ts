import { expect, test } from '@playwright/test';

import { setUiSettingsLocalStorage, setupHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile mail recipient controls have unique names and usable touch targets', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 });
  await setUiSettingsLocalStorage(page, { language: 'en' });

  const roleRecipients = [
    {
      id: 'account',
      label: 'Account messages',
      description: 'Messages related to the account.',
      to: 'account@example.test',
    },
    {
      id: 'billing',
      label: 'Billing messages',
      description: 'Messages related to billing.',
      to: 'billing@example.test',
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
    {
      id: 'vps_deleted',
      label: 'VPS deleted',
      description: 'Sent after a VPS has been deleted.',
      roles: 'account',
      to: 'deleted@example.test',
      enabled: true,
    },
  ];

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
          preferred_language: { id: 1, label: 'English' },
        },
      }),
      'GET languages': () => ({ languages: [{ id: 1, label: 'English' }] }),
      'GET users/1/mail_role_recipients': () => ({ mail_role_recipients: roleRecipients }),
      'GET users/1/mail_template_recipients': () => ({ mail_template_recipients: templateRecipients }),
    },
  });

  await page.goto('/app/profile/mail');

  const accountTextarea = page.getByRole('textbox', {
    name: 'Override recipients for role Account messages (account)',
  });
  const billingTextarea = page.getByRole('textbox', {
    name: 'Override recipients for role Billing messages (billing)',
  });
  const accountCopy = page.getByRole('button', {
    name: 'Copy effective recipients for role Account messages (account)',
  });
  const billingCopy = page.getByRole('button', {
    name: 'Copy effective recipients for role Billing messages (billing)',
  });
  const search = page.getByRole('textbox', { name: 'Search templates' });
  const view = page.getByRole('combobox', { name: 'Template view' });
  const createdDisable = page.getByTestId('mail.templates.disable.vps_created');
  const createdTextarea = page.getByRole('textbox', {
    name: 'Override recipients for template VPS created (vps_created)',
  });
  const createdCopy = page.getByRole('button', {
    name: 'Copy effective recipients for template VPS created (vps_created)',
  });
  const deletedDisable = page.getByTestId('mail.templates.disable.vps_deleted');

  await expect(accountTextarea).toHaveAccessibleDescription('Messages related to the account.');
  await expect(billingTextarea).toHaveAccessibleDescription('Messages related to billing.');
  await expect(createdTextarea).toHaveAccessibleDescription('Sent after a VPS has been created.');
  await expect(page.getByRole('textbox', {
    name: 'Override recipients for template VPS deleted (vps_deleted)',
  })).toHaveAccessibleDescription('Sent after a VPS has been deleted.');

  await accountTextarea.focus();
  await page.keyboard.press('Tab');
  await expect(accountCopy).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(billingTextarea).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(billingCopy).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(search).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(view).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(createdDisable).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(createdTextarea).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(createdCopy).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(deletedDisable).toBeFocused();

  await accountTextarea.fill('next-account@example.test');
  await createdTextarea.fill('next-template@example.test');

  const compactActions = [
    page.getByTestId('mail.roles.save.account'),
    page.getByTestId('mail.roles.reset.account'),
    page.getByTestId('mail.roles.copy.account'),
    page.getByTestId('mail.templates.save.vps_created'),
    page.getByTestId('mail.templates.reset.vps_created'),
    page.getByTestId('mail.templates.copy.vps_created'),
  ];

  for (const control of [search, view, ...compactActions]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    if (mobile) {
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    } else {
      expect(box!.height).toBeGreaterThanOrEqual(32);
      expect(box!.height).toBeLessThan(44);
    }
  }
});

import { expect, test } from '@playwright/test';

import { setupHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile profile mail recipient editors stay usable without horizontal scrolling', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'mobile-chrome') {
    await page.setViewportSize({ width: 320, height: 800 });
  }

  const longRecipient = `${'a'.repeat(72)}@example.test`;
  const roleRecipients = [
    {
      id: 'account',
      label: 'Account messages',
      description: 'Messages related to the account.',
      to: longRecipient,
    },
  ];
  const templateRecipients = [
    {
      id: 'vps_created',
      label: 'VPS created',
      description: 'Sent after a VPS has been created.',
      roles: 'account',
      to: '',
      enabled: true,
    },
  ];
  const roleUpdates: unknown[] = [];
  const templateUpdates: unknown[] = [];

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
      'PUT users/1/mail_role_recipients/account': ({ reqJson }) => {
        roleUpdates.push(reqJson);
        return {
          mail_role_recipient: {
            ...roleRecipients[0],
            to: 'billing@example.test',
          },
        };
      },
      'PUT users/1/mail_template_recipients/vps_created': ({ reqJson }) => {
        templateUpdates.push(reqJson);
        return {
          mail_template_recipient: {
            ...templateRecipients[0],
            to: 'alerts@example.test',
          },
        };
      },
    },
  });

  await page.goto('/app/profile/mail');
  await expect(page.getByTestId('mail.templates.to.vps_created')).toBeVisible();

  const roleScroller = page.getByTestId('mail.roles').locator(':scope > .overflow-x-auto');
  const roleScrollMetrics = await roleScroller.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth,
  }));
  expect(roleScrollMetrics.scrollLeft).toBe(0);
  expect(roleScrollMetrics.scrollWidth).toBeLessThanOrEqual(roleScrollMetrics.clientWidth + 1);

  const templateScroller = page.getByTestId('mail.templates').locator(':scope > .overflow-x-auto');
  const scrollMetrics = await templateScroller.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth,
  }));
  expect(scrollMetrics.scrollLeft).toBe(0);
  expect(scrollMetrics.scrollWidth).toBeLessThanOrEqual(scrollMetrics.clientWidth + 1);

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  for (const control of [
    page.getByTestId('mail.roles.to.account'),
    page.getByTestId('mail.roles.save.account'),
    page.getByTestId('mail.templates.to.vps_created'),
    page.getByTestId('mail.templates.save.vps_created'),
  ]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  }

  await page.getByTestId('mail.roles.to.account').fill('billing@example.test');
  await page.getByTestId('mail.roles.save.account').click();
  await expect.poll(() => roleUpdates.length).toBe(1);
  expect(roleUpdates[0]).toEqual({ mail_role_recipient: { to: 'billing@example.test' } });

  await page.getByTestId('mail.templates.to.vps_created').fill('alerts@example.test');
  await page.getByTestId('mail.templates.save.vps_created').click();
  await expect.poll(() => templateUpdates.length).toBe(1);
  expect(templateUpdates[0]).toEqual({
    mail_template_recipient: {
      enabled: true,
      to: 'alerts@example.test',
    },
  });
});

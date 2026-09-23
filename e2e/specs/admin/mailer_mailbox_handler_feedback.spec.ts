import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock } from '../../fixtures';

const mailbox = {
  id: 20,
  label: 'Incident inbox',
  server: 'imap.example.test',
  port: 993,
  user: 'incidents@example.test',
  enable_ssl: true,
  handlers_count: 1,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-02-01T00:00:00Z',
};

test('@pr-smoke @pr-smoke-mobile keeps rejected mailbox handler creation in context for retry', async ({
  page,
}) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'MAILBOX_HANDLER_CREATE_RETRY' });

  const handlers: any[] = [];
  let createAttempts = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET mailboxes/20': () => ({ mailbox }),
      'GET mailboxes/20/handler': () => ({ handlers, _meta: { total_count: handlers.length } }),
      'POST mailboxes/20/handler': () => {
        createAttempts += 1;
        if (createAttempts === 1) return failEnvelope('Handler class is unavailable');
        const created = { id: 201, class_name: 'Custom::RetryHandler', order: 1, continue: false };
        handlers.push(created);
        return { handler: created };
      },
    },
  });

  await page.goto('/admin/mailer/mailboxes/20');
  await page.getByTestId('admin.mailer.mailboxes.detail.handlers.add').click();
  await page.getByTestId('admin.mailer.mailboxes.handler.modal.class_name').fill('Custom::RetryHandler');
  await page.getByTestId('admin.mailer.mailboxes.handler.modal.save').click();

  await expect(page.getByTestId('admin.mailer.mailboxes.handler.modal.error')).toContainText(
    'Handler class is unavailable',
  );
  await expect(page.getByTestId('admin.mailer.mailboxes.handler.modal')).toBeVisible();
  await expect(page.getByTestId('admin.mailer.mailboxes.handler.modal.class_name')).toHaveValue(
    'Custom::RetryHandler',
  );
  await expect(page.getByTestId('admin.mailer.mailboxes.handler.modal.order')).toHaveValue('1');

  await page.getByTestId('admin.mailer.mailboxes.handler.modal.save').click();
  await expect(page.getByTestId('admin.mailer.mailboxes.handler.modal')).toHaveCount(0);
  await expect(page.getByTestId('admin.mailer.mailboxes.handler.201')).toContainText('Custom::RetryHandler');
  expect(createAttempts).toBe(2);
});

test('@pr-smoke @pr-smoke-mobile keeps rejected mailbox handler edits in context for retry', async ({ page }, testInfo) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'MAILBOX_HANDLER_EDIT_RETRY' });

  let handlers: any[] = [{ id: 201, class_name: 'Custom::Handler', order: 1, continue: false }];
  let updateAttempts = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET mailboxes/20': () => ({ mailbox }),
      'GET mailboxes/20/handler': () => ({ handlers, _meta: { total_count: handlers.length } }),
      'PUT mailboxes/20/handler/201': () => {
        updateAttempts += 1;
        if (updateAttempts === 1) return failEnvelope('Handler order changed on the server');
        const updated = { id: 201, class_name: 'Custom::UpdatedHandler', order: 2, continue: true };
        handlers = [updated];
        return { handler: updated };
      },
    },
  });

  await page.goto('/admin/mailer/mailboxes/20');
  const editButton = page.getByTestId('admin.mailer.mailboxes.handler.201.edit');
  if (testInfo.project.name === 'mobile-chrome') {
    await editButton.focus();
    await editButton.press('Enter');
  } else {
    await editButton.click();
  }
  await page.getByTestId('admin.mailer.mailboxes.handler.modal.class_name').fill('Custom::UpdatedHandler');
  await page.getByTestId('admin.mailer.mailboxes.handler.modal.order').fill('2');
  await page.getByTestId('admin.mailer.mailboxes.handler.modal.continue').click();
  await page.getByTestId('admin.mailer.mailboxes.handler.modal.save').click();

  await expect(page.getByTestId('admin.mailer.mailboxes.handler.modal.error')).toContainText(
    'Handler order changed on the server',
  );
  await expect(page.getByTestId('admin.mailer.mailboxes.handler.modal.class_name')).toHaveValue(
    'Custom::UpdatedHandler',
  );
  await expect(page.getByTestId('admin.mailer.mailboxes.handler.modal.order')).toHaveValue('2');
  await expect(page.getByTestId('admin.mailer.mailboxes.handler.modal.continue')).toBeChecked();

  await page.getByTestId('admin.mailer.mailboxes.handler.modal.save').click();
  await expect(page.getByTestId('admin.mailer.mailboxes.handler.modal')).toHaveCount(0);
  await expect(page.getByTestId('admin.mailer.mailboxes.handler.201')).toContainText('Custom::UpdatedHandler');
  expect(updateAttempts).toBe(2);
});

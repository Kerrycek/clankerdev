import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke Admin mailer recipients', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    const recipients = [
      { id: 10, label: 'Support', to: 'support@example.test', cc: '', bcc: '', updated_at: '2025-01-01T12:00:00Z' },
      { id: 11, label: 'Accounting', to: 'acc@example.test', cc: '', bcc: '', updated_at: '2025-01-02T12:00:00Z' },
    ];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET mail_recipients': ({ searchParams }) => {
          const q = searchParams.get('mail_recipient[q]') || '';
          const data = q ? recipients.filter((r) => r.label.toLowerCase().includes(q.toLowerCase()) || r.to.toLowerCase().includes(q.toLowerCase())) : recipients;
          return { mail_recipients: data, _meta: { total_count: data.length } };
        },
      },
    });
  });

  test('shows recipients and filters using namespaced q', async ({ page }) => {
    const reqs: URL[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET') return;
      const url = new URL(req.url());
      if (!url.pathname.endsWith('/mail_recipients')) return;
      reqs.push(url);
    });

    await page.goto('/admin/mailer/recipients');

    await expect(page.getByTestId('admin.mailer.recipients.page')).toBeVisible();
    await expect(page.getByTestId('admin.mailer.recipients.row.10')).toBeVisible();

    await page.getByTestId('admin.mailer.recipients.search.input').fill('acc');
    await page.getByTestId('admin.mailer.recipients.search.input').press('Enter');

    await expect(page.getByTestId('admin.mailer.recipients.row.11')).toBeVisible();

    expect(reqs.length).toBeGreaterThan(0);
    const last = reqs[reqs.length - 1];
    expect(last.searchParams.get('mail_recipient[q]')).toBe('acc');
  });
});

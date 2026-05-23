import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test.describe('@smoke Admin mailer templates', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapVpsAdminWindow(page, {
      sessionToken: 'TEST',
    });

    const languages = [
      { id: 1, code: 'en', label: 'English' },
      { id: 2, code: 'cs', label: 'Čeština' },
    ];

    const templates = [
      {
        id: 1,
        name: 'welcome',
        label: 'Welcome mail',
        template_id: 'welcome',
        user_visibility: 'visible',
        translations_count: 2,
        recipients_count: 1,
        registry_roles: 'account',
        registry_public: true,
        registry_description: 'Welcome email sent after signup.',
        registry_vars: 'user: User\nlogin: String',
        registry_params: 'locale: String',
        updated_at: '2025-01-01T12:00:00Z',
      },
      {
        id: 2,
        name: 'invoice',
        label: 'Invoice',
        template_id: 'invoice',
        user_visibility: 'default',
        translations_count: 1,
        recipients_count: 0,
        registry_roles: 'account,admin',
        registry_public: false,
        registry_description: 'Invoice notification.',
        registry_vars: 'invoice: Invoice',
        registry_params: '',
        updated_at: '2025-01-02T12:00:00Z',
      },
    ];

    const recipients = [{ id: 10, label: 'Support', to: 'support@example.test', cc: '', bcc: '' }];

    const templateRecipients = [{ id: 1000, mail_recipient: recipients[0] }];

    const translations = [
      {
        id: 101,
        language: languages[0],
        subject: 'Welcome',
        from: 'noreply@example.test',
        text_plain: 'Hello',
        text_html: '<p>Hello</p>',
        updated_at: '2025-01-01T12:00:00Z',
        created_at: '2025-01-01T12:00:00Z',
      },
      {
        id: 102,
        language: languages[1],
        subject: 'Vítejte',
        from: 'noreply@example.test',
        text_plain: 'Ahoj',
        text_html: '<p>Ahoj</p>',
        updated_at: '2025-01-01T12:00:00Z',
        created_at: '2025-01-01T12:00:00Z',
      },
    ];

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 90 },
      handlers: {
        'GET languages': () => ({ languages, _meta: { total_count: languages.length } }),
        'GET mail_templates': ({ searchParams }) => {
          const q = searchParams.get('mail_template[q]') || '';
          const uv = searchParams.get('mail_template[user_visibility]') || '';

          let data = templates;
          if (uv) data = data.filter((t) => t.user_visibility === uv);
          if (q) data = data.filter((t) => t.label.toLowerCase().includes(q.toLowerCase()) || t.name.toLowerCase().includes(q.toLowerCase()));

          return { mail_templates: data, _meta: { total_count: data.length } };
        },
        'GET mail_templates/1': () => ({ mail_template: templates[0] }),
        'GET mail_templates/2': () => ({ mail_template: templates[1] }),
        'GET mail_templates/1/recipients': () => ({ recipients: templateRecipients, _meta: { total_count: templateRecipients.length } }),
        'GET mail_templates/1/translations': () => ({ translations, _meta: { total_count: translations.length } }),
        'GET mail_templates/1/translations/101': () => ({ translation: translations[0] }),
      },
    });
  });

  test('lists templates and opens detail + translation', async ({ page }) => {
    await page.goto('/admin/mailer/templates');

    await expect(page.getByTestId('admin.mailer.templates.page')).toBeVisible();
    await expect(page.getByTestId('admin.mailer.templates.row.1')).toBeVisible();

    await page.getByTestId('admin.mailer.templates.row.1').click();

    await expect(page).toHaveURL(/\/admin\/mailer\/templates\/1/);
    await expect(page.getByTestId('admin.mailer.templates.detail')).toBeVisible();

    // Translations list should include EN row.
    await expect(page.getByTestId('admin.mailer.templates.detail.translation.101')).toBeVisible();

    await page.getByTestId('admin.mailer.templates.detail.translation.101').click();

    await expect(page).toHaveURL(/\/admin\/mailer\/templates\/1\/translations\/101/);
    await expect(page.getByTestId('admin.mailer.templates.translation.detail')).toBeVisible();
    await expect(page.getByTestId('admin.mailer.templates.translation.detail.fields')).toContainText('Welcome');
  });

  test('filters list and uses namespaced query params', async ({ page }) => {
    const reqs: URL[] = [];
    page.on('request', (req) => {
      if (req.method() !== 'GET') return;
      const url = new URL(req.url());
      if (!url.pathname.endsWith('/mail_templates')) return;
      reqs.push(url);
    });

    await page.goto('/admin/mailer/templates');

    await page.getByTestId('admin.mailer.templates.search.input').fill('visibility:visible welcome');
    await page.getByTestId('admin.mailer.templates.search.input').press('Enter');

    await expect(page.getByTestId('admin.mailer.templates.row.1')).toBeVisible();

    expect(reqs.length).toBeGreaterThan(0);
    const last = reqs[reqs.length - 1];
    expect(last.searchParams.get('mail_template[user_visibility]')).toBe('visible');
    expect(last.searchParams.get('mail_template[q]')).toBe('welcome');
  });
});

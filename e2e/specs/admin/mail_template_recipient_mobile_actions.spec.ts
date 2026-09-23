import { expect, test } from '../../fixtures/bootstrap';
import { setupHaveApiMock } from '../../fixtures/haveapi';
import { withAppUrl } from '../../fixtures/url';

const compactWidths = {
  chromium: [1024, 1152],
  'mobile-chrome': [320, 390, 768],
} as const;

test.beforeEach(async ({ page }) => {
  const template = {
    id: 1,
    name: 'mobile-recipient-test',
    label: 'Mobile recipient test',
    template_id: 'mobile-recipient-test',
    user_visibility: 'visible',
    updated_at: '2026-09-16T08:00:00Z',
  };
  const recipient = {
    id: 68,
    label: 'Long operations recipient',
    to: 'a-very-long-primary-recipient-address-without-a-natural-breakpoint@example.test',
    cc: 'a-very-long-carbon-copy-address-without-a-natural-breakpoint@example.test',
    bcc: 'a-very-long-blind-copy-address-without-a-natural-breakpoint@example.test',
  };

  await setupHaveApiMock(page, {
    user: { id: 1, login: 'mailer-admin', level: 100 },
    handlers: {
      'GET languages': () => ({
        languages: [{ id: 1, code: 'en', label: 'English' }],
        _meta: { total_count: 1 },
      }),
      'GET mail_templates/1': () => ({ mail_template: template }),
      'GET mail_templates/1/recipients': () => ({
        recipients: [{ id: 1000, mail_recipient: recipient }],
        _meta: { total_count: 1 },
      }),
      'GET mail_templates/1/translations': () => ({
        translations: [],
        _meta: { total_count: 0 },
      }),
    },
  });
});

test('@pr-smoke @pr-smoke-mobile keeps mail-template recipient actions reachable in narrow content', async ({ page }, testInfo) => {
  const mutations: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      request.method() !== 'GET'
      && url.pathname.startsWith('/api/v7.0/mail_templates/1/recipients')
    ) {
      mutations.push(`${request.method()} ${url.pathname}`);
    }
  });

  await page.goto(withAppUrl('/admin/mailer/templates/1'));
  const table = page.getByTestId('admin.mailer.templates.detail.recipients.table');
  const remove = page.getByTestId('admin.mailer.templates.detail.recipients.remove.68');
  await expect(table).toBeVisible();
  await expect(remove).toBeVisible();

  const widths = compactWidths[testInfo.project.name as keyof typeof compactWidths] ?? [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });

    const metrics = await table.evaluate((element) => {
      const scroller = element.parentElement;
      const removeButton = document.querySelector<HTMLElement>(
        '[data-testid="admin.mailer.templates.detail.recipients.remove.68"]',
      );
      const scrollerRect = scroller?.getBoundingClientRect();
      const removeRect = removeButton?.getBoundingClientRect();

      return {
        tableDisplay: getComputedStyle(element).display,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        innerOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : -1,
        scrollLeft: scroller?.scrollLeft ?? -1,
        removeHeight: removeRect?.height ?? 0,
        removeInsideScroller: Boolean(
          scrollerRect
            && removeRect
            && removeRect.left >= scrollerRect.left
            && removeRect.right <= scrollerRect.right
        ),
      };
    });

    expect(metrics.tableDisplay, `${width}px should use the compact recipient layout`).toBe('block');
    if (width !== 768) {
      expect(metrics.documentOverflow, `${width}px document overflow`).toBeLessThanOrEqual(1);
    }
    expect(metrics.innerOverflow, `${width}px recipient list overflow`).toBeLessThanOrEqual(1);
    expect(metrics.scrollLeft, `${width}px hidden horizontal offset`).toBe(0);
    expect(metrics.removeInsideScroller, `${width}px remove action should be visible without scrolling`).toBe(true);
    expect(metrics.removeHeight, `${width}px remove target`).toBeGreaterThanOrEqual(44);

    const row = remove.locator('xpath=ancestor::tr');
    await expect(row.getByText(/^(Label|Popisek)$/)).toBeVisible();
    await expect(row.getByText(/^(To|Komu)$/)).toBeVisible();
    await expect(row.getByText(/^(CC|Kopie \(CC\))$/)).toBeVisible();
    await expect(row.getByText(/^(BCC|Skrytá kopie \(BCC\))$/)).toBeVisible();
    await expect(row.getByText(/^(Actions|Akce)$/)).toBeVisible();
  }

  if (testInfo.project.name === 'chromium') {
    await page.setViewportSize({ width: 1280, height: 900 });
    const metrics = await table.evaluate((element) => {
      const removeButton = document.querySelector<HTMLElement>(
        '[data-testid="admin.mailer.templates.detail.recipients.remove.68"]',
      );
      const removeCell = removeButton?.closest('td');
      return {
        tableDisplay: getComputedStyle(element).display,
        removeHeight: removeButton?.getBoundingClientRect().height ?? 0,
        actionAlignment: removeCell ? getComputedStyle(removeCell).textAlign : '',
      };
    });

    expect(metrics.tableDisplay).toBe('table');
    expect(metrics.removeHeight).toBeGreaterThanOrEqual(32);
    expect(metrics.removeHeight).toBeLessThan(44);
    expect(metrics.actionAlignment).toBe('right');
  }

  await remove.click();
  const dialog = page.getByTestId('admin.mailer.templates.detail.recipients.remove_confirm');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('admin.mailer.templates.detail.recipients.remove_confirm.cancel').click();
  await expect(dialog).toBeHidden();

  expect(mutations).toEqual([]);
  await expect(page.getByRole('table')).toHaveCount(1);
});

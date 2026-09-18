import { expect, test } from '../../fixtures/bootstrap';
import { setupHaveApiMock } from '../../fixtures/haveapi';
import { withAppUrl } from '../../fixtures/url';

const compactWidths = {
  chromium: [1024, 1152],
  'mobile-chrome': [768, 390, 320],
} as const;

test.beforeEach(async ({ page }) => {
  await setupHaveApiMock(page, {
    user: { level: 100 },
    handlers: {
      'GET vpses/123': () => ({
        vps: {
          id: 123,
          hostname: 'oom-mobile.example.test',
          user: { id: 7, login: 'mobile-admin' },
          node: { id: 4, domain_name: 'node4.example.test' },
        },
      }),
      'GET oom_report_rules': () => ({
        oom_report_rules: [
          {
            id: 77,
            action: 'notify',
            cgroup_pattern: '^/lxc/123/user.slice/a-very-long-cgroup-segment-without-a-natural-breakpoint$',
            hit_count: 42,
          },
        ],
      }),
    },
  });
});

test('@pr-smoke @pr-smoke-mobile keeps OOM rule actions reachable in narrow content', async ({ page }, testInfo) => {
  const mutations: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() !== 'GET' && url.pathname.startsWith('/api/v7.0/oom_report_rules')) {
      mutations.push(`${request.method()} ${url.pathname}`);
    }
  });

  await page.goto(withAppUrl('/admin/oom-reports/rules/123'));
  await expect(page.getByTestId('oom.rules.table')).toBeVisible();

  const widths = compactWidths[testInfo.project.name as keyof typeof compactWidths] ?? [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });

    const metrics = await page.getByTestId('oom.rules.table').evaluate((table) => {
      const scroller = table.parentElement;
      const edit = document.querySelector<HTMLElement>('[data-testid="oom.rules.row.77.edit"]');
      const remove = document.querySelector<HTMLElement>('[data-testid="oom.rules.row.77.delete"]');
      const card = document.querySelector<HTMLElement>('[data-testid="oom.rules.list"]');
      const editRect = edit?.getBoundingClientRect();
      const removeRect = remove?.getBoundingClientRect();
      const cardRect = card?.getBoundingClientRect();

      return {
        tableDisplay: getComputedStyle(table).display,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        innerOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : -1,
        scrollLeft: scroller?.scrollLeft ?? -1,
        editHeight: editRect?.height ?? 0,
        removeHeight: removeRect?.height ?? 0,
        controlsInsideCard: Boolean(
          editRect &&
            removeRect &&
            cardRect &&
            editRect.left >= cardRect.left &&
            removeRect.right <= cardRect.right
        ),
        cardInsideViewport: Boolean(
          cardRect && cardRect.left >= 0 && cardRect.right <= document.documentElement.clientWidth
        ),
      };
    });

    expect(metrics.tableDisplay, `${width}px should use the compact rule layout`).toBe('block');
    // At the exact md breakpoint the app-shell account button has a pre-existing 4px overflow;
    // keep this regression assertion scoped to the OOM card there.
    if (width !== 768) {
      expect(metrics.documentOverflow, `${width}px document overflow`).toBeLessThanOrEqual(1);
    }
    expect(metrics.innerOverflow, `${width}px rule list overflow`).toBeLessThanOrEqual(1);
    expect(metrics.scrollLeft, `${width}px hidden horizontal offset`).toBe(0);
    expect(metrics.cardInsideViewport, `${width}px rule card should stay in the viewport`).toBe(true);
    expect(metrics.controlsInsideCard, `${width}px actions should stay inside the card`).toBe(true);
    expect(metrics.editHeight, `${width}px edit target`).toBeGreaterThanOrEqual(44);
    expect(metrics.removeHeight, `${width}px delete target`).toBeGreaterThanOrEqual(44);

    const row = page.getByTestId('oom.rules.row.77');
    await expect(row.getByText('ID', { exact: true })).toBeVisible();
    await expect(row.getByText('cgroup regex', { exact: true })).toBeVisible();
    await expect(row.getByText('Hits', { exact: true })).toBeVisible();
  }

  if (testInfo.project.name === 'chromium') {
    await page.setViewportSize({ width: 1280, height: 900 });
    const metrics = await page.getByTestId('oom.rules.table').evaluate((table) => {
      const edit = document.querySelector<HTMLElement>('[data-testid="oom.rules.row.77.edit"]');
      const remove = document.querySelector<HTMLElement>('[data-testid="oom.rules.row.77.delete"]');
      const actionCell = remove?.closest('td');
      return {
        tableDisplay: getComputedStyle(table).display,
        editHeight: edit?.getBoundingClientRect().height ?? 0,
        removeHeight: remove?.getBoundingClientRect().height ?? 0,
        actionAlignment: actionCell ? getComputedStyle(actionCell).textAlign : '',
      };
    });

    expect(metrics.tableDisplay).toBe('table');
    expect(metrics.editHeight).toBeGreaterThanOrEqual(32);
    expect(metrics.editHeight).toBeLessThan(44);
    expect(metrics.removeHeight).toBeGreaterThanOrEqual(32);
    expect(metrics.removeHeight).toBeLessThan(44);
    expect(metrics.actionAlignment).toBe('right');
  }

  await page.getByTestId('oom.rules.row.77.edit').click();
  await expect(page.getByTestId('oom.rules.row.77.save')).toBeVisible();
  await expect(page.getByTestId('oom.rules.row.77.cancel')).toBeVisible();
  const editMetrics = await page.getByTestId('oom.rules.table.scroller').evaluate((scroller) => {
    const save = document.querySelector<HTMLElement>('[data-testid="oom.rules.row.77.save"]');
    const cancel = document.querySelector<HTMLElement>('[data-testid="oom.rules.row.77.cancel"]');
    const card = document.querySelector<HTMLElement>('[data-testid="oom.rules.list"]');
    const saveRect = save?.getBoundingClientRect();
    const cancelRect = cancel?.getBoundingClientRect();
    const cardRect = card?.getBoundingClientRect();
    return {
      innerOverflow: scroller.scrollWidth - scroller.clientWidth,
      saveHeight: saveRect?.height ?? 0,
      cancelHeight: cancelRect?.height ?? 0,
      controlsInsideCard: Boolean(
        saveRect && cancelRect && cardRect && saveRect.left >= cardRect.left && cancelRect.right <= cardRect.right
      ),
    };
  });
  expect(editMetrics.innerOverflow).toBeLessThanOrEqual(1);
  expect(editMetrics.controlsInsideCard).toBe(true);
  if (testInfo.project.name === 'mobile-chrome') {
    expect(editMetrics.saveHeight).toBeGreaterThanOrEqual(44);
    expect(editMetrics.cancelHeight).toBeGreaterThanOrEqual(44);
  }
  await page.getByTestId('oom.rules.row.77.cancel').click();

  await page.getByTestId('oom.rules.row.77.delete').click();
  const modal = page.getByTestId('oom.rules.delete.modal');
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: /Cancel|Zrušit/ }).click();
  await expect(modal).toBeHidden();

  expect(mutations).toEqual([]);
  await expect(page.getByRole('table')).toHaveCount(1);
});

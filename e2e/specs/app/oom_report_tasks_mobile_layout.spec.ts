import { expect, test } from '../../fixtures/bootstrap';
import { setupHaveApiMock } from '../../fixtures/haveapi';
import { setUiSettingsLocalStorage } from '../../fixtures/uiSettings';
import { withAppUrl } from '../../fixtures/url';

const compactWidths = {
  chromium: [1024, 1152],
  'mobile-chrome': [768, 390, 320],
} as const;

const expectedCells = [
  ['Název', 'memory-hungry-worker-with-a-long-process-name-that-must-wrap-inside-the-card'],
  ['PID hostitele', '109182'],
  ['PID ve VPS', '9182'],
  ['UID ve VPS', '1000'],
  ['TGID', '9183'],
  ['Virtuální paměť', '2.00 GiB'],
  ['RSS', '1.00 GiB'],
  ['Tabulky stránek', '8.00 MiB'],
  ['Swap', '16.0 MiB'],
  ['Úprava OOM skóre', '750'],
] as const;

test.beforeEach(async ({ page }) => {
  await setUiSettingsLocalStorage(page, { language: 'cs', sidebarCollapsed: false });
  await setupHaveApiMock(page, {
    user: { id: 90, login: 'mobile-admin', level: 100 },
    handlers: {
      'GET oom_reports/77': () => ({
        oom_report: {
          id: 77,
          created_at: '2026-09-16T08:00:00Z',
          vps: {
            id: 123,
            hostname: 'oom-mobile.example.test',
            user: { id: 7, login: 'mobile-owner' },
            node: { id: 4, domain_name: 'node4.example.test' },
          },
          cgroup: '/lxc/123/user.slice/memory-pressure.service',
          killed_name: 'memory-hungry-worker',
          killed_pid: 9182,
          invoked_by_name: 'systemd',
          invoked_by_pid: 1,
          count: 1,
          oom_report_rule: { id: 1, action: 'notify' },
        },
      }),
      'GET oom_reports/77/tasks': ({ searchParams }) => {
        expect(searchParams.get('task[limit]')).toBe('2000');
        return {
          tasks: [
            {
              id: 501,
              name: 'memory-hungry-worker-with-a-long-process-name-that-must-wrap-inside-the-card',
              host_pid: 109182,
              vps_pid: 9182,
              vps_uid: 1000,
              tgid: 9183,
              total_vm: 524288,
              rss: 262144,
              pgtables_bytes: 8388608,
              swapents: 4096,
              oom_score_adj: 750,
            },
          ],
          _meta: { total_count: 1 },
        };
      },
    },
  });
});

test('@pr-smoke @pr-smoke-mobile keeps every OOM process field visible in narrow content', async ({
  page,
}, testInfo) => {
  const mutations: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() !== 'GET' && url.pathname.startsWith('/api/v7.0/oom_reports')) {
      mutations.push(`${request.method()} ${url.pathname}`);
    }
  });

  await page.goto(withAppUrl('/admin/oom-reports/77/tasks'));
  const table = page.getByTestId('oom.detail.tasks.table');
  const scroller = page.getByTestId('oom.detail.tasks.table.scroller');
  const row = table.locator('tbody tr').first();
  await expect(table).toBeVisible();
  await expect(row).toBeVisible();
  await expect(row.locator('td')).toHaveCount(expectedCells.length);
  for (const [index, [labelText, valueText]] of expectedCells.entries()) {
    const cell = row.locator('td').nth(index);
    await expect(cell.locator('[data-oom-task-label]')).toHaveText(labelText);
    await expect(cell.locator('[data-oom-task-value]')).toHaveText(valueText);
    await expect(cell.locator('[data-oom-task-value]')).toBeVisible();
  }

  const widths = compactWidths[testInfo.project.name as keyof typeof compactWidths];
  if (!widths) throw new Error(`Missing compact width coverage for Playwright project ${testInfo.project.name}`);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });

    const metrics = await scroller.evaluate((scroller) => {
      const table = scroller.querySelector<HTMLElement>('table');
      const row = table?.querySelector<HTMLElement>('tbody tr');
      const card = document.querySelector<HTMLElement>('[data-testid="oom.detail.tasks"]');
      const cardRect = card?.getBoundingClientRect();
      const cellRects = Array.from(row?.querySelectorAll<HTMLElement>('td') ?? []).map((cell) =>
        cell.getBoundingClientRect()
      );
      const valueRects = Array.from(row?.querySelectorAll<HTMLElement>('[data-oom-task-value]') ?? []).map((value) =>
        value.getBoundingClientRect()
      );

      return {
        tableDisplay: table ? getComputedStyle(table).display : '',
        rowDisplay: row ? getComputedStyle(row).display : '',
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        innerOverflow: scroller.scrollWidth - scroller.clientWidth,
        scrollLeft: scroller.scrollLeft,
        cardInsideViewport: Boolean(
          cardRect && cardRect.left >= 0 && cardRect.right <= document.documentElement.clientWidth
        ),
        allCellsInsideCard: Boolean(
          cardRect &&
            cellRects.length === 10 &&
            cellRects.every((rect) => rect.left >= cardRect.left - 1 && rect.right <= cardRect.right + 1)
        ),
        allValuesInsideCard: Boolean(
          cardRect &&
            valueRects.length === 10 &&
            valueRects.every((rect) => rect.left >= cardRect.left - 1 && rect.right <= cardRect.right + 1)
        ),
      };
    });

    expect(metrics.tableDisplay, `${width}px should use the compact process layout`).toBe('block');
    expect(metrics.rowDisplay, `${width}px should stack the process fields`).toBe('block');
    // At the exact md breakpoint the app-shell account button has a pre-existing 4px overflow;
    // keep this regression assertion scoped to the OOM card there.
    if (width !== 768) {
      expect(metrics.documentOverflow, `${width}px document overflow`).toBeLessThanOrEqual(1);
    }
    expect(metrics.innerOverflow, `${width}px process list overflow`).toBeLessThanOrEqual(1);
    expect(metrics.scrollLeft, `${width}px hidden horizontal offset`).toBe(0);
    expect(metrics.cardInsideViewport, `${width}px process card should stay in the viewport`).toBe(true);
    expect(metrics.allCellsInsideCard, `${width}px all ten fields should stay inside the card`).toBe(true);
    expect(metrics.allValuesInsideCard, `${width}px all ten values should stay inside the card`).toBe(true);

    const labels = row.locator('td > [data-oom-task-label]');
    await expect(labels).toHaveCount(expectedCells.length);
    await expect(labels).toHaveText(expectedCells.map(([label]) => label));
    for (const label of await labels.all()) {
      await expect(label).toBeVisible();
    }
    for (const value of await row.locator('td > [data-oom-task-value]').all()) {
      await expect(value).toBeVisible();
    }
  }

  if (testInfo.project.name === 'chromium') {
    await page.setViewportSize({ width: 1280, height: 900 });
    const desktopMetrics = await scroller.evaluate((scroller) => {
      const table = scroller.querySelector<HTMLElement>('table');
      const head = table?.querySelector<HTMLElement>('thead');
      const row = table?.querySelector<HTMLElement>('tbody tr');
      const firstCell = row?.querySelector<HTMLElement>('td');
      return {
        tableDisplay: table ? getComputedStyle(table).display : '',
        headDisplay: head ? getComputedStyle(head).display : '',
        rowDisplay: row ? getComputedStyle(row).display : '',
        cellDisplay: firstCell ? getComputedStyle(firstCell).display : '',
        innerOverflow: scroller.scrollWidth - scroller.clientWidth,
      };
    });

    expect(desktopMetrics.tableDisplay).toBe('table');
    expect(desktopMetrics.headDisplay).toBe('table-header-group');
    expect(desktopMetrics.rowDisplay).toBe('table-row');
    expect(desktopMetrics.cellDisplay).toBe('table-cell');
    expect(desktopMetrics.innerOverflow).toBeLessThanOrEqual(1);
    await expect(row.locator('td > [data-oom-task-label]').first()).toBeHidden();
  }

  expect(mutations).toEqual([]);
  await expect(page.getByTestId('oom.detail.tasks').getByRole('table')).toHaveCount(1);
});

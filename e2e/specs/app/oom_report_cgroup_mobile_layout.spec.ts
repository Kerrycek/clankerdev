import { expect, test } from '../../fixtures/bootstrap';
import { setupHaveApiMock } from '../../fixtures/haveapi';
import { setUiSettingsLocalStorage } from '../../fixtures/uiSettings';
import { withAppUrl } from '../../fixtures/url';

const cgroup =
  '/system.slice/docker-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.scope';

test.beforeEach(async ({ page }) => {
  await setUiSettingsLocalStorage(page, { language: 'cs', sidebarCollapsed: false });
  await setupHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET oom_reports/77': () => ({
        oom_report: {
          id: 77,
          created_at: '2026-09-16T08:30:00Z',
          reported_at: '2026-09-16T08:30:01Z',
          cgroup,
          killed_name: 'memory-worker',
          killed_pid: 12345,
          invoked_by_name: 'systemd',
          invoked_by_pid: 1,
          count: 2,
          vps: {
            id: 123,
            hostname: 'oom-vps.example.test',
            user: { id: 10, login: 'alice' },
            node: { id: 3, domain_name: 'node3.example.test' },
          },
          oom_report_rule: {
            id: 9,
            action: 'notify',
            cgroup_pattern: cgroup,
          },
        },
      }),
      'GET oom_reports/77/usages': () => ({ usages: [] }),
    },
  });
});

test('@pr-smoke @pr-smoke-mobile keeps long OOM cgroup paths inside the detail viewport', async ({
  page,
}, testInfo) => {
  const mutations: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/v7.0/') || ['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return;
    if (request.method() === 'PUT' && url.pathname === '/api/v7.0/webui_user_settings/ui/settings') return;
    mutations.push(`${request.method()} ${url.pathname}`);
  });

  await page.goto(withAppUrl('/admin/oom-reports/77'));

  const header = page.getByTestId('oom.detail.header');
  const summary = page.getByTestId('oom.detail.overview.summary');
  const headerCgroup = page.getByTestId('oom.detail.header.cgroup');
  const overviewCgroup = page.getByTestId('oom.detail.overview.cgroup');
  const ruleCgroup = page.getByTestId('oom.detail.overview.rule_cgroup');
  const openVps = page.getByTestId('oom.detail.open_vps');
  const configureRules = page.getByTestId('oom.detail.rules');
  await expect(header).toBeVisible();
  await expect(summary).toBeVisible();
  await expect(headerCgroup).toHaveText(cgroup);
  await expect(overviewCgroup).toHaveText(cgroup);
  await expect(ruleCgroup).toHaveText(cgroup);

  const widths =
    testInfo.project.name === 'mobile-chrome'
      ? [320, 390]
      : testInfo.project.name === 'chromium'
        ? [1280]
        : (() => {
            throw new Error(`Missing OOM detail layout coverage for Playwright project ${testInfo.project.name}`);
          })();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const metrics = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>('[data-testid="oom.detail.header"]');
      const summary = document.querySelector<HTMLElement>('[data-testid="oom.detail.overview.summary"]');
      const cgroupElements = [
        document.querySelector<HTMLElement>('[data-testid="oom.detail.header.cgroup"]'),
        document.querySelector<HTMLElement>('[data-testid="oom.detail.overview.cgroup"]'),
        document.querySelector<HTMLElement>('[data-testid="oom.detail.overview.rule_cgroup"]'),
      ];
      return {
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        headerOverflow: header ? header.scrollWidth - header.clientWidth : -1,
        summaryOverflow: summary ? summary.scrollWidth - summary.clientWidth : -1,
        cgroups: cgroupElements.map((element) => {
          const rect = element?.getBoundingClientRect();
          return {
            overflow: element ? element.scrollWidth - element.clientWidth : -1,
            left: rect?.left ?? -1,
            right: rect?.right ?? -1,
            height: rect?.height ?? 0,
            lineHeight: element ? Number.parseFloat(getComputedStyle(element).lineHeight) : 0,
          };
        }),
      };
    });

    expect(metrics.documentOverflow, `${width}px document overflow`).toBeLessThanOrEqual(1);
    expect(metrics.headerOverflow, `${width}px header overflow`).toBeLessThanOrEqual(1);
    expect(metrics.summaryOverflow, `${width}px summary overflow`).toBeLessThanOrEqual(1);
    for (const [index, path] of metrics.cgroups.entries()) {
      expect(path.overflow, `${width}px cgroup ${index} overflow`).toBeLessThanOrEqual(1);
      expect(path.left, `${width}px cgroup ${index} left edge`).toBeGreaterThanOrEqual(-1);
      expect(path.right, `${width}px cgroup ${index} right edge`).toBeLessThanOrEqual(width + 1);
      expect(path.height, `${width}px cgroup ${index} height`).toBeGreaterThan(0);
      if (width <= 390) {
        expect(path.height, `${width}px cgroup ${index} should wrap`).toBeGreaterThan(path.lineHeight);
      }
    }
    await expect(openVps).toBeInViewport();
    await expect(configureRules).toBeInViewport();
  }

  expect(mutations).toEqual([]);
});

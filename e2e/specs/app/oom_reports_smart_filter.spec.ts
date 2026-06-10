import { test, expect } from '../../fixtures/bootstrap';
import { setupHaveApiMock } from '../../fixtures/haveapi';
import { withAppUrl } from '../../fixtures/url';

test.describe('OOM reports - Smart Filter Input', () => {
  test.beforeEach(async ({ page }) => {
    await setupHaveApiMock(page, {
      user: { level: 100 },
      handlers: {
        'GET nodes': async () => {
          return {
            nodes: [
              {
                id: 1,
                domain_name: 'node1.example.test',
                location: { id: 1, label: 'PRG' },
              },
            ],
          };
        },
        'GET environments': async () => {
          return { environments: [{ id: 1, label: 'prod' }] };
        },
        'GET locations': async () => {
          return { locations: [{ id: 1, label: 'PRG' }] };
        },
        'GET oom_reports': async ({ request }) => {
          const limit = Number(request.searchParams.get('oom_report[limit]') ?? '25') || 25;
          const fromIdRaw = request.searchParams.get('oom_report[from_id]');
          const fromId = fromIdRaw ? Number(fromIdRaw) : 0;

          const cgroup = request.searchParams.get('oom_report[cgroup]') ?? 'default-cgroup';

          const start = fromId > 0 ? fromId - 1 : 125;
          const count = Math.min(limit, 25);

          const oom_reports = Array.from({ length: count }, (_, i) => {
            const id = start - i;
            return {
              id,
              created_at: '2025-01-01T00:00:00Z',
              vps: {
                id: 1000 + id,
                hostname: `vps${id}.example.test`,
                user: { id: 2000 + id, login: `user${id}` },
                node: { id: 1, domain_name: 'node1.example.test', location: { id: 1, label: 'PRG' } },
              },
              cgroup,
              killed_name: 'nginx',
              killed_pid: 1234,
              invoked_by_name: 'systemd',
              invoked_by_pid: 1,
              count: 1,
              oom_report_rule: { id: 1, action: 'mail' },
            };
          });

          return { oom_reports, _meta: { total_count: 125 } };
        },
      },
    });
  });

  test('applies cgroup: filter and keeps it on next page', async ({ page }) => {
    await page.goto(withAppUrl('/admin/oom-reports?limit=25'));

    await expect(page.getByTestId('oom.list.row.125')).toBeVisible();
    await expect(page.getByTestId('oom.list.row.125')).toHaveAttribute('data-row-variant', 'warn');
    await expect(page.getByTestId('oom.list.row.125.dot')).toBeVisible();
    await expect(page.getByTestId('oom.list.row.125')).toContainText('default-cgroup');

    const input = page.getByTestId('oom.smart_filter.input');
    await input.fill('cgroup:system.slice');
    await input.press('Enter');

    await expect(page.getByTestId('oom.list.row.125')).toBeVisible();
    await expect(page.getByTestId('oom.list.row.125')).toContainText('system.slice');

    await page.getByTestId('oom.list.pagination.next').click();
    await expect(page.getByTestId('oom.list.row.100')).toBeVisible();
    await expect(page.getByTestId('oom.list.row.100')).toContainText('system.slice');
  });
});

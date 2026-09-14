import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const exactAddress = '2001:db8::125';

function assignmentRow(id: number) {
  return {
    id,
    ip_addr: exactAddress,
    ip_prefix: 128,
    user: { id: 7, login: 'alice' },
    vps: { id: 42, hostname: 'vps-42' },
    from_date: '2026-09-14T00:00:00Z',
    to_date: null,
    reconstructed: false,
  };
}

test('@pr-smoke @pr-smoke-mobile IP address assignment action opens an exact filtered audit', async ({
  page,
}, testInfo) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  const assignmentRequests: Array<{ ipAddr: string | null; q: string | null }> = [];
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET locations': () => ({ locations: [] }),
      'GET ip_addresses': () => ({
        ip_addresses: [{
          id: 125,
          addr: exactAddress,
          prefix: 128,
          routed: true,
          user: { id: 7, login: 'alice' },
          vps: { id: 42, hostname: 'vps-42' },
          network: { id: 3000, address: '2001:db8::', prefix: 64 },
          network_interface: { id: 4000, name: 'eth0' },
          created_at: '2026-09-14T00:00:00Z',
        }],
      }),
      'GET ip_address_assignments': ({ searchParams }) => {
        const request = {
          ipAddr: searchParams.get('ip_address_assignment[ip_addr]'),
          q: searchParams.get('ip_address_assignment[q]'),
        };
        assignmentRequests.push(request);
        return {
          ip_address_assignments: request.ipAddr === exactAddress && request.q === null
            ? [assignmentRow(801)]
            : [],
        };
      },
    },
  });

  await page.goto('/admin/ip-addresses');

  const layout = testInfo.project.name === 'mobile-chrome' ? 'card' : 'row';
  const assignmentsAction = page.getByTestId(`admin.ip_addresses.${layout}.125.action.assignments`);
  await expect(assignmentsAction).toBeVisible();
  await expect(assignmentsAction).toHaveAttribute(
    'href',
    '/admin/networking/ip-address-assignments?ip_addr=2001%3Adb8%3A%3A125'
  );

  await assignmentsAction.click();

  await expect(page).toHaveURL((url) => (
    url.pathname === '/admin/networking/ip-address-assignments'
    && url.searchParams.get('ip_addr') === exactAddress
    && !url.searchParams.has('q')
  ));
  await expect(page.getByTestId('admin.ip_assignments.filter.ip_addr')).toHaveValue(exactAddress);
  await expect(page.getByTestId('admin.ip_assignments.row.801')).toBeVisible();
  await expect.poll(() => assignmentRequests).toEqual([{ ipAddr: exactAddress, q: null }]);
});

test('@pr-smoke legacy assignment q links are canonical before the first list request', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  const assignmentRequests: Array<{
    ipAddr: string | null;
    q: string | null;
    fromId: string | null;
    limit: string | null;
  }> = [];
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET ip_address_assignments': ({ searchParams }) => {
        assignmentRequests.push({
          ipAddr: searchParams.get('ip_address_assignment[ip_addr]'),
          q: searchParams.get('ip_address_assignment[q]'),
          fromId: searchParams.get('ip_address_assignment[from_id]'),
          limit: searchParams.get('ip_address_assignment[limit]'),
        });
        return { ip_address_assignments: [assignmentRow(801)] };
      },
    },
  });

  await page.goto('/admin/networking/live');
  await page.goto(`/admin/networking/ip-address-assignments?q=${encodeURIComponent(exactAddress)}&limit=25&page=2&from_id=802`);

  await expect(page).toHaveURL((url) => (
    url.pathname === '/admin/networking/ip-address-assignments'
    && url.searchParams.get('ip_addr') === exactAddress
    && url.searchParams.get('limit') === '25'
    && url.searchParams.get('page') === '1'
    && !url.searchParams.has('q')
    && !url.searchParams.has('from_id')
  ));
  await expect(page.getByTestId('admin.ip_assignments.row.801')).toBeVisible();
  await expect.poll(() => assignmentRequests).toEqual([{
    ipAddr: exactAddress,
    q: null,
    fromId: null,
    limit: '25',
  }]);

  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/networking\/live$/);
  await page.goForward();
  await expect(page).toHaveURL((url) => (
    url.pathname === '/admin/networking/ip-address-assignments'
    && url.searchParams.get('ip_addr') === exactAddress
    && !url.searchParams.has('q')
  ));
});

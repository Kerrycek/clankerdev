import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock, setUiSettingsLocalStorage } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile admin cluster networks use only exact Network.Index filters', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await setUiSettingsLocalStorage(page, { language: 'en' });

  const requests: Array<{ pageUrl: string; params: URLSearchParams }> = [];

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET locations': () => ({ locations: [{ id: 1, label: 'Prague' }] }),
      'GET networks': ({ searchParams }) => {
        requests.push({ pageUrl: page.url(), params: new URLSearchParams(searchParams) });
        return {
          networks: [
            {
              id: 101,
              label: 'Public Prague',
              ip_version: 4,
              address: '192.0.2.0',
              prefix: 24,
              role: 'public_access',
              managed: true,
              purpose: 'vps',
              size: 254,
              taken: 1,
            },
          ],
        };
      },
    },
  });

  await page.goto(
    '/admin/cluster/networks?q=public&ip_version=4&role=public_access&managed=true&location=1&purpose=vps&limit=25&from_id=99&page=2'
  );

  await expect(page.getByTestId('admin.cluster.networks.page')).toBeVisible();
  await expect(page.getByTestId('admin.cluster.networks.row.101')).toBeVisible();
  await expect.poll(() => requests.length).toBeGreaterThan(0);

  const first = requests[0]!;
  const networkKeys = [...first.params.keys()].filter((key) => key.startsWith('network[')).sort();
  expect(networkKeys).toEqual(
    ['network[limit]', 'network[location]', 'network[purpose]'].sort()
  );
  expect(first.params.get('network[limit]')).toBe('25');
  expect(first.params.get('network[location]')).toBe('1');
  expect(first.params.get('network[purpose]')).toBe('vps');

  expect(new URL(first.pageUrl).searchParams.toString()).toBe('location=1&purpose=vps&limit=25&page=1');
  await expect(page).toHaveURL((url) => url.searchParams.toString() === 'location=1&purpose=vps&limit=25&page=1');

  await page.getByTestId('admin.cluster.networks.advanced.open').click();
  await expect(page.getByTestId('admin.cluster.networks.filter.location')).toBeVisible();
  await expect(page.getByTestId('admin.cluster.networks.filter.purpose')).toBeVisible();
  await expect(page.getByTestId('admin.cluster.networks.filter.q')).toHaveCount(0);
  await expect(page.getByTestId('admin.cluster.networks.filter.ip_version')).toHaveCount(0);
  await expect(page.getByTestId('admin.cluster.networks.filter.role')).toHaveCount(0);
  await expect(page.getByTestId('admin.cluster.networks.filter.managed')).toHaveCount(0);
  await page.getByTestId('drawer.close').click();

  const input = page.getByTestId('admin.cluster.networks.search.input');
  const rapidSubmitBefore = requests.length;
  await input.evaluate((element) => {
    const inputElement = element as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(inputElement, 'managed:true');
    inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await expect(page.getByTestId('admin.cluster.networks.filter.error.0')).toContainText(
    'Network.Index supports only location:, purpose: or a numeric network ID.'
  );
  expect(requests).toHaveLength(rapidSubmitBefore);

  for (const unsupported of ['public', 'role:public_access']) {
    const before = requests.length;
    await input.fill(unsupported);
    await input.press('Enter');
    await expect(page.getByTestId('admin.cluster.networks.filter.error.0')).toContainText(
      'Network.Index supports only location:, purpose: or a numeric network ID.'
    );
    await page.waitForTimeout(200);
    expect(requests).toHaveLength(before);
  }

  expect(
    requests.every(({ params }) =>
      ['q', 'ip_version', 'role', 'managed'].every((key) => !params.has(`network[${key}]`))
    )
  ).toBe(true);
});

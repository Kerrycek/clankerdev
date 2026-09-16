import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const vps = {
  id: 123,
  hostname: 'vps123.example',
  object_state: 'active',
  is_running: true,
  enable_network: true,
  cpus: 2,
  memory: 2048,
  swap: 0,
  diskspace: 20480,
  node: { id: 1, domain_name: 'node1.example' },
  os_template: { label: 'debian' },
  dns_resolver: 'inherit',
};

test('@pr-smoke @pr-smoke-mobile VPS maintenance editors stay usable without horizontal scrolling', async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === 'mobile-chrome') {
    await page.setViewportSize({ width: 320, height: 800 });
  }

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'user', level: 1 },
    handlers: {
      'GET vpses/123': () => ({ vps }),
      'GET ip_addresses': () => ({ ip_addresses: [] }),
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'GET vpses/123/maintenance_windows': () => ({ maintenance_windows: [] }),
      'PUT vpses/123/maintenance_windows/1': () => ({
        maintenance_window: { weekday: 1, is_open: true, opens_at: 135, closes_at: 270 },
      }),
    },
  });

  await page.goto('/app/vps/123/maintenance');
  await expect(page.getByTestId('vps.maintenance.day.1')).toBeVisible();

  const scroller = page.getByTestId('vps.maintenance.card').locator('.overflow-x-auto');
  const scrollMetrics = await scroller.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollLeft: element.scrollLeft,
    scrollWidth: element.scrollWidth,
  }));
  expect(scrollMetrics.scrollLeft).toBe(0);
  expect(scrollMetrics.scrollWidth).toBeLessThanOrEqual(scrollMetrics.clientWidth + 1);

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  for (const control of [
    page.getByTestId('vps.maintenance.day.1.open'),
    page.getByTestId('vps.maintenance.day.1.opens.h'),
    page.getByTestId('vps.maintenance.day.1.closes.h'),
  ]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  }

  await page.getByTestId('vps.maintenance.day.1.open').check();
  await page.getByTestId('vps.maintenance.day.1.opens.h').selectOption('2');
  await page.getByTestId('vps.maintenance.day.1.opens.m').selectOption('15');
  await page.getByTestId('vps.maintenance.day.1.closes.h').selectOption('4');
  await page.getByTestId('vps.maintenance.day.1.closes.m').selectOption('30');

  const requestPromise = page.waitForRequest(
    (request) => request.method() === 'PUT' && request.url().includes('/api/v7.0/vpses/123/maintenance_windows/1')
  );
  await page.getByTestId('vps.maintenance.save').click();

  const request = await requestPromise;
  expect(request.postDataJSON()).toEqual({
    maintenance_window: {
      is_open: true,
      opens_at: 135,
      closes_at: 270,
    },
  });
});

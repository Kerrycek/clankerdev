import { expect, test, type Locator, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

const exportItem = {
  id: 10,
  dataset: { id: 20, name: 'data', full_name: 'tank/user/data' },
  snapshot: null,
  user: { id: 1, login: 'demo' },
  host_ip_address: { id: 5, addr: '198.51.100.10' },
  path: '/tank/user/data',
  all_vps: false,
  rw: true,
  sync: true,
  subtree_check: false,
  root_squash: false,
  threads: 8,
  enabled: true,
  updated_at: '2026-09-16T08:00:00Z',
  created_at: '2026-09-15T08:00:00Z',
};

const host = {
  id: 11,
  ip_address: { id: 9, addr: '203.0.113.11' },
  rw: true,
  sync: true,
  subtree_check: false,
  root_squash: false,
};

async function hostTableLayout(tableCard: Locator) {
  return tableCard.evaluate((card) => {
    const scroller = card.firstElementChild as HTMLElement;
    const table = scroller.querySelector('table') as HTMLTableElement;
    const rect = scroller.getBoundingClientRect();
    return {
      clientWidth: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
      scrollLeft: scroller.scrollLeft,
      left: rect.left,
      right: rect.right,
      tableDisplay: getComputedStyle(table).display,
    };
  });
}

async function expectActionInside(page: Page, action: Locator, tableCard: Locator, minHeight: number) {
  const actionRect = await action.boundingBox();
  const cardRect = await tableCard.boundingBox();
  expect(actionRect).not.toBeNull();
  expect(cardRect).not.toBeNull();
  if (!actionRect || !cardRect) throw new Error('Missing export host action geometry');

  expect(actionRect.x).toBeGreaterThanOrEqual(cardRect.x - 1);
  expect(actionRect.x + actionRect.width).toBeLessThanOrEqual(cardRect.x + cardRect.width + 1);
  expect(actionRect.x + actionRect.width).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth + 1));
  expect(actionRect.height).toBeGreaterThanOrEqual(minHeight);
}

test('@pr-smoke @pr-smoke-mobile export host actions follow the card width without horizontal scrolling', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  const hostMutations: Array<{ method: string; path: string }> = [];

  if (mobile) await page.setViewportSize({ width: 320, height: 740 });

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'demo', level: 1 },
    handlers: {
      'GET exports/10': () => exportItem,
      'GET exports/10/hosts': () => ({ hosts: [host], _meta: { total_count: 1 } }),
      'GET ip_addresses': () => ({ ip_addresses: [host.ip_address], _meta: { total_count: 1 } }),
    },
  });

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname !== '/api/v7.0/exports/10/hosts/11') return;
    if (request.method() === 'GET') return;
    hostMutations.push({ method: request.method(), path: url.pathname });
  });

  await page.goto('/app/exports/10');

  const tableCard = page.getByTestId('exports.detail.hosts.table');
  const row = page.getByTestId('exports.detail.hosts.row.11');
  const edit = page.getByTestId('exports.detail.hosts.row.11.edit');
  const remove = page.getByTestId('exports.detail.hosts.row.11.delete');

  await expect(row).toBeVisible();
  await expect(tableCard.getByRole('table')).toBeVisible();

  async function expectCompactLayout(width: number) {
    await page.setViewportSize({ width, height: 800 });
    await expect.poll(async () => (await hostTableLayout(tableCard)).tableDisplay).toBe('block');
    await row.scrollIntoViewIfNeeded();
    await expectNoDocumentHorizontalOverflow(page);

    const layout = await hostTableLayout(tableCard);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.scrollLeft).toBe(0);
    await expect(row.getByText('Host address', { exact: true })).toBeVisible();
    await expect(row.getByText('Mode', { exact: true })).toBeVisible();
    await expect(row.getByText('State', { exact: true })).toBeVisible();
    await expect(row.getByText('Actions', { exact: true })).toBeVisible();
    await expectActionInside(page, edit, tableCard, 44);
    await expectActionInside(page, remove, tableCard, 44);
  }

  if (mobile) {
    await expectCompactLayout(320);
    await expectCompactLayout(390);
  } else {
    await page.setViewportSize({ width: 1024, height: 800 });
    await expect.poll(async () => (await hostTableLayout(tableCard)).tableDisplay).toBe('table');
    await expect(tableCard.getByRole('columnheader', { name: 'Host address' })).toBeVisible();
    expect((await edit.boundingBox())?.height).toBe(32);
    expect((await remove.boundingBox())?.height).toBe(32);

    const wideProofScreenshot = process.env.E2E_EXPORT_HOST_WIDE_PROOF_SCREENSHOT?.trim();
    if (wideProofScreenshot) await page.screenshot({ path: wideProofScreenshot, fullPage: true });

    // At xl the host card moves into a fixed 360px sidebar, so it must return
    // to the compact layout even though the viewport itself is wide.
    await expectCompactLayout(1280);
  }

  const compactProofScreenshot = process.env.E2E_EXPORT_HOST_COMPACT_PROOF_SCREENSHOT?.trim();
  if (compactProofScreenshot) await page.screenshot({ path: compactProofScreenshot, fullPage: true });

  await edit.click();
  await expect(page.getByTestId('exports.detail.host.editor')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('exports.detail.host.editor')).toHaveCount(0);

  await remove.click();
  await expect(page.getByTestId('exports.detail.host.delete.dialog')).toBeVisible();
  await page.getByTestId('exports.detail.host.delete.dialog.cancel').click();
  await expect(page.getByTestId('exports.detail.host.delete.dialog')).toHaveCount(0);
  expect(hostMutations).toEqual([]);
});

import { expect, test, type Locator, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

const advisory = {
  id: 77,
  state: 'draft',
  name: 'Linux kernel advisory',
  published_at: null,
  created_at: '2026-09-16T08:00:00.000Z',
  en_summary: 'Kernel vulnerability',
  en_description: 'Affects supported compute nodes.',
  en_response: 'Apply the fixed kernel and reboot.',
  cs_summary: 'Zranitelnost kernelu',
  cs_description: 'Tyka se podporovanych vypocetnich nodu.',
  cs_response: 'Nasad opraveny kernel a restartuj.',
};

const outageLink = {
  id: 801,
  security_advisory_id: 77,
  outage_id: 321,
  outage: {
    id: 321,
    begins_at: '2026-09-16T10:00:00.000Z',
    en_summary: 'EmergencyKernelMaintenanceWithAVeryLongSummaryThatMustWrapInsideTheCardWithoutSpaces',
    cs_summary: 'NouzovaUdrzbaKerneluSDlouhymShrnutimKtereSeMusiZalomitVKarteBezMezer',
  },
};

async function tableLayout(table: Locator) {
  return table.evaluate((element) => {
    const scroller = element.parentElement as HTMLElement;
    const rect = scroller.getBoundingClientRect();
    return {
      clientWidth: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
      scrollLeft: scroller.scrollLeft,
      left: rect.left,
      right: rect.right,
      tableDisplay: getComputedStyle(element).display,
      tableMinWidth: Number.parseFloat(getComputedStyle(element).minWidth) || 0,
    };
  });
}

async function expectActionInside(page: Page, action: Locator, tableCard: Locator, minHeight: number) {
  const actionRect = await action.boundingBox();
  const cardRect = await tableCard.boundingBox();
  expect(actionRect).not.toBeNull();
  expect(cardRect).not.toBeNull();
  if (!actionRect || !cardRect) throw new Error('Missing outage action geometry');

  expect(actionRect.x).toBeGreaterThanOrEqual(cardRect.x - 1);
  expect(actionRect.x + actionRect.width).toBeLessThanOrEqual(cardRect.x + cardRect.width + 1);
  expect(actionRect.x + actionRect.width).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth + 1),
  );
  expect(actionRect.height).toBeGreaterThanOrEqual(minHeight);
}

test('@pr-smoke @pr-smoke-mobile security advisory outage unlink stays directly usable on mobile', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  const mutations: Array<{ method: string; path: string }> = [];

  if (mobile) await page.setViewportSize({ width: 320, height: 740 });

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'security-admin', level: 90 },
    handlers: {
      'GET languages': () => ({ languages: [{ id: 1, code: 'en', label: 'English' }] }),
      'GET security_advisories/77': () => ({ security_advisory: advisory }),
      'GET security_advisory_cves': () => ({ security_advisory_cves: [] }),
      'GET nodes': () => ({ nodes: [] }),
      'GET security_advisories/77/node_statuses': () => ({ node_statuses: [] }),
      'GET security_advisory_updates': () => ({ security_advisory_updates: [] }),
      'GET outage_security_advisories': () => ({ outage_security_advisories: [outageLink] }),
    },
  });

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/v7.0/outage_security_advisories')) return;
    if (request.method() === 'GET') return;
    mutations.push({ method: request.method(), path: url.pathname });
  });

  await page.goto('/admin/security-advisories/77?tab=outages');

  const table = page.getByRole('table');
  const tableCard = table.locator('xpath=../..');
  const row = table.getByRole('row').filter({ has: page.getByRole('link', { name: '#321' }) });
  const unlink = row.getByRole('button', { name: 'Unlink' });
  const linkOutage = page.getByRole('button', { name: 'Link outage' });

  await expect(table).toBeVisible();
  await expect(row).toBeVisible();

  async function expectCompactLayout(width: number) {
    await page.setViewportSize({ width, height: 800 });
    await expect.poll(async () => (await tableLayout(table)).tableDisplay).toBe('block');
    await row.scrollIntoViewIfNeeded();
    await expectNoDocumentHorizontalOverflow(page);

    const layout = await tableLayout(table);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.scrollLeft).toBe(0);
    await expect(row.getByText('Outage', { exact: true })).toBeVisible();
    await expect(row.getByText('Begins', { exact: true })).toBeVisible();
    await expect(row.getByText('Summary', { exact: true })).toBeVisible();
    await expect(row.getByText('Actions', { exact: true })).toBeVisible();
    await expect(linkOutage).toBeInViewport();
    expect((await linkOutage.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expectActionInside(page, unlink, tableCard, 44);
  }

  if (mobile) {
    await expectCompactLayout(767);
    await expectCompactLayout(320);
    await expectCompactLayout(390);
  } else {
    await expectCompactLayout(1024);
    await expectCompactLayout(1152);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(async () => (await tableLayout(table)).tableDisplay).toBe('table');
    const wideLayout = await tableLayout(table);
    expect(wideLayout.tableMinWidth).toBeGreaterThanOrEqual(840);
    expect(wideLayout.scrollWidth).toBeLessThanOrEqual(wideLayout.clientWidth + 1);
    expect(wideLayout.scrollLeft).toBe(0);
    await expect(table.getByRole('columnheader', { name: 'Outage' })).toBeVisible();
    expect((await linkOutage.boundingBox())?.height).toBe(36);
    expect((await unlink.boundingBox())?.height).toBe(32);
    expect(await unlink.locator('xpath=..').evaluate((cell) => getComputedStyle(cell).textAlign)).toBe('right');
  }

  const proofScreenshot = process.env.E2E_SECURITY_OUTAGE_ACTION_PROOF_SCREENSHOT?.trim();
  if (proofScreenshot) await page.screenshot({ path: proofScreenshot, fullPage: true });

  await unlink.click();
  await expect(page.getByTestId('admin.security_advisory.outages.unlink')).toBeVisible();
  await page.getByTestId('admin.security_advisory.outages.unlink.cancel').click();
  await expect(page.getByTestId('admin.security_advisory.outages.unlink')).toHaveCount(0);
  expect(mutations).toEqual([]);
});

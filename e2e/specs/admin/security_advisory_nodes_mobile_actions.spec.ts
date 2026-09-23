import { expect, test } from '@playwright/test';

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

const node = {
  id: 10,
  active: true,
  type: 'node',
  domain_name: 'very-long-security-node-name-without-shortcuts.example.test',
};

test('@pr-smoke @pr-smoke-mobile security advisory node actions stay directly usable on mobile', async ({
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
      'GET security_advisory_cves': () => ({
        security_advisory_cves: [{ id: 901, security_advisory_id: 77, cve_id: 'CVE-2026-12345' }],
      }),
      'GET nodes': () => ({ nodes: [node] }),
      'GET security_advisories/77/node_statuses': () => ({
        node_statuses: [
          {
            id: 501,
            security_advisory_id: 77,
            node_id: node.id,
            node,
            state: 'mitigated',
            vulnerable_until: '2026-09-16T09:00:00.000Z',
            mitigated_since: '2026-09-16T10:00:00.000Z',
            note: 'A-very-long-assessment-note-that-must-wrap-within-the-mobile-card-without-hiding-actions',
          },
        ],
      }),
      'GET security_advisory_updates': () => ({ security_advisory_updates: [] }),
      'GET outage_security_advisories': () => ({ outage_security_advisories: [] }),
    },
  });

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.pathname.includes('/security_advisories/77/node_statuses')) return;
    if (request.method() === 'GET') return;
    mutations.push({ method: request.method(), path: url.pathname });
  });

  await page.goto('/admin/security-advisories/77?tab=nodes');

  const panel = page.getByTestId('admin.security_advisories.nodes.panel');
  const tableCard = page.getByTestId('admin.security_advisories.nodes.table');
  const row = page.getByTestId(`admin.security_advisories.nodes.row.${node.id}`);
  const bulk = page.getByTestId('admin.security_advisories.nodes.bulk.open');
  const edit = page.getByTestId(`admin.security_advisories.nodes.row.${node.id}.edit`);
  const remove = page.getByTestId(`admin.security_advisories.nodes.row.${node.id}.delete`);

  await expect(panel).toBeVisible();
  await expect(row).toBeVisible();
  await expect(tableCard.getByRole('table')).toBeVisible();
  await row.scrollIntoViewIfNeeded();
  await expectNoDocumentHorizontalOverflow(page);

  const layout = await tableCard.evaluate((card) => {
    const scroller = card.firstElementChild as HTMLElement;
    const table = scroller.querySelector('table') as HTMLTableElement;
    return {
      clientWidth: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
      scrollLeft: scroller.scrollLeft,
      tableDisplay: getComputedStyle(table).display,
      tableMinWidth: Number.parseFloat(getComputedStyle(table).minWidth) || 0,
    };
  });

  if (mobile) {
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.scrollLeft).toBe(0);
    expect(layout.tableDisplay).toBe('block');
    await expect(row.getByText('Node', { exact: true })).toBeVisible();
    await expect(row.getByText('Actions', { exact: true })).toBeVisible();
    await expect(edit).toBeInViewport();
    await expect(remove).toBeInViewport();
    expect((await bulk.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect((await edit.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect((await remove.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  } else {
    expect(layout.tableDisplay).toBe('table');
    expect(layout.tableMinWidth).toBeGreaterThanOrEqual(840);
    await expect(tableCard.getByRole('columnheader', { name: 'Node' })).toBeVisible();
    expect((await bulk.boundingBox())?.height).toBe(36);
    expect((await edit.boundingBox())?.height).toBe(32);
    expect((await remove.boundingBox())?.height).toBe(32);
  }

  const proofScreenshot = process.env.E2E_SECURITY_NODE_ACTIONS_PROOF_SCREENSHOT?.trim();
  if (proofScreenshot) await page.screenshot({ path: proofScreenshot, fullPage: true });

  await edit.click();
  const editor = page.getByTestId('admin.security_advisories.nodes.editor');
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Cancel' }).click();
  await expect(editor).toHaveCount(0);

  await remove.click();
  await expect(page.getByTestId('admin.security_advisories.nodes.delete')).toBeVisible();
  await page.getByTestId('admin.security_advisories.nodes.delete.cancel').click();
  await expect(page.getByTestId('admin.security_advisories.nodes.delete')).toHaveCount(0);
  expect(mutations).toEqual([]);
});

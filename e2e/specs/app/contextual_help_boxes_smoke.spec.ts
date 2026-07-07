import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock, jsonFulfill } from '../../fixtures';

async function ensureContextualHelpExpanded(page: Page) {
  const toggle = page.getByTestId('contextual.help.toggle');
  await expect(toggle).toBeVisible();

  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}

test('@smoke contextual help renders on the public surface', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  await installHaveApiMock(page, {
    handlers: {
      'GET users/current': () => jsonFulfill(failEnvelope('Unauthorized'), 401),
      'GET cluster/public_stats': () => ({ public_stats: { user_count: 1, vps_count: 1, ipv4_left: 100 } }),
      'GET nodes/public_status': () => ({ nodes: [] }),
      'GET outages': () => ({ outages: [] }),
      'GET news_logs': () => ({ news_logs: [] }),
      'GET help_boxes': ({ searchParams }) => {
        const pageKey = searchParams.get('help_box[page]');
        const actionKey = searchParams.get('help_box[action]');
        const view = searchParams.get('help_box[view]');
        if (pageKey === 'public' && actionKey === 'index' && view === 'true') {
          return { help_boxes: [{ id: 1, page: 'public', action: 'index', order: 10, content: '<p>Public page help</p>' }] };
        }
        return { help_boxes: [] };
      },
    },
  });

  await page.goto('/');
  await expect(page.getByTestId('contextual.help.panel')).toBeVisible();
  await ensureContextualHelpExpanded(page);
  await expect(page.frameLocator('[data-testid="contextual.help.box.1"] iframe').getByText('Public page help')).toBeVisible();
  await expect(page.getByTestId('contextual.help.manage')).toHaveCount(0);
});

test('@smoke contextual help renders on user and admin surfaces', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, {
    sessionToken: 'TEST',
  });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 90 },
    handlers: {
      'GET cluster/full_stats': () => ({ full_stats: { nodes_online: 2, nodes_total: 3, vps_count: 10, users_count: 5, ipv4_total: 100, ipv4_used: 60 } }),
      'GET languages': () => ({ languages: [] }),
      'GET help_boxes': ({ searchParams }) => {
        const pageKey = searchParams.get('help_box[page]');
        const actionKey = searchParams.get('help_box[action]');
        const view = searchParams.get('help_box[view]');
        if (pageKey === 'profile' && actionKey === 'overview' && view === 'true') {
          return { help_boxes: [{ id: 2, page: 'profile', action: 'overview', order: 10, content: '<p>Profile help</p>' }] };
        }
        if (pageKey === 'cluster' && actionKey === 'summary' && view === 'true') {
          return { help_boxes: [{ id: 3, page: 'cluster', action: 'summary', order: 10, content: '<p>Cluster summary help</p>' }] };
        }
        if (pageKey === 'cluster' && actionKey === 'summary') {
          return { help_boxes: [{ id: 3, page: 'cluster', action: 'summary', order: 10, content: '<p>Cluster summary help</p>' }] };
        }
        return { help_boxes: [] };
      },
    },
  });

  await page.goto('/app/profile');
  await expect(page.getByTestId('contextual.help.panel')).toBeVisible();
  await ensureContextualHelpExpanded(page);
  await expect(page.frameLocator('[data-testid="contextual.help.box.2"] iframe').getByText('Profile help')).toBeVisible();
  await expect(page.getByTestId('contextual.help.manage')).toHaveAttribute('href', /\/admin\/content\/help-boxes\?page=profile&action=overview/);

  await page.goto('/admin/cluster/summary');
  await expect(page.getByTestId('contextual.help.panel')).toBeVisible();
  await ensureContextualHelpExpanded(page);
  await expect(page.frameLocator('[data-testid="contextual.help.box.3"] iframe').getByText('Cluster summary help')).toBeVisible();
  await expect(page.getByTestId('contextual.help.manage')).toHaveAttribute('href', /\/admin\/content\/help-boxes\?page=cluster&action=summary/);

  await page.getByTestId('contextual.help.manage').click();
  await expect(page).toHaveURL(/\/admin\/content\/help-boxes\?page=cluster&action=summary/);
  await expect(page.getByTestId('admin.help_boxes.filter.page')).toHaveValue('cluster');
  await expect(page.getByTestId('admin.help_boxes.filter.action')).toHaveValue('summary');
});

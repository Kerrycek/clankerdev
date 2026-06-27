import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

async function installDashboardMock(page: Page, level: number = 1) {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_SESSION' });

  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level },
    handlers: {
      'GET vpses': () => ({
        vpses: [
          { id: 101, hostname: 'alpha', is_running: true, object_state: 'active', user: { id: 10, login: 'alice' } },
          { id: 102, hostname: 'beta', is_running: false, object_state: 'active', user: { id: 10, login: 'alice' } },
        ],
        _meta: { total_count: 2 },
      }),
      'GET datasets': () => ({ datasets: [{ id: 1, user: { id: 10, login: 'alice' } }], _meta: { total_count: 1 } }),
      'GET dns_zones': () => ({ dns_zones: [{ id: 1, name: 'example.test' }], _meta: { total_count: 1 } }),
      'GET transaction_chains': () => ({ transaction_chains: [], _meta: { total_count: 0 } }),
      'GET nodes/public_status': () => ({ nodes: [{ name: 'node1', status: true, location: { label: 'DC1' } }] }),
      'GET outages': () => ({ outages: [] }),
      'GET help_boxes': () => ({ help_boxes: [] }),
    },
  });
}

test('@pr-smoke phase 11: app shell exposes skip link and popover state', async ({ page }) => {
  await installDashboardMock(page, 95);
  await page.goto('/admin');

  await expect(page.getByTestId('shell.main')).toHaveAttribute('id', 'app-main-content');

  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#app-main-content')).toBeFocused();

  const tasksButton = page.getByTestId('tasks.open-button');
  await expect(tasksButton).toHaveAttribute('aria-controls', 'app-tasks-drawer');
  await expect(tasksButton).toHaveAttribute('aria-expanded', 'false');
  await tasksButton.click();
  await expect(tasksButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#app-tasks-drawer')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Filter tasks' })).toBeVisible();
  await page.getByTestId('tasks.close-button').click();
  await expect(page.locator('#app-tasks-drawer')).toBeHidden();
  await expect(tasksButton).toHaveAttribute('aria-expanded', 'false');

  const userMenuButton = page.getByTestId('shell.user-menu-button');
  await expect(userMenuButton).toHaveAttribute('aria-controls', 'shell-user-menu');
  await expect(userMenuButton).toHaveAttribute('aria-expanded', 'false');
  await userMenuButton.click();
  await expect(userMenuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('dialog', { name: 'Account and display settings' })).toBeVisible();
  await expect(page.getByTestId('shell.user-menu.scope.all')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('shell.user-menu.language.en')).toHaveAttribute('aria-label', 'English');
});

test('@pr-smoke-mobile phase 11: mobile public navigation exposes expanded state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_SESSION' });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'test', level: 1 },
    handlers: {
      'GET cluster/public_stats': () => ({ public_stats: { user_count: 12, vps_count: 34, ipv4_left: 200 } }),
      'GET nodes/public_status': () => ({ nodes: [{ name: 'node1', status: true, location: { label: 'DC1' } }] }),
      'GET outages': () => ({ outages: [] }),
      'GET news_logs': () => ({ news_logs: [] }),
      'GET help_boxes': () => ({ help_boxes: [] }),
    },
  });

  await page.goto('/');

  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();

  const menuButton = page.locator('[aria-controls="public-mobile-navigation"]');
  await expect(menuButton).toHaveAttribute('aria-controls', 'public-mobile-navigation');
  await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  await menuButton.click();
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#public-mobile-navigation')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
});

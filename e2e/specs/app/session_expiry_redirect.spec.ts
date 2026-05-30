import { expect, test } from '../../fixtures/playwright';
import { bootstrapVpsAdminWindow } from '../../fixtures/bootstrap';
import { installHaveApiMock, jsonFulfill } from '../../fixtures/haveapi';

test('@smoke expired session redirects to public overview with a clear notice', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'EXPIRED_SESSION' });
  await installHaveApiMock(page, {
    handlers: {
      'GET users/current': () =>
        jsonFulfill({ status: false, message: 'Session expired', response: null }, 401),
      'GET cluster/public_stats': () => ({ public_stats: { user_count: 10, vps_count: 20, ipv4_left: 30 } }),
      'GET nodes/public_status': () => ({ nodes: [] }),
      'GET outages': () => ({ outages: [] }),
      'GET news_logs': () => ({ news_logs: [] }),
      'GET help_boxes': () => ({ help_boxes: [] }),
    },
  });

  await page.goto('/app/vps');

  await expect(page).toHaveURL(/\/\?session=expired$/);
  await expect(page.getByTestId('public.overview.page')).toBeVisible();
  await expect(page.getByTestId('auth.session-expired.notice')).toBeVisible();
  await expect(page.getByText('Your session expired due to inactivity. Please sign in again.')).toBeVisible();
});

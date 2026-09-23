import { expect, test } from '@playwright/test';
import { bootstrapVpsAdminWindow, installHaveApiMock, jsonFulfill, failEnvelope, setUiSettingsLocalStorage } from '../../fixtures';

for (const language of ['cs', 'en'] as const) {
  for (const role of ['member', 'admin'] as const) {
    test(`@pr-smoke @pr-smoke-mobile vpsAdmin leads browser titles for ${role} in ${language}`, async ({ page }) => {
      await setUiSettingsLocalStorage(page, { language });
      await bootstrapVpsAdminWindow(page);
      let hostname = 'title-first.example.test';
      const api = await installHaveApiMock(page, {
        user: { id: 10, login: 'title-test', level: role === 'admin' ? 100 : 10 },
        handlers: {
          'GET vpses': () => ({ vpses: [] }),
          'GET datasets': () => ({ datasets: [] }),
          'GET dns_zones': () => ({ dns_zones: [] }),
          'GET vpses/123': () => ({ vps: {
            id: 123, hostname, user: { id: 10, login: 'title-test' },
            object_state: 'active', is_running: true, cpus: 2, memory: 1024,
            node: { id: 1, domain_name: 'node.example.test' },
          } }),
          'GET cluster/public_stats': () => ({ public_stats: { user_count: 0, vps_count: 0, ipv4_left: 999 } }),
          'GET nodes/public_status': () => ({ nodes: [] }),
          'GET outages': () => ({ outages: [] }),
          'GET news_logs': () => ({ news_logs: [] }),
          'GET help_boxes': () => ({ help_boxes: [] }),
        },
      });
      const base = role === 'admin' ? '/admin' : '/app';
      const scope = role === 'admin'
        ? (language === 'cs' ? 'Všechny objekty' : 'All objects')
        : (language === 'cs' ? 'Moje' : 'Mine');
      const dashboard = language === 'cs' ? 'Přehled' : 'Dashboard';
      await page.goto(base);
      await expect(page).toHaveTitle(`vpsAdmin · ${dashboard} · ${scope}`);

      await page.goto(`${base}/vps/123`);
      await expect(page.getByTestId('vps.header')).toBeVisible();
      await expect(page).toHaveTitle(new RegExp(`^vpsAdmin · .*title-first\\.example\\.test.* · ${scope}$`));
      hostname = 'title-refreshed.example.test';
      await page.reload();
      await expect(page).toHaveTitle(new RegExp(`^vpsAdmin · .*title-refreshed\\.example\\.test.* · ${scope}$`));

      api.addHandler('GET users/current', () => jsonFulfill(failEnvelope('Unauthorized'), 401));
      await page.goto('/');
      await expect(page.getByTestId('public.overview.page')).toBeVisible();
      await expect(page).toHaveTitle(new RegExp(`^vpsAdmin · ${language === 'cs' ? 'Stav služby' : 'Status'}(?: · .+)?$`));
      expect((await page.title()).match(/vpsAdmin/g)).toHaveLength(1);
    });
  }
}

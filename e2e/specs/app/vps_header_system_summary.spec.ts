import { expect, test } from '@playwright/test';
import { bootstrapVpsAdminWindow, installHaveApiMock, setUiSettingsLocalStorage } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

for (const language of ['cs', 'en'] as const) {
  for (const mode of ['admin', 'app'] as const) {
    test(`@pr-smoke @pr-smoke-mobile VPS system summary in ${language} for ${mode}`, async ({ page }, testInfo) => {
      await setUiSettingsLocalStorage(page, { language });
      await bootstrapVpsAdminWindow(page);
      const vps = {
        id: 123, hostname: 'vps123.example.test', object_state: 'active', is_running: true,
        cpu: 2, memory: 2048, swap: 0, diskspace: 20480, used_memory: 768, used_diskspace: 5120,
        uptime: 3026523, loadavg1: 0.06, loadavg5: 0.04, loadavg15: 0, process_count: 64, cpu_idle: 99.87,
        dataset: { id: 10, name: 'tank/data' },
        os_template: { id: 6, label: 'Debian 12' }, user: { id: 10, login: 'alice' },
        node: { id: 1, domain_name: 'node1.example.test', location: { id: 2, label: 'Praha', remote_console_server: '/_console' } },
      };
      await installHaveApiMock(page, {
        user: { id: 10, login: 'alice', level: mode === 'admin' ? 100 : 1 },
        handlers: {
          'GET vpses/123': () => ({ vps }),
          'GET ip_addresses': () => ({ ip_addresses: [{ id: 1, addr: '203.0.113.42', prefix: 32, network: { id: 1, role: 'public' } }] }),
          'GET datasets/10': () => ({ dataset: { id: 10, name: 'tank/data', refquota: 20480 } }),
          'GET vpses/123/statuses': () => ({ statuses: [] }),
        },
      });
      await page.goto(`/${mode}/vps/123`);
      const header = page.getByTestId('vps.header');
      await expect(header.getByTestId('vps.header.distribution')).toContainText('Debian 12');
      await expect(header.getByTestId('vps.header.runtime.uptime').locator('dd')).toHaveText('35d 0h');
      await expect(header.getByTestId('vps.header.runtime.load').locator('dd')).toHaveText('0.06 / 0.04 / 0.00');
      await expect(header.getByTestId('vps.header.runtime.processes').locator('dd')).toHaveText('64');
      await expect(header.getByTestId('vps.header.runtime.cpu').locator('dd')).toHaveText('0.13 %');
      const headerBox = await header.boundingBox();
      const runtimeBox = await header.getByTestId('vps.header.runtime').boundingBox();
      expect(runtimeBox!.width).toBeGreaterThan(headerBox!.width * 0.85);
      const uptimeBox = await header.getByTestId('vps.header.runtime.uptime').boundingBox();
      const loadBox = await header.getByTestId('vps.header.runtime.load').boundingBox();
      const cpuBox = await header.getByTestId('vps.header.runtime.cpu').boundingBox();
      expect(Math.abs(uptimeBox!.y - loadBox!.y)).toBeLessThan(1);
      if (page.viewportSize()!.width >= 640) {
        expect(Math.abs(uptimeBox!.y - cpuBox!.y)).toBeLessThan(1);
      } else {
        expect(cpuBox!.y).toBeGreaterThan(uptimeBox!.y + uptimeBox!.height);
      }
      await expectNoDocumentHorizontalOverflow(page);
      await header.screenshot({ path: testInfo.outputPath(`vps-header-${language}-${mode}.png`) });

      // Metadata stays available after stopping; old live values must not.
      vps.is_running = false;
      await page.reload();
      await expect(header.getByTestId('vps.header.distribution')).toContainText('Debian 12');
      for (const key of ['uptime', 'load', 'processes', 'cpu']) {
        await expect(header.getByTestId(`vps.header.runtime.${key}`).locator('dd')).toHaveText('—');
      }

      vps.os_template.label = 'CustomDistributionWithAnUnusuallyLongUnbrokenVersionLabel'.repeat(4);
      await page.reload();
      await expect(header.getByTestId('vps.header.distribution')).toContainText(vps.os_template.label);
      await expectNoDocumentHorizontalOverflow(page);
    });
  }
}

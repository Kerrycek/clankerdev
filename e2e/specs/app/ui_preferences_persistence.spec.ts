import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock, jsonFulfill } from '../../fixtures';

interface MockSetting {
  id: number;
  namespace: string;
  key: string;
  value: string;
}

const SETTINGS_NAMESPACE = 'ui';
const SETTINGS_KEY = 'settings';

function serverUiSettingsConfig() {
  return {
    uiSettings: {
      persistence: 'server',
      server: {
        path: '/webui_user_settings',
        namespace: SETTINGS_NAMESPACE,
        field: SETTINGS_KEY,
      },
    },
  };
}

function encodeSettings(settings: Record<string, unknown>): string {
  return JSON.stringify(settings);
}

test('authenticated UI preferences load from and save to webui_user_settings', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, {
    sessionToken: 'TEST_USER_SESSION',
    webuiNext: serverUiSettingsConfig(),
  });

  let storedSetting: MockSetting = {
    id: 1,
    namespace: SETTINGS_NAMESPACE,
    key: SETTINGS_KEY,
    value: encodeSettings({
      sidebarCollapsed: false,
      theme: 'dark',
      language: 'system',
      tips: {
        sidebarTimeZone: 'visible',
      },
    }),
  };

  const writes: unknown[] = [];

  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET webui_user_settings': () => ({ webui_user_settings: [storedSetting] }),
      'PUT webui_user_settings': ({ reqJson }) => {
        writes.push(reqJson);
        const payload = (reqJson as any).webui_user_setting;
        storedSetting = {
          id: storedSetting.id,
          namespace: payload.namespace,
          key: payload.key,
          value: payload.value,
        };
        return { webui_user_setting: storedSetting };
      },
      'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
    },
  });

  await page.goto('/app/vps');

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', { name: /collapse sidebar|sbalit panel/i })).toBeVisible();

  await page.getByTestId('shell.user-menu-button').click();
  await page.getByTestId('shell.user-menu.theme.light').click();
  await page.getByRole('button', { name: /collapse sidebar|sbalit panel/i }).click();

  await expect.poll(() => writes.length).toBeGreaterThanOrEqual(1);

  const savedPayload = JSON.parse(storedSetting.value);
  expect(savedPayload.theme).toBe('light');
  expect(savedPayload.sidebarCollapsed).toBe(true);
  expect(storedSetting.namespace).toBe(SETTINGS_NAMESPACE);
  expect(storedSetting.key).toBe(SETTINGS_KEY);

  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: /expand sidebar|rozbalit panel/i })).toBeVisible();
});

test('public pages do not call webui_user_settings', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, {
    sessionToken: 'TEST_USER_SESSION',
    webuiNext: serverUiSettingsConfig(),
  });

  let settingsCalls = 0;

  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET users/current': () => jsonFulfill(failEnvelope('Unauthorized'), 401),
      'GET webui_user_settings': () => {
        settingsCalls += 1;
        return { webui_user_settings: [] };
      },
      'GET cluster/public_stats': () => ({ public_stats: { user_count: 0, vps_count: 0, ipv4_left: 999 } }),
      'GET nodes/public_status': () => ({ nodes: [] }),
      'GET outages': () => ({ outages: [] }),
      'GET news_logs': () => ({ news_logs: [] }),
      'GET help_boxes': () => ({ help_boxes: [] }),
    },
  });

  await page.goto('/');
  await expect(page.getByTestId('public.overview.page')).toBeVisible();

  expect(settingsCalls).toBe(0);
});

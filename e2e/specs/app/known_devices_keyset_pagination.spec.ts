import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

interface KnownDeviceRequest {
  fromId: number | null;
  limit: number;
  userId: number;
}

function makeKnownDevice(id: number) {
  return {
    id,
    api_ip_addr: `198.51.100.${id}`,
    api_ip_ptr: `api-${id}.example`,
    client_ip_addr: `203.0.113.${id}`,
    client_ip_ptr: `client-${id}.example`,
    user_agent: `Mozilla/5.0 (X11; Linux x86_64) Firefox/${100 + id}.0`,
    last_seen_at: '2026-09-15T01:00:00Z',
    created_at: '2026-09-01T01:00:00Z',
    updated_at: '2026-09-15T01:00:00Z',
  };
}

async function setupKnownDevicesApi(
  page: Page,
  options: {
    targetUserId: number;
    deviceCount: number;
    admin?: boolean;
  }
) {
  const currentUser = options.admin
    ? { id: 1, login: 'admin', level: 100 }
    : { id: options.targetUserId, login: 'member', level: 1 };
  const targetUser = {
    id: options.targetUserId,
    login: options.admin ? 'inspected-member' : currentUser.login,
    level: 1,
    enable_multi_factor_auth: false,
  };
  const devices = Array.from({ length: options.deviceCount }, (_, index) => makeKnownDevice(index + 1));
  const activeIds = new Set(devices.map((device) => device.id));
  const requests: KnownDeviceRequest[] = [];
  const deletedIds: number[] = [];
  let delayedPanelRequest: Promise<void> | null = null;

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  const haveApi = await installHaveApiMock(page, {
    user: currentUser,
    handlers: {
      [`GET users/${options.targetUserId}`]: () => ({ user: targetUser }),
      [`GET users/${options.targetUserId}/totp_devices`]: () => ({ totp_devices: [] }),
      [`GET users/${options.targetUserId}/webauthn_credentials`]: () => ({ webauthn_credentials: [] }),
      [`GET users/${options.targetUserId}/known_devices`]: async ({ searchParams }) => {
        const fromIdRaw = searchParams.get('known_device[from_id]');
        const limitRaw = searchParams.get('known_device[limit]');
        const fromId = fromIdRaw === null ? null : Number(fromIdRaw);
        const limit = limitRaw === null ? 25 : Number(limitRaw);
        const activeDevices = devices.filter((device) => activeIds.has(device.id));
        const pageDevices = activeDevices
          .filter((device) => fromId === null || device.id > fromId)
          .slice(0, limit);

        requests.push({ fromId, limit, userId: options.targetUserId });
        if (limit === 26 && delayedPanelRequest) {
          const delayed = delayedPanelRequest;
          delayedPanelRequest = null;
          await delayed;
        }
        return {
          known_devices: pageDevices,
          _meta: { total_count: activeDevices.length },
        };
      },
    },
  });

  for (const device of devices) {
    haveApi.addHandler(`DELETE users/${options.targetUserId}/known_devices/${device.id}`, () => {
      activeIds.delete(device.id);
      deletedIds.push(device.id);
      return { ok: true };
    });
  }

  return {
    deletedIds,
    clearRequests() {
      requests.length = 0;
    },
    panelRequests() {
      return requests.filter((request) => request.limit === 26);
    },
    pauseNextPanelRequest() {
      let release = () => {};
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      delayedPanelRequest = promise;
      return release;
    },
  };
}

function visibleDevice(page: Page, testInfo: TestInfo, prefix: string, id: number) {
  const testId = `${prefix}.known_devices.row.${id}`;
  if (testInfo.project.name === 'mobile-chrome') {
    return page.locator(`[data-testid="${testId}"]:visible`);
  }
  return page.getByTestId(`${prefix}.known_devices.table`).getByTestId(testId);
}

async function expectResponsiveDeviceList(page: Page, testInfo: TestInfo, prefix: string) {
  const table = page.getByTestId(`${prefix}.known_devices.table`);
  if (testInfo.project.name === 'mobile-chrome') {
    await expect(table).toBeHidden();
  } else {
    await expect(table).toBeVisible();
  }
  await expectNoDocumentHorizontalOverflow(page);
}

async function forgetDevice(page: Page, prefix: string, id: number) {
  await page.locator(`[data-testid="${prefix}.known_devices.forget.${id}"]:visible`).click();
  await expect(page.getByTestId(`${prefix}.known_devices.forget.confirm`)).toBeVisible();
  await page.getByTestId(`${prefix}.known_devices.forget.confirm.confirm`).click();
  await expect(page.getByTestId(`${prefix}.known_devices.forget.confirm`)).toHaveCount(0);
}

test.describe('@smoke known-device keyset pagination', () => {
  test('@pr-smoke @pr-smoke-mobile member pages forward without repeats and rebuilds a visited edge after forgetting a device', async ({
    page,
  }, testInfo) => {
    const api = await setupKnownDevicesApi(page, { targetUserId: 1, deviceCount: 51 });
    const prefix = 'profile.mfa';
    const pagination = `${prefix}.known_devices.pagination`;

    await page.goto('/app/profile/mfa?limit=25');

    await expect(visibleDevice(page, testInfo, prefix, 1)).toBeVisible();
    await expect(visibleDevice(page, testInfo, prefix, 25)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.known_devices.row.26`)).toHaveCount(0);
    await expect(page.getByTestId(`${pagination}.next`)).toBeEnabled();
    await expectResponsiveDeviceList(page, testInfo, prefix);
    await expect.poll(() => api.panelRequests()[0]).toEqual({ fromId: null, limit: 26, userId: 1 });

    await page.getByTestId(`${pagination}.next`).click();

    await expect(page).toHaveURL(/from_id=25/);
    await expect(visibleDevice(page, testInfo, prefix, 26)).toBeVisible();
    await expect(visibleDevice(page, testInfo, prefix, 50)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.known_devices.row.25`)).toHaveCount(0);
    await expect(page.getByTestId(`${prefix}.known_devices.row.51`)).toHaveCount(0);
    await expect.poll(() => api.panelRequests().at(-1)?.fromId).toBe(25);

    await page.getByTestId(`${pagination}.next`).click();

    await expect(page).toHaveURL(/from_id=50/);
    await expect(visibleDevice(page, testInfo, prefix, 51)).toBeVisible();
    await expect(page.getByTestId(`${pagination}.next`)).toBeDisabled();

    await page.getByTestId(`${pagination}.prev`).click();
    await expect(page).toHaveURL(/from_id=25/);
    await expect(visibleDevice(page, testInfo, prefix, 26)).toBeVisible();
    await page.getByTestId(`${pagination}.prev`).click();
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(visibleDevice(page, testInfo, prefix, 25)).toBeVisible();

    const releaseRefresh = api.pauseNextPanelRequest();
    api.clearRequests();
    await page.getByTestId(`${prefix}.known_devices.refresh`).click();
    await expect.poll(() => api.panelRequests().length).toBe(1);
    await expect(page.getByTestId(`${pagination}.page.2`)).toBeVisible();
    await expect(page.getByTestId(`${pagination}.page.2`)).toBeDisabled();
    await expect(page.getByTestId(`${pagination}.next`)).toBeDisabled();
    releaseRefresh();
    await expect(page.getByTestId(`${pagination}.next`)).toBeEnabled();

    await forgetDevice(page, prefix, 25);

    await expect.poll(() => api.deletedIds).toEqual([25]);
    await expect(page.getByTestId(`${prefix}.known_devices.row.25`)).toHaveCount(0);
    await expect(visibleDevice(page, testInfo, prefix, 26)).toBeVisible();
    await expect(page.getByTestId(`${pagination}.next`)).toBeEnabled();

    await page.getByTestId(`${pagination}.page.2`).click();

    await expect(page).toHaveURL(/from_id=26/);
    await expect(page).not.toHaveURL(/from_id=25/);
    await expect(visibleDevice(page, testInfo, prefix, 27)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.known_devices.row.26`)).toHaveCount(0);
    await expect.poll(() => api.panelRequests().at(-1)?.fromId).toBe(26);
  });

  test('@pr-smoke @pr-smoke-mobile changing the local device search resets a deep cursor before refetch', async ({
    page,
  }, testInfo) => {
    const api = await setupKnownDevicesApi(page, { targetUserId: 1, deviceCount: 51 });
    const prefix = 'profile.mfa';

    await page.goto('/app/profile/mfa?limit=25&page=2&from_id=25');

    await expect(visibleDevice(page, testInfo, prefix, 26)).toBeVisible();
    api.clearRequests();
    await page.getByTestId(`${prefix}.known_devices.search`).fill('client-1.example');

    await expect(page).toHaveURL(/q=client-1.example/);
    await expect(page).toHaveURL(/page=1/);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(visibleDevice(page, testInfo, prefix, 1)).toBeVisible();
    await expect.poll(() => api.panelRequests()[0]?.fromId).toBeNull();

    await page.evaluate(() => {
      window.history.pushState({}, '', '/app/profile/mfa?limit=25&page=2&from_id=25&q=client');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await expect(page).toHaveURL(/from_id=25/);
    await expect(page.getByTestId(`${prefix}.known_devices.search`)).toHaveValue('client');
    await expect(visibleDevice(page, testInfo, prefix, 26)).toBeVisible();

    await page.goBack();

    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId(`${prefix}.known_devices.search`)).toHaveValue('client-1.example');
    await expect(visibleDevice(page, testInfo, prefix, 1)).toBeVisible();

    await page.goForward();

    await expect(page).toHaveURL(/from_id=25/);
    await expect(page.getByTestId(`${prefix}.known_devices.search`)).toHaveValue('client');
    await expect(visibleDevice(page, testInfo, prefix, 26)).toBeVisible();
  });

  test('@pr-smoke @pr-smoke-mobile admin exact terminal page drops a stale forward edge after forgetting its last device', async ({
    page,
  }, testInfo) => {
    const api = await setupKnownDevicesApi(page, { targetUserId: 42, deviceCount: 26, admin: true });
    const prefix = 'admin.user.mfa';
    const pagination = `${prefix}.known_devices.pagination`;

    await page.goto('/admin/users/42/mfa?limit=25');

    await expect(visibleDevice(page, testInfo, prefix, 1)).toBeVisible();
    await expect(visibleDevice(page, testInfo, prefix, 25)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.known_devices.row.26`)).toHaveCount(0);
    await expect(page.getByTestId(`${pagination}.next`)).toBeEnabled();
    await expectResponsiveDeviceList(page, testInfo, prefix);
    await expect.poll(() => api.panelRequests()[0]).toEqual({ fromId: null, limit: 26, userId: 42 });

    await page.getByTestId(`${pagination}.next`).click();

    await expect(page).toHaveURL(/from_id=25/);
    await expect(visibleDevice(page, testInfo, prefix, 26)).toBeVisible();
    await expect(page.getByTestId(`${pagination}.next`)).toBeDisabled();

    await forgetDevice(page, prefix, 26);

    await expect.poll(() => api.deletedIds).toEqual([26]);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(visibleDevice(page, testInfo, prefix, 1)).toBeVisible();
    await expect(visibleDevice(page, testInfo, prefix, 25)).toBeVisible();
    await expect(page.getByTestId(`${pagination}.next`)).toBeDisabled();
    await expect(page.getByTestId(`${pagination}.page.2`)).toHaveCount(0);
    await expect.poll(() => api.panelRequests().at(-1)).toEqual({ fromId: null, limit: 26, userId: 42 });

    await page.goBack();
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId(`${prefix}.known_devices.empty`)).toHaveCount(0);
    await expect(visibleDevice(page, testInfo, prefix, 1)).toBeVisible();

    await page.goForward();
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId(`${prefix}.known_devices.empty`)).toHaveCount(0);
    await expect(visibleDevice(page, testInfo, prefix, 25)).toBeVisible();
  });
});

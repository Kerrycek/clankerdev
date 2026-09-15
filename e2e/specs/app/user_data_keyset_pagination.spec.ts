import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import {
  expectNoDocumentHorizontalOverflow,
  expectTableHorizontalScrollUsable,
} from '../../helpers/horizontalOverflow';

interface UserDataRequest {
  format: string | null;
  fromId: number | null;
  hasUnsupportedQ: boolean;
  limit: number;
  userId: number | null;
}

interface UserDataTemplate {
  id: number;
  userId: number;
  label: string;
  format: string;
  content: string;
  created_at: string;
  updated_at: string;
}

function makeTemplate(id: number, userId: number): UserDataTemplate {
  return {
    id,
    userId,
    label: id === 51 ? 'Late provisioning match' : `Template ${id}`,
    format: id % 2 === 0 ? 'script' : 'cloudinit_config',
    content: id % 2 === 0 ? '#!/bin/sh\necho ok\n' : '#cloud-config\n',
    created_at: '2026-09-15T01:00:00Z',
    updated_at: '2026-09-15T01:00:00Z',
  };
}

async function setupUserDataApi(
  page: Page,
  options: { admin?: boolean; targetUserId: number; templateCount: number }
) {
  const currentUser = options.admin
    ? { id: 1, login: 'admin', level: 100 }
    : { id: options.targetUserId, login: 'member', level: 1 };
  let templates = Array.from(
    { length: options.templateCount },
    (_, index) => makeTemplate(index + 1, options.targetUserId)
  );
  if (options.admin) {
    templates.push(...Array.from({ length: 12 }, (_, index) => makeTemplate(1001 + index, 99)));
  }

  const requests: UserDataRequest[] = [];
  const deletedIds: number[] = [];

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  const haveApi = await installHaveApiMock(page, {
    user: currentUser,
    handlers: {
      [`GET users/${options.targetUserId}`]: () => ({
        user: {
          id: options.targetUserId,
          login: options.admin ? 'inspected-member' : currentUser.login,
          level: 1,
          full_name: 'Inspected Member',
        },
      }),
      'GET vps_user_data': ({ searchParams }) => {
        const unsupportedQ = searchParams.get('vps_user_data[q]');
        const fromIdRaw = searchParams.get('vps_user_data[from_id]');
        const limitRaw = searchParams.get('vps_user_data[limit]');
        const userRaw = searchParams.get('vps_user_data[user]');
        const format = searchParams.get('vps_user_data[format]');
        const fromId = fromIdRaw === null ? null : Number(fromIdRaw);
        const limit = limitRaw === null ? 50 : Number(limitRaw);
        const userId = userRaw === null ? null : Number(userRaw);

        requests.push({
          format,
          fromId,
          hasUnsupportedQ: unsupportedQ !== null,
          limit,
          userId,
        });

        if (unsupportedQ !== null) {
          return {
            status: false,
            message: 'Unsupported input vps_user_data[q]',
            response: null,
          };
        }

        let result = templates.filter((template) =>
          options.admin
            ? userId === null || template.userId === userId
            : template.userId === options.targetUserId
        );
        if (format) result = result.filter((template) => template.format === format);
        const scopedResult = result
          .filter((template) => fromId === null || template.id > fromId)
          .sort((a, b) => a.id - b.id);
        const pageResult = scopedResult.slice(0, limit);

        return {
          vps_user_data: pageResult.map(({ userId: _userId, ...template }) => template),
          _meta: { total_count: scopedResult.length },
        };
      },
    },
  });

  for (const template of templates) {
    haveApi.addHandler(`DELETE vps_user_data/${template.id}`, () => {
      templates = templates.filter((candidate) => candidate.id !== template.id);
      deletedIds.push(template.id);
      return null;
    });
  }

  return {
    deletedIds,
    clearRequests() {
      requests.length = 0;
    },
    requests() {
      return [...requests];
    },
  };
}

async function expectResponsiveUserDataTable(page: Page, testInfo: TestInfo, prefix: string) {
  await expect(page.getByTestId(`${prefix}.table`)).toBeVisible();
  await expectNoDocumentHorizontalOverflow(page);
  if (testInfo.project.name === 'mobile-chrome') {
    await expectTableHorizontalScrollUsable(page, `${prefix}.table.element`);
  }
}

test.describe('@smoke user-data keyset pagination', () => {
  test('@pr-smoke @pr-smoke-mobile member pages without repeats, searches without q, and restores URL history', async ({
    page,
  }, testInfo) => {
    const api = await setupUserDataApi(page, { targetUserId: 1, templateCount: 52 });
    const prefix = 'profile.user_data';
    const pagination = `${prefix}.pagination`;

    await page.goto('/app/profile/user-data?limit=25');

    await expect(page.getByTestId(`${prefix}.row.1`)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.row.25`)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.row.26`)).toHaveCount(0);
    await expect(page.getByTestId(`${pagination}.next`)).toBeEnabled();
    await expectResponsiveUserDataTable(page, testInfo, prefix);
    await expect.poll(() => api.requests()[0]).toEqual({
      format: null,
      fromId: null,
      hasUnsupportedQ: false,
      limit: 26,
      userId: null,
    });

    await page.getByTestId(`${pagination}.next`).click();

    await expect(page).toHaveURL(/from_id=25/);
    await expect(page.getByTestId(`${prefix}.row.26`)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.row.50`)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.row.25`)).toHaveCount(0);
    await expect(page.getByTestId(`${prefix}.row.51`)).toHaveCount(0);

    await page.getByTestId(`${pagination}.next`).click();

    await expect(page).toHaveURL(/from_id=50/);
    await expect(page.getByTestId(`${prefix}.row.51`)).toBeVisible();
    await expect(page.getByTestId(`${pagination}.next`)).toBeDisabled();
    await expect(page.getByTestId(`${pagination}.page.3`)).toHaveAttribute('aria-label', /3/);

    await page.getByTestId(`${pagination}.prev`).click();
    await expect(page).toHaveURL(/from_id=25/);
    await expect(page.getByTestId(`${prefix}.row.26`)).toBeVisible();

    api.clearRequests();
    await page.getByTestId(`${prefix}.row.50.delete`).click();
    await expect(page.getByTestId(`${prefix}.delete.confirm`)).toBeVisible();
    await page.getByTestId(`${prefix}.delete.confirm.confirm`).click();

    await expect.poll(() => api.deletedIds).toEqual([50]);
    await expect(page.getByTestId(`${prefix}.row.51`)).toBeVisible();
    await page.getByTestId(`${pagination}.next`).click();
    await expect(page).toHaveURL(/from_id=51/);
    await expect(page.getByTestId(`${prefix}.row.52`)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.row.51`)).toHaveCount(0);
    await expect(page.getByTestId(`${pagination}.next`)).toBeDisabled();
    await expect.poll(() => api.requests().at(-1)?.fromId).toBe(51);

    await page.getByTestId(`${pagination}.prev`).click();
    await expect(page).toHaveURL(/from_id=25/);
    await expect(page.getByTestId(`${prefix}.row.51`)).toBeVisible();

    api.clearRequests();
    const search = page.getByTestId(`${prefix}.filters.q`);
    await search.fill('provisioning');
    await search.press('Enter');

    await expect(page).toHaveURL(/q=provisioning/);
    await expect(page).toHaveURL(/page=1/);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId(`${prefix}.row.51`)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.row.1`)).toHaveCount(0);
    await expect(page.getByTestId(`${pagination}.next`)).toBeDisabled();
    await expect.poll(() => api.requests()).toEqual([
      {
        format: null,
        fromId: null,
        hasUnsupportedQ: false,
        limit: 100,
        userId: null,
      },
    ]);

    await page.evaluate(() => {
      window.history.pushState({}, '', '/app/profile/user-data?limit=25&page=2&from_id=25');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page.getByTestId(`${prefix}.row.26`)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.filters.chips`)).toHaveCount(0);

    await page.goBack();
    await expect(page).toHaveURL(/q=provisioning/);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId(`${prefix}.row.51`)).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/from_id=25/);
    await expect(page.getByTestId(`${prefix}.row.26`)).toBeVisible();
    expect(api.requests().every((request) => !request.hasUnsupportedQ)).toBe(true);
  });

  test('@pr-smoke @pr-smoke-mobile admin scope detects the terminal page and recovers after deleting its final row', async ({
    page,
  }, testInfo) => {
    const api = await setupUserDataApi(page, { admin: true, targetUserId: 42, templateCount: 26 });
    const prefix = 'admin.user.user_data';
    const pagination = `${prefix}.pagination`;

    await page.goto('/admin/users/42/user-data?limit=25');

    await expect(page.getByTestId(`${prefix}.row.1`)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.row.25`)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.row.26`)).toHaveCount(0);
    await expect(page.getByTestId(`${pagination}.next`)).toBeEnabled();
    await expectResponsiveUserDataTable(page, testInfo, prefix);
    await expect.poll(() => api.requests()[0]?.userId).toBe(42);

    await page.getByTestId(`${pagination}.next`).click();

    await expect(page).toHaveURL(/from_id=25/);
    await expect(page.getByTestId(`${prefix}.row.26`)).toBeVisible();
    await expect(page.getByTestId(`${pagination}.next`)).toBeDisabled();
    expect(api.requests().every((request) => request.userId === 42)).toBe(true);

    api.clearRequests();
    await page.getByTestId(`${prefix}.row.26.delete`).click();
    await expect(page.getByTestId(`${prefix}.delete.confirm`)).toBeVisible();
    await page.getByTestId(`${prefix}.delete.confirm.confirm`).click();

    await expect.poll(() => api.deletedIds).toEqual([26]);
    await expect(page).not.toHaveURL(/from_id=/);
    await expect(page.getByTestId(`${prefix}.row.1`)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.row.25`)).toBeVisible();
    await expect(page.getByTestId(`${prefix}.row.26`)).toHaveCount(0);
    await expect(page.getByTestId(`${pagination}.next`)).toBeDisabled();
    await expect(page.getByTestId(`${pagination}.page.2`)).toHaveCount(0);
    await expect.poll(() => api.requests().at(-1)).toEqual({
      format: null,
      fromId: null,
      hasUnsupportedQ: false,
      limit: 26,
      userId: 42,
    });
    expect(api.requests().every((request) => request.userId === 42)).toBe(true);
  });
});

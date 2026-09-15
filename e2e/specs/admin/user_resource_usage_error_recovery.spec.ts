import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile resource usage failures stay distinct from empty results and retry in place', async ({
  page,
}) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  let adminCalls = 0;
  let profileCalls = 0;
  let allowAdminSuccess = false;
  let allowProfileSuccess = false;

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users/53': () => ({ user: { id: 53, login: 'kavman', level: 1 } }),
      'GET users/53/cluster_resources': () => {
        adminCalls += 1;
        if (!allowAdminSuccess) return failEnvelope('Resource usage unavailable');
        return {
          cluster_resources: [
            {
              id: 31,
              environment: { id: 7, label: 'Production' },
              cluster_resource: { id: 2, name: 'cpu', label: 'CPU' },
              value: 4,
              used: 2,
              free: 2,
            },
          ],
        };
      },
      'GET users/1/cluster_resources': () => {
        profileCalls += 1;
        if (!allowProfileSuccess) return failEnvelope('Resource usage unavailable');
        return {
          cluster_resources: [
            {
              id: 32,
              environment: { id: 8, label: 'Personal' },
              cluster_resource: { id: 2, name: 'cpu', label: 'CPU' },
              value: 2,
              used: 1,
              free: 1,
            },
          ],
        };
      },
    },
  });

  await page.goto('/admin/users/53/resources/usage');

  const adminError = page.getByTestId('admin.user.resource_usage.resources.error');
  await expect(adminError).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('admin.user.resource_usage.resources.empty')).toHaveCount(0);
  await expect(page.getByText(/No resources|Žádné prostředky/)).toHaveCount(0);
  await expect(page.getByTestId('admin.user.resource_usage.resources.error.back')).toHaveCount(0);
  await expect(page.getByTestId('admin.user.resource_usage.resources.error.status')).toHaveCount(0);

  await page.evaluate(() => {
    document.documentElement.dataset.resourceUsageMarker = 'admin-preserved';
  });
  const adminUrl = page.url();
  const adminCallsBeforeRetry = adminCalls;
  allowAdminSuccess = true;
  await page.getByTestId('admin.user.resource_usage.resources.error.retry').click();

  await expect(page.getByTestId('admin.user.resource_usage.resources.environment.7.resource.31')).toContainText('CPU');
  await expect(adminError).toHaveCount(0);
  expect(page.url()).toBe(adminUrl);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.resourceUsageMarker)).toBe('admin-preserved');
  expect(adminCalls).toBe(adminCallsBeforeRetry + 1);

  await page.goto('/app/profile/resources');

  const profileError = page.getByTestId('profile.resources.usage.error');
  await expect(profileError).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('profile.resources.usage.empty')).toHaveCount(0);
  await expect(page.getByText(/No resources|Žádné prostředky/)).toHaveCount(0);

  await page.evaluate(() => {
    document.documentElement.dataset.resourceUsageMarker = 'profile-preserved';
  });
  const profileUrl = page.url();
  const profileCallsBeforeRetry = profileCalls;
  allowProfileSuccess = true;
  await page.getByTestId('profile.resources.usage.error.retry').click();

  await expect(page.getByTestId('profile.resources.usage.environment.8.resource.32')).toContainText('CPU');
  await expect(profileError).toHaveCount(0);
  expect(page.url()).toBe(profileUrl);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.resourceUsageMarker)).toBe('profile-preserved');
  expect(profileCalls).toBe(profileCallsBeforeRetry + 1);
});

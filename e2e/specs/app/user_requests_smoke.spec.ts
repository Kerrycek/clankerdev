import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@workflow-matrix @smoke user requests: request administration is hidden from user mode', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {},
  });

  await page.goto('/app');
  await expect(page.getByRole('link', { name: /^requests$|^žádosti$/i })).toHaveCount(0);

  await page.goto('/app/requests');
  await expect(page).toHaveURL('/app');
  await expect(page.getByTestId('admin.requests.list')).toHaveCount(0);

  await page.goto('/app/requests/registration/123');
  await expect(page).toHaveURL('/app');
  await expect(page.getByTestId('admin.requests.detail.registration.123.dot')).toHaveCount(0);
});

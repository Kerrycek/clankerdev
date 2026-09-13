import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, failEnvelope, installHaveApiMock } from '../../fixtures';

function registration(id: number) {
  return {
    id,
    type: 'registration',
    state: 'awaiting',
    login: `applicant-${id}`,
    full_name: `Applicant ${id}`,
    email: `applicant-${id}@example.test`,
  };
}

test('@workflow-matrix @pr-smoke @pr-smoke-mobile @smoke admin request detail: retry recovers in place without a mutation or page reload', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  let detailGets = 0;
  let resolvePosts = 0;
  let allowSuccess = false;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations/172': () => {
        detailGets += 1;
        if (!allowSuccess) {
          return {
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify(failEnvelope('Temporary request detail failure')),
          };
        }
        return { registration: registration(172) };
      },
      'POST user_request/registrations/172/resolve': () => {
        resolvePosts += 1;
        return { registration: { ...registration(172), state: 'approved' } };
      },
    },
  });

  const detailUrl = '/admin/requests/registration/172?returnTo=%2Fadmin%2Frequests%3Fstate%3Dignored%26type%3Dregistration';
  await page.goto(detailUrl);

  const error = page.getByTestId('admin.requests.detail.error');
  await expect(error).toBeVisible();
  await expect(error.getByTestId('admin.requests.detail.error.back')).toHaveAttribute(
    'href',
    '/admin/requests?state=ignored&type=registration',
  );
  await expect(page.getByTestId('admin.requests.resolve.action.approve')).toHaveCount(0);
  expect(detailGets).toBe(1);
  expect(resolvePosts).toBe(0);

  await page.evaluate(() => {
    document.documentElement.dataset['requestRecoveryDocument'] = 'same-document';
  });
  allowSuccess = true;
  await error.getByTestId('admin.requests.detail.error.retry').click();

  await expect(page.getByTestId('admin.requests.detail.registration.fields')).toContainText('Applicant 172');
  await expect(page.getByTestId('admin.requests.resolve.action.approve')).toBeVisible();
  await expect(page).toHaveURL(detailUrl);
  expect(await page.evaluate(() => document.documentElement.dataset['requestRecoveryDocument'])).toBe('same-document');
  expect(detailGets).toBe(2);
  expect(resolvePosts).toBe(0);
});

test('@workflow-matrix @smoke admin request detail: a direct legacy not-found response returns safely to the overview', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  let detailGets = 0;
  let resolvePosts = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [] }),
      'GET user_request/changes': () => ({ changes: [] }),
      'GET user_request/registrations/173': () => {
        detailGets += 1;
        return failEnvelope('Object not found');
      },
      'POST user_request/registrations/173/resolve': () => {
        resolvePosts += 1;
        return {};
      },
    },
  });

  await page.goto('/admin/requests/registration/173');

  const missing = page.getByTestId('admin.requests.detail.not_found');
  await expect(missing).toBeVisible();
  await expect(missing.getByTestId('admin.requests.detail.not_found.primary')).toHaveAttribute('href', '/admin/requests');
  await expect(missing.getByTestId('admin.requests.detail.not_found.retry')).toHaveCount(0);
  await expect(page.getByTestId('admin.requests.resolve.action.approve')).toHaveCount(0);
  expect(detailGets).toBe(1);
  expect(resolvePosts).toBe(0);

  await missing.getByTestId('admin.requests.detail.not_found.primary').click();
  await expect(page).toHaveURL('/admin/requests');
  await expect(page.getByTestId('admin.requests.empty')).toBeVisible();
  expect(resolvePosts).toBe(0);
});

test('@workflow-matrix @pr-smoke @smoke admin request detail: wrong IDs and subtypes stay fail-closed', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const detailGets = new Map<number, number>();
  let resolvePosts = 0;
  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations/174': () => {
        detailGets.set(174, (detailGets.get(174) ?? 0) + 1);
        return { registration: registration(999) };
      },
      'GET user_request/registrations/175': () => {
        detailGets.set(175, (detailGets.get(175) ?? 0) + 1);
        return {
          registration: {
            id: 175,
            type: 'change',
            state: 'awaiting',
            change_reason: 'Move office',
          },
        };
      },
      'POST user_request/registrations/174/resolve': () => {
        resolvePosts += 1;
        return {};
      },
      'POST user_request/registrations/175/resolve': () => {
        resolvePosts += 1;
        return {};
      },
    },
  });

  await page.goto('/admin/requests/registration/174?returnTo=https%3A%2F%2Fevil.example%2Fadmin%2Frequests');
  let mismatch = page.getByTestId('admin.requests.detail.mismatch');
  await expect(mismatch).toBeVisible();
  await expect(mismatch.getByTestId('admin.requests.detail.mismatch.primary')).toHaveAttribute('href', '/admin/requests');
  await expect(mismatch.getByTestId('admin.requests.detail.mismatch.retry')).toHaveCount(0);
  await expect(page.locator('[data-testid^="admin.requests.resolve.action."]')).toHaveCount(0);
  expect(detailGets.get(174)).toBe(1);
  expect(resolvePosts).toBe(0);

  await page.goto('/admin/requests/registration/175?returnTo=%2Fadmin%2Frequests%3Fstate%3Dignored');
  mismatch = page.getByTestId('admin.requests.detail.mismatch');
  await expect(mismatch).toBeVisible();
  await expect(mismatch.getByTestId('admin.requests.detail.mismatch.primary')).toHaveAttribute(
    'href',
    '/admin/requests?state=ignored',
  );
  await expect(mismatch.getByTestId('admin.requests.detail.mismatch.retry')).toHaveCount(0);
  await expect(page.locator('[data-testid^="admin.requests.resolve.action."]')).toHaveCount(0);
  expect(detailGets.get(175)).toBe(1);
  expect(resolvePosts).toBe(0);
});

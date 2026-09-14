import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const ORPHAN_CHANGE_ID = 2_041;
const OWNERLESS_REGISTRATION_ID = 2_042;
const DELETED_USER_ID = 42;

function orphanedChange(id = ORPHAN_CHANGE_ID) {
  return {
    id,
    state: 'awaiting',
    user: null,
    raw_user_id: DELETED_USER_ID,
    full_name: 'Historical name',
    email: 'historical@example.test',
    address: 'Historical address',
    change_reason: 'Update an account that was later deleted',
    created_at: '2026-03-01T09:00:00Z',
  };
}

function ownerlessRegistration(id = OWNERLESS_REGISTRATION_ID) {
  return {
    id,
    state: 'awaiting',
    user: null,
    login: 'new-applicant',
    full_name: 'New Applicant',
    email: 'new-applicant@example.test',
    address: 'Applicant address',
    year_of_birth: 1990,
    os_template: { id: 5, label: 'Debian 13', cgroup_version: 'cgroup_v2' },
    location: { id: 7, label: 'Prague' },
    language: { id: 2, label: 'English' },
    change_reason: undefined,
    created_at: '2026-03-01T10:00:00Z',
  };
}

function visibleRequestRow(page: Page, type: 'registration' | 'change', id: number) {
  return page.locator([
    `[data-testid="admin.requests.row.${type}.${id}"]:visible`,
    `[data-testid="admin.requests.mobile.row.${type}.${id}"]:visible`,
  ].join(', '));
}

function visibleBulkCheckbox(page: Page, type: 'registration' | 'change', id: number) {
  return page.locator([
    `[data-testid="admin.requests.bulk.select.${type}.${id}"]:visible`,
    `[data-testid="admin.requests.bulk.select.mobile.${type}.${id}"]:visible`,
  ].join(', '));
}

test('@workflow-matrix @pr-smoke @pr-smoke-mobile @smoke @smoke-mobile orphaned change requests are historical-only while ownerless registrations stay actionable', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const orphan = orphanedChange();
  const registration = ownerlessRegistration();
  const resolveRequests: string[] = [];
  let deletedUserGets = 0;

  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/user_request\/(?:changes|registrations)\/\d+\/resolve(?:\?|$)/.test(request.url())) {
      resolveRequests.push(request.url());
    }
  });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET user_request/registrations': () => ({ registrations: [registration] }),
      'GET user_request/changes': () => ({ changes: [orphan] }),
      [`GET user_request/registrations/${OWNERLESS_REGISTRATION_ID}`]: () => ({ registration }),
      [`GET user_request/changes/${ORPHAN_CHANGE_ID}`]: () => ({ change: orphan }),
      [`GET users/${DELETED_USER_ID}`]: () => {
        deletedUserGets += 1;
        return { user: { id: DELETED_USER_ID, login: 'must-not-be-loaded', level: 1 } };
      },
      [`POST user_request/changes/${ORPHAN_CHANGE_ID}/resolve`]: () => ({ change: orphan }),
      [`POST user_request/registrations/${OWNERLESS_REGISTRATION_ID}/resolve`]: () => ({ registration }),
    },
  });

  await page.goto('/admin/requests');

  const orphanRow = visibleRequestRow(page, 'change', ORPHAN_CHANGE_ID);
  await expect(orphanRow).toBeVisible();
  await expect(orphanRow).toContainText(`#${DELETED_USER_ID}`);
  await expect(orphanRow).toContainText(/deleted user|smazaný uživatel/i);
  await expect(orphanRow.locator(`a[href="/admin/users/${DELETED_USER_ID}"]`)).toHaveCount(0);
  expect(deletedUserGets).toBe(0);

  await page.getByTestId('admin.requests.bulk.selection_mode').click();

  const orphanCheckbox = visibleBulkCheckbox(page, 'change', ORPHAN_CHANGE_ID);
  const registrationCheckbox = visibleBulkCheckbox(page, 'registration', OWNERLESS_REGISTRATION_ID);
  await expect(orphanCheckbox).toHaveCount(1);
  await expect(orphanCheckbox).toBeDisabled();
  await expect(orphanCheckbox).not.toBeChecked();
  await expect(registrationCheckbox).toHaveCount(1);
  await expect(registrationCheckbox).toBeEnabled();

  await registrationCheckbox.check();
  const bulk = page.getByTestId('admin.requests.bulk');
  await expect(bulk).toBeVisible();
  await expect(bulk).toContainText(/selected:\s*1|vybráno:\s*1/i);
  await bulk.getByRole('button', { name: /^(?:select this page|vybrat tuto stránku)$/i }).click();
  await expect(registrationCheckbox).toBeChecked();
  await expect(orphanCheckbox).not.toBeChecked();
  await expect(bulk).toContainText(/selected:\s*1|vybráno:\s*1/i);

  await page.goto(`/admin/requests/change/${ORPHAN_CHANGE_ID}`);

  const ownerMissing = page.getByTestId('admin.requests.resolve.owner_missing');
  await expect(ownerMissing).toBeVisible();
  await expect(ownerMissing).toContainText(`#${DELETED_USER_ID}`);
  await page.getByTestId('admin.requests.detail.metadata.toggle').click();
  const metadataUser = page.getByTestId('admin.requests.detail.metadata.user');
  await expect(metadataUser).toContainText(`#${DELETED_USER_ID}`);
  await expect(metadataUser).toContainText(/deleted user|smazaný uživatel/i);
  await expect(page.getByTestId('admin.requests.detail.change.current_fallback')).toHaveCount(0);
  await expect(page.locator('[data-testid^="admin.requests.resolve.action."]')).toHaveCount(0);
  await expect(page.locator(`a[href="/admin/users/${DELETED_USER_ID}"]`)).toHaveCount(0);
  expect(deletedUserGets).toBe(0);
  expect(resolveRequests).toEqual([]);

  await page.goto(`/admin/requests/registration/${OWNERLESS_REGISTRATION_ID}`);

  await expect(page.getByTestId('admin.requests.resolve.action.approve')).toBeVisible();
  await expect(page.getByTestId('admin.requests.resolve.action.deny')).toBeVisible();
  await expect(page.getByTestId('admin.requests.resolve.action.ignore')).toBeVisible();
  await expect(page.getByTestId('admin.requests.resolve.action.request_correction')).toBeVisible();
  expect(resolveRequests).toEqual([]);
});

test('@workflow-matrix @pr-smoke @pr-smoke-mobile @smoke @smoke-mobile owner deletion during change-request preflight stops before Resolve POST', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);

  const requestId = 2_043;
  const liveChange = {
    ...orphanedChange(requestId),
    user: { id: DELETED_USER_ID, login: 'soon-deleted' },
  };
  const orphan = orphanedChange(requestId);
  let showCalls = 0;
  let resolvePosts = 0;

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      [`GET user_request/changes/${requestId}`]: () => {
        showCalls += 1;
        return { change: showCalls === 1 ? liveChange : orphan };
      },
      [`GET users/${DELETED_USER_ID}`]: () => ({
        user: {
          id: DELETED_USER_ID,
          login: 'soon-deleted',
          level: 1,
          full_name: 'Current Name',
          email: 'current@example.test',
          address: 'Current address',
        },
      }),
      [`POST user_request/changes/${requestId}/resolve`]: () => {
        resolvePosts += 1;
        return { change: { ...liveChange, state: 'approved' } };
      },
    },
  });

  await page.goto(`/admin/requests/change/${requestId}`);
  await expect(page.getByTestId('admin.requests.resolve.action.approve')).toBeVisible();
  expect(showCalls).toBe(1);

  await page.getByTestId('admin.requests.resolve.action.approve').click();
  await expect(page.getByTestId('admin.requests.resolve.modal')).toBeVisible();
  await page.getByTestId('admin.requests.resolve.submit').click();

  await expect(page.getByTestId('admin.requests.resolve.modal')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText(/changed before submission|před odesláním změnila/i);
  await expect(page.getByTestId('admin.requests.resolve.owner_missing')).toBeVisible();
  expect(showCalls).toBeGreaterThanOrEqual(2);
  expect(resolvePosts).toBe(0);
});

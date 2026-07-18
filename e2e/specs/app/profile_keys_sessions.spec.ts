import { test, expect } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@smoke profile: ssh keys + sessions flows', async ({ page }) => {
  const user = { id: 1, login: 'e2e', level: 1 };

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  let keys = [
    {
      id: 1,
      label: 'Laptop',
      fingerprint: 'SHA256:AAAA',
      auto_add: true,
      created_at: '2026-02-01T12:00:00Z',
    },
  ];

  let sessions = [
    {
      id: 1,
      label: 'Firefox',
      auth_type: 'oauth2',
      created_at: '2026-02-01T12:00:00Z',
      last_request_at: '2026-02-02T08:00:00Z',
      closed_at: null,
      api_ip_addr: '203.0.113.10',
      api_ip_ptr: 'user.example.test',
      client_ip_addr: '203.0.113.10',
      client_ip_ptr: 'client.example.test',
      user_agent: 'Mozilla/5.0 (X11; Linux x86_64)',
      client_version: 'vpsadmin-webui 9a5fccf4',
      token_fragment: 'abc…',
      token_lifetime: 'renewable_auto',
      token_interval: 900,
      request_count: 111,
      scope: 'all',
    },
    {
      id: 2,
      label: 'Old token',
      auth_type: 'token',
      created_at: '2026-01-01T12:00:00Z',
      last_request_at: '2026-01-02T08:00:00Z',
      closed_at: '2026-01-02T08:30:00Z',
      api_ip_addr: '198.51.100.20',
      client_ip_addr: '198.51.100.21',
      user_agent: 'curl/8',
      client_version: 'vpsfreectl 1.0',
      token_fragment: 'deadbeef',
      token_lifetime: 'fixed',
      token_interval: 3600,
      request_count: 8,
      scope: 'dns',
    },
  ];

  await installHaveApiMock(page, {
    user,
    handlers: {
      'GET users/1/public_keys': () => ({ public_keys: keys }),
      'POST users/1/public_keys': () => {
        const created = {
          id: 2,
          label: 'Office',
          fingerprint: 'SHA256:BBBB',
          auto_add: false,
          created_at: '2026-02-02T08:00:00Z',
        };
        keys = [keys[0], created];
        return { public_key: created };
      },
      'PUT users/1/public_keys/2': () => {
        keys = keys.map((k) => (k.id === 2 ? { ...k, label: 'Office (renamed)', auto_add: true } : k));
        return { public_key: keys.find((k) => k.id === 2) };
      },
      'DELETE users/1/public_keys/2': () => {
        keys = keys.filter((k) => k.id !== 2);
        return { ok: true };
      },

      'GET user_sessions': (ctx) => {
        const authType = ctx.searchParams.get('user_session[auth_type]');
        const rows = authType ? sessions.filter((s) => s.auth_type === authType) : sessions;
        return { user_sessions: rows };
      },
      'GET user_sessions/2': () => ({ user_session: sessions.find((s) => s.id === 2) }),
      'PUT user_sessions/1': () => {
        sessions = sessions.map((s) => (s.id === 1 ? { ...s, label: 'Firefox (renamed)' } : s));
        return { user_session: sessions.find((s) => s.id === 1) };
      },
      'POST user_sessions/1': () => {
        sessions = sessions.map((s) => (s.id === 1 ? { ...s, closed_at: '2026-02-02T08:30:00Z' } : s));
        return { user_session: sessions.find((s) => s.id === 1) };
      },
    },
  });

  await page.goto('/app/profile/keys');
  const keysTable = page.getByTestId('profile.keys.table');

  // Create key
  await expect(keysTable.getByTestId('profile.keys.row.1')).toBeVisible();
  await page.getByTestId('profile.keys.add').click();
  await expect(page.getByTestId('profile.keys.modal')).toBeVisible();
  await page.getByTestId('profile.keys.modal.label').fill('Office');
  await page.getByTestId('profile.keys.modal.key').fill('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA TEST');
  // Disable auto-add
  await page.getByTestId('profile.keys.modal.auto_add').click();

  const createReqP = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes('/users/1/public_keys'));
  await page.getByTestId('profile.keys.modal.save').click();
  const createReq = await createReqP;
  const createBody = createReq.postDataJSON();
  expect(createBody.public_key.label).toBe('Office');
  expect(createBody.public_key.key).toContain('ssh-ed25519');
  expect(createBody.public_key.auto_add).toBe(false);

  await expect(keysTable.getByTestId('profile.keys.row.2')).toBeVisible();

  // Edit key (rename + enable auto-add)
  await keysTable.getByTestId('profile.keys.row.2.edit').click();
  await expect(page.getByTestId('profile.keys.modal')).toBeVisible();
  await page.getByTestId('profile.keys.modal.label').fill('Office (renamed)');
  await page.getByTestId('profile.keys.modal.auto_add').click();

  const updateReqP = page.waitForRequest((r) => r.method() === 'PUT' && r.url().includes('/users/1/public_keys/2'));
  await page.getByTestId('profile.keys.modal.save').click();
  const updateReq = await updateReqP;
  const updateBody = updateReq.postDataJSON();
  expect(updateBody.public_key.label).toBe('Office (renamed)');
  expect(updateBody.public_key.auto_add).toBe(true);
  // key field is optional on update when unchanged
  expect(updateBody.public_key.key).toBeUndefined();

  // Delete key
  await keysTable.getByTestId('profile.keys.row.2.delete').click();
  await expect(page.getByTestId('profile.keys.delete_dialog')).toBeVisible();

  const deleteReqP = page.waitForRequest((r) => r.method() === 'DELETE' && r.url().includes('/users/1/public_keys/2'));
  await page.getByTestId('profile.keys.delete_dialog.confirm').click();
  await deleteReqP;

  // Navigate to Sessions tab
  await page.goto('/app/profile/sessions');
  const sessionsTable = page.getByTestId('profile.sessions.table');

  // Session rename
  await expect(sessionsTable.getByTestId('profile.sessions.row.1')).toBeVisible();
  await expect(sessionsTable.getByText('Request count').first()).toBeVisible();
  await expect(sessionsTable.getByText('111').first()).toBeVisible();
  await expect(sessionsTable.getByText('vpsadmin-webui 9a5fccf4')).toBeVisible();
  await expect(sessionsTable.getByTestId('profile.sessions.row.1.transactions')).toBeVisible();

  const authFilterReqP = page.waitForRequest(
    (r) => r.method() === 'GET' && r.url().includes('/user_sessions?') && r.url().includes('user_session%5Bauth_type%5D=token')
  );
  await page.getByTestId('profile.sessions.auth_type').selectOption('token');
  await authFilterReqP;
  await expect(sessionsTable.getByTestId('profile.sessions.row.2')).toBeVisible();
  await expect(sessionsTable.getByTestId('profile.sessions.row.1')).toBeHidden();

  const exactIdReqP = page.waitForRequest((r) => r.method() === 'GET' && r.url().includes('/user_sessions/2'));
  await page.getByTestId('profile.sessions.exact_id').fill('2');
  await exactIdReqP;
  await expect(sessionsTable.getByTestId('profile.sessions.row.2')).toBeVisible();

  await page.getByTestId('profile.sessions.exact_id').fill('');
  await page.getByTestId('profile.sessions.auth_type').selectOption('all');
  await expect(sessionsTable.getByTestId('profile.sessions.row.1')).toBeVisible();

  await sessionsTable.getByTestId('profile.sessions.row.1.rename').click();
  await expect(page.getByTestId('profile.sessions.rename_modal')).toBeVisible();
  await page.getByTestId('profile.sessions.rename_modal.label').fill('Firefox (renamed)');

  const renameReqP = page.waitForRequest((r) => r.method() === 'PUT' && r.url().includes('/user_sessions/1'));
  await page.getByTestId('profile.sessions.rename_modal.save').click();
  const renameReq = await renameReqP;
  const renameBody = renameReq.postDataJSON();
  expect(renameBody.user_session.label).toBe('Firefox (renamed)');

  // Close session
  await sessionsTable.getByTestId('profile.sessions.row.1.close').click();
  await expect(page.getByTestId('profile.sessions.close_dialog')).toBeVisible();
  await expect(page.getByTestId('profile.sessions.close_dialog.confirm')).toBeEnabled();
  const closeReqP = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes('/user_sessions/1'));
  await page.getByTestId('profile.sessions.close_dialog.confirm').click();
  await closeReqP;
});

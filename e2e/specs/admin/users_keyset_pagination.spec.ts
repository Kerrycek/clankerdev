import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('admin users: keyset pagination (from_id)', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users': (ctx) => {
        const fromId = ctx.searchParams.get('user[from_id]');
        const limitStr = ctx.searchParams.get('user[limit]');
        const limit = limitStr ? Number(limitStr) : 50;

        const startId = fromId ? Number(fromId) - 1 : 125;
        const count = Number.isFinite(limit) && limit > 0 ? limit : 50;

        const users = Array.from({ length: count }, (_, i) => {
          const id = startId - i;
          return {
            id,
            login: `user${id}`,
            full_name: `User ${id}`,
            email: `user${id}@example.test`,
            level: id % 3 === 0 ? 100 : 1,
            lockout: id === 125,
            password_reset: id === 124,
            enable_multi_factor_auth: id === 123,
            mailer_enabled: id !== 122,
            last_activity_at: '2026-01-01T00:00:00Z',
            created_at: '2025-01-01T00:00:00Z',
          };
        }).filter((u) => u.id > 0);

        return { users };
      },
    },
  });

  await page.goto('/admin/users');

  await expect(page.getByTestId('admin.users.row.125')).toBeVisible();
  await expect(page.getByTestId('admin.users.row.125')).toHaveAttribute('data-row-variant', 'danger');
  await expect(page.getByTestId('admin.users.row.125.dot')).toBeVisible();
  await expect(page.getByTestId('admin.users.row.124')).toHaveAttribute('data-row-variant', 'warn');
  await expect(page.getByTestId('admin.users.row.123.dot')).toBeVisible();

  await page.getByTestId('admin.users.pagination.desktop.next').click();
  await expect(page.getByTestId('admin.users.row.75')).toBeVisible();

  await page.getByTestId('admin.users.pagination.desktop.prev').click();
  await expect(page.getByTestId('admin.users.row.125')).toBeVisible();
});

test('admin users: creates member with legacy payload fields and opens detail', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  const posts: any[] = [];

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 100 },
    handlers: {
      'GET users': () => ({ users: [] }),
      'POST users': () => {
        return {
          user: {
            id: 77,
            login: 'new-member',
            level: 2,
          },
        };
      },
      'GET users/77': () => ({
        user: {
          id: 77,
          login: 'new-member',
          level: 2,
          full_name: 'New Member',
          email: 'new-member@example.test',
        },
      }),
    },
  });

  page.on('request', (req) => {
    const url = new URL(req.url());
    if (req.method() === 'POST' && url.pathname === '/api/v7.0/users') {
      posts.push(req.postDataJSON());
    }
  });

  await page.goto('/admin/users');
  await page.getByTestId('admin.users.create.open').click();
  await expect(page.getByTestId('admin.users.create.modal')).toBeVisible();

  await page.getByTestId('admin.users.create.submit').click();
  await expect(page.getByTestId('admin.users.create.modal')).toContainText(/login|required|vypl/i);
  expect(posts).toEqual([]);

  await page.getByTestId('admin.users.create.login').fill('new-member');
  await page.getByTestId('admin.users.create.password').fill('secret123');
  await page.getByTestId('admin.users.create.password2').fill('secret123');
  await page.getByTestId('admin.users.create.full_name').fill('New Member');
  await page.getByTestId('admin.users.create.email').fill('new-member@example.test');
  await page.getByTestId('admin.users.create.address').fill('Main street');
  await page.getByTestId('admin.users.create.info').fill('Admin note');
  await page.getByTestId('admin.users.create.submit').click();

  await expect(page).toHaveURL(/\/admin\/users\/77$/);
  expect(posts.at(-1)).toEqual({
    user: expect.objectContaining({
      login: 'new-member',
      password: 'secret123',
      full_name: 'New Member',
      email: 'new-member@example.test',
      address: 'Main street',
      level: 2,
      info: 'Admin note',
      monthly_payment: 300,
      mailer_enabled: true,
    }),
  });
});

test('admin users: normal user cannot open member management', async ({ page }) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await installHaveApiMock(page, {
    user: { id: 2, login: 'member', level: 1 },
    handlers: {
      'GET users': () => ({ users: [{ id: 2, login: 'member', level: 1 }] }),
    },
  });

  await page.goto('/admin/users');

  await expect(page.getByTestId('auth.admin-required')).toBeVisible();
  await expect(page.getByTestId('admin.users.create.open')).toHaveCount(0);
});

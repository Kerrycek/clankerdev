import { expect, test } from '@playwright/test';

import { installHaveApiMock } from '../../fixtures/haveapi';

function nowIso() {
  return new Date('2026-02-18T10:00:00Z').toISOString();
}

test.describe('Profile: user data templates', () => {
  test('list, create, edit, deploy and delete', async ({ page }) => {
    const t0 = nowIso();

    // In-memory templates for the mock.
    let templates = [
      {
        id: 101,
        label: 'Base cloud-init',
        format: 'cloudinit_config',
        content: '#cloud-config\npackages:\n  - curl\n',
        created_at: t0,
        updated_at: t0,
      },
    ];

    await installHaveApiMock(page, {
      authorize: {
        user: { id: 1, login: 'e2e', level: 1 },
        identity: { id: 1, provider: 'mock' },
      },
      handlers: {
        'GET vps_user_data': async ({ params }) => {
          const q = (params['vps_user_data[q]'] ?? '').toString().trim().toLowerCase();
          const format = (params['vps_user_data[format]'] ?? '').toString().trim();

          let out = [...templates].sort((a, b) => b.id - a.id);

          if (q) {
            out = out.filter((x) => x.label.toLowerCase().includes(q) || `#${x.id}`.includes(q));
          }

          if (format) {
            out = out.filter((x) => x.format === format);
          }

          return out;
        },

        'POST vps_user_data': async ({ reqJson }) => {
          const payload = (reqJson?.vps_user_data ?? {}) as any;

          const nextId = Math.max(...templates.map((x) => x.id)) + 1;
          const tpl = {
            id: nextId,
            label: payload.label ?? 'Unnamed',
            format: payload.format ?? 'cloudinit_config',
            content: payload.content ?? '',
            created_at: t0,
            updated_at: t0,
          };

          templates = [tpl, ...templates];
          return tpl;
        },

        'PUT vps_user_data/102': async ({ reqJson }) => {
          const payload = (reqJson?.vps_user_data ?? {}) as any;
          templates = templates.map((x) =>
            x.id === 102
              ? {
                  ...x,
                  label: payload.label ?? x.label,
                  format: payload.format ?? x.format,
                  content: payload.content ?? x.content,
                  updated_at: t0,
                }
              : x
          );

          return templates.find((x) => x.id === 102);
        },

        'DELETE vps_user_data/102': async () => {
          templates = templates.filter((x) => x.id !== 102);
          return null;
        },

        'POST vps_user_data/102/deploy': async () => {
          return {
            status: true,
            response: null,
            _meta: { state_id: 999 },
          };
        },

        'GET action_states/999': async () => {
          return {
            id: 999,
            label: 'Deploy user data',
            status: true,
            finished: true,
            can_cancel: false,
            current: 1,
            total: 1,
            progress: 1,
            created_at: t0,
            updated_at: t0,
          };
        },
      },
    });

    await page.goto('/app/profile/user-data');

    await expect(page.getByTestId('profile.user_data.panel')).toBeVisible();

    // Initial list
    await expect(page.getByTestId('profile.user_data.row.101')).toBeVisible();

    // Create
    await page.getByTestId('profile.user_data.create').click();
    await expect(page.getByTestId('profile.user_data.editor.drawer')).toBeVisible();

    await page.getByTestId('profile.user_data.editor.label').fill('Provision nginx');
    await page.getByTestId('profile.user_data.editor.format').selectOption('script');
    await page.getByTestId('profile.user_data.editor.content').fill('#!/bin/sh\necho hello\n');

    await page.getByTestId('profile.user_data.editor.create').click();

    // The new template should get id 102 from the mock.
    await expect(page.getByTestId('profile.user_data.row.102')).toBeVisible();

    // Edit
    await page.getByTestId('profile.user_data.row.102.edit').click();
    await expect(page.getByTestId('profile.user_data.editor.drawer')).toBeVisible();

    await page.getByTestId('profile.user_data.editor.label').fill('Provision nginx (v2)');
    await page.getByTestId('profile.user_data.editor.save').click();

    await expect(page.getByText('Provision nginx (v2)')).toBeVisible();

    // Deploy (use direct id entry to avoid VPS list mocks)
    await page.getByTestId('profile.user_data.row.102.deploy').click();
    await expect(page.getByTestId('profile.user_data.deploy.drawer')).toBeVisible();

    await page.getByTestId('profile.user_data.deploy.vps').fill('#500');
    await page.getByTestId('profile.user_data.deploy.submit').click();

    await expect(page.getByText('Deployment started')).toBeVisible();
    await expect(page.getByText('Deploying user data…')).toHaveCount(0);

    // Delete
    await page.getByTestId('profile.user_data.row.102.delete').click();
    await expect(page.getByTestId('profile.user_data.delete.confirm')).toBeVisible();
    await page.getByTestId('profile.user_data.delete.confirm.confirm').click();

    await expect(page.getByTestId('profile.user_data.row.102')).toHaveCount(0);
  });
});

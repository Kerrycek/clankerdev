import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

const TEMPLATE = {
  id: 101,
  label: 'Base cloud-init',
  format: 'cloudinit_config',
  content: '#cloud-config\npackages:\n  - curl\n',
  created_at: '2026-02-18T10:00:00Z',
  updated_at: '2026-02-18T10:00:00Z',
};

test('@smoke @smoke-mobile @pr-smoke @pr-smoke-mobile user data create and edit forms expose labels, errors, focus, and touch targets', async ({
  page,
}, testInfo) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_SESSION' });
  await installHaveApiMock(page, {
    authorize: {
      user: { id: 1, login: 'e2e', level: 1 },
      identity: { id: 1, provider: 'mock' },
    },
    handlers: {
      'GET vps_user_data': () => [TEMPLATE],
    },
  });

  await page.goto('/app/profile/user-data');
  await expect(page.getByTestId('profile.user_data.panel')).toBeVisible();

  await page.getByTestId('profile.user_data.create').click();
  const createDrawer = page.getByTestId('profile.user_data.editor.drawer');
  await expect(createDrawer).toBeVisible();

  const labelInput = createDrawer.getByRole('textbox', { name: 'Label' });
  const formatSelect = createDrawer.getByRole('combobox', { name: 'Format' });
  const contentTextarea = createDrawer.getByRole('textbox', { name: 'Content' });

  await expect(labelInput).toHaveAccessibleDescription('Shown in lists and pickers. 1–255 characters.');
  await expect(formatSelect).toHaveAccessibleDescription(
    'Choose how vpsAdmin interprets and validates the content.'
  );
  await expect(contentTextarea).toHaveAccessibleDescription('0 / 65536 chars');

  await createDrawer.getByText('Label', { exact: true }).click();
  await expect(labelInput).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(formatSelect).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(contentTextarea).toBeFocused();

  await contentTextarea.fill('x'.repeat(65_537));
  await expect(contentTextarea).toHaveAttribute('aria-invalid', 'true');
  await expect(contentTextarea).toHaveAccessibleDescription(
    /65537 \/ 65536 chars.*Error: Max length 65536 characters/
  );
  await expect(createDrawer.getByRole('status')).toHaveCount(1);
  await expect(createDrawer.getByRole('status')).toContainText('Max length 65536 characters');
  await expect(createDrawer.getByTestId('profile.user_data.editor.create')).toBeDisabled();

  if (testInfo.project.name === 'mobile-chrome') {
    for (const control of [
      labelInput,
      formatSelect,
      createDrawer.getByRole('button', { name: 'Cancel' }),
      createDrawer.getByTestId('profile.user_data.editor.create'),
    ]) {
      const box = await control.boundingBox();
      expect(box, 'editor control should be measurable').not.toBeNull();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  }

  await createDrawer.getByRole('button', { name: 'Cancel' }).click();
  await expect(createDrawer).toHaveCount(0);

  await page.getByTestId('profile.user_data.row.101.edit').scrollIntoViewIfNeeded();
  await page.getByTestId('profile.user_data.row.101.edit').click();
  const editDrawer = page.getByTestId('profile.user_data.editor.drawer');
  await expect(editDrawer).toBeVisible();

  const editLabel = editDrawer.getByRole('textbox', { name: 'Label' });
  const editFormat = editDrawer.getByRole('combobox', { name: 'Format' });
  const editContent = editDrawer.getByRole('textbox', { name: 'Content' });
  await expect(editLabel).toHaveValue(TEMPLATE.label);
  await expect(editFormat).toHaveValue(TEMPLATE.format);
  await expect(editContent).toHaveValue(TEMPLATE.content);

  await editDrawer.getByText('Content', { exact: true }).click();
  await expect(editContent).toBeFocused();
  await expect(editDrawer.getByTestId('profile.user_data.editor.save')).toBeEnabled();

  if (testInfo.project.name === 'mobile-chrome') {
    const saveBox = await editDrawer.getByTestId('profile.user_data.editor.save').boundingBox();
    expect(saveBox, 'edit action should be measurable').not.toBeNull();
    expect(saveBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

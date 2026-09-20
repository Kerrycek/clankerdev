import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow } from '../../fixtures/bootstrap';
import { installHaveApiMock } from '../../fixtures/haveapi';

test.describe('VPS lookup combobox', () => {
  test('@pr-smoke @pr-smoke-mobile keeps the deploy drawer open on the first Escape and supports keyboard and pointer selection', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_SESSION' });
    await installHaveApiMock(page, {
      authorize: {
        user: { id: 1, login: 'e2e', level: 1 },
        identity: { id: 1, provider: 'mock' },
      },
      handlers: {
        'GET vps_user_data': () => ({
          vps_user_data: [
            {
              id: 101,
              label: 'Base cloud-init',
              format: 'cloudinit_config',
              content: '#cloud-config\n',
              created_at: '2026-02-18T10:00:00Z',
              updated_at: '2026-02-18T10:00:00Z',
            },
          ],
        }),
        'GET vpses': () => ({
          vpses: [
            { id: 701, hostname: 'alpha.lookup.example' },
            { id: 702, hostname: 'bravo.lookup.example' },
          ],
        }),
      },
    });

    await page.goto('/app/profile/user-data');
    await page.getByTestId('profile.user_data.row.101.deploy').click();

    const drawer = page.getByTestId('profile.user_data.deploy.drawer');
    const input = page.getByTestId('profile.user_data.deploy.vps');
    await expect(drawer).toBeVisible();
    await expect(input).toHaveAttribute('role', 'combobox');
    await expect(input).toHaveAttribute('aria-autocomplete', 'list');

    await input.fill('lookup');
    const listbox = page.getByRole('listbox');
    const options = listbox.getByRole('option');
    await expect(listbox).toBeVisible();
    await expect(options).toHaveCount(2);
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', await options.nth(0).getAttribute('id') ?? '');

    const inputBox = await input.boundingBox();
    const optionBox = await options.nth(0).boundingBox();
    expect(inputBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(optionBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    await input.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', await options.nth(1).getAttribute('id') ?? '');

    await input.press('Escape');
    await expect(listbox).toBeHidden();
    await expect(drawer).toBeVisible();
    await expect(input).toBeFocused();

    await input.press('ArrowDown');
    await expect(listbox).toBeVisible();
    await input.press('End');
    await input.press('Enter');
    await expect(input).toHaveValue('#702');
    await expect(page.getByTestId('profile.user_data.deploy.submit')).toBeEnabled();

    // With the combobox collapsed, Escape belongs to the parent drawer.
    await input.press('Escape');
    await expect(drawer).toBeHidden();

    await page.getByTestId('profile.user_data.row.101.deploy').click();
    await input.fill('lookup');
    await expect(listbox).toBeVisible();
    await options.nth(0).click();
    await expect(input).toHaveValue('#701');
    await expect(listbox).toBeHidden();
    await expect(input).toBeFocused();
  });
});

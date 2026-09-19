import { expect, test } from '@playwright/test';

import { setupHaveApiMock } from '../../fixtures/haveapi';
import { setUiSettingsLocalStorage } from '../../fixtures/uiSettings';
import { withAppUrl } from '../../fixtures/url';

test.describe('Smart filter accessibility contract', () => {
  test('supports an announced combobox, wrapped keyboard navigation, and 44px pointer choices @pr-smoke @pr-smoke-mobile', async ({
    page,
  }) => {
    await setUiSettingsLocalStorage(page, { language: 'en' });
    await setupHaveApiMock(page, {
      user: { id: 41, login: 'member', level: 1 },
      handlers: {
        'GET incident_reports': () => ({ incident_reports: [], _meta: { total_count: 0 } }),
      },
    });

    await page.goto(withAppUrl('/app/incidents'));

    const input = page.getByTestId('incidents.smart_filter.input');
    await expect(input).toHaveRole('combobox');
    await expect(input).toHaveAccessibleName('Open an incident by ID or filter incident reports');

    const inputBox = await input.boundingBox();
    expect(inputBox).not.toBeNull();
    expect(inputBox!.height).toBeGreaterThanOrEqual(44);

    await input.fill('123');

    const listbox = page.getByRole('listbox', { name: 'Open an incident by ID or filter incident reports' });
    await expect(listbox).toBeVisible();
    const controlledId = await input.getAttribute('aria-controls');
    expect(controlledId).toBeTruthy();
    await expect(listbox).toHaveAttribute('id', controlledId!);
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(listbox.getByRole('option')).toHaveCount(3);
    await expect(input.locator('xpath=../..').getByRole('status')).toHaveText('3 suggestions available.');

    const first = listbox.getByRole('option').nth(0);
    const second = listbox.getByRole('option').nth(1);
    const last = listbox.getByRole('option').nth(2);
    await expect(first).toHaveAttribute('aria-selected', 'true');
    const firstId = await first.getAttribute('id');
    expect(firstId).toBeTruthy();
    await expect(input).toHaveAttribute('aria-activedescendant', firstId!);

    await input.press('ArrowUp');
    await expect(last).toHaveAttribute('aria-selected', 'true');
    const lastId = await last.getAttribute('id');
    expect(lastId).toBeTruthy();
    await expect(input).toHaveAttribute('aria-activedescendant', lastId!);

    await input.press('ArrowDown');
    await expect(first).toHaveAttribute('aria-selected', 'true');

    await input.press('Escape');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(input).not.toHaveAttribute('aria-activedescendant');
    await expect(listbox).toHaveCount(0);

    await input.press('ArrowUp');
    const reopenedListbox = page.getByRole('listbox', {
      name: 'Open an incident by ID or filter incident reports',
    });
    await expect(reopenedListbox.getByRole('option').nth(2)).toHaveAttribute('aria-selected', 'true');

    await input.press('Escape');
    await input.press('ArrowDown');
    await input.press('ArrowDown');
    await expect(second).toHaveAttribute('aria-selected', 'true');
    await input.press('Enter');
    await expect(page.getByTestId('incidents.chip.vps')).toContainText('vps:123');
    await expect(input).toHaveAttribute('aria-expanded', 'false');

    await input.fill('456');
    const assignment = page.getByTestId('incidents.smart.suggest.assignment');
    const assignmentBox = await assignment.boundingBox();
    expect(assignmentBox).not.toBeNull();
    expect(assignmentBox!.height).toBeGreaterThanOrEqual(44);
    await assignment.click();
    await expect(page.getByTestId('incidents.chip.assignment')).toContainText('assignment:456');
  });
});

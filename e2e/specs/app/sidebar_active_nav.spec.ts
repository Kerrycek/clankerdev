import { expect, test } from '../../fixtures/playwright';
import { bootstrapVpsAdminWindow } from '../../fixtures/bootstrap';
import { installHaveApiMock } from '../../fixtures/haveapi';

test.describe('@smoke app sidebar active navigation', () => {
  test('marks dashboard as active only on the app root route', async ({ page }) => {
    await installHaveApiMock(page, {
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'GET transaction_chains': () => ({ transaction_chains: [] }),
      },
    });
    await bootstrapVpsAdminWindow(page);

    await page.goto('/app');
    await expect(page.getByTestId('nav.sidebar.dashboard')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('nav.sidebar.action-states')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Stavy akcí', exact: true })).toHaveCount(0);

    await page.goto('/app/vps');
    await expect(page.getByTestId('nav.sidebar.vps')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('nav.sidebar.dashboard')).not.toHaveAttribute('aria-current', 'page');
  });
});

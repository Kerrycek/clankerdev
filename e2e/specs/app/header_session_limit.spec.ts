import { expect, test, type Page } from '@playwright/test';
import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

async function setup(page: Page, seconds = 2400) {
  await page.clock.install({ time: new Date('2026-09-26T12:00:00Z') });
  await bootstrapVpsAdminWindow(page, {
    sessionToken: '',
    webuiNext: { logoutUrl: '/oauth/logout', sessionExpiresAt: Date.now() + 720 * 60 * 60 * 1000 },
  });
  let tokenGeneration = 0;
  await page.route('**/session.json', route => route.fulfill({ json: {
    accessToken: `TEST_ACCESS_TOKEN_${++tokenGeneration}`, sessionKey: 'a'.repeat(64),
    sessionExpiresAt: Date.now() + 720 * 60 * 60 * 1000,
  } }));
  await page.route('**/oauth/logout?*', route => route.fulfill({ contentType: 'text/html', body: '<p>Logged out</p>' }));
  await installHaveApiMock(page, {
    user: { id: 53, login: 'KerryCZE', level: 99, preferred_session_length: seconds },
    handlers: {
      'GET vpses': () => ({ vpses: [], _meta: { total_count: 0 } }),
      'GET datasets': () => ({ datasets: [], _meta: { total_count: 0 } }),
      'GET dns_zones': () => ({ dns_zones: [], _meta: { total_count: 0 } }),
      'GET transaction_chains': () => ({ transaction_chains: [], _meta: { total_count: 0 } }),
    },
  });
  await page.goto('/app');
  await expect(page.getByTestId('shell.user-menu-button')).toBeVisible();
}

test('@pr-smoke session counts down despite polling, renews on interaction and survives reload', async ({ page }) => {
  await setup(page);
  const remaining = page.getByTestId('shell.session-remaining');
  await expect(remaining).toHaveText('40 min');
  await page.clock.fastForward(61_000);
  await expect(remaining).toHaveText('39 min');
  // A real input extends the inactivity deadline. Merely rendering/polling does not.
  await page.getByTestId('shell.user-menu-button').click();
  await expect(remaining).toHaveText('40 min');
  await page.clock.fastForward(121_000);
  await expect(remaining).toHaveText('38 min');
  await page.reload();
  await expect(remaining).toHaveText('38 min');
  await expect(remaining).not.toContainText('720');
});

test('@pr-smoke @pr-smoke-mobile session logs out after inactivity, including a sleeping tab', async ({ page }) => {
  await setup(page);
  await page.clock.fastForward(41 * 60_000);
  await expect(page).toHaveURL(/\/oauth\/logout\?next=/);
  await expect(page.getByText('Logged out')).toBeVisible();
});

test('@pr-smoke @pr-smoke-mobile disabled session timeout does not log out an idle user', async ({ page }) => {
  await setup(page, 0);
  await page.clock.fastForward(61 * 60_000);
  await expect(page.getByTestId('shell.user-menu-button')).toBeVisible();
  await expect(page).not.toHaveURL(/\/oauth\/logout/);
});


test('@pr-smoke activity in another tab extends the same session countdown', async ({ page, context }) => {
  await setup(page);
  const other = await context.newPage();
  await setup(other);
  await page.clock.fastForward(20 * 60_000);
  await expect(page.getByTestId('shell.session-remaining')).toHaveText('20 min');
  await other.bringToFront();
  await other.keyboard.press('Tab');
  await expect(page.getByTestId('shell.session-remaining')).toHaveText('40 min');
  await other.close();
  await page.clock.fastForward(31 * 60_000);
  await expect(page.getByTestId('shell.session-remaining')).toHaveText('9 min');
});

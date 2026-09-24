import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

type ScrollTrackingWindow = Window & { __routeFocusScrollToCalls: number };

async function installScrollTracker(page: Page) {
  await page.evaluate(() => {
    const trackedWindow = window as ScrollTrackingWindow;
    const originalScrollTo = window.scrollTo.bind(window);
    trackedWindow.__routeFocusScrollToCalls = 0;
    window.scrollTo = ((first?: number | ScrollToOptions, second?: number) => {
      trackedWindow.__routeFocusScrollToCalls += 1;
      if (typeof first === 'number') originalScrollTo(first, second ?? 0);
      else originalScrollTo(first);
    }) as typeof window.scrollTo;
  });
}

async function resetScrollTracker(page: Page) {
  await page.evaluate(() => {
    (window as ScrollTrackingWindow).__routeFocusScrollToCalls = 0;
  });
}

async function scrollToCallCount(page: Page) {
  return page.evaluate(() => (window as ScrollTrackingWindow).__routeFocusScrollToCalls);
}

async function settleAnimationFrames(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

test('@pr-smoke @pr-smoke-mobile @smoke @smoke-mobile keyboard users can skip chrome and keep route focus predictable', async ({ page, browserName }, testInfo) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'KEYBOARD_USER_SESSION' });
  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 100 },
    handlers: {
      'GET vpses': () => ({
        vpses: [{ id: 101, hostname: 'alpha', is_running: true, object_state: 'active' }],
        _meta: { total_count: 1 },
      }),
      'GET datasets': () => ({ datasets: [], _meta: { total_count: 0 } }),
      'GET dns_zones': () => ({ dns_zones: [], _meta: { total_count: 0 } }),
    },
  });

  await page.goto('/app');
  await installScrollTracker(page);
  await page.addStyleTag({ content: '#main-content { min-height: 2500px; }' });
  const main = page.getByTestId('shell.main');
  const skipLink = page.getByTestId('shell.skip-link');
  await expect(page.getByTestId('app.dashboard.page')).toBeVisible();
  await expect(main).not.toBeFocused();

  // WebKit on macOS uses Option+Tab to include links in keyboard traversal.
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await expect(skipLink).not.toHaveCSS('box-shadow', 'none');
  await page.keyboard.press('Enter');
  await expect(main).toBeFocused();
  await expect(main).toHaveCSS('outline-style', 'none');
  await page.evaluate(() => window.history.replaceState(window.history.state, '', '/app'));
  await expect(page).toHaveURL(/\/app$/);

  await page.evaluate(async () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  await resetScrollTracker(page);

  if (testInfo.project.name === 'mobile-chrome') {
    const menuButton = page.getByTestId('shell.mobile-nav-button');
    await menuButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('nav.drawer')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('nav.drawer')).toBeHidden();
    await expect(menuButton).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByTestId('nav.drawer')).toBeVisible();
    const vpsLink = page.getByTestId('nav.drawer.vps');
    await vpsLink.focus();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('nav.drawer')).toBeHidden();
  } else {
    const vpsLink = page.getByTestId('nav.sidebar.vps');
    await vpsLink.focus();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
    await page.keyboard.press('Enter');
  }

  await expect(page).toHaveURL(/\/app\/vps$/);
  await expect(page.getByTestId('vps.list')).toBeVisible();
  await expect(main).toBeFocused();
  await expect(main).toHaveCSS('outline-style', 'none');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await settleAnimationFrames(page);
  expect(await scrollToCallCount(page)).toBe(1);

  if (testInfo.project.name === 'mobile-chrome') {
    const menuButton = page.getByTestId('shell.mobile-nav-button');
    await menuButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('nav.drawer')).toBeVisible();

    await resetScrollTracker(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByTestId('nav.drawer')).toBeHidden();
    await expect(main).toBeFocused();
    await expect(main).toHaveCSS('outline-style', 'none');
    await settleAnimationFrames(page);
    expect(await scrollToCallCount(page)).toBe(0);

    await page.goForward();
    await expect(page).toHaveURL(/\/app\/vps(?:\?.*)?$/);
    await expect(main).toBeFocused();
    await expect(main).toHaveCSS('outline-style', 'none');
    await settleAnimationFrames(page);
    expect(await scrollToCallCount(page)).toBe(0);
  }

  const smartFilter = page.getByTestId('vps.smart_filter.input');
  await resetScrollTracker(page);
  await smartFilter.fill('alpha');
  await smartFilter.press('Enter');
  await expect(page).toHaveURL(/\/app\/vps\?.*q=alpha/);
  await expect(smartFilter).toBeFocused();
  await expect(smartFilter).not.toHaveCSS('box-shadow', 'none');
  await settleAnimationFrames(page);
  expect(await scrollToCallCount(page)).toBe(0);

  await page.evaluate(async () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  await resetScrollTracker(page);
  await page.getByTestId('shell.user-menu-button').click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  const beforeScopeSwitchY = await page.evaluate(() => window.scrollY);
  await page.getByTestId('shell.user-menu.scope.all').click();

  await expect(page).toHaveURL(/\/admin\/vps\?.*q=alpha/);
  await expect(page.getByTestId('vps.list')).toBeVisible();
  await expect(page.getByTestId('shell.main')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await settleAnimationFrames(page);
  expect(await scrollToCallCount(page)).toBe(1);

  await resetScrollTracker(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/vps\?.*q=alpha/);
  await expect(page.getByTestId('vps.list')).toBeVisible();
  await expect(page.getByTestId('shell.main')).toBeFocused();
  await settleAnimationFrames(page);
  expect(await scrollToCallCount(page)).toBe(0);
  await expect.poll(() => page.evaluate((expected) => Math.abs(window.scrollY - expected), beforeScopeSwitchY)).toBeLessThanOrEqual(2);
});

import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

// Opt-in only: keep routine CI independent of the public geocoder and tile server.
// Run with one worker to respect the public geocoder's request rate.
test('@live-manual deployed request map renders public addresses and distinguishes no result', async ({ page }, testInfo) => {
  test.skip(process.env.E2E_LIVE_ADDRESS_MAP !== '1', 'Set E2E_LIVE_ADDRESS_MAP=1 and use --workers=1.');
  test.setTimeout(120_000);
  const responses: Array<{ url: string; status: number }> = [];
  const failures: Array<{ url: string; error: string | undefined }> = [];
  const isMapUrl = (url: string) => /https:\/\/(nominatim|www|tile)\.openstreetmap\.org\//.test(url);
  page.on('response', response => {
    if (isMapUrl(response.url())) responses.push({ url: response.url(), status: response.status() });
  });
  page.on('requestfailed', request => {
    if (isMapUrl(request.url())) failures.push({ url: request.url(), error: request.failure()?.errorText });
  });

  // Only authentication/application data are fixtures. The deployed UI, geocoder,
  // iframe and map tiles are real; no private applicant address leaves the browser.
  await bootstrapVpsAdminWindow(page);
  let address = '';
  await installHaveApiMock(page, {
    user: { id: 1, login: 'map-test', level: 100 },
    handlers: {
      'GET user_request/registrations/999991': () => ({ registration: {
        id: 999991, state: 'awaiting', login: 'map-test', full_name: 'Public museum map test',
        email: 'map@example.test', address, ip_checked: true, ip_success: true,
        ip_fraud_score: 87, mail_checked: true, mail_success: true, mail_fraud_score: 100,
      } }),
    },
  });

  try {
    for (const [label, publicAddress] of [
      ['prague', 'Václavské náměstí 68, Praha, Česko'],
      ['brno', 'Zelný trh 6, Brno, Česko'],
    ]) {
      address = publicAddress;
      const firstResponse = responses.length;
      await page.goto('/admin/requests/registration/999991');
      const preview = page.getByTestId('admin.requests.detail.registration.address.map.preview');
      await expect(preview).toBeVisible({ timeout: 30_000 });
      await expect(preview).toHaveAttribute('src', /marker=/);
      await preview.scrollIntoViewIfNeeded();
      const map = preview.contentFrame();
      await expect(map.locator('#map canvas')).toBeVisible({ timeout: 30_000 });
      await expect(map.locator('.maplibregl-marker')).toBeVisible();
      await expect.poll(() => responses.slice(firstResponse).filter(response =>
        response.url.startsWith('https://tile.openstreetmap.org/') && response.status === 200,
      ).length, { timeout: 30_000 }).toBeGreaterThan(0);
      await expect(map.getByRole('link', { name: 'OpenStreetMap contributors' })).toBeVisible();
      await preview.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`${label}-map.png`), fullPage: true });
      // Explicit provider rate limit, not a UI synchronization delay.
      await page.waitForTimeout(1100);
    }

    address = 'Nonexistentstreetzzzz 999999, Nonexistentcityzzzz, Česko';
    await page.goto('/admin/requests/registration/999991');
    const card = page.getByTestId('admin.requests.detail.registration.address.map');
    await expect(card).toContainText(/address was not found|adresu se v OpenStreetMap nepodařilo najít/i, { timeout: 30_000 });
    await expect(card.locator('iframe')).toHaveCount(0);
    await expect(card.getByTestId('admin.requests.detail.registration.address.map.retry')).toHaveCount(0);
  } finally {
    const networkPath = testInfo.outputPath('map-network.json');
    await writeFile(networkPath, JSON.stringify({ responses, failures }, null, 2));
    await testInfo.attach('map-network.json', { path: networkPath, contentType: 'application/json' });
  }
});

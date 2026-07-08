import { test, expect } from '@playwright/test';

import { bootstrapVpsAdminWindow } from '../../fixtures/bootstrap';
import { installHaveApiMock } from '../../fixtures/haveapi';
import { withAppUrl } from '../../fixtures/url';

const UI_SETTINGS_STORAGE_KEY = 'vpsadmin.uiSettings.v1';

test('user payments page: shows status, instructions and history', async ({ page }) => {
  test.setTimeout(90_000);

  await bootstrapVpsAdminWindow(page);
  const haveApiMock = await installHaveApiMock(page);

  haveApiMock.addHandler('GET users/current', () => {
    return {
      user: {
        id: 1,
        login: 'alice',
        level: 1,
        monthly_payment: 200,
        paid_until: '2099-01-01T00:00:00Z',
      },
    };
  });

  haveApiMock.addHandler('GET users/1/get_payment_instructions', () => {
    return {
      hash: {
        instructions: '<h3>Payment in CZK</h3><table><tr><td>IBAN:</td><td>CZ00TEST</td></tr><tr><td>VS:</td><td>1</td></tr></table>',
      },
    };
  });

  haveApiMock.addHandler('GET user_payments', ({ searchParams }) => {
    const limit = Number(searchParams.get('user_payment[limit]') ?? 50);
    const fromIdRaw = searchParams.get('user_payment[from_id]');
    const fromId = fromIdRaw ? Number(fromIdRaw) : null;

    const ids = Array.from({ length: 10 }, (_, i) => 300 - i)
      .filter((id) => (fromId ? id < fromId : true))
      .slice(0, limit);

    return {
      status: true,
      response: {
        user_payments: ids.map((id) => ({
          id,
          amount: 200,
          created_at: '2026-02-14T09:00:00Z',
          from_date: '2026-02-01T00:00:00Z',
          to_date: '2026-03-01T00:00:00Z',
        })),
      },
    };
  });

  await page.goto(withAppUrl('/app/payments'));

  await expect(page.getByTestId('payments.my.stat.paid_until')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('payments.my.stat.paid_until').getByText('Paid', { exact: true })).toBeVisible();

  const instructions = page.getByTestId('payments.my.instructions.text');
  await expect(instructions.getByRole('heading', { name: 'Payment in CZK' })).toBeVisible();
  await expect(instructions.getByText('CZ00TEST')).toBeVisible();
  await expect(instructions).not.toContainText('<h3>');
  await expect(page.getByTestId('payments.my.instructions.copy')).toBeVisible();

  await expect(page.getByTestId('payments.my.history.table')).toBeVisible();
  await expect(page.getByTestId('payments.my.history.table').locator('tbody tr')).toHaveCount(10);
});

test('user payments page: localizes and constrains legacy payment instruction HTML', async ({ page }) => {
  test.setTimeout(90_000);

  await bootstrapVpsAdminWindow(page);
  await page.addInitScript(({ storageKey }) => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        sidebarCollapsed: false,
        theme: 'system',
        language: 'cs',
        tips: { sidebarTimeZone: 'visible' },
      })
    );
  }, { storageKey: UI_SETTINGS_STORAGE_KEY });

  const haveApiMock = await installHaveApiMock(page);

  haveApiMock.addHandler('GET users/current', () => {
    return {
      user: {
        id: 53,
        login: 'kerry',
        level: 1,
        monthly_payment: 300,
        paid_until: '2099-01-01T00:00:00Z',
      },
    };
  });

  haveApiMock.addHandler('GET users/53/get_payment_instructions', () => {
    return {
      hash: {
        instructions: `
          <h3>General info</h3>
          <p>Payments can be made either in CZK or EUR, see below for bank account numbers.</p>
          <h3>Payment in CZK</h3>
          <table class="payment-instr">
            <tr>
              <td>Back account for CZK (CZ):</td>
              <td><em>2200041594/2010</em></td>
              <td rowspan="6"><img alt="QR kód" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAIAAACyr5FlAAAAA3NCSVQICAjb4U/gAAABCUlEQVR4nO3QMQEAAAwCoNm/9HI83BLIOdwZC6wRViOsRliNsBphNcJqhNUIqxFWI6xGWI2wGmE1wmqE1QirEVYjrEZYjbAaYTXCaoTVCKsRViOsRliNsBphNcJqhNUIqxFWI6xGWI2wGmE1wmqE1QirEVYjrEZYjbAaYTXCaoTVCKsRViOsRliNsBphNcJqhNUIqxFWI6xGWI2wGmE1wmqE1QirEVYjrEZYjbAaYTXCaoTVCKsRViOsRliNsBphNcJqhNUIqxFWI6xGWI2wGmE1wmqE1QirEVYjrEZYjbAaYTXCaoTVCKsRViOsRliNsBphNcJqhNUIqxFWI6xGWI2wGmE1wmqE1QirEVYjrEZYjbAaYTXCaoTVCM8DXC0CiXjbrFUAAAAASUVORK5CYII=" width="180" height="180" /></td>
            </tr>
            <tr><td>Variable symbol:</td><td>53</td></tr>
            <tr><td>Message (<a href="#">more info</a>):</td><td>/VS/53</td></tr>
            <tr><td>Sum:</td><td>300 CZK per month</td></tr>
            <tr><td>Bank account overview:</td><td><a href="https://example.test">https://example.test</a></td></tr>
          </table>
        `,
      },
    };
  });

  haveApiMock.addHandler('GET user_payments', () => {
    return {
      status: true,
      response: {
        user_payments: [],
      },
    };
  });

  await page.goto(withAppUrl('/app/payments'));

  const instructions = page.getByTestId('payments.my.instructions.text');
  await expect(instructions.getByRole('heading', { name: 'Obecné informace' })).toBeVisible();
  await expect(instructions.getByRole('heading', { name: 'Platba v CZK' })).toBeVisible();
  await expect(instructions.getByText('Bankovní účet pro CZK (CZ):')).toBeVisible();
  await expect(instructions.getByText('Variabilní symbol:')).toBeVisible();
  await expect(instructions.getByText('300 CZK měsíčně')).toBeVisible();
  await expect(instructions).not.toContainText('Payment in CZK');
  await expect(instructions).not.toContainText('Variable symbol:');

  const qr = instructions.locator('img').first();
  await expect(qr).toBeVisible();
  const qrBox = await qr.boundingBox();
  expect(qrBox?.width).toBeLessThanOrEqual(160);
  expect(qrBox?.height).toBeLessThanOrEqual(160);
});

import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';
import { expectNoDocumentHorizontalOverflow } from '../../helpers/horizontalOverflow';

test('@pr-smoke @pr-smoke-mobile DNS TTL fields follow the live API contract', async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-chrome';
  if (mobile) await page.setViewportSize({ width: 320, height: 900 });

  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

  let createPayload: any;
  let updatePayload: any;
  let zoneUpdatePayload: any;
  let zone = {
    id: 10,
    name: 'example.com',
    source: 'internal_source',
    enabled: true,
    dnssec_enabled: false,
    default_ttl: 3600,
    object_state: 'active',
  };
  let records = [
    {
      id: 100,
      dns_zone: { id: 10 },
      name: 'www',
      type: 'A',
      content: '192.0.2.10',
      ttl: 3600,
      priority: null,
      comment: '',
      enabled: true,
      dynamic_update_enabled: false,
    },
  ];

  await installHaveApiMock(page, {
    user: { id: 1, login: 'test', level: 1 },
    handlers: {
      'GET dns_zones/10': () => ({ dns_zone: zone }),
      'GET dns_records': () => ({ dns_records: records }),
      'GET dns_record_logs': () => ({ dns_record_logs: [] }),
      'POST dns_records': async ({ request }) => {
        createPayload = await request.postDataJSON?.();
        const created = {
          id: 101,
          dns_zone: { id: 10 },
          name: 'api',
          type: 'A',
          content: '192.0.2.11',
          ttl: createPayload?.dns_record?.ttl ?? null,
          priority: null,
          comment: '',
          enabled: true,
          dynamic_update_enabled: false,
        };
        records = [created, ...records];
        return { dns_record: created };
      },
      'PUT dns_records/100': async ({ request }) => {
        updatePayload = await request.postDataJSON?.();
        records = records.map((record) =>
          record.id === 100 ? { ...record, ttl: updatePayload?.dns_record?.ttl } : record
        );
        return { dns_record: records.find((record) => record.id === 100) };
      },
      'PUT dns_zones/10': async ({ request }) => {
        zoneUpdatePayload = await request.postDataJSON?.();
        zone = { ...zone, ...zoneUpdatePayload?.dns_zone };
        return { dns_zone: zone };
      },
    },
  });

  await page.goto('/app/dns/zones/10');
  await expect(page.getByTestId('dns.records.list')).toBeVisible();
  await expect(page.getByTestId(mobile ? 'dns.record.card.100' : 'dns.record.row.100')).toBeVisible();

  await page.getByTestId('dns.records.create.open').click();
  await page.getByTestId('dns.records.create.name').fill('api');
  await page.getByTestId('dns.records.create.content').fill('192.0.2.11');

  const createTtl = page.getByTestId('dns.records.create.ttl');
  const createSubmit = page.getByTestId('dns.records.create.submit');
  await expect(createTtl).toHaveAttribute('min', '60');
  await expect(createTtl).toHaveAttribute('max', '604800');
  await expect(createSubmit).toBeEnabled();

  await createTtl.fill('59');
  await expect(page.getByTestId('dns.records.create.ttl.validation')).toContainText('60');
  await expect(createSubmit).toBeDisabled();

  await createTtl.fill('60');
  await expect(page.getByTestId('dns.records.create.ttl.validation')).toHaveCount(0);
  await expect(createSubmit).toBeEnabled();

  await createTtl.fill('604801');
  await expect(page.getByTestId('dns.records.create.ttl.validation')).toContainText('604800');
  await expect(createSubmit).toBeDisabled();

  await createTtl.fill('604800');
  await expect(createSubmit).toBeEnabled();

  // A blank value is the intentional create contract: omit the override and
  // let the new record inherit the zone default.
  await createTtl.fill('');
  await createSubmit.click();
  await expect.poll(() => createPayload?.dns_record).toBeTruthy();
  expect(createPayload.dns_record).not.toHaveProperty('ttl');

  const editButton = page.locator(
    '[data-testid="dns.record.row.100.edit"]:visible, [data-testid="dns.record.card.100.edit"]:visible'
  );
  await editButton.click();

  const editTtl = page.getByTestId('dns.records.edit.ttl');
  await expect(editTtl).toHaveValue('3600');
  await editTtl.fill('');
  await expect(page.getByTestId('dns.records.edit.submit')).toBeEnabled();
  await page.getByTestId('dns.records.edit.submit').click();
  await expect.poll(() => updatePayload?.dns_record?.ttl).toBeNull();

  await page.goto('/app/dns/zones/10/settings');
  const zoneTtl = page.getByTestId('dns.settings.default_ttl');
  const zoneTtlFeedback = page.getByTestId('dns.settings.default_ttl.validation');
  const save = page.getByTestId('dns.settings.save');

  await expect(zoneTtl).toHaveValue('3600');
  await expect(zoneTtl).toHaveAttribute('min', '60');
  await expect(zoneTtl).toHaveAttribute('max', '604800');

  await zoneTtl.fill('');
  await expect(zoneTtl).toHaveAttribute('aria-invalid', 'true');
  await expect(zoneTtlFeedback).toContainText('required');
  await expect(save).toBeDisabled();

  await zoneTtl.fill('59');
  await expect(zoneTtlFeedback).toContainText('60');
  await expect(save).toBeDisabled();

  await zoneTtl.fill('60');
  await expect(zoneTtl).toHaveAttribute('aria-invalid', 'false');
  await expect(save).toBeEnabled();

  await zoneTtl.fill('604801');
  await expect(zoneTtlFeedback).toContainText('604800');
  await expect(save).toBeDisabled();

  const proofScreenshot = process.env.E2E_DNS_TTL_PROOF_SCREENSHOT?.trim();
  if (proofScreenshot) {
    await page.screenshot({
      path: proofScreenshot.replace(/\.png$/i, `-${testInfo.project.name}.png`),
      fullPage: true,
    });
  }

  await zoneTtl.fill('604800');
  await expect(save).toBeEnabled();
  await save.click();
  await expect.poll(() => zoneUpdatePayload?.dns_zone?.default_ttl).toBe(604800);

  await expectNoDocumentHorizontalOverflow(page);
});

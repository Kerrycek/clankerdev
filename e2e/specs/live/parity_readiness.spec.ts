import { expect, test } from '@playwright/test';

const liveEnabled = process.env.E2E_LIVE_PARITY === '1';
const liveVpsId = process.env.E2E_LIVE_VPS_ID;
const liveSwapTargetVpsId = process.env.E2E_LIVE_SWAP_TARGET_VPS_ID;
const liveDatasetId = process.env.E2E_LIVE_DATASET_ID;

test.describe('@live-manual live parity readiness', () => {
  test.skip(!liveEnabled, 'Set E2E_LIVE_PARITY=1 to run against a real dev environment.');

  test('VPS lifecycle workflows expose real-operation gates without submitting actions', async ({ page }) => {
    test.skip(!liveVpsId, 'Set E2E_LIVE_VPS_ID to a disposable VPS ID.');

    await page.goto(`/admin/vps/${liveVpsId}/lifecycle`);

    await expect(page.getByTestId('vps.lifecycle.page')).toBeVisible();
    await expect(page.getByTestId('vps.lifecycle.clone')).toBeVisible();
    await expect(page.getByTestId('vps.lifecycle.delete')).toBeVisible();

    await expect(page.getByTestId('vps.lifecycle.clone.submit')).toBeDisabled();
    await expect(page.getByTestId('vps.lifecycle.delete.submit')).toBeDisabled();

    await page.getByTestId('vps.lifecycle.swap.open').click();
    await expect(page.getByTestId('vps.lifecycle.swap.drawer')).toBeVisible();
    await expect(page.getByTestId('vps.lifecycle.swap.submit')).toBeDisabled();

    if (liveSwapTargetVpsId) {
      await page.getByTestId('vps.lifecycle.swap.target').fill(`#${liveSwapTargetVpsId}`);
      await expect(page.getByTestId('vps.lifecycle.swap.preview')).toBeVisible();
      await expect(page.getByTestId('vps.lifecycle.swap.preview.after_table')).toBeVisible();
    }

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('vps.lifecycle.boot')).toBeVisible();
    await expect(page.getByTestId('vps.lifecycle.reinstall')).toBeVisible();
    await expect(page.getByTestId('vps.lifecycle.boot.submit')).toBeDisabled();
    await expect(page.getByTestId('vps.lifecycle.reinstall.submit')).toBeDisabled();
  });

  test('dataset workflows expose real-operation gates without submitting actions', async ({ page }) => {
    test.skip(!liveDatasetId, 'Set E2E_LIVE_DATASET_ID to a disposable dataset ID.');

    await page.goto(`/admin/datasets/${liveDatasetId}`);

    await expect(page.getByTestId('dataset.header')).toBeVisible();
    await expect(page.getByTestId('dataset.manage')).toBeVisible();

    await page.getByTestId('dataset.manage.create.open').click();
    await expect(page.getByTestId('dataset.manage.create.modal')).toBeVisible();
    await expect(page.getByTestId('dataset.manage.create.submit')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('dataset.manage.edit.open').click();
    await expect(page.getByTestId('dataset.manage.edit.modal')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('dataset.manage.delete.open').click();
    await expect(page.getByTestId('dataset.manage.delete.confirm')).toBeVisible();
    await expect(page.getByTestId('dataset.manage.delete.confirm.confirm')).toBeDisabled();
    await page.getByTestId('dataset.manage.delete.confirm.cancel').click();
  });

  test('snapshot and download workflows expose real-operation gates without submitting actions', async ({ page }) => {
    test.skip(!liveDatasetId, 'Set E2E_LIVE_DATASET_ID to a disposable dataset ID.');

    await page.goto(`/admin/datasets/${liveDatasetId}/snapshots`);

    await expect(page.getByTestId('dataset.snapshots.list')).toBeVisible();
    await page.getByTestId('dataset.snapshots.create.open').click();
    await expect(page.getByTestId('dataset.snapshots.create.modal')).toBeVisible();
    await expect(page.getByTestId('dataset.snapshots.create.submit')).toBeVisible();
    await page.getByTestId('dataset.snapshots.create.cancel').click();

    await page.goto(`/admin/datasets/${liveDatasetId}/downloads`);

    await expect(page.getByTestId('dataset.downloads.list')).toBeVisible();
    await page.getByTestId('dataset.downloads.create.open').click();
    await expect(page.getByTestId('dataset.downloads.create.modal')).toBeVisible();
    await expect(page.getByTestId('dataset.downloads.create.submit')).toBeVisible();
    await page.getByTestId('dataset.downloads.create.cancel').click();
  });
});

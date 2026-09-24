import { expect, test, type Page } from '@playwright/test';
import { bootstrapVpsAdminWindow, installHaveApiMock, jsonFulfill, setUiSettingsLocalStorage } from '../../fixtures';

// Synthetic API fixtures: these tests never mutate a real VPS or dataset.
async function setup(page: Page, options: { level?: number; language?: 'cs' | 'en' } = {}) {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
  await setUiSettingsLocalStorage(page, { language: options.language ?? 'en' });
  const state = {
    vps: { id: 123, hostname: 'example.test', object_state: 'active', is_running: true, manage_hostname: true,
      cpu: 2, memory: 2048, swap: 0, cpu_limit: 100, diskspace: 20480, allow_admin_modifications: true,
      dataset: { id: 10, name: 'root' }, user: { id: 42, login: 'member' }, node: { id: 1, domain_name: 'node.test' } },
    dataset: { id: 10, name: 'root', full_name: 'tank/root', refquota: 20480, used: 5120, object_state: 'active', user: { id: 42 } },
    diskWrites: [] as unknown[], vpsWrites: [] as unknown[],
    failDisk: false, missingTask: false, busyDataset: false,
  };
  const mock = await installHaveApiMock(page, {
    user: { id: 42, login: 'admin', level: options.level ?? 99 },
    handlers: {
      'GET vpses/123': () => ({ vps: state.vps }),
      'GET datasets/10': () => ({ dataset: state.dataset }),
      'GET ip_addresses': () => ({ ip_addresses: [] }),
      'GET dns_resolvers': () => ({ dns_resolvers: [] }),
      'GET user_namespace_maps': () => ({ user_namespace_maps: [] }),
      'GET transaction_chains': ctx => ({ transaction_chains: state.busyDataset && ctx.searchParams.get('transaction_chain[class_name]') === 'Dataset' ? [{ id: 1, state: 'queued' }] : [] }),
      'PUT datasets/10': ctx => {
        state.diskWrites.push(ctx.json);
        if (state.failDisk) return jsonFulfill({ status: false, message: 'Resource allocation failed', response: null }, 422);
        if (state.missingTask) return {};
        Object.assign(state.dataset, (ctx.json as any).dataset);
        return { _meta: { action_state_id: 901 } };
      },
      'PUT vpses/123': ctx => {
        state.vpsWrites.push(ctx.json);
        Object.assign(state.vps, (ctx.json as any).vps);
        return { vps: state.vps, _meta: { action_state_id: 902 } };
      },
      'GET action_states/901': () => ({ action_state: { id: 901, finished: true, status: true, current: 1, total: 1 } }),
      'GET action_states/902': () => ({ action_state: { id: 902, finished: true, status: true, current: 1, total: 1 } }),
    },
  });
  return { state, mock };
}
const disk = (page: Page) => page.getByTestId('vps.resources.disk.size');
const memory = (page: Page) => page.getByRole('spinbutton', { name: /^Memory \(MiB\)/ });
async function submitDisk(page: Page) {
  await page.getByTestId('vps.resources.disk.save').click();
  await page.getByTestId('vps.resources.disk.confirm.confirm').click();
}
async function submitVps(page: Page) {
  await page.getByTestId('vps.config.header.save').click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}

test.describe('@pr-smoke @pr-smoke-mobile VPS resource workspace', () => {
  for (const language of ['cs', 'en'] as const) {
    test(`opens focused resources from overview, ${language}`, async ({ page }, testInfo) => {
      await setup(page, { language });
      await page.goto('/admin/vps/123');
      const entry = page.getByTestId('vps.overview.resources_usage.card').getByRole('link');
      await expect(entry).toHaveAttribute('href', /\/config\?section=resources/);
      await entry.click();
      await expect(disk(page)).toHaveValue('20');
      await expect(page.getByTestId('vps.config.additional')).not.toHaveAttribute('open', '');
      await expect(page.getByTestId('vps.config.review')).toHaveCount(0);
      await page.getByTestId('vps.resources.workspace').scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(`resources-${language}.png`), fullPage: true });
      await page.getByTestId('vps.config.additional').locator('summary').click();
      await expect(page.getByTestId('vps.config.additional')).toHaveAttribute('open', '');
    });
  }

  for (const first of ['disk', 'vps']) {
    test(`preserves the other draft when saving ${first} first`, async ({ page }) => {
      const { state } = await setup(page);
      await page.goto('/admin/vps/123/config?section=resources');
      await memory(page).fill('4096');
      await disk(page).fill('32');
      if (first === 'disk') {
        await submitDisk(page);
        await expect(page.getByTestId('vps.resources.disk.confirm')).toBeHidden();
        await expect(memory(page)).toHaveValue('4096');
        expect(state.vpsWrites).toEqual([]);
        await submitVps(page);
      } else {
        await submitVps(page);
        await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
        await expect(disk(page)).toHaveValue('32');
        expect(state.diskWrites).toEqual([]);
        await submitDisk(page);
      }
      await expect.poll(() => state.diskWrites).toEqual([{ dataset: { refquota: 32768 } }]);
      await expect.poll(() => state.vpsWrites).toEqual([{ vps: { memory: 4096 } }]);
    });
  }

  test('keeps both drafts after allocation failure and retries with explicit disk override', async ({ page }) => {
    const { state } = await setup(page);
    state.failDisk = true;
    await page.goto('/admin/vps/123/config?section=resources');
    await memory(page).fill('4096');
    await disk(page).fill('32');
    await submitDisk(page);
    await expect(page.getByTestId('vps.resources.disk.confirm')).toContainText('Resource allocation failed');
    await page.getByTestId('vps.resources.disk.confirm.cancel').click();
    await expect(disk(page)).toHaveValue('32');
    await expect(memory(page)).toHaveValue('4096');
    await page.getByTestId('vps.resources.disk.override').check();
    state.failDisk = false;
    await submitDisk(page);
    await expect.poll(() => state.diskWrites.length).toBe(2);
    expect(state.diskWrites[1]).toEqual({ dataset: { refquota: 32768, admin_override: true } });
    expect(state.vpsWrites).toEqual([]);
    await expect(page.getByTestId('vps.resources.disk.override')).not.toBeChecked();
  });

  test('validates used space and rechecks dataset activity before writing', async ({ page }) => {
    const { state } = await setup(page);
    await page.goto('/admin/vps/123/config?section=resources');
    await disk(page).fill('4');
    await expect(page.getByTestId('vps.resources.disk.save')).toBeDisabled();
    await expect(page.getByTestId('vps.resources.disk')).toContainText('cannot be smaller');
    await disk(page).fill('32');
    await page.getByTestId('vps.resources.disk.save').click();
    state.busyDataset = true;
    await page.getByTestId('vps.resources.disk.confirm.confirm').click();
    await expect(page.getByTestId('vps.resources.disk.confirm')).toContainText('Operation in progress');
    expect(state.diskWrites).toEqual([]);
  });

  test('blocks blind retries after a success response without task identification', async ({ page }) => {
    const { state } = await setup(page);
    state.missingTask = true;
    await page.goto('/admin/vps/123/config?section=resources');
    await disk(page).fill('32');
    await submitDisk(page);
    await expect(page.getByTestId('vps.resources.disk.confirm')).toContainText('did not confirm the disk change');
    await page.getByTestId('vps.resources.disk.confirm.cancel').click();
    await expect(page.getByTestId('vps.resources.disk.save')).toBeDisabled();
    await page.reload();
    await disk(page).fill('32');
    await expect(page.getByTestId('vps.resources.disk.save')).toBeDisabled();
    expect(state.diskWrites).toHaveLength(1);
  });

  test('fails closed when a fresh disk read fails or used space has increased', async ({ page }) => {
    const { state, mock } = await setup(page);
    await page.goto('/admin/vps/123/config?section=resources');
    await disk(page).fill('10');
    await page.getByTestId('vps.resources.disk.save').click();
    state.dataset.used = 15 * 1024;
    await page.getByTestId('vps.resources.disk.confirm.confirm').click();
    await expect(page.getByTestId('vps.resources.disk.confirm')).toContainText('cannot be smaller');
    expect(state.diskWrites).toEqual([]);
    await page.getByTestId('vps.resources.disk.confirm.cancel').click();
    await disk(page).fill('32');
    await page.getByTestId('vps.resources.disk.save').click();
    mock.addHandler('GET datasets/10', () => jsonFulfill({ status: false, message: 'Disk unavailable', response: null }, 503));
    await page.getByTestId('vps.resources.disk.confirm.confirm').click();
    await expect(page.getByTestId('vps.resources.disk.confirm')).toContainText('Disk unavailable');
    expect(state.diskWrites).toEqual([]);
  });

  test('keeps VPS editing usable when the root disk cannot be loaded', async ({ page }) => {
    const { mock } = await setup(page);
    mock.addHandler('GET datasets/10', () => jsonFulfill({ status: false, message: 'Not found', response: null }, 404));
    await page.goto('/admin/vps/123/config?section=resources');
    await expect(page.getByTestId('vps.resources.disk')).toContainText('Could not load');
    await expect(disk(page)).toHaveCount(0);
    await memory(page).fill('4096');
    await expect(page.getByTestId('vps.config.header.save')).toBeEnabled();
  });

  test('keeps root resizing admin-only, including admin personal mode', async ({ page }) => {
    await setup(page);
    await page.goto('/app/vps/123/config?section=resources');
    await expect(memory(page)).toBeVisible();
    await expect(page.getByTestId('vps.resources.disk')).toHaveCount(0);
  });

  test('does not expose root resizing to a member', async ({ page }) => {
    await setup(page, { level: 1 });
    await page.goto('/app/vps/123/config?section=resources');
    await expect(memory(page)).toBeVisible();
    await expect(page.getByTestId('vps.resources.disk')).toHaveCount(0);
  });
});

import { expect, test, type Page } from '@playwright/test';
import { bootstrapVpsAdminWindow, installHaveApiMock, setUiSettingsLocalStorage, type HaveApiHandler } from '../../fixtures';

const node = { id: 5, name: 'node5', domain_name: 'node5.example.test', type: 'node', active: true };
const boot = { id: 100, event_type: 'boot', booted_release: '6.12.1', reported_release: '6.12.2', observed_after: '2026-09-20T10:00:00Z', observed_before: '2026-09-20T11:00:00Z', source: 'reconstructed_node_status', confidence: 'inferred', current: true };

async function setup(page: Page, level = 10, handlers: Record<string, HaveApiHandler> = {}, language: 'cs' | 'en' = 'en') {
  await setUiSettingsLocalStorage(page, { language });
  await bootstrapVpsAdminWindow(page);
  const requests: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/v7.0/')) requests.push(new URL(request.url()).pathname); });
  await installHaveApiMock(page, {
    user: { id: 1, login: 'test-member', level },
    handlers: {
      'GET nodes/5': () => ({ node }),
      'GET nodes': () => ({ nodes: [node] }),
      'GET nodes/5/kernel_history': () => ({ kernel_histories: [boot] }),
      'GET node_system_states': () => ({ node_system_states: [{ id: 9, first_observed_at: '2026-09-01T10:00:00Z', last_observed_at: '2026-09-20T11:00:00Z', current: true, cpus: 16, total_memory: 32768, total_swap: 0, cgroup_version: 'cgroup_v2' }] }),
      'GET node_kernel_parameters': () => ({ node_kernel_parameters: [{ id: 1, position: 0, name: 'quiet', value: null }, { id: 2, position: 1, name: 'console', value: 'ttyS0' }] }),
      'GET node_kernel_evidences': () => ({ node_kernel_evidences: [{ id: 2, kernel_command_line: `quiet console=ttyS0 ${'long-parameter='.repeat(35)}` }] }),
      'GET node_sysctls': () => ({ node_sysctls: [{ id: 3, name: 'net.ipv4.ip_forward', configured_value: '1', effective_value: '0', available: true }] }),
      'GET node_software_versions': () => ({ node_software_versions: [
        { id: 5, component: 'vpsadminos', generation: 'booted', version: '26.09', revision: 'abcdef', revision_dirty: false },
        { id: 6, component: 'vpsadminos', generation: 'current', version: '26.10', revision: 'fedcba', revision_dirty: true },
      ] }),
      ...handlers,
    },
  });
  return requests;
}

for (const language of ['cs', 'en'] as const) {
  test(`@smoke @smoke-mobile @pr-smoke @pr-smoke-mobile member reads kernel and system history in ${language}`, async ({ page }, testInfo) => {
    const requests = await setup(page, 10, {}, language);
    await page.goto('/app/nodes/5/history');
    await expect(page.getByRole('heading', { name: language === 'cs' ? 'Historie kernelu' : 'Kernel history' })).toBeVisible();
    await expect(page.getByTestId('node.history.kernel')).toContainText('6.12.1');
    await expect(page.getByTestId('node.history.kernel')).toContainText(language === 'cs' ? '20. 9. 2026' : '20/09/2026');
    await expect(page.getByTestId('node.history.kernel')).toContainText(language === 'cs' ? 'nejpozději' : 'no later than');
    await expect(page.locator('[data-vpsadmin-doc-id="node.kernel-parameters"]')).toHaveCount(0);
    if (language === 'cs') await page.screenshot({ path: testInfo.outputPath('kernel-history.png'), fullPage: true });
    await page.locator('[data-vpsadmin-doc-id="node.system-history"]').click();
    await expect(page.getByTestId('node.history.system')).toContainText('32 GiB');
    await expect(page.getByTestId('node.history.system')).toContainText('0 MiB');
    await page.reload();
    await expect(page.getByTestId('node.history.system')).toBeVisible();
    expect(requests.some((path) => /node_(kernel|software|sysctl)|\/statuses$/.test(path))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  });
}

for (const level of [10, 21]) {
  test(`@smoke @smoke-mobile @pr-smoke @pr-smoke-mobile role ${level} cannot open admin evidence by URL`, async ({ page }) => {
    const requests = await setup(page, level);
    for (const section of ['parameters', 'sysctls', 'software']) {
      await page.goto(`/app/nodes/5/history?section=${section}`);
      await expect(page.getByTestId('node.history.page')).toHaveCount(0);
      await expect(page.getByText(/access denied|access forbidden|permission/i).first()).toBeVisible();
    }
    expect(requests.some((path) => /node_(kernel|software|sysctl)/.test(path))).toBe(false);
  });
}

test('@smoke @smoke-mobile @pr-smoke @pr-smoke-mobile admin sees boot parameters, sysctls and both software generations', async ({ page }) => {
  await setup(page, 99);
  await page.goto('/admin/nodes/5/history?section=parameters');
  await expect(page.getByTestId('node.history.parameters')).toContainText('ttyS0');
  await expect(page.getByRole('heading', { name: 'Raw boot command line' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(2);
  await page.locator('[data-vpsadmin-doc-id="node.sysctls"]').click();
  await expect(page.getByTestId('node.history.sysctls')).toContainText('Differs');
  await page.locator('[data-vpsadmin-doc-id="node.software-versions"]').click();
  await expect(page.getByTestId('node.history.software')).toContainText('Booted system');
  await expect(page.getByTestId('node.history.software')).toContainText('Currently activated system');
  await expect(page.getByTestId('node.history.software')).toContainText('Locally modified');
});

test('@smoke @smoke-mobile @pr-smoke @pr-smoke-mobile history pagination follows the last row and resets on node change', async ({ page }) => {
  const cursors: Array<string | null> = [];
  const systemCursors: Array<string | null> = [];
  await setup(page, 10, {
    'GET nodes/5/kernel_history': ({ searchParams }) => {
      const cursor = searchParams.get('kernel_history[from_id]'); cursors.push(cursor);
      return { kernel_histories: cursor ? [{ ...boot, id: 10, reported_release: 'older-kernel' }] : Array.from({ length: 50 }, (_, index) => ({ ...boot, id: 100 - index })) };
    },
    'GET nodes/6': () => ({ node: { ...node, id: 6, domain_name: 'node6.example.test' } }),
    'GET nodes/6/kernel_history': ({ searchParams }) => { expect(searchParams.has('kernel_history[from_id]')).toBe(false); return { kernel_histories: [] }; },
    'GET node_system_states': ({ searchParams }) => {
      const cursor = searchParams.get('node_system_state[from_id]'); systemCursors.push(cursor);
      return { node_system_states: cursor ? [] : Array.from({ length: 50 }, (_, index) => ({
        id: index === 0 ? 5 : 100 - index,
        first_observed_at: '2026-09-01T10:00:00Z', last_observed_at: '2026-09-20T11:00:00Z', current: false,
      })) };
    },
  });
  await page.goto('/app/nodes/5/history');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByTestId('node.history.kernel')).toContainText('older-kernel');
  expect(cursors).toContain('51');
  await page.getByRole('button', { name: 'Prev', exact: true }).click();
  await expect(page.getByTestId('node.history.kernel').locator('tbody tr')).toHaveCount(50);
  await page.locator('[data-vpsadmin-doc-id="node.system-history"]').click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByTestId('node.history.system')).toContainText('No records are available yet.');
  expect(systemCursors).toContain('51');
  expect(systemCursors).not.toContain('5');
  await page.goto('/app/nodes/6/history');
  await expect(page.getByTestId('node.history.kernel')).toContainText('No records are available yet.');
});

test('@smoke @smoke-mobile @pr-smoke @pr-smoke-mobile failed API is retryable and never displayed as empty history', async ({ page }) => {
  let fail = true;
  await setup(page, 10, { 'GET nodes/5/kernel_history': () => fail ? { status: 503, contentType: 'application/json', body: JSON.stringify({ status: false, message: 'Unavailable' }) } : { kernel_histories: [boot] } });
  await page.goto('/app/nodes/5/history');
  await expect(page.getByTestId('node.history.kernel')).not.toContainText('No records are available yet.');
  await expect(page.getByTestId('node.history.kernel').getByRole('button', { name: /retry|try again/i })).toBeVisible();
  fail = false;
  await page.getByTestId('node.history.kernel').getByRole('button', { name: /retry|try again/i }).click();
  await expect(page.getByTestId('node.history.kernel')).toContainText('6.12.1');
});

test('@smoke @smoke-mobile @pr-smoke @pr-smoke-mobile member can discover node history from the node list', async ({ page }) => {
  await setup(page);
  await page.goto('/app/nodes');
  await page.locator('a[href="/app/nodes/5"]').filter({ visible: true }).first().click();
  await expect(page.getByTestId('node.history.kernel')).toContainText('6.12.1');
});

test('@smoke @smoke-mobile @pr-smoke @pr-smoke-mobile admin detail links to history using its KB landmark', async ({ page }) => {
  await setup(page, 99, {
    'GET nodes/5/statuses': () => ({ statuses: [] }),
    'GET transactions': () => ({ transactions: [] }),
    'GET transaction_chains': () => ({ transaction_chains: [] }),
  });
  await page.goto('/admin/nodes/5');
  await page.locator('a[data-vpsadmin-doc-id="node.kernel-history"]').click();
  await expect(page.getByTestId('node.history.kernel')).toContainText('6.12.1');
});

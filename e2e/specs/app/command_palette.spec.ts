import { expect, test, type Page } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

type ClipboardProbe = { writes: string[] };

async function installClipboardProbe(page: Page) {
  await page.addInitScript(() => {
    const probe: ClipboardProbe = { writes: [] };
    const stateWindow = window as typeof window & { __paletteClipboardProbe?: ClipboardProbe };
    stateWindow.__paletteClipboardProbe = probe;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          probe.writes.push(text);
        },
      },
    });
  });
}

async function readClipboardProbe(page: Page): Promise<ClipboardProbe> {
  return page.evaluate(() => {
    const stateWindow = window as typeof window & { __paletteClipboardProbe?: ClipboardProbe };
    return stateWindow.__paletteClipboardProbe ?? { writes: [] };
  });
}

async function openCommandPalette(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
  });
  await expect(page.getByTestId('palette.modal')).toBeVisible();
}

test.describe('Command palette', () => {
  test('opens and searches VPSes in user view', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'user', level: 1 },
      handlers: {
        'GET vpses': (ctx) => {
          // Both the list page and command palette search use this endpoint.
          const q = String(ctx.searchParams.get('vps[hostname_any]') ?? '').trim();
          const list = q
            ? [
                {
                  id: 3,
                  hostname: 'vps3.example',
                  object_state: 'active',
                  is_running: true,
                  cpus: 2,
                  memory: 2048,
                  diskspace: 20480,
                  used_memory: 512,
                  used_diskspace: 4096,
                  node: { id: 1, domain_name: 'node1' },
                },
              ]
            : [
                {
                  id: 3,
                  hostname: 'vps3.example',
                  object_state: 'active',
                  is_running: true,
                  cpus: 2,
                  memory: 2048,
                  diskspace: 20480,
                  used_memory: 512,
                  used_diskspace: 4096,
                  node: { id: 1, domain_name: 'node1' },
                },
              ];

          return { vpses: list };
        },
        'GET vpses/3': () => ({
          vps: {
            id: 3,
            hostname: 'vps3.example',
            object_state: 'active',
            is_running: true,
            cpus: 2,
            memory: 2048,
            diskspace: 20480,
            used_memory: 512,
            used_diskspace: 4096,
            node: { id: 1, domain_name: 'node1', location: { id: 1, label: 'DC1' } },
            user: { id: 1, login: 'user' },
          },
        }),
        'GET vpses/3/statuses': () => [],
        'GET ip_addresses': (ctx) => {
          const vpsId = ctx.searchParams.get('ip_address[vps]');
          if (vpsId !== '3') return [];
          return [
            {
              id: 10,
              addr: '203.0.113.10',
              prefix: 32,
              routed: true,
              network: { id: 1, address: '203.0.113.0', prefix: 24, role: 'public', purpose: 'public' },
            },
          ];
        },
      },
    });

    await page.goto('/app/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();

    await openCommandPalette(page);

    await page.getByTestId('palette.input').fill('vps3');
    await expect(page.getByTestId('palette.result.0')).toBeVisible();
    await page.getByTestId('palette.result.0').click();

    await expect(page).toHaveURL(/\/app\/vps\/3$/);
    await expect(page.getByTestId('vps.header')).toBeVisible();
  });

  test('exposes combobox selection state, retains input focus, and sizes help for the viewport', async ({ page }, testInfo) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'user', level: 1 },
      handlers: {
        'GET vpses': () => ({
          vpses: [
            {
              id: 3,
              hostname: 'vps3.example',
              object_state: 'active',
              is_running: true,
              cpus: 2,
              memory: 2048,
              diskspace: 20480,
              used_memory: 512,
              used_diskspace: 4096,
              node: { id: 1, domain_name: 'node1' },
            },
            {
              id: 4,
              hostname: 'vps4.example',
              object_state: 'active',
              is_running: true,
              cpus: 2,
              memory: 2048,
              diskspace: 20480,
              used_memory: 768,
              used_diskspace: 5120,
              node: { id: 1, domain_name: 'node1' },
            },
          ],
        }),
      },
    });

    await page.goto('/app/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();

    const returnTarget = testInfo.project.name === 'mobile-chrome'
      ? page.getByTestId('palette.open')
      : page.getByTestId('shell.inline-search.input');
    await returnTarget.focus();
    await openCommandPalette(page);

    const input = page.getByTestId('palette.input');
    const helpButton = page.getByTestId('palette.help.open');
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('role', 'combobox');
    await expect(input).toHaveAttribute('aria-autocomplete', 'list');
    await expect(input).toHaveAttribute('aria-controls', 'command-palette-listbox');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(input).not.toHaveAttribute('aria-activedescendant');
    await expect(page.getByTestId('palette.empty')).toHaveAttribute('role', 'status');
    await expect(page.getByTestId('palette.empty')).toHaveAttribute('aria-live', 'polite');

    const helpBox = await helpButton.boundingBox();
    expect(helpBox).not.toBeNull();
    if (testInfo.project.name === 'mobile-chrome') {
      expect(helpBox!.width).toBeGreaterThanOrEqual(44);
      expect(helpBox!.height).toBeGreaterThanOrEqual(44);
    } else {
      expect(helpBox!.width).toBeLessThanOrEqual(40);
      expect(helpBox!.height).toBeLessThanOrEqual(36);
    }

    await input.fill('vps');
    const listbox = page.getByRole('listbox', { name: 'Quickly search objects' });
    const firstOption = page.getByTestId('palette.result.0');
    const secondOption = page.getByTestId('palette.result.1');
    await expect(listbox).toHaveAttribute('id', 'command-palette-listbox');
    await expect(firstOption).toHaveAttribute('role', 'option');
    await expect(firstOption).toHaveAttribute('id', 'command-palette-listbox-option-0');
    await expect(secondOption).toHaveAttribute('id', 'command-palette-listbox-option-1');
    await expect(input).toHaveAttribute('aria-expanded', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', 'command-palette-listbox-option-0');
    await expect(firstOption).toHaveAttribute('aria-selected', 'true');

    await input.press('ArrowDown');
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('aria-activedescendant', 'command-palette-listbox-option-1');
    await expect(firstOption).toHaveAttribute('aria-selected', 'false');
    await expect(secondOption).toHaveAttribute('aria-selected', 'true');

    await input.press('ArrowUp');
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('aria-activedescendant', 'command-palette-listbox-option-0');
    await expect(firstOption).toHaveAttribute('aria-selected', 'true');

    await input.press('Escape');
    await expect(page.getByTestId('palette.modal')).toHaveCount(0);
    await expect(returnTarget).toBeFocused();
  });

  test('keeps palette action buttons keyboard-operable while results are present', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 99, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'POST cluster/search': () => ({
          cluster_search: [{ resource: 'User', id: 5, value: 'alice', attribute: 'login' }],
        }),
        'GET users/5': () => ({
          user: { id: 5, login: 'alice', full_name: 'Alice A.', email: 'alice@example', level: 1 },
        }),
      },
    });

    await page.goto('/admin/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    const startUrl = page.url();
    await openCommandPalette(page);

    const input = page.getByTestId('palette.input');
    await input.fill('alice');
    await expect(page.getByTestId('palette.result.0')).toBeVisible();

    const helpButton = page.getByTestId('palette.help.open');
    await helpButton.focus();
    await helpButton.press('Enter');
    await expect(page.getByTestId('palette.help')).toBeVisible();
    await expect(page).toHaveURL(startUrl);

    const backButton = page.getByRole('button', { name: 'Back to search' });
    await backButton.focus();
    await backButton.press('Enter');
    await expect(page.getByTestId('palette.help')).toHaveCount(0);

    const closeButton = page.getByTestId('palette.modal').getByRole('button', { name: 'Close', exact: true });
    await closeButton.focus();
    await closeButton.press('Enter');
    await expect(page.getByTestId('palette.modal')).toHaveCount(0);
    await expect(page).toHaveURL(startUrl);
  });

  test('keeps the help target touch-sized for wide coarse and hybrid pointers', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1024, height: 600 });
    if (testInfo.project.name === 'chromium') {
      await page.addInitScript(() => {
        const nativeMatchMedia = window.matchMedia.bind(window);
        window.matchMedia = (query: string): MediaQueryList => {
          if (query !== '(pointer: coarse)' && query !== '(any-pointer: coarse)') {
            return nativeMatchMedia(query);
          }
          const matches = query === '(any-pointer: coarse)';
          return {
            matches,
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
          };
        };
      });
    }
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });
    await installHaveApiMock(page, {
      user: { id: 1, login: 'user', level: 1 },
      handlers: { 'GET vpses': () => ({ vpses: [] }) },
    });

    await page.goto('/app/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    await openCommandPalette(page);

    const helpButton = page.getByTestId('palette.help.open');
    const pointerMedia = await page.evaluate(() => ({
      fine: matchMedia('(pointer: fine)').matches,
      pointerCoarse: matchMedia('(pointer: coarse)').matches,
      anyPointerCoarse: matchMedia('(any-pointer: coarse)').matches,
    }));
    if (testInfo.project.name === 'chromium') {
      expect(pointerMedia).toEqual({ fine: true, pointerCoarse: false, anyPointerCoarse: true });
    } else {
      expect(pointerMedia.pointerCoarse || pointerMedia.anyPointerCoarse).toBe(true);
    }

    const touchBox = await helpButton.boundingBox();
    expect(touchBox).not.toBeNull();
    expect(touchBox!.width).toBeGreaterThanOrEqual(44);
    expect(touchBox!.height).toBeGreaterThanOrEqual(44);
  });

  test('supports quick-jump by VPS numeric ID in user view', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 1, login: 'user', level: 1 },
      handlers: {
        'GET vpses': (ctx) => {
          // When searching by ID we intentionally do not rely on hostname_any.
          // Returning empty list ensures the palette uses the show action.
          const q = String(ctx.searchParams.get('vps[hostname_any]') ?? '').trim();
          if (q === '3') return { vpses: [] };
          return {
            vpses: [
              {
                id: 3,
                hostname: 'vps3.example',
                object_state: 'active',
                is_running: true,
                cpus: 2,
                memory: 2048,
                diskspace: 20480,
                used_memory: 512,
                used_diskspace: 4096,
                node: { id: 1, domain_name: 'node1' },
              },
            ],
          };
        },
        'GET vpses/3': () => ({
          vps: {
            id: 3,
            hostname: 'vps3.example',
            object_state: 'active',
            is_running: true,
            cpus: 2,
            memory: 2048,
            diskspace: 20480,
            used_memory: 512,
            used_diskspace: 4096,
            node: { id: 1, domain_name: 'node1', location: { id: 1, label: 'DC1' } },
            user: { id: 1, login: 'user' },
          },
        }),
        'GET vpses/3/statuses': () => [],
      },
    });

    await page.goto('/app/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();

    await openCommandPalette(page);

    await page.getByTestId('palette.input').fill('3');
    await expect(page.getByTestId('palette.result.0')).toBeVisible();
    await page.getByTestId('palette.result.0').click();

    await expect(page).toHaveURL(/\/app\/vps\/3$/);
    await expect(page.getByTestId('vps.header')).toBeVisible();
  });

  test('searches cluster objects in admin view', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 99, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'POST cluster/search': () => ({
          cluster_search: [
            { resource: 'User', id: 5, value: '5', attribute: 'id' },
            { resource: 'User', id: 5, value: 'alice', attribute: 'login' },
          ],
        }),
        'GET users/5': () => ({ user: { id: 5, login: 'alice', full_name: 'Alice A.', email: 'alice@example', level: 1 } }),
      },
    });

    await page.goto('/admin/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    await openCommandPalette(page);

    const input = page.getByTestId('palette.input');
    const firstOption = page.getByTestId('palette.result.0');
    const duplicateOption = page.getByTestId('palette.result.1');
    await input.fill('alice');
    await expect(firstOption).toBeVisible();
    await expect(duplicateOption).toBeVisible();
    await expect(firstOption).toContainText('Alice A.');
    await expect(firstOption).toContainText('alice@example');
    await expect(firstOption).toHaveAttribute('id', 'command-palette-listbox-option-0');
    await expect(duplicateOption).toHaveAttribute('id', 'command-palette-listbox-option-1');
    await expect(input).toHaveAttribute('aria-activedescendant', 'command-palette-listbox-option-0');
    await expect(firstOption).toHaveAttribute('aria-selected', 'true');
    await expect(duplicateOption).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(1);

    await input.press('ArrowDown');
    await expect(input).toHaveAttribute('aria-activedescendant', 'command-palette-listbox-option-1');
    await expect(firstOption).toHaveAttribute('aria-selected', 'false');
    await expect(duplicateOption).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[role="option"][aria-selected="true"]')).toHaveCount(1);

    await page.getByTestId('palette.result.0').click();

    await expect(page).toHaveURL(/\/admin\/users\/5$/);
    await expect(page.getByTestId('admin.user.page')).toBeVisible();
  });

  test('keeps keyboard selection aligned with group-sorted result order', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 99, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'POST cluster/search': () => ({
          cluster_search: [
            { resource: 'User', id: 5, value: 'alice', attribute: 'login' },
            { resource: 'Vps', id: 6, value: 'vps6.example', attribute: 'hostname' },
          ],
        }),
        'GET users/5': () => ({
          user: { id: 5, login: 'alice', full_name: 'Alice A.', email: 'alice@example', level: 1 },
        }),
      },
    });

    await page.goto('/admin/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    await openCommandPalette(page);

    const input = page.getByTestId('palette.input');
    const firstOption = page.getByTestId('palette.result.0');
    const secondOption = page.getByTestId('palette.result.1');
    await input.fill('mixed');

    await expect(firstOption).toContainText('vps6.example');
    await expect(secondOption).toContainText('Alice A.');
    await expect(firstOption).toHaveAttribute('aria-selected', 'true');
    await expect(secondOption).toHaveAttribute('aria-selected', 'false');
    await expect(input).toHaveAttribute('aria-activedescendant', 'command-palette-listbox-option-0');

    await input.press('ArrowDown');
    await expect(firstOption).toHaveAttribute('aria-selected', 'false');
    await expect(secondOption).toHaveAttribute('aria-selected', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', 'command-palette-listbox-option-1');

    await input.press('Enter');
    await expect(page).toHaveURL(/\/admin\/users\/5$/);
    await expect(page.getByTestId('admin.user.page')).toBeVisible();
  });

  test('exposes the numeric direct-open candidate as the active option', async ({ page }) => {
    await installClipboardProbe(page);
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 99, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'POST cluster/search': () => ({
          cluster_search: [
            { resource: 'User', id: 5, value: 'alice', attribute: 'id' },
            { resource: 'TransactionChain', id: 5, value: 'chain-five', attribute: 'id' },
          ],
        }),
        'GET users/5': () => ({
          user: { id: 5, login: 'alice', full_name: 'Alice A.', email: 'alice@example', level: 1 },
        }),
      },
    });

    await page.goto('/admin/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    const origin = new URL(page.url()).origin;
    await openCommandPalette(page);

    const input = page.getByTestId('palette.input');
    const userOption = page.getByTestId('palette.result.0');
    const chainOption = page.getByTestId('palette.result.1');
    await input.fill('5');

    await expect(userOption).toContainText('Alice A.');
    await expect(chainOption).toContainText('chain-five');
    await expect(userOption).toHaveAttribute('aria-selected', 'false');
    await expect(chainOption).toHaveAttribute('aria-selected', 'true');
    await expect(input).toHaveAttribute('aria-activedescendant', 'command-palette-listbox-option-1');

    await input.press('Control+Shift+C');
    await input.press('Control+Shift+I');
    await expect.poll(() => readClipboardProbe(page)).toEqual({
      writes: [`${origin}/admin/transactions/5`, '#5'],
    });

    await input.press('Enter');
    await expect(page).toHaveURL(/\/admin\/transactions\/5$/);
  });

  test('does not activate or copy stale results while a replacement query is pending', async ({ page }) => {
    await installClipboardProbe(page);
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const searchQueries: string[] = [];
    let releaseReplacement!: () => void;
    await installHaveApiMock(page, {
      user: { id: 99, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'POST cluster/search': async (ctx) => {
          const query = String((ctx.reqJson as any)?.cluster?.value ?? '');
          searchQueries.push(query);
          if (query === '6') {
            await new Promise<void>((resolve) => {
              releaseReplacement = resolve;
            });
            return {
              cluster_search: [
                { resource: 'Vps', id: 6, value: 'vps6.example', attribute: 'id' },
                { resource: 'User', id: 6, value: 'user-six', attribute: 'id' },
              ],
            };
          }
          return {
            cluster_search: query === '5'
              ? [
                  { resource: 'Vps', id: 5, value: 'vps5.example', attribute: 'id' },
                  { resource: 'User', id: 5, value: 'user-five', attribute: 'id' },
                ]
              : [],
          };
        },
        'GET users/5': () => ({
          user: { id: 5, login: 'alice', full_name: 'Alice A.', email: 'alice@example', level: 1 },
        }),
        'GET users/6': () => ({
          user: { id: 6, login: 'bob', full_name: 'Bob B.', email: 'bob@example', level: 1 },
        }),
        'GET vpses/6': () => ({
          vps: {
            id: 6,
            hostname: 'vps6.example',
            object_state: 'active',
            is_running: true,
            cpus: 2,
            memory: 2048,
            diskspace: 20480,
            node: { id: 1, domain_name: 'node1' },
            user: { id: 6, login: 'bob' },
          },
        }),
      },
    });

    await page.goto('/admin/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    const startUrl = page.url();
    await openCommandPalette(page);

    const input = page.getByTestId('palette.input');
    await input.fill('5');
    await expect(page.getByTestId('palette.result.0')).toBeVisible();

    await input.fill('6');
    await expect(input).toHaveAttribute('aria-busy', 'true');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('option')).toHaveCount(0);
    await expect.poll(() => searchQueries).toEqual(['5', '6']);

    await input.press('ArrowDown');

    await input.press('Control+Shift+C');
    await input.press('Control+Shift+I');
    expect(await readClipboardProbe(page)).toEqual({ writes: [] });

    await input.press('Enter');
    await expect(page).toHaveURL(startUrl);
    await expect(page.getByTestId('palette.modal')).toBeVisible();

    releaseReplacement();
    const firstReplacement = page.getByTestId('palette.result.0');
    const secondReplacement = page.getByTestId('palette.result.1');
    await expect(firstReplacement).toBeVisible();
    await expect(secondReplacement).toBeVisible();
    await expect(firstReplacement).toHaveAttribute('aria-selected', 'true');
    await expect(secondReplacement).toHaveAttribute('aria-selected', 'false');

    await input.press('Enter');
    await expect(page).toHaveURL(/\/admin\/vps\/6$/);
    expect(searchQueries).toEqual(['5', '6']);
  });

  test('clears an in-flight search across close, late completion, and reopen', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const searchQueries: string[] = [];
    let slowResponseCompleted = false;
    let releaseSlowSearch!: () => void;
    await installHaveApiMock(page, {
      user: { id: 99, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'POST cluster/search': async (ctx) => {
          const query = String((ctx.reqJson as any)?.cluster?.value ?? '');
          searchQueries.push(query);
          if (query === 'slow') {
            await new Promise<void>((resolve) => {
              releaseSlowSearch = resolve;
            });
            slowResponseCompleted = true;
            return {
              cluster_search: [{ resource: 'Vps', id: 7, value: 'late.example', attribute: 'hostname' }],
            };
          }
          return { cluster_search: [] };
        },
      },
    });

    await page.goto('/admin/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    await openCommandPalette(page);

    const input = page.getByTestId('palette.input');
    await input.fill('slow');
    await expect.poll(() => searchQueries).toEqual(['slow']);
    await expect(input).toHaveAttribute('aria-busy', 'true');

    await page.getByTestId('palette.modal').getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByTestId('palette.modal')).toHaveCount(0);

    await openCommandPalette(page);
    const reopenedInput = page.getByTestId('palette.input');
    await expect(reopenedInput).toHaveValue('');
    await expect(reopenedInput).not.toHaveAttribute('aria-busy');
    await expect(page.getByTestId('palette.empty')).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(0);

    releaseSlowSearch();
    await expect.poll(() => slowResponseCompleted).toBe(true);
    await page.waitForTimeout(250);
    await expect(reopenedInput).toHaveValue('');
    await expect(reopenedInput).not.toHaveAttribute('aria-busy');
    await expect(page.getByTestId('palette.empty')).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(0);
    expect(searchQueries).toEqual(['slow']);
  });

  test('announces command-palette loading, no-results, and error states outside the listbox', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 99, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'POST cluster/search': async (ctx) => {
          const query = String((ctx.reqJson as any)?.cluster?.value ?? '');
          if (query === 'slow') {
            await new Promise((resolve) => setTimeout(resolve, 450));
            return { cluster_search: [] };
          }
          if (query === 'failure') {
            return {
              status: 503,
              contentType: 'application/json',
              body: JSON.stringify({ status: false, message: 'offline', response: null }),
            };
          }
          return { cluster_search: [] };
        },
      },
    });

    await page.goto('/admin/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    await openCommandPalette(page);

    const input = page.getByTestId('palette.input');
    await page.getByTestId('palette.results-scroll').evaluate((container) => {
      const stateWindow = window as typeof window & {
        __paletteStatusObserver?: MutationObserver;
        __paletteStatusTransitions?: string[];
      };
      const transitions: string[] = [];
      const record = () => {
        const status = container.querySelector<HTMLElement>('[role="status"]');
        const next = status?.dataset.testid;
        if (next && transitions.at(-1) !== next) transitions.push(next);
      };
      record();
      const observer = new MutationObserver(record);
      observer.observe(container, { childList: true, subtree: true, characterData: true });
      stateWindow.__paletteStatusObserver = observer;
      stateWindow.__paletteStatusTransitions = transitions;
    });
    await input.fill('slow');

    const loading = page.getByTestId('palette.loading');
    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute('id', 'command-palette-status');
    await expect(loading).toHaveAttribute('role', 'status');
    await expect(loading).toHaveAttribute('aria-live', 'polite');
    await expect(loading).not.toHaveAttribute('aria-busy');
    await expect(input).toHaveAttribute('aria-busy', 'true');
    await expect(input).toHaveAttribute('aria-describedby', 'command-palette-status');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('listbox')).toHaveCount(0);

    const noResults = page.getByTestId('palette.no_results');
    await expect(noResults).toBeVisible();
    await expect(noResults).toHaveAttribute('role', 'status');
    await expect(noResults).toHaveAttribute('aria-live', 'polite');
    await expect(input).not.toHaveAttribute('aria-busy');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('listbox')).toHaveCount(0);

    const statusTransitions = await page.evaluate(() => {
      const stateWindow = window as typeof window & {
        __paletteStatusTransitions?: string[];
      };
      return stateWindow.__paletteStatusTransitions ?? [];
    });
    expect(statusTransitions).toEqual([
      'palette.empty',
      'palette.loading',
      'palette.no_results',
    ]);

    await input.fill('failure');
    const error = page.getByTestId('palette.error');
    await expect(error).toBeVisible();
    await expect(error).toHaveAttribute('role', 'status');
    await expect(error).toHaveAttribute('aria-live', 'polite');
    await expect(input).not.toHaveAttribute('aria-busy');
    await expect(input).toHaveAttribute('aria-describedby', 'command-palette-status');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await page.evaluate(() => {
      const stateWindow = window as typeof window & {
        __paletteStatusObserver?: MutationObserver;
      };
      stateWindow.__paletteStatusObserver?.disconnect();
    });
  });

  test('scrolls the keyboard-active option into view for long result sets', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 99, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'POST cluster/search': () => ({
          cluster_search: Array.from({ length: 30 }, (_, index) => ({
            resource: 'Node',
            id: index + 1,
            value: `node-${String(index + 1).padStart(2, '0')}`,
            attribute: 'domain_name',
          })),
        }),
      },
    });

    await page.goto('/admin/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    await openCommandPalette(page);

    const input = page.getByTestId('palette.input');
    const modal = page.getByTestId('palette.modal');
    const lastOption = page.getByTestId('palette.result.29');
    await input.fill('node');
    await expect(lastOption).toBeAttached();

    const beforeModalBox = await modal.boundingBox();
    const beforeOptionBox = await lastOption.boundingBox();
    expect(beforeModalBox).not.toBeNull();
    expect(beforeOptionBox).not.toBeNull();
    expect(beforeOptionBox!.y).toBeGreaterThan(beforeModalBox!.y + beforeModalBox!.height);

    for (let index = 0; index < 29; index += 1) {
      await input.press('ArrowDown');
    }

    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('aria-activedescendant', 'command-palette-listbox-option-29');
    await expect(lastOption).toHaveAttribute('aria-selected', 'true');
    await expect.poll(async () => {
      const modalBox = await modal.boundingBox();
      const optionBox = await lastOption.boundingBox();
      if (!modalBox || !optionBox) return false;
      return optionBox.y >= modalBox.y && optionBox.y + optionBox.height <= modalBox.y + modalBox.height + 1;
    }).toBe(true);
  });

  test('searches cluster objects from the header inline field in admin view', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 99, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'POST cluster/search': (ctx) => {
          expect((ctx.reqJson as any)?.cluster?.value).toBe('53');
          return {
            cluster_search: [{ resource: 'User', id: 53, value: '53', attribute: 'id' }],
          };
        },
        'GET users/53': () => ({ user: { id: 53, login: 'KerryCZE', full_name: 'Kerry', email: 'kerry@example', level: 99 } }),
      },
    });

    await page.goto('/admin');
    await expect(page.getByTestId('shell.inline-search.input')).toBeVisible();

    await page.getByTestId('shell.inline-search.input').fill('53');
    await expect(page.getByTestId('shell.inline-search.result.0')).toContainText('KerryCZE');
    await expect(page.getByTestId('shell.inline-search.result.0')).toContainText('kerry@example');
    await page.getByTestId('shell.inline-search.input').press('Enter');

    await expect(page).toHaveURL(/\/admin\/users\/53$/);
    await expect(page.getByTestId('admin.user.page')).toBeVisible();
  });

  test('navigates to IP address detail from cluster search (admin view)', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    await installHaveApiMock(page, {
      user: { id: 99, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'POST cluster/search': () => ({
          cluster_search: [{ resource: 'IpAddress', id: 7, value: '203.0.113.10', attribute: 'addr' }],
        }),
        'GET ip_addresses/7': () => ({
          ip_address: {
            id: 7,
            addr: '203.0.113.10',
            prefix: 32,
            routed: true,
            network: { id: 1, address: '203.0.113.0', prefix: 24, role: 'public', purpose: 'public' },
            user: { id: 5, login: 'alice', level: 1 },
            vps: { id: 3, hostname: 'vps3.example' },
          },
        }),
      },
    });

    await page.goto('/admin/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    await openCommandPalette(page);

    await page.getByTestId('palette.input').fill('203.0.113.10');
    await expect(page.getByTestId('palette.result.0')).toBeVisible();
    await page.getByTestId('palette.result.0').click();

    await expect(page).toHaveURL(/\/admin\/ip-addresses\/7$/);
    await expect(page.getByTestId('admin.ip_address.page')).toBeVisible();
  });

  test('does not request stale help text after closing query-driven help', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const searchQueries: string[] = [];

    await installHaveApiMock(page, {
      user: { id: 99, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'POST cluster/search': (ctx) => {
          searchQueries.push(String((ctx.reqJson as any)?.cluster?.value ?? ''));
          return { cluster_search: [] };
        },
      },
    });

    await page.goto('/admin/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    await openCommandPalette(page);

    await page.getByTestId('palette.input').fill('?');
    await expect(page.getByTestId('palette.help')).toBeVisible();
    await page.waitForTimeout(250);

    await page.getByRole('button', { name: 'Back to search' }).click();
    await expect(page.getByTestId('palette.empty')).toBeVisible();
    await page.waitForTimeout(250);

    expect(searchQueries).toEqual([]);

    await page.getByTestId('palette.modal').getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByTestId('palette.modal')).toHaveCount(0);
    await openCommandPalette(page);
    await expect(page.getByTestId('palette.input')).toHaveValue('');
    await page.waitForTimeout(250);
    expect(searchQueries).toEqual([]);
  });

  test('does not rerun an earlier query when inserting a help key', async ({ page }) => {
    await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST' });

    const searchQueries: string[] = [];
    await installHaveApiMock(page, {
      user: { id: 99, login: 'admin', level: 100 },
      handlers: {
        'GET vpses': () => ({ vpses: [] }),
        'POST cluster/search': (ctx) => {
          searchQueries.push(String((ctx.reqJson as any)?.cluster?.value ?? ''));
          return { cluster_search: [] };
        },
      },
    });

    await page.goto('/admin/vps');
    await expect(page.getByTestId('vps.list')).toBeVisible();
    await openCommandPalette(page);

    const input = page.getByTestId('palette.input');
    await input.fill('alice');
    await expect(page.getByTestId('palette.no_results')).toBeVisible();
    expect(searchQueries).toEqual(['alice']);

    await page.getByTestId('palette.help.open').click();
    await expect(page.getByTestId('palette.help')).toBeVisible();
    await page.getByTestId('palette.help.key.vps').click();

    await expect(input).toHaveValue('vps:');
    await expect(input).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('palette.no_results')).toBeVisible();
    await page.waitForTimeout(250);

    expect(searchQueries).toEqual(['alice']);
  });
});

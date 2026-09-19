import type { Page } from '@playwright/test';

import { expect, test } from '../../fixtures/bootstrap';
import { setupHaveApiMock } from '../../fixtures/haveapi';
import { setUiSettingsLocalStorage } from '../../fixtures/uiSettings';
import { withAppUrl } from '../../fixtures/url';

const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
const sshCommand = `ssh root@${ipv6}`;

async function installClipboardProbe(page: Page) {
  await page.addInitScript(() => {
    const testWindow = window as typeof window & { __sshClipboardWrites?: string[] };
    const writes: string[] = [];
    testWindow.__sshClipboardWrites = writes;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          writes.push(text);
        },
      },
    });
  });
}

test.beforeEach(async ({ page }) => {
  await setUiSettingsLocalStorage(page, { language: 'cs', sidebarCollapsed: false });
  await setupHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET vpses/123': () => ({
        vps: {
          id: 123,
          hostname: 'vps123.example',
          object_state: 'active',
          is_running: true,
          enable_network: true,
          cpus: 2,
          memory: 2048,
          swap: 1024,
          diskspace: 20480,
          used_memory: 768,
          used_swap: 10,
          used_diskspace: 5120,
          uptime: 12345,
          loadavg1: 0.12,
          created_at: '2026-01-01T12:00:00Z',
          dataset: { id: 10, name: 'tank/data', full_name: 'tank/data' },
          node: {
            id: 1,
            domain_name: 'node1.example',
            location: { id: 2, label: 'Praha', environment: { id: 1, label: 'prod' } },
          },
          user: { id: 10, login: 'alice' },
          os_template: { id: 6, label: 'Debian 12' },
          dns_resolver: { id: 2, label: 'Default' },
        },
      }),
      'GET ip_addresses': () => ({
        ip_addresses: [
          {
            id: 501,
            addr: ipv6,
            prefix: 128,
            network: { id: 55, role: 'public' },
          },
        ],
      }),
      'GET vpses/123/statuses': () => ({ statuses: [] }),
    },
  });
});

test('@pr-smoke @pr-smoke-mobile keeps an IPv6 SSH command and copy action inside the VPS header', async ({
  page,
}, testInfo) => {
  const mutations: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/v7.0/') || ['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return;
    // Opening a detail route persists UI navigation preferences. That is not a
    // product mutation caused by the SSH copy control.
    if (url.pathname.endsWith('/webui_user_settings')) return;
    mutations.push(`${request.method()} ${url.pathname}`);
  });

  await installClipboardProbe(page);
  await page.goto(withAppUrl('/app/vps/123'));
  const header = page.getByTestId('vps.header');
  const ssh = page.getByTestId('vps.header.ssh');
  const code = ssh.locator('code');
  const row = code.locator('..');
  const copy = ssh.locator('button');

  await expect(header).toBeVisible();
  await expect(code).toHaveText(sshCommand);
  await expect(copy).toBeVisible();
  await expect(copy).toHaveAccessibleName(/Kopírovat|Copy/);
  await expect(page.getByTestId('vps.overview.health')).toHaveCount(0);

  if (testInfo.project.name === 'mobile-chrome') {
    for (const width of [320, 390, 640, 768, 800]) {
      await page.setViewportSize({ width, height: 900 });

      const metrics = await page.evaluate(() => {
        const header = document.querySelector<HTMLElement>('[data-testid="vps.header"]');
        const ssh = document.querySelector<HTMLElement>('[data-testid="vps.header.ssh"]');
        const code = ssh?.querySelector<HTMLElement>('code');
        const copy = ssh?.querySelector<HTMLElement>('button');
        const rect = (element: HTMLElement | null | undefined) => {
          const box = element?.getBoundingClientRect();
          return { left: box?.left ?? -1, right: box?.right ?? -1, height: box?.height ?? 0 };
        };

        return {
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          headerOverflow: header ? header.scrollWidth - header.clientWidth : -1,
          sshOverflow: ssh ? ssh.scrollWidth - ssh.clientWidth : -1,
          codeOverflow: code ? code.scrollWidth - code.clientWidth : -1,
          codeTextOverflow: code ? getComputedStyle(code).textOverflow : '',
          header: rect(header),
          code: rect(code),
          copy: rect(copy),
        };
      });

      expect(metrics.documentOverflow, `${width}px document overflow`).toBeLessThanOrEqual(1);
      expect(metrics.headerOverflow, `${width}px header overflow`).toBeLessThanOrEqual(1);
      expect(metrics.sshOverflow, `${width}px SSH row overflow`).toBeLessThanOrEqual(1);
      if (width <= 390) {
        expect(metrics.codeOverflow, `${width}px command should truncate visually`).toBeGreaterThan(0);
        expect(metrics.codeTextOverflow).toBe('ellipsis');
      }
      expect(metrics.code.left).toBeGreaterThanOrEqual(metrics.header.left - 1);
      expect(metrics.code.right).toBeLessThanOrEqual(metrics.header.right + 1);
      expect(metrics.copy.left).toBeGreaterThanOrEqual(metrics.header.left - 1);
      expect(metrics.copy.right).toBeLessThanOrEqual(metrics.header.right + 1);
      expect(metrics.copy.right).toBeLessThanOrEqual(width + 1);
      expect(metrics.copy.height, `${width}px copy target`).toBeGreaterThanOrEqual(44);
      await expect(copy).toBeInViewport();
      await expect(code).toHaveText(sshCommand);
    }

    await copy.click();
    await expect(copy).toContainText(/Zkopírováno|Copied/);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const testWindow = window as typeof window & { __sshClipboardWrites?: string[] };
          return testWindow.__sshClipboardWrites ?? [];
        })
      )
      .toEqual([sshCommand]);
  } else if (testInfo.project.name === 'chromium') {
    for (const width of [1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const metrics = await page.evaluate(() => {
        const header = document.querySelector<HTMLElement>('[data-testid="vps.header"]');
        const ssh = document.querySelector<HTMLElement>('[data-testid="vps.header.ssh"]');
        const code = ssh?.querySelector<HTMLElement>('code');
        const copy = ssh?.querySelector<HTMLElement>('button');
        const rect = (element: HTMLElement | null | undefined) => {
          const box = element?.getBoundingClientRect();
          return { left: box?.left ?? -1, right: box?.right ?? -1 };
        };
        return {
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          headerOverflow: header ? header.scrollWidth - header.clientWidth : -1,
          sshOverflow: ssh ? ssh.scrollWidth - ssh.clientWidth : -1,
          copyHeight: copy?.getBoundingClientRect().height ?? 0,
          header: rect(header),
          code: rect(code),
          copy: rect(copy),
        };
      });

      expect(metrics.documentOverflow, `${width}px document overflow`).toBeLessThanOrEqual(1);
      expect(metrics.headerOverflow, `${width}px header overflow`).toBeLessThanOrEqual(1);
      expect(metrics.sshOverflow, `${width}px SSH row overflow`).toBeLessThanOrEqual(1);
      expect(metrics.code.left).toBeGreaterThanOrEqual(metrics.header.left - 1);
      expect(metrics.code.right).toBeLessThanOrEqual(metrics.header.right + 1);
      expect(metrics.copy.left).toBeGreaterThanOrEqual(metrics.header.left - 1);
      expect(metrics.copy.right).toBeLessThanOrEqual(metrics.header.right + 1);
      expect(metrics.copy.right).toBeLessThanOrEqual(width + 1);
      if (width < 1280) {
        expect(metrics.copyHeight).toBeGreaterThanOrEqual(44);
      } else {
        expect(metrics.copyHeight).toBeGreaterThanOrEqual(32);
        expect(metrics.copyHeight).toBeLessThan(44);
      }
      await expect(code).toHaveText(sshCommand);
      await expect(copy).toBeInViewport();
    }
  } else {
    throw new Error(`Missing VPS header layout coverage for Playwright project ${testInfo.project.name}`);
  }

  expect(mutations).toEqual([]);
});

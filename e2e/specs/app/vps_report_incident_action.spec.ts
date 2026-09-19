import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@pr-smoke @pr-smoke-mobile admin VPS actions open a prefilled incident form without creating it', async ({
  page,
}) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_ADMIN_SESSION' });

  let createCalls = 0;
  const vps = {
    id: 123,
    hostname: 'incident-target.example',
    object_state: 'active',
    is_running: true,
    enable_network: true,
    node: {
      id: 1,
      domain_name: 'node1.example',
      location: { id: 2, label: 'Praha', environment: { id: 1, label: 'prod' } },
    },
    user: { id: 10, login: 'alice' },
  };

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 99 },
    handlers: {
      'GET vpses/123': () => ({ vps }),
      'GET ip_addresses': () => ({ ip_addresses: [] }),
      'GET vpses/123/statuses': () => ({ statuses: [] }),
      'GET vpses/123/state_logs': () => ({ state_logs: [] }),
      'GET dns_resolvers': () => ({ dns_resolvers: [] }),
      'GET user_namespace_maps': () => ({ user_namespace_maps: [] }),
      'GET ip_address_assignments': () => ({ ip_address_assignments: [] }),
      'POST incident_reports': () => {
        createCalls += 1;
        return { incident_report: { id: 999 } };
      },
    },
  });

  await page.goto('/admin/vps/123');

  const incidentPath = '/admin/incidents/new?vps=123';
  const actionsMenu = page.getByTestId('vps.actions.menu');
  await expect(actionsMenu.locator(`option[value="${incidentPath}"]`)).toHaveCount(1);

  await actionsMenu.selectOption(incidentPath);

  await expect(page).toHaveURL(/\/admin\/incidents\/new\?vps=123$/);
  await expect(page.getByTestId('incidents.new')).toBeVisible();
  await expect(page.getByTestId('incidents.new.vps')).toHaveValue('123');
  await expect(page.getByTestId('incidents.new.submit')).toBeVisible();
  expect(createCalls).toBe(0);
});

test('@pr-smoke @pr-smoke-mobile pending incident creation keeps its disabled Cancel link inert', async ({
  page,
}) => {
  await bootstrapVpsAdminWindow(page, { sessionToken: 'TEST_ADMIN_SESSION' });

  let createCalls = 0;
  let resolveCreate!: (value: { incident_report: { id: number } }) => void;
  const pendingCreate = new Promise<{ incident_report: { id: number } }>((resolve) => {
    resolveCreate = resolve;
  });
  const vps = {
    id: 123,
    hostname: 'incident-target.example',
    object_state: 'active',
    is_running: true,
    enable_network: true,
    node: {
      id: 1,
      domain_name: 'node1.example',
      location: { id: 2, label: 'Praha', environment: { id: 1, label: 'prod' } },
    },
    user: { id: 10, login: 'alice' },
  };

  await installHaveApiMock(page, {
    user: { id: 1, login: 'admin', level: 99 },
    handlers: {
      'GET vpses/123': () => ({ vps }),
      'GET ip_address_assignments': () => ({ ip_address_assignments: [] }),
      'POST incident_reports': async () => {
        createCalls += 1;
        return pendingCreate;
      },
    },
  });

  await page.goto('/admin/incidents/new?vps=123');
  await page.getByTestId('incidents.new.subject').fill('Network abuse report');
  await page.getByTestId('incidents.new.text').fill('Evidence gathered for operator review.');

  await page.getByTestId('incidents.new.submit').click();
  await expect.poll(() => createCalls).toBe(1);

  const cancel = page.getByTestId('incidents.new.cancel');
  await expect(cancel).toHaveAttribute('aria-disabled', 'true');
  await expect(cancel).toHaveAttribute('tabindex', '-1');

  try {
    await cancel.focus();
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/admin\/incidents\/new\?vps=123$/);

    await cancel.evaluate((element) => (element as HTMLAnchorElement).click());
    await expect(page).toHaveURL(/\/admin\/incidents\/new\?vps=123$/);
    expect(createCalls).toBe(1);
  } finally {
    resolveCreate({ incident_report: { id: 999 } });
  }

  await expect(page).toHaveURL(/\/admin\/vps\/123$/);
});

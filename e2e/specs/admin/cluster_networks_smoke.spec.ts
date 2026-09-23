import { expect, test } from '../../fixtures/vpsadmin-window';
import { bootstrapVpsAdminWindow } from '../../fixtures/bootstrap';
import { failEnvelope, installHaveApiMock } from '../../fixtures/haveapi';

test.describe('Admin / Cluster / Networks (smoke)', () => {
  test('lists networks, supports filters, and opens network detail', async ({ page }) => {
    const isApiRequest = (url: string, path: string) =>
      (url.includes(`/api/v7.0/${path}`) || url.includes(`/v7.0/${path}`));

    const locations = [
      { id: 1, label: 'Praha' },
      { id: 2, label: 'Brno' },
    ];

    const baseNetworks = [
      {
        id: 101,
        label: 'Public IPv4',
        ip_version: 4,
        address: '192.0.2.0',
        prefix: 24,
        role: 'public_access',
        managed: true,
        split_access: 'no_access',
        split_prefix: 24,
        purpose: 'vps',
        size: 254,
        used: 120,
        assigned: 24,
        owned: 12,
        taken: 30,
        locations_count: 2,
        primary_location: locations[0],
      },
      {
        id: 102,
        label: 'Private IPv6',
        ip_version: 6,
        address: '2001:db8::',
        prefix: 120,
        role: 'private_access',
        managed: false,
        split_access: 'no_access',
        split_prefix: 120,
        purpose: 'any',
        size: 255,
        used: 10,
        assigned: 0,
        owned: 0,
        taken: 0,
        locations_count: 0,
        primary_location: null,
      },
    ];

    const locationNetworksByNetworkId: Record<number, any[]> = {
      101: [
        {
          id: 1001,
          location: locations[0],
          network: { id: 101 },
          primary: true,
          priority: 0,
          autopick: true,
          userpick: true,
        },
        {
          id: 1002,
          location: locations[1],
          network: { id: 101 },
          primary: false,
          priority: 10,
          autopick: true,
          userpick: false,
        },
      ],
    };

    let createdNetwork = false;
    let seenPurpose: string | null = null;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET locations': () => ({ locations, _meta: { total_count: locations.length } }),

        'GET networks': (ctx) => {
          seenPurpose = ctx.searchParams.get('network[purpose]');

          const list = createdNetwork
            ? [
                {
                  id: 200,
                  label: 'New network',
                  ip_version: 4,
                  address: '198.51.100.0',
                  prefix: 24,
                  role: 'public_access',
                  managed: true,
                  split_access: 'no_access',
                  split_prefix: 24,
                  purpose: 'any',
                  size: 254,
                  used: 0,
                  assigned: 0,
                  owned: 0,
                  taken: 0,
                  locations_count: 0,
                  primary_location: null,
                },
                ...baseNetworks,
              ]
            : baseNetworks;

          return { networks: list, _meta: { total_count: list.length } };
        },

        'POST networks': () => {
          createdNetwork = true;
          return {
            network: {
              id: 200,
              label: 'New network',
              ip_version: 4,
              address: '198.51.100.0',
              prefix: 24,
              role: 'public_access',
              managed: true,
              split_access: 'no_access',
              split_prefix: 24,
              purpose: 'any',
              size: 254,
              used: 0,
              assigned: 0,
              owned: 0,
              taken: 0,
              locations_count: 0,
              primary_location: null,
            },
          };
        },

        'GET networks/101': () => ({ network: baseNetworks[0] }),
        'GET networks/102': () => ({ network: baseNetworks[1] }),
        'GET networks/200': () => ({
          network: {
            id: 200,
            label: 'New network',
            ip_version: 4,
            address: '198.51.100.0',
            prefix: 24,
            role: 'public_access',
            managed: true,
            split_access: 'no_access',
            split_prefix: 24,
            purpose: 'any',
            size: 254,
            used: 0,
            assigned: 0,
            owned: 0,
            taken: 0,
            locations_count: 0,
            primary_location: null,
          },
        }),

        'GET location_networks': (ctx) => {
          const networkId = Number(ctx.searchParams.get('location_network[network]') ?? NaN);
          const list = Number.isFinite(networkId) ? locationNetworksByNetworkId[networkId] ?? [] : [];
          return { location_networks: list, _meta: { total_count: list.length } };
        },
      },
    });

    const apiCalls: { url: string; method: string; body?: string | null }[] = [];
    page.on('request', (req) => {
      if (!req.url().includes('/api/v7.0/') && !req.url().includes('/v7.0/')) return;
      apiCalls.push({ url: req.url(), method: req.method(), body: req.postData() });
    });

    await bootstrapVpsAdminWindow(page, { sessionToken: 'test-admin-session' });

    await page.goto('/admin/cluster/networks');
    await expect(page.getByTestId('admin.cluster.networks.page')).toBeVisible();
    await expect(page.getByTestId('admin.cluster.networks.row.101')).toBeVisible();

    // Filter by purpose
    await page.getByTestId('admin.cluster.networks.advanced.open').click();
    await Promise.all([
      page.waitForRequest((r) => isApiRequest(r.url(), 'networks') && r.url().includes('network%5Bpurpose%5D=vps')),
      page.getByTestId('admin.cluster.networks.filter.purpose').selectOption('vps'),
    ]);
    await expect.poll(() => seenPurpose).toBe('vps');
    await page.getByTestId('admin.cluster.networks.advanced').getByRole('button', { name: /done/i }).click();

    // Create network
    await page.getByTestId('admin.cluster.networks.create').click();
    await expect(page.getByTestId('admin.cluster.networks.editor')).toBeVisible();
    await page.getByTestId('admin.cluster.networks.editor.address').fill('198.51.100.0');
    await page.getByTestId('admin.cluster.networks.editor.prefix').fill('24');
    await page.getByTestId('admin.cluster.networks.editor.split_prefix').fill('24');
    const createRequest = page.waitForRequest((r) => r.method() === 'POST' && isApiRequest(r.url(), 'networks'));
    await page.getByTestId('admin.cluster.networks.editor.save').click();
    await createRequest;
    await expect(page.getByTestId('admin.cluster.networks.row.200')).toBeVisible();

    const createCall = apiCalls.find((c) => c.method === 'POST' && isApiRequest(c.url, 'networks'));
    expect(createCall?.body).toContain('"network"');
    expect(createCall?.body).toContain('"address"');

    // Open detail
    const detailRequest = page.waitForRequest((r) => isApiRequest(r.url(), 'networks/101'));
    await page.getByTestId('admin.cluster.networks.row.101.open').click({ force: true });
    await detailRequest;
    await expect(page).toHaveURL(/\/admin\/cluster\/networks\/101/);
    await expect(page.getByTestId('admin.cluster.network_detail.page')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('admin.cluster.network_detail.availability.table')).toBeVisible();
    await expect(page.getByTestId('admin.cluster.network_detail.ln.1001')).toBeVisible();
  });

  test('keeps rejected network create and edit forms in context for retry', async ({ page }) => {
    const locations = [{ id: 1, label: 'Praha' }];
    let networks = [{
      id: 101,
      label: 'Public IPv4',
      ip_version: 4,
      address: '192.0.2.0',
      prefix: 24,
      role: 'public_access',
      managed: true,
      split_access: 'no_access',
      split_prefix: 24,
      purpose: 'vps',
      size: 254,
      used: 120,
      assigned: 24,
      owned: 12,
      taken: 30,
      locations_count: 1,
      primary_location: locations[0],
    }];
    let createAttempts = 0;
    let updateAttempts = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET locations': () => ({ locations, _meta: { total_count: locations.length } }),
        'GET networks': () => ({ networks: [...networks], _meta: { total_count: networks.length } }),
        'POST networks': () => {
          createAttempts += 1;
          if (createAttempts === 1) return failEnvelope('Network range changed on the server');
          const created = {
            id: 201,
            label: 'Retry network',
            ip_version: 4,
            address: '198.51.100.0',
            prefix: 24,
            role: 'public_access',
            managed: true,
            split_access: 'no_access',
            split_prefix: 24,
            purpose: 'any',
            size: 254,
            used: 0,
            assigned: 0,
            owned: 0,
            taken: 0,
            locations_count: 0,
            primary_location: null,
          };
          networks = [created, ...networks];
          return { network: created };
        },
        'PUT networks/201': () => {
          updateAttempts += 1;
          if (updateAttempts === 1) return failEnvelope('Network metadata changed on the server');
          networks = networks.map((row) => row.id === 201 ? { ...row, label: 'Renamed after retry' } : row);
          return { network: networks.find((row) => row.id === 201) };
        },
      },
    });
    await bootstrapVpsAdminWindow(page, { sessionToken: 'test-admin-session' });
    await page.goto('/admin/cluster/networks');

    await page.getByTestId('admin.cluster.networks.create').click();
    const editor = page.getByTestId('admin.cluster.networks.editor');
    await page.getByTestId('admin.cluster.networks.editor.label').fill('Retry network');
    await page.getByTestId('admin.cluster.networks.editor.address').fill('198.51.100.0');
    await page.getByTestId('admin.cluster.networks.editor.prefix').fill('24');
    await page.getByTestId('admin.cluster.networks.editor.split_prefix').fill('24');
    await page.getByTestId('admin.cluster.networks.editor.save').click();

    await expect(page.getByTestId('admin.cluster.networks.editor.error')).toContainText('Network range changed on the server');
    await expect(page.getByTestId('admin.cluster.networks.editor.label')).toHaveValue('Retry network');
    await expect(page.getByTestId('admin.cluster.networks.editor.address')).toHaveValue('198.51.100.0');
    await page.getByTestId('admin.cluster.networks.editor.save').click();
    await expect(editor).toBeHidden();
    await expect(page.getByTestId('admin.cluster.networks.row.201')).toBeVisible();

    await page.getByTestId('admin.cluster.networks.row.201.edit').click();
    await page.getByTestId('admin.cluster.networks.editor.label').fill('Renamed after retry');
    await page.getByTestId('admin.cluster.networks.editor.save').click();

    await expect(page.getByTestId('admin.cluster.networks.editor.error')).toContainText('Network metadata changed on the server');
    await expect(page.getByTestId('admin.cluster.networks.editor.label')).toHaveValue('Renamed after retry');
    await page.getByTestId('admin.cluster.networks.editor.save').click();
    await expect(editor).toBeHidden();
    await expect(page.getByTestId('admin.cluster.networks.row.201')).toContainText('Renamed after retry');

    expect({ createAttempts, updateAttempts }).toEqual({ createAttempts: 2, updateAttempts: 2 });
  });

  test('keeps rejected network availability changes in their dialogs for retry', async ({ page }) => {
    const locations = [
      { id: 1, label: 'Praha' },
      { id: 2, label: 'Brno' },
    ];
    const network = {
      id: 101,
      label: 'Public IPv4',
      ip_version: 4,
      address: '192.0.2.0',
      prefix: 24,
      role: 'public_access',
      managed: true,
      split_access: 'no_access',
      split_prefix: 24,
      purpose: 'vps',
      size: 254,
      used: 120,
      assigned: 24,
      owned: 12,
      taken: 30,
      primary_location: locations[0],
    };
    let locationNetworks = [{
      id: 1001,
      location: locations[0],
      network: { id: 101 },
      primary: true,
      priority: 0,
      autopick: true,
      userpick: true,
    }];
    let createAttempts = 0;
    let updateAttempts = 0;
    let deleteAttempts = 0;
    let addAddressAttempts = 0;

    await installHaveApiMock(page, {
      user: { id: 1, login: 'admin', level: 100 },
      handlers: {
        'GET locations': () => ({ locations, _meta: { total_count: locations.length } }),
        'GET networks/101': () => ({ network }),
        'GET location_networks': () => ({
          location_networks: [...locationNetworks],
          _meta: { total_count: locationNetworks.length },
        }),
        'POST location_networks': () => {
          createAttempts += 1;
          if (createAttempts === 1) return failEnvelope('Location availability changed on the server');
          const created = {
            id: 1002,
            location: locations[1],
            network: { id: 101 },
            primary: false,
            priority: 5,
            autopick: false,
            userpick: false,
          };
          locationNetworks = [...locationNetworks, created];
          return { location_network: created };
        },
        'PUT location_networks/1001': () => {
          updateAttempts += 1;
          if (updateAttempts === 1) return failEnvelope('Location priority changed on the server');
          locationNetworks = locationNetworks.map((row) => row.id === 1001 ? { ...row, priority: 15 } : row);
          return { location_network: locationNetworks.find((row) => row.id === 1001) };
        },
        'DELETE location_networks/1001': () => {
          deleteAttempts += 1;
          if (deleteAttempts === 1) return failEnvelope('Location is still in use');
          locationNetworks = locationNetworks.filter((row) => row.id !== 1001);
          return {};
        },
        'POST networks/101/add_addresses': () => {
          addAddressAttempts += 1;
          if (addAddressAttempts === 1) return failEnvelope('Address pool changed on the server');
          return { network: { count: 3 } };
        },
      },
    });
    await bootstrapVpsAdminWindow(page, { sessionToken: 'test-admin-session' });
    await page.goto('/admin/cluster/networks/101');

    await page.getByTestId('admin.cluster.network_detail.add_location').click();
    const editor = page.getByTestId('admin.cluster.network_detail.editor');
    await page.getByTestId('admin.cluster.network_detail.editor.location').selectOption('2');
    await page.getByTestId('admin.cluster.network_detail.editor.priority').fill('5');
    await page.getByTestId('admin.cluster.network_detail.editor.save').click();
    await expect(page.getByTestId('admin.cluster.network_detail.editor.error')).toContainText('Location availability changed on the server');
    await expect(page.getByTestId('admin.cluster.network_detail.editor.location')).toHaveValue('2');
    await expect(page.getByTestId('admin.cluster.network_detail.editor.priority')).toHaveValue('5');
    await page.getByTestId('admin.cluster.network_detail.editor.save').click();
    await expect(editor).toBeHidden();
    await expect(page.getByTestId('admin.cluster.network_detail.ln.1002')).toBeVisible();

    await page.getByTestId('admin.cluster.network_detail.ln.1001.edit').click();
    await page.getByTestId('admin.cluster.network_detail.editor.priority').fill('15');
    await page.getByTestId('admin.cluster.network_detail.editor.save').click();
    await expect(page.getByTestId('admin.cluster.network_detail.editor.error')).toContainText('Location priority changed on the server');
    await expect(page.getByTestId('admin.cluster.network_detail.editor.priority')).toHaveValue('15');
    await page.getByTestId('admin.cluster.network_detail.editor.save').click();
    await expect(editor).toBeHidden();

    await page.getByTestId('admin.cluster.network_detail.ln.1001.remove').click();
    const remove = page.getByTestId('admin.cluster.network_detail.remove.confirm');
    await expect(remove).toContainText('Praha');
    await page.getByTestId('admin.cluster.network_detail.remove.confirm.confirm').click();
    await expect(page.getByTestId('admin.cluster.network_detail.remove.error')).toContainText('Location is still in use');
    await page.getByTestId('admin.cluster.network_detail.remove.confirm.confirm').click();
    await expect(remove).toBeHidden();
    await expect(page.getByTestId('admin.cluster.network_detail.ln.1001')).toHaveCount(0);

    await page.getByTestId('admin.cluster.network_detail.add_addresses').click();
    const addAddresses = page.getByTestId('admin.cluster.network_detail.add_addresses.modal');
    await page.getByTestId('admin.cluster.network_detail.add_addresses.count').fill('3');
    await page.getByTestId('admin.cluster.network_detail.add_addresses.user').fill('7');
    await page.getByTestId('admin.cluster.network_detail.add_addresses.environment').fill('9');
    await page.getByTestId('admin.cluster.network_detail.add_addresses.save').click();
    await expect(page.getByTestId('admin.cluster.network_detail.add_addresses.error')).toContainText('Address pool changed on the server');
    await expect(page.getByTestId('admin.cluster.network_detail.add_addresses.count')).toHaveValue('3');
    await expect(page.getByTestId('admin.cluster.network_detail.add_addresses.user')).toHaveValue('7');
    await expect(page.getByTestId('admin.cluster.network_detail.add_addresses.environment')).toHaveValue('9');
    await page.getByTestId('admin.cluster.network_detail.add_addresses.save').click();
    await expect(addAddresses).toBeHidden();

    expect({ createAttempts, updateAttempts, deleteAttempts, addAddressAttempts }).toEqual({
      createAttempts: 2,
      updateAttempts: 2,
      deleteAttempts: 2,
      addAddressAttempts: 2,
    });
  });
});

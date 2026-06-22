import { expect, test } from '../../fixtures/vpsadmin-window';
import { bootstrapVpsAdminWindow } from '../../fixtures/bootstrap';
import { installHaveApiMock } from '../../fixtures/haveapi';

test.describe('Admin / Cluster / Networks (smoke)', () => {
  test('lists networks, supports filters, and opens network detail', async ({ page }) => {
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
      if (!req.url().includes('/api/v7.0/')) return;
      apiCalls.push({ url: req.url(), method: req.method(), body: req.postData() });
    });

    await bootstrapVpsAdminWindow(page, { sessionToken: 'test-admin-session' });

    await page.goto('/admin/cluster/networks');
    await expect(page.getByTestId('admin.cluster.networks.page')).toBeVisible();
    await expect(page.getByTestId('admin.cluster.networks.row.101')).toBeVisible();

    // Filter by purpose
    await page.getByTestId('admin.cluster.networks.advanced.open').click();
    await page.getByTestId('admin.cluster.networks.filter.purpose').selectOption('vps');
    await page.waitForRequest((r) => r.url().includes('/api/v7.0/networks') && r.url().includes('network%5Bpurpose%5D=vps'));
    await expect.poll(() => seenPurpose).toBe('vps');
    await page.getByTestId('admin.cluster.networks.advanced').getByRole('button', { name: /done/i }).click();

    // Create network
    await page.getByTestId('admin.cluster.networks.create').click();
    await expect(page.getByTestId('admin.cluster.networks.editor')).toBeVisible();
    await page.getByTestId('admin.cluster.networks.editor.address').fill('198.51.100.0');
    await page.getByTestId('admin.cluster.networks.editor.prefix').fill('24');
    await page.getByTestId('admin.cluster.networks.editor.split_prefix').fill('24');
    const createRequest = page.waitForRequest((r) => r.method() === 'POST' && r.url().includes('/api/v7.0/networks'));
    await page.getByTestId('admin.cluster.networks.editor.save').click();
    await createRequest;
    await expect(page.getByTestId('admin.cluster.networks.row.200')).toBeVisible();

    const createCall = apiCalls.find((c) => c.method === 'POST' && c.url.includes('/api/v7.0/networks'));
    expect(createCall?.body).toContain('"network"');
    expect(createCall?.body).toContain('"address"');

    // Open detail
    const detailRequest = page.waitForRequest((r) => r.url().includes('/api/v7.0/networks/101'));
    await page.getByTestId('admin.cluster.networks.row.101.open').click({ force: true });
    await detailRequest;
    await expect(page).toHaveURL(/\/admin\/cluster\/networks\/101/);
    await expect(page.getByTestId('admin.cluster.network_detail.page')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('admin.cluster.network_detail.availability.table')).toBeVisible();
    await expect(page.getByTestId('admin.cluster.network_detail.ln.1001')).toBeVisible();
  });
});

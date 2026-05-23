import { expect, test } from '@playwright/test';

import { bootstrapVpsAdminWindow, installHaveApiMock } from '../../fixtures';

test('@smoke dns zone advanced tabs render', async ({ page }) => {
  await bootstrapVpsAdminWindow(page);
  await installHaveApiMock(page, {
    user: { id: 10, login: 'alice', level: 1 },
    handlers: {
      'GET dns_zones/42': () => ({ dns_zone: { id: 42, name: 'example.test', enabled: true, dnssec_enabled: true, serial: 1234, user: { id: 10, login: 'alice' } } }),
      'GET transaction_chains': () => ({ transaction_chains: [] }),
      'GET dns_zone_transfers': () => ({ dns_zone_transfers: [{ id: 1, dns_zone: { id: 42 }, host_ip_address: { id: 11, ip_address: { ip_addr: '203.0.113.10' } }, peer_type: 'primary_type', dns_tsig_key: { id: 21, name: 'tsig-a' } }] }),
      'GET dns_tsig_keys': () => ({ dns_tsig_keys: [{ id: 21, name: 'tsig-a', algorithm: 'hmac-sha256', secret: 'secret', user: { id: 10, login: 'alice' } }] }),
      'GET dnssec_records': () => ({ dnssec_records: [{ id: 1, dns_zone: { id: 42 }, keyid: 12345, dnskey_algorithm: 13, dnskey_pubkey: 'ABCDEF', ds_algorithm: 13, ds_digest_type: 2, ds_digest: '012345' }] }),
      'GET dns_server_zones': () => ({ dns_server_zones: [{ id: 1, dns_server: { id: 5, name: 'ns1' }, type: 'primary_type', serial: 1234 }] }),
      'GET dns_servers': () => ({ dns_servers: [{ id: 5, name: 'ns1' }] }),
    },
  });

  await page.goto('/app/dns/zones/42/transfers');
  await expect(page.getByTestId('dns.transfers.page')).toBeVisible();
  await expect(page.getByTestId('dns.transfers.row.1')).toBeVisible();

  await page.goto('/app/dns/zones/42/dnssec');
  await expect(page.getByTestId('dns.dnssec.page')).toBeVisible();
  await expect(page.getByTestId('dns.dnssec.card.1')).toBeVisible();

  await page.goto('/app/dns/zones/42/servers');
  await expect(page.getByTestId('dns.servers.page')).toBeVisible();
  await expect(page.getByTestId('dns.servers.row.1')).toBeVisible();
});

import { describe, expect, it } from 'vitest';

import { objectRef } from './objectRef';
import { queryKeyMatchesObject } from './queryInvalidation';

describe('queryKeyMatchesObject', () => {
  it('matches VPS detail queries', () => {
    const ref = objectRef('Vps', 123);

    expect(queryKeyMatchesObject(ref, ['vps', 'show', { id: 123 }])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['vps', 'show', { id: 124 }])).toBe(false);

    expect(queryKeyMatchesObject(ref, ['vps', 123, 'mounts'])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['vps', 124, 'mounts'])).toBe(false);

    expect(queryKeyMatchesObject(ref, ['vps', 'metrics', { vpsId: 123, window: '24h' }])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['vps', 'metrics', { vpsId: 124, window: '24h' }])).toBe(false);

    // List is module-wide
    expect(queryKeyMatchesObject(ref, ['vps', 'list', { limit: 50 }])).toBe(true);
  });

  it('matches VPS related resources (network, IP)', () => {
    const ref = objectRef('Vps', 123);

    expect(queryKeyMatchesObject(ref, ['ip_address', 'list', { vpsId: 123, limit: 250 }])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['ip_address', 'list', { vpsId: 124, limit: 250 }])).toBe(false);

    expect(queryKeyMatchesObject(ref, ['network_interface', 'list', { vpsId: 123, limit: 100 }])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['network_interface', 'accounting', { vpsId: 123, year: 2026, month: 2 }])).toBe(
      true
    );
  });

  it('matches VPS per-object transaction chain list', () => {
    const ref = objectRef('Vps', 123);

    expect(queryKeyMatchesObject(ref, ['transaction_chain', 'list', { className: 'Vps', rowId: 123, limit: 10 }])).toBe(
      true
    );
    expect(queryKeyMatchesObject(ref, ['transaction_chain', 'list', { className: 'Vps', rowId: 124, limit: 10 }])).toBe(
      false
    );
  });

  it('matches Dataset queries', () => {
    const ref = objectRef('Dataset', 55);

    expect(queryKeyMatchesObject(ref, ['datasets', 'show', 55])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['datasets', 'show', 56])).toBe(false);

    expect(queryKeyMatchesObject(ref, ['datasets', 'index', { limit: 50 }])).toBe(true);

    expect(queryKeyMatchesObject(ref, ['datasets', 55, 'snapshots', { limit: 25 }])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['datasets', 56, 'snapshots', { limit: 25 }])).toBe(false);

    expect(queryKeyMatchesObject(ref, ['transaction_chain', 'list', { className: 'Dataset', rowId: 55, limit: 10 }])).toBe(
      true
    );
  });

  it('matches DNS zone queries', () => {
    const ref = objectRef('DnsZone', 9);

    expect(queryKeyMatchesObject(ref, ['dns_zones', 'show', 9])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['dns_zones', 'index', { limit: 50 }])).toBe(true);

    expect(queryKeyMatchesObject(ref, ['dns_records', 'index', { dns_zone: 9, limit: 50 }])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['dns_records', 'index', { dns_zone: 10, limit: 50 }])).toBe(false);

    expect(queryKeyMatchesObject(ref, ['dns_record_logs', 'index', { dns_zone: 9, limit: 50 }])).toBe(true);

    // DNS zone chain discovery hooks
    expect(queryKeyMatchesObject(ref, ['transaction_chains', 'dns_zone_direct', { zoneId: 9 }])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['transaction_chains', 'dns_zone_recent', { zoneId: 9, ids: [1, 2] }])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['transaction_chains', 'dns_zone_by_concern', { zoneId: 9, classes: ['DnsRecord'] }])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['transaction_chains', 'dns_zone_direct', { zoneId: 10 }])).toBe(false);
  });

  it('matches Node queries', () => {
    const ref = objectRef('Node', 7);

    expect(queryKeyMatchesObject(ref, ['nodes', 'show', { id: 7 }])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['nodes', 'show', { id: 8 }])).toBe(false);

    expect(queryKeyMatchesObject(ref, ['nodes', 'index', { limit: 50 }])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['nodes', 'public_status'])).toBe(true);

    expect(queryKeyMatchesObject(ref, ['nodes', 'statuses', { nodeId: 7, limit: 50 }])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['nodes', 'metrics', { nodeId: 7, window: '24h' }])).toBe(true);
  });

  it('matches Migration plan queries', () => {
    const ref = objectRef('MigrationPlan', 101);

    expect(queryKeyMatchesObject(ref, ['migration_plans', 'show', { id: 101 }])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['migration_plans', 'list', { limit: 50 }])).toBe(true);

    expect(queryKeyMatchesObject(ref, ['migration_plans', 'vps_migrations', { planId: 101, limit: 50 }])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['migration_plans', 'vps_migrations', { planId: 102, limit: 50 }])).toBe(false);
  });

  it('matches User queries', () => {
    const ref = objectRef('User', 42);

    expect(queryKeyMatchesObject(ref, ['users', 42])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['users', 43])).toBe(false);

    expect(queryKeyMatchesObject(ref, ['users', 'index', { limit: 50 }])).toBe(true);
  });

  it('matches IP address queries', () => {
    const ref = objectRef('IpAddress', 777);

    expect(queryKeyMatchesObject(ref, ['ip_addresses', 777])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['ip_addresses', 778])).toBe(false);

    expect(queryKeyMatchesObject(ref, ['ip_addresses', 'index', { limit: 50 }])).toBe(true);
  });

  it('matches Network queries', () => {
    const ref = objectRef('Network', 55);

    // Admin list queries
    expect(queryKeyMatchesObject(ref, ['networks', null, 50, '', null, '4', '', '', '', ''])).toBe(true);

    // Detail
    expect(queryKeyMatchesObject(ref, ['network', 55])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['network', 56])).toBe(false);

    // Location-network membership list
    expect(queryKeyMatchesObject(ref, ['location_networks', 'network', 55])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['location_networks', 'network', 56])).toBe(false);
  });

  it('matches DNS resolver queries', () => {
    const ref = objectRef('DnsResolver', 9);

    expect(queryKeyMatchesObject(ref, ['dns_resolvers', null, 50, '', '', null])).toBe(true);
    expect(queryKeyMatchesObject(ref, ['dns_resolvers'])).toBe(true);
  });
});

import { describe, expect, test } from 'vitest';

import type { Node } from '../../../lib/api/nodes';
import type { PublicNodeStatus } from '../../../lib/api/public';

import {
  buildNodeRows,
  buildStatusIndex,
  filterNodeRows,
  locationLabel,
  maintenanceReason,
  nodeDotVariant,
  nodeRowVariant,
  nodeSecondaryLabel,
  nodeStats,
  nodeStatusBadge,
  normalizeLegacyNodesUrl,
  normalizeNodeState,
  parseIssuesValue,
  resolveNodeStateValue,
} from './NodesModel';

describe('NodesModel', () => {
  test('canonicalizes unsupported node filters before list queries mount', () => {
    const adminParams = new URLSearchParams(
      'q=brno&q=ignored&state=inactive&issues=1&limit=25&from_id=400&page=3'
    );
    const adminOriginal = adminParams.toString();
    expect(
      normalizeLegacyNodesUrl({ basePath: '/admin', searchParams: adminParams, allowState: true })
    ).toEqual({
      changed: true,
      href: '/admin/nodes?state=inactive&issues=1&limit=25',
    });
    expect(adminParams.toString()).toBe(adminOriginal);

    expect(
      normalizeLegacyNodesUrl({
        basePath: '/admin',
        searchParams: new URLSearchParams('state=all&issues=1&limit=50&from_id=90&page=2'),
        allowState: false,
      })
    ).toEqual({
      changed: true,
      href: '/admin/nodes?issues=1&limit=50',
    });
  });

  test('leaves supported role-specific filters and pagination untouched', () => {
    expect(
      normalizeLegacyNodesUrl({
        basePath: '/admin',
        searchParams: new URLSearchParams('state=inactive&issues=1&limit=25&from_id=400&page=3'),
        allowState: true,
      })
    ).toEqual({
      changed: false,
      href: '/admin/nodes?state=inactive&issues=1&limit=25&from_id=400&page=3',
    });

    expect(
      normalizeLegacyNodesUrl({
        basePath: '/admin',
        searchParams: new URLSearchParams('issues=1&limit=25&from_id=400&page=3'),
        allowState: false,
      })
    ).toEqual({
      changed: false,
      href: '/admin/nodes?issues=1&limit=25&from_id=400&page=3',
    });
  });

  test('normalizes node state and issues smart values', () => {
    expect(normalizeNodeState(' inactive ')).toBe('inactive');
    expect(normalizeNodeState('all')).toBe('all');
    expect(normalizeNodeState('weird')).toBe('active');

    expect(resolveNodeStateValue('inact')).toBe('inactive');
    expect(resolveNodeStateValue('*')).toBe('all');
    expect(resolveNodeStateValue('off')).toBe('inactive');
    expect(resolveNodeStateValue('unknown')).toBeNull();

    expect(parseIssuesValue('')).toBe(true);
    expect(parseIssuesValue('enabled')).toBe(true);
    expect(parseIssuesValue('0')).toBe(false);
    expect(parseIssuesValue('maybe')).toBeNull();
  });

  test('builds node rows by joining authenticated nodes with public status', () => {
    const nodes: Node[] = [
      {
        id: 125,
        domain_name: 'node125.example.test',
        fqdn: 'node125.example.test',
        location: { id: 1, label: 'dc1' },
      },
      {
        id: 124,
        domain_name: 'node124.example.test',
        fqdn: 'node124.example.test',
        location: { id: 2, label: 'dc2' },
      },
    ];
    const statuses: PublicNodeStatus[] = [
      {
        name: 'node125.example.test',
        fqdn: 'node125.example.test',
        status: false,
        vps_count: 12,
      },
      {
        name: 'node124.example.test',
        fqdn: 'node124.example.test',
        status: true,
        maintenance_lock: 'no',
      },
    ];

    const rows = buildNodeRows({
      nodes,
      nodesUnavailable: false,
      publicStatus: statuses,
      statusIndex: buildStatusIndex(statuses),
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 125,
      name: 'node125.example.test',
      locationLabel: 'dc1',
      status: false,
      vps_count: 12,
    });
    expect(rows[1]).toMatchObject({
      id: 124,
      status: true,
      maintenance_lock: 'no',
    });
    expect(nodeRowVariant(rows[1]!)).toBeUndefined();
  });

  test('falls back to public status rows and keeps the issues filter honest', () => {
    const statuses: PublicNodeStatus[] = [
      { name: 'node125.example.test', fqdn: 'node125.example.test', status: false },
      { name: 'node124.example.test', fqdn: 'node124.example.test', status: true, maintenance_lock: 'maint' },
      { name: 'node123.example.test', fqdn: 'node123.example.test', status: true },
    ];

    const rows = buildNodeRows({
      nodes: undefined,
      nodesUnavailable: true,
      publicStatus: statuses,
      statusIndex: buildStatusIndex(statuses),
    });

    expect(rows.map((row) => row.name)).toEqual([
      'node125.example.test',
      'node124.example.test',
      'node123.example.test',
    ]);
    expect(filterNodeRows(rows, { issuesOnly: true }).map((row) => row.name)).toEqual([
      'node125.example.test',
      'node124.example.test',
    ]);
    expect(filterNodeRows(rows, { issuesOnly: false })).toHaveLength(3);
  });

  test('derives row presentation helpers without renderer state', () => {
    expect(locationLabel({ id: 7 })).toBe('#7');
    expect(nodeRowVariant({ name: 'down', status: false })).toBe('danger');
    expect(nodeRowVariant({ name: 'not-maint', status: true, maintenance_lock: 'no' })).toBeUndefined();
    expect(nodeRowVariant({ name: 'maint', status: true, maintenance_lock: 'lock' })).toBe('warn');
    expect(nodeDotVariant({ name: 'up', status: true })).toBe('ok');
    expect(nodeDotVariant({ name: 'unknown' })).toBe('neutral');
    expect(nodeStatusBadge(false)).toEqual({ variant: 'danger', labelKey: 'state.down' });
    expect(nodeSecondaryLabel({ id: 9, name: 'n' }, 'N/A')).toBe('#9');
    expect(maintenanceReason({ name: 'n', maintenance_lock: { reason: 'HW upgrade' } })).toBe('HW upgrade');
    expect(nodeStats([{ name: 'down', status: false }, { name: 'maint', maintenance_lock: 'lock' }])).toEqual({
      total: 2,
      down: 1,
      locked: 1,
    });
  });
});

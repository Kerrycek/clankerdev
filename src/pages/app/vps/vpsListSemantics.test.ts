import { describe, expect, it } from 'vitest';

import type { TransactionChain } from '../../../lib/api/transactions';
import type { Vps } from '../../../lib/api/vps';
import { buildTransactionLockIndex } from '../../../lib/lockIndex';
import {
  buildVpsListPageWindow,
  buildVpsListRecord,
  extractVpsIpCandidates,
  normalizeVpsListStateFilter,
  recordMatchesStateFilter,
} from './vpsListSemantics';

function t(key: string, vars?: Record<string, unknown>): string {
  if (!vars) return key;
  return Object.entries(vars).reduce((acc, [name, value]) => acc.replace(`{${name}}`, String(value)), key);
}

const baseVps: Vps = {
  id: 101,
  hostname: 'db101.example',
  object_state: 'active',
  is_running: true,
  node: { id: 3, domain_name: 'node3.example', location: { id: 2, label: 'Praha' } },
  user: { id: 7, login: 'alice', level: 1 },
  primary_ip_address: '198.51.100.10',
};

function recordFor(vps: Vps, failedChains: TransactionChain[] = []) {
  return buildVpsListRecord({
    vps,
    lockIndex: buildTransactionLockIndex([], { onlyActive: true }),
    failureIndex: buildTransactionLockIndex(failedChains, { onlyActive: false }),
    isLocallyLocked: () => false,
    t,
  });
}

describe('vpsListSemantics', () => {
  it.each([25, 50, 100])('uses one hidden lookahead row for a %i-row VPS page', (limit) => {
    const data = Array.from({ length: limit + 1 }, (_, index) => ({ id: index + 1 }));

    expect(buildVpsListPageWindow(data, limit)).toEqual({
      rows: data.slice(0, limit),
      cursor: limit,
      hasMore: true,
    });
  });

  it('uses the largest visible ID as the ascending cursor and excludes the lookahead row', () => {
    expect(buildVpsListPageWindow([{ id: 4 }, { id: 9 }, { id: 2 }, { id: 20 }], 3)).toEqual({
      rows: [{ id: 4 }, { id: 9 }, { id: 2 }],
      cursor: 9,
      hasMore: true,
    });
  });

  it('stops on an exact terminal page and fails closed when visible IDs are invalid', () => {
    expect(buildVpsListPageWindow([{ id: 1 }, { id: 2 }], 2)).toMatchObject({ cursor: 2, hasMore: false });
    expect(buildVpsListPageWindow([{ id: 0 }, { id: Number.NaN }, { id: -3 }], 2)).toMatchObject({
      cursor: null,
      hasMore: false,
    });
  });

  it('builds scan-friendly labels and chooses a running row primary action', () => {
    const row = recordFor(baseVps);

    expect(row.primaryAction).toBe('console');
    expect(row.nodeLabel).toBe('node3.example');
    expect(row.locationLabel).toBe('Praha');
    expect(row.ownerLabel).toBe('alice');
    expect(row.primaryIpLabel).toBe('198.51.100.10');
    expect(recordMatchesStateFilter(row, 'running')).toBe(true);
    expect(recordMatchesStateFilter(row, 'stopped')).toBe(false);
  });

  it('moves stopped rows toward Start and failed rows into the failed filter', () => {
    const failedChains: TransactionChain[] = [
      { id: 9001, state: 'failed', concerns: [['Vps', 101]] },
    ];
    const row = recordFor({ ...baseVps, is_running: false }, failedChains);

    expect(row.primaryAction).toBe('start');
    expect(row.recentFailureChainIds).toEqual([9001]);
    expect(row.rowVariant).toBe('danger');
    expect(recordMatchesStateFilter(row, 'stopped')).toBe(true);
    expect(recordMatchesStateFilter(row, 'failed')).toBe(true);
  });

  it('normalizes state aliases and extracts nested IP candidates', () => {
    expect(normalizeVpsListStateFilter('locked')).toBe('busy');
    expect(normalizeVpsListStateFilter('error')).toBe('failed');
    expect(normalizeVpsListStateFilter('unexpected')).toBe('all');

    expect(
      extractVpsIpCandidates({
        ...baseVps,
        ip_addresses: [{ address: '203.0.113.5' }, { ip_addr: '2001:db8::5' }],
      })
    ).toEqual(['198.51.100.10', '203.0.113.5', '2001:db8::5']);
  });
});

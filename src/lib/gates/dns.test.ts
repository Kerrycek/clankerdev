import { describe, expect, it } from 'vitest';

import { gateDnsAction } from './dns';

describe('gateDnsAction', () => {
  it('blocks actions when a local transition lock is present', () => {
    const r = gateDnsAction('record.create', { busyLocal: true });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason.titleKey).toBe('gate.busy.local.title');
    }
  });

  it('blocks actions when a transaction chain is active', () => {
    const r = gateDnsAction('record.delete', { busyTransaction: true });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason.titleKey).toBe('gate.busy.transaction.title');
    }
  });

  it('allows actions when not busy', () => {
    const r = gateDnsAction('zone.update', {});
    expect(r.allowed).toBe(true);
  });
});

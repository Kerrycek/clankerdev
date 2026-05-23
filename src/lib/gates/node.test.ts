import { describe, expect, it } from 'vitest';

import { gateNodeAction } from './node';

describe('gateNodeAction', () => {
  it('blocks actions when a local transition lock is present', () => {
    const r = gateNodeAction('maintenance.lock', { busyLocal: true });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason.titleKey).toBe('gate.busy.local.title');
    }
  });

  it('blocks actions when a transaction chain is active', () => {
    const r = gateNodeAction('evacuate', { busyTransaction: true });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason.titleKey).toBe('gate.busy.transaction.title');
    }
  });

  it('allows actions when not busy', () => {
    const r = gateNodeAction('maintenance.unlock', {});
    expect(r.allowed).toBe(true);
  });
});

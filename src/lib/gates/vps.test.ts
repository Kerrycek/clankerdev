import { describe, expect, it } from 'vitest';

import { gateVpsAction, gateVpsMutation } from './vps';

const baseVps: any = {
  id: 101,
  object_state: 'active',
  is_running: false,
};

describe('gateVpsAction', () => {
  it('blocks actions when a transaction is in progress', () => {
    const r = gateVpsAction('start', { vps: baseVps, busyTransaction: true });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason.titleKey).toBe('gate.busy.transaction.title');
    }
  });

  it('allows start when stopped', () => {
    const r = gateVpsAction('start', { vps: baseVps });
    expect(r.allowed).toBe(true);
  });

  it('blocks start when already running', () => {
    const r = gateVpsAction('start', { vps: { ...baseVps, is_running: true } });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason.titleKey).toBe('gate.blocked.vps.running.title');
    }
  });

  it('blocks stop when already stopped', () => {
    const r = gateVpsAction('stop', { vps: baseVps });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason.titleKey).toBe('gate.blocked.vps.stopped.title');
    }
  });

  it('blocks power actions when runtime is unknown', () => {
    const r = gateVpsAction('start', { vps: { ...baseVps, is_running: undefined as LegacyAny } });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason.titleKey).toBe('gate.blocked.vps.unknown_state.title');
    }
  });

  it('blocks power actions when VPS is inactive', () => {
    const r = gateVpsAction('start', { vps: { ...baseVps, object_state: 'inactive' } });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason.titleKey).toBe('gate.blocked.vps.inactive.title');
    }
  });
});


describe('gateVpsMutation', () => {
  it('allows mutations when active and not busy', () => {
    const r = gateVpsMutation({ vps: baseVps });
    expect(r.allowed).toBe(true);
  });

  it('blocks mutations when a local lock is present', () => {
    const r = gateVpsMutation({ vps: baseVps, busyLocal: true });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason.titleKey).toBe('gate.busy.local.title');
    }
  });

  it('blocks mutations when VPS is inactive', () => {
    const r = gateVpsMutation({ vps: { ...baseVps, object_state: 'inactive' } });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason.titleKey).toBe('gate.blocked.vps.inactive.title');
    }
  });
});

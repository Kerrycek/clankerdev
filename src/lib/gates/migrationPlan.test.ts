import { describe, expect, it } from 'vitest';

import { gateMigrationPlanAction } from './migrationPlan';

describe('gateMigrationPlanAction', () => {
  it('blocks actions when a local transition lock is present', () => {
    const r = gateMigrationPlanAction('start', { plan: { id: 1, state: 'staged' } as any, busyLocal: true });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason.titleKey).toBe('gate.busy.local.title');
    }
  });

  it('blocks start when plan is not staged', () => {
    const r = gateMigrationPlanAction('start', { plan: { id: 1, state: 'running' } as any });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason.titleKey).toBe('gate.blocked.migration_plan.not_startable.title');
    }
  });

  it('allows cancel for running plan', () => {
    const r = gateMigrationPlanAction('cancel', { plan: { id: 1, state: 'running' } as any });
    expect(r.allowed).toBe(true);
  });

  it('blocks cancel for staged plan', () => {
    const r = gateMigrationPlanAction('cancel', { plan: { id: 1, state: 'staged' } as any });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason.titleKey).toBe('gate.blocked.migration_plan.not_cancellable.title');
    }
  });

  it('blocks delete when plan is not staged', () => {
    const r = gateMigrationPlanAction('delete', { plan: { id: 1, state: 'done' } as any });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason.titleKey).toBe('gate.blocked.migration_plan.not_deletable.title');
    }
  });
});

import { describe, expect, it } from 'vitest';

import {
  actionStateBadge,
  chainBadgeFromState,
  chainProgressLabel,
  chainProgressPercent,
  objectStateBadge,
  runtimeStateBadge,
  transactionBadge,
} from './taskStatus';

const t = (key: any) => String(key);

// Note: TransactionChain.progress in vpsAdmin is a *count* of finished transactions.
// Percent = progress / size * 100.

describe('chainProgressPercent', () => {
  it('returns 100% for progress=size=1', () => {
    expect(chainProgressPercent({ progress: 1, size: 1 })).toBe(100);
  });

  it('returns 0% for progress=0', () => {
    expect(chainProgressPercent({ progress: 0, size: 1 })).toBe(0);
  });

  it('computes percent from progress/size', () => {
    expect(chainProgressPercent({ progress: 2, size: 4 })).toBe(50);
  });

  it('clamps above 100%', () => {
    expect(chainProgressPercent({ progress: 5, size: 4 })).toBe(100);
  });

  it('returns null for invalid size', () => {
    expect(chainProgressPercent({ progress: 1, size: 0 })).toBeNull();
    expect(chainProgressPercent({ progress: 1, size: -1 })).toBeNull();
  });
});

describe('chainProgressLabel', () => {
  it('formats progress/size as integers', () => {
    expect(chainProgressLabel({ progress: 2, size: 4 })).toBe('2/4');
  });

  it('returns null when missing progress or size', () => {
    expect(chainProgressLabel({ progress: 2 })).toBeNull();
    expect(chainProgressLabel({ size: 4 })).toBeNull();
  });
});

describe('runtimeStateBadge', () => {
  it('maps running/stopped/unknown', () => {
    expect(runtimeStateBadge(true, t)).toEqual({ variant: 'ok', label: 'state.running' });
    expect(runtimeStateBadge(false, t)).toEqual({ variant: 'danger', label: 'state.stopped' });
    expect(runtimeStateBadge(null, t)).toEqual({ variant: 'neutral', label: 'state.unknown' });
  });
});

describe('objectStateBadge', () => {
  it('maps common lifecycle states', () => {
    expect(objectStateBadge('active', t)).toEqual({ variant: 'ok', label: 'state.active' });
    expect(objectStateBadge('inactive', t)).toEqual({ variant: 'warn', label: 'state.inactive' });
    expect(objectStateBadge('stopped', t)).toEqual({ variant: 'danger', label: 'state.stopped' });
    expect(objectStateBadge('suspended', t)).toEqual({ variant: 'warn', label: 'state.suspended' });
    expect(objectStateBadge('deleted', t)).toEqual({ variant: 'danger', label: 'state.deleted' });
    expect(objectStateBadge(undefined, t)).toEqual({ variant: 'neutral', label: 'state.unknown' });
  });
});

describe('chainBadgeFromState', () => {
  it('colors active chain states as working (warn)', () => {
    expect(chainBadgeFromState('queued').variant).toBe('warn');
    expect(chainBadgeFromState('staged').variant).toBe('warn');
    expect(chainBadgeFromState('rollbacking').variant).toBe('warn');
  });

  it('colors finished states', () => {
    expect(chainBadgeFromState('done').variant).toBe('ok');
    expect(chainBadgeFromState('resolved').variant).toBe('ok');
    expect(chainBadgeFromState('failed').variant).toBe('danger');
    expect(chainBadgeFromState('fatal').variant).toBe('danger');
  });
});

describe('transactionBadge', () => {
  it('colors done success/failure', () => {
    expect(transactionBadge({ done: 'done', success: 1 }).variant).toBe('ok');
    expect(transactionBadge({ done: 'done', success: 0 }).variant).toBe('danger');
  });

  it('colors in-progress as working (warn)', () => {
    expect(transactionBadge({ done: 'waiting' }).variant).toBe('warn');
    expect(transactionBadge({ done: 'staged' }).variant).toBe('warn');
  });
});

describe('actionStateBadge', () => {
  it('colors done success/failure', () => {
    expect(actionStateBadge({ finished: true, status: true }).variant).toBe('ok');
    expect(actionStateBadge({ finished: true, status: false }).variant).toBe('danger');
  });

  it('colors running as working (warn)', () => {
    expect(actionStateBadge({ finished: false, status: true }).variant).toBe('warn');
  });
});

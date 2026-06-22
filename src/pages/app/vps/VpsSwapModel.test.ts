import type { Vps } from '../../../lib/api/vps';
import {
  buildSwapAfterPreview,
  buildVpsSwapPayload,
  defaultSwapForm,
  isSameSwapTarget,
  looksLikeSwapCandidate,
  rankSwapCandidate,
  swapCandidateReasonKeys,
  swapTargetFit,
  type SwapForm,
} from './VpsSwapModel';

const sourceVps: Vps = {
  id: 123,
  hostname: 'prod.example',
  object_state: 'active',
  expiration_date: '2026-07-01T00:00:00Z',
  cpu: 4,
  memory: 4096,
  swap: 1024,
  diskspace: 51200,
  dataset: { id: 701, name: 'tank/prod' },
  user: { id: 45, login: 'alice', level: 1 },
  node: { id: 12, domain_name: 'node1.example', location: { id: 7, label: 'Praha' } },
};

const stagingVps: Vps = {
  id: 321,
  hostname: 'prod-staging.example',
  object_state: 'active',
  expiration_date: '2026-08-01T00:00:00Z',
  cpu: 2,
  memory: 2048,
  swap: 512,
  diskspace: 25600,
  dataset: { id: 702, name: 'tank/staging' },
  user: { id: 45, login: 'alice', level: 1 },
  node: { id: 12, domain_name: 'node1.example', location: { id: 7, label: 'Praha' } },
};

const unrelatedVps: Vps = {
  id: 987,
  hostname: 'customer.example',
  object_state: 'stopped',
  user: { id: 99, login: 'bob', level: 1 },
  node: { id: 88, domain_name: 'node9.example', location: { id: 44, label: 'Ostrava' } },
};

function form(overrides: Partial<SwapForm> = {}): SwapForm {
  return {
    ...defaultSwapForm(),
    targetVps: 321,
    ...overrides,
  };
}

describe('VPS swap model', () => {
  it('keeps the regular-user swap payload limited to the target VPS', () => {
    expect(buildVpsSwapPayload(form({ hostname: false, resources: false, expirations: false }), false)).toEqual({
      vps: 321,
    });
  });

  it('adds admin-only swap flags only for admin mode', () => {
    expect(buildVpsSwapPayload(form({ hostname: false, resources: true, expirations: false }), true)).toEqual({
      vps: 321,
      hostname: false,
      resources: true,
      expirations: false,
    });
  });

  it('rejects missing target VPS and detects self-target swaps', () => {
    expect(() => buildVpsSwapPayload(form({ targetVps: null }), true)).toThrow('required-id');
    expect(isSameSwapTarget(123, 123)).toBe(true);
    expect(isSameSwapTarget(123, 321)).toBe(false);
    expect(isSameSwapTarget(123, null)).toBe(false);
  });

  it('identifies and ranks likely staging or playground targets', () => {
    expect(looksLikeSwapCandidate(stagingVps)).toBe(true);
    expect(looksLikeSwapCandidate(unrelatedVps)).toBe(false);
    expect(rankSwapCandidate(stagingVps, sourceVps, 12, 7)).toBeGreaterThan(rankSwapCandidate(unrelatedVps, sourceVps, 12, 7));
    expect(swapCandidateReasonKeys(stagingVps, sourceVps, 12, 7)).toEqual([
      'vps.lifecycle.swap.candidate.reason.environment',
      'vps.lifecycle.swap.candidate.reason.owner',
      'vps.lifecycle.swap.candidate.reason.node',
      'vps.lifecycle.swap.candidate.reason.location',
      'vps.lifecycle.swap.candidate.reason.active',
    ]);
  });

  it('builds the after-swap preview from source, target and enabled admin options', () => {
    const after = buildSwapAfterPreview({
      source: sourceVps,
      target: stagingVps,
      form: form(),
      sourceId: sourceVps.id,
      isAdminMode: true,
      targetLabel: 'prod-staging.example (#321)',
      formatDateTime: (value) => value ? `formatted:${value}` : '—',
    });

    expect(after.sourceHostnameAfter).toBe('prod-staging.example (#321)');
    expect(after.targetHostnameAfter).toBe('prod.example (#123)');
    expect(after.sourceDatasetAfter).toBe('tank/staging');
    expect(after.targetDatasetAfter).toBe('tank/prod');
    expect(after.sourceExpirationAfter).toBe('formatted:2026-08-01T00:00:00Z');
    expect(after.targetExpirationAfter).toBe('formatted:2026-07-01T00:00:00Z');
  });

  it('keeps disabled admin options on their original side in the preview', () => {
    const after = buildSwapAfterPreview({
      source: sourceVps,
      target: stagingVps,
      form: form({ hostname: false, resources: false, expirations: false }),
      sourceId: sourceVps.id,
      isAdminMode: true,
      targetLabel: 'prod-staging.example (#321)',
      formatDateTime: (value) => value ? `formatted:${value}` : '—',
    });

    expect(after.sourceHostnameAfter).toBe('prod.example (#123)');
    expect(after.targetHostnameAfter).toBe('prod-staging.example (#321)');
    expect(after.sourceResourcesAfter).toContain('4 vCPU');
    expect(after.targetResourcesAfter).toContain('2 vCPU');
    expect(after.sourceExpirationAfter).toBe('formatted:2026-07-01T00:00:00Z');
    expect(after.targetExpirationAfter).toBe('formatted:2026-08-01T00:00:00Z');
  });

  it('summarizes target fit for the impact panel', () => {
    expect(swapTargetFit({ source: sourceVps, target: stagingVps, ownerId: 45, locationId: 7 })).toEqual({
      likely: true,
      sameOwner: true,
      sameLocation: true,
      ownerLabel: 'alice',
      targetLabel: 'prod-staging.example (#321)',
      stateLabel: 'active',
    });
  });
});

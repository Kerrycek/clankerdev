import { describe, expect, it } from 'vitest';

import { datasetExpansionCapabilities } from './DatasetExpansionCapabilities';

describe('datasetExpansionCapabilities', () => {
  it.each([
    { label: 'regular user without expansion', mode: 'user', role: 'user', hasExpansion: false, isVpsDataset: true, showEntry: false },
    { label: 'support in admin mode without expansion', mode: 'admin', role: 'support', hasExpansion: false, isVpsDataset: true, showEntry: false },
    { label: 'admin in user mode without expansion', mode: 'user', role: 'admin', hasExpansion: false, isVpsDataset: true, showEntry: false },
    { label: 'admin on NAS without expansion', mode: 'admin', role: 'admin', hasExpansion: false, isVpsDataset: false, showEntry: false },
    { label: 'admin on VPS dataset without expansion', mode: 'admin', role: 'admin', hasExpansion: false, isVpsDataset: true, showEntry: true },
    { label: 'regular user with expansion', mode: 'user', role: 'user', hasExpansion: true, isVpsDataset: true, showEntry: true },
  ] as const)('$label', ({ showEntry, ...input }) => {
    const capabilities = datasetExpansionCapabilities(input);
    expect(capabilities.showEntry).toBe(showEntry);
    expect(capabilities.canCreate).toBe(input.mode === 'admin' && input.role === 'admin' && input.isVpsDataset && !input.hasExpansion);
  });

  it('separates active add-space permission from edit and history metadata', () => {
    const resolved = datasetExpansionCapabilities({
      mode: 'admin',
      role: 'admin',
      hasExpansion: true,
      isVpsDataset: false,
      expansionState: 'resolved',
    });
    expect(resolved.canEdit).toBe(true);
    expect(resolved.canAddSpace).toBe(false);
    expect(resolved.showAdminMetadata).toBe(true);

    const active = datasetExpansionCapabilities({
      mode: 'admin',
      role: 'admin',
      hasExpansion: true,
      isVpsDataset: true,
      expansionState: 'active',
    });
    expect(active.canAddSpace).toBe(true);
  });
});

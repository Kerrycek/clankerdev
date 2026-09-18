import type { AppMode } from '../../../app/appMode';
import type { UserRole } from '../../../lib/roles';

export function datasetExpansionCapabilities(input: {
  mode: AppMode;
  role: UserRole;
  hasExpansion: boolean;
  isVpsDataset: boolean;
  expansionState?: string;
}) {
  const adminContext = input.mode === 'admin' && input.role === 'admin';
  const canCreate = adminContext && input.isVpsDataset && !input.hasExpansion;
  const canEdit = adminContext && input.hasExpansion;

  return {
    showEntry: input.hasExpansion || canCreate,
    canCreate,
    canRegister: canCreate,
    canEdit,
    canAddSpace: canEdit && input.expansionState === 'active',
    showAdminMetadata: adminContext,
  };
}

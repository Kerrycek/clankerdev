import type { Dataset } from '../api/datasets';
import type { UserRole } from '../roles';
import type { GateDecision, GateReason } from './types';

export type DatasetAction =
  | 'dataset.create'
  | 'dataset.update'
  | 'dataset.delete'
  | 'snapshot.create'
  | 'snapshot.rollback'
  | 'snapshot.delete'
  | 'download.create'
  | 'download.delete';

type DatasetLife = 'active' | 'inactive' | 'deleted' | 'unknown';

function lifeState(ds: Dataset): DatasetLife {
  const st = String((ds as any).object_state ?? '').trim();
  if (st === 'active') return 'active';
  if (st === 'deleted') return 'deleted';
  if (st === 'inactive') return 'inactive';
  if (st) return 'unknown';

  const active = (ds as any).active;
  if (active === true) return 'active';
  if (active === false) return 'inactive';
  return 'active';
}

function blocksWhenInactive(action: DatasetAction): boolean {
  // Download deletion is independent and remains useful even if the dataset is deleted.
  return action !== 'download.delete';
}

function requiresAdmin(action: DatasetAction): boolean {
  switch (action) {
    case 'dataset.create':
    case 'dataset.delete':
    case 'snapshot.rollback':
    case 'snapshot.delete':
    case 'download.delete':
      return true;
    case 'snapshot.create':
    case 'download.create':
      return false;
    default:
      return false;
  }
}

function deny(reason: GateReason): GateDecision {
  return { allowed: false, reason };
}

export function gateDatasetAction(
  action: DatasetAction,
  ctx: {
    dataset: Dataset;
    busyTransaction?: boolean;
    busyLocal?: boolean;
    role?: UserRole;
  }
): GateDecision {
  if (ctx.role && ctx.role !== 'admin' && requiresAdmin(action)) {
    return deny({ titleKey: 'gate.admin_only.title', descriptionKey: 'gate.admin_only.body' });
  }

  if (ctx.busyTransaction) {
    return deny({ titleKey: 'gate.busy.transaction.title', descriptionKey: 'gate.busy.transaction.body' });
  }

  if (ctx.busyLocal) {
    return deny({ titleKey: 'gate.busy.local.title', descriptionKey: 'gate.busy.local.body' });
  }

  const life = lifeState(ctx.dataset);
  if (blocksWhenInactive(action)) {
    if (life === 'deleted') {
      return deny({
        titleKey: 'gate.blocked.dataset.deleted.title',
        descriptionKey: 'gate.blocked.dataset.deleted.body',
      });
    }

    if (life === 'inactive') {
      return deny({
        titleKey: 'gate.blocked.dataset.inactive.title',
        descriptionKey: 'gate.blocked.dataset.inactive.body',
      });
    }

    if (life !== 'active') {
      return deny({
        titleKey: 'gate.blocked.dataset.unknown_state.title',
        descriptionKey: 'gate.blocked.dataset.unknown_state.body',
      });
    }
  }

  return { allowed: true };
}

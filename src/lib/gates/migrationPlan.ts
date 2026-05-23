import type { MigrationPlan } from '../api/app';
import type { GateDecision, GateReason } from './types';

export type MigrationPlanGateContext = {
  plan: MigrationPlan;
  busyLocal?: boolean;
  busyTransaction?: boolean;
};

function deny(reason: GateReason): GateDecision {
  return { allowed: false, reason };
}

function baseBlockers(ctx: MigrationPlanGateContext): { state: string } | GateDecision {
  if (ctx.busyLocal) {
    return deny({ titleKey: 'gate.busy.local.title', descriptionKey: 'gate.busy.local.body' });
  }
  if (ctx.busyTransaction) {
    return deny({ titleKey: 'gate.busy.transaction.title', descriptionKey: 'gate.busy.transaction.body' });
  }

  const st = String((ctx.plan as any).state ?? '').trim().toLowerCase();
  if (!st) {
    return deny({
      titleKey: 'gate.blocked.migration_plan.unknown_state.title',
      descriptionKey: 'gate.blocked.migration_plan.unknown_state.body',
    });
  }

  return { state: st };
}

export function gateMigrationPlanAction(
  action: 'start' | 'cancel' | 'delete' | 'schedule',
  ctx: MigrationPlanGateContext
): GateDecision {
  const base = baseBlockers(ctx);
  if ('allowed' in base) return base;

  const st = base.state;

  switch (action) {
    case 'start':
      if (st !== 'staged') {
        return deny({
          titleKey: 'gate.blocked.migration_plan.not_startable.title',
          descriptionKey: 'gate.blocked.migration_plan.not_startable.body',
        });
      }
      return { allowed: true };

    case 'cancel':
      if (!(st === 'running' || st === 'cancelling' || st === 'failing')) {
        return deny({
          titleKey: 'gate.blocked.migration_plan.not_cancellable.title',
          descriptionKey: 'gate.blocked.migration_plan.not_cancellable.body',
        });
      }
      return { allowed: true };

    case 'delete':
      if (st !== 'staged') {
        return deny({
          titleKey: 'gate.blocked.migration_plan.not_deletable.title',
          descriptionKey: 'gate.blocked.migration_plan.not_deletable.body',
        });
      }
      return { allowed: true };

    case 'schedule':
      if (st !== 'staged') {
        return deny({
          titleKey: 'gate.blocked.migration_plan.not_schedulable.title',
          descriptionKey: 'gate.blocked.migration_plan.not_schedulable.body',
        });
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
}

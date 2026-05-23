import type { Vps } from '../api/app';
import type { GateDecision, GateReason } from './types';

export type VpsGateContext = {
  vps: Vps;
  busyLocal?: boolean;
  busyTransaction?: boolean;
};

function deny(reason: GateReason): GateDecision {
  return { allowed: false, reason };
}

function baseBlockers(ctx: VpsGateContext): GateDecision | null {
  if (ctx.busyLocal) {
    return deny({ titleKey: 'gate.busy.local.title', descriptionKey: 'gate.busy.local.body' });
  }
  if (ctx.busyTransaction) {
    return deny({ titleKey: 'gate.busy.transaction.title', descriptionKey: 'gate.busy.transaction.body' });
  }

  const st = String((ctx.vps as any).object_state ?? '').toLowerCase().trim();
  if (!st) {
    return deny({
      titleKey: 'gate.blocked.vps.unknown_state.title',
      descriptionKey: 'gate.blocked.vps.unknown_state.body',
    });
  }

  if (st === 'inactive') {
    return deny({ titleKey: 'gate.blocked.vps.inactive.title', descriptionKey: 'gate.blocked.vps.inactive.body' });
  }

  if (st === 'suspended') {
    return deny({ titleKey: 'gate.blocked.vps.suspended.title', descriptionKey: 'gate.blocked.vps.suspended.body' });
  }
  if (st === 'deleted') {
    return deny({ titleKey: 'gate.blocked.vps.deleted.title', descriptionKey: 'gate.blocked.vps.deleted.body' });
  }

  if (st !== 'active') {
    return deny({
      titleKey: 'gate.blocked.vps.unknown_state.title',
      descriptionKey: 'gate.blocked.vps.unknown_state.body',
    });
  }

  return null;
}

export function gateVpsMutation(ctx: VpsGateContext): GateDecision {
  const base = baseBlockers(ctx);
  if (base) return base;
  return { allowed: true };
}

export function gateVpsAction(action: 'start' | 'stop' | 'restart' | 'passwd', ctx: VpsGateContext): GateDecision {
  const base = baseBlockers(ctx);
  if (base) return base;

  const runningRaw = (ctx.vps as any).is_running as unknown;
  const runningKnown = runningRaw === true || runningRaw === false;

  if ((action === 'start' || action === 'stop' || action === 'restart') && !runningKnown) {
    return deny({
      titleKey: 'gate.blocked.vps.unknown_state.title',
      descriptionKey: 'gate.blocked.vps.unknown_state.body',
    });
  }

  const isRunning = runningRaw === true;

  switch (action) {
    case 'start':
      if (isRunning) {
        return deny({ titleKey: 'gate.blocked.vps.running.title', descriptionKey: 'gate.blocked.vps.running.body' });
      }
      return { allowed: true };

    case 'stop':
    case 'restart':
      if (!isRunning) {
        return deny({ titleKey: 'gate.blocked.vps.stopped.title', descriptionKey: 'gate.blocked.vps.stopped.body' });
      }
      return { allowed: true };

    case 'passwd':
      return { allowed: true };

    default:
      return { allowed: true };
  }
}

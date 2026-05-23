import type { GateDecision } from './types';
import { deny } from './types';

export type DnsAction = 'record.create' | 'record.update' | 'record.delete' | 'zone.update' | 'zone.delete';

export function gateDnsAction(
  _action: DnsAction,
  ctx?: {
    busyLocal?: boolean;
    busyTransaction?: boolean;
  }
): GateDecision {
  if (ctx?.busyLocal) {
    return deny({ titleKey: 'gate.busy.local.title', descriptionKey: 'gate.busy.local.body' });
  }

  if (ctx?.busyTransaction) {
    return deny({ titleKey: 'gate.busy.transaction.title', descriptionKey: 'gate.busy.transaction.body' });
  }

  return { allowed: true };
}

import type { Vps } from './api/vps';
import { refId } from './resourceRefs';

export function vpsOwnerId(vps: Partial<Vps> | Record<string, unknown> | null | undefined): number | undefined {
  if (!vps || typeof vps !== 'object') return undefined;
  const row = vps as Record<string, unknown>;
  return refId(row['user']) ?? refId(row['user_id']) ?? refId(row['raw_user_id']);
}

export function vpsMatchesOwner(vps: Partial<Vps> | Record<string, unknown> | null | undefined, userId: number | undefined): boolean {
  if (userId === undefined) return true;
  return vpsOwnerId(vps) === userId;
}

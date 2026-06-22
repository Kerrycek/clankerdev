import type { Vps } from '../../../lib/api/vps';

export type VpsDeleteConfirmationSource = Pick<Vps, 'id'> & {
  hostname?: string | null;
};

export type DeleteForm = {
  lazy: boolean;
  confirmText: string;
};

export function defaultDeleteForm(): DeleteForm {
  return {
    lazy: true,
    confirmText: '',
  };
}

export function vpsDeleteConfirmationTarget(vps: VpsDeleteConfirmationSource): string {
  const hostname = typeof vps.hostname === 'string' ? vps.hostname.trim() : '';
  return hostname || `#${vps.id}`;
}

export function isVpsDeleteConfirmationSatisfied(value: string, target: string): boolean {
  return value === target;
}

export function vpsDeleteObjectLabel(vps: VpsDeleteConfirmationSource): string {
  const hostname = typeof vps.hostname === 'string' ? vps.hostname.trim() : '';
  return hostname || `#${vps.id}`;
}

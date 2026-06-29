import type { Vps } from '../../../lib/api/vps';

export type VpsDeleteConfirmationSource = Pick<Vps, 'id'> & {
  hostname?: string | null;
};

export type DeleteForm = {
  lazy: boolean;
};

export function defaultDeleteForm(): DeleteForm {
  return {
    lazy: true,
  };
}

export function vpsDeleteConfirmationTarget(vps: VpsDeleteConfirmationSource): string {
  const hostname = typeof vps.hostname === 'string' ? vps.hostname.trim() : '';
  return hostname || `#${vps.id}`;
}

export function vpsDeleteObjectLabel(vps: VpsDeleteConfirmationSource): string {
  const hostname = typeof vps.hostname === 'string' ? vps.hostname.trim() : '';
  return hostname || `#${vps.id}`;
}

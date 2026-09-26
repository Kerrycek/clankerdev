import { localInputToIso } from '../../../lib/datetimeLocal';
import type { Vps, VpsDeleteOptions } from '../../../lib/api/vps';

export type VpsDeleteConfirmationSource = Pick<Vps, 'id'> & {
  hostname?: string | null;
};

export type DeleteForm = {
  lazy: boolean;
  customExpiration?: boolean;
  expirationLocal?: string;
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

export function isVpsDeleteConfirmationSatisfied(value: string, target: string): boolean {
  return value === target;
}

export function vpsDeleteObjectLabel(vps: VpsDeleteConfirmationSource): string {
  const hostname = typeof vps.hostname === 'string' ? vps.hostname.trim() : '';
  return hostname || `#${vps.id}`;
}

export function deleteExpirationValid(form: DeleteForm): boolean {
  if (!form.lazy || !form.customExpiration) return true;
  const parsed = localInputToIso(form.expirationLocal);
  return parsed.valid && parsed.iso !== null && Date.parse(parsed.iso) > Date.now();
}

export function buildVpsDeleteOptions(form: DeleteForm, isAdmin: boolean): VpsDeleteOptions | undefined {
  if (!isAdmin) return undefined;
  if (!deleteExpirationValid(form)) throw new Error('invalid-date');
  return {
    lazy: form.lazy,
    ...(form.lazy && form.customExpiration
      ? { expiration_date: localInputToIso(form.expirationLocal).iso! }
      : {}),
  };
}

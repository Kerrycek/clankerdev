import type { OsTemplate } from '../../../lib/api/osTemplates';
import type { Vps, VpsReinstallPayload } from '../../../lib/api/vps';

export type ReinstallUserDataFormat =
  | 'script'
  | 'cloudinit_config'
  | 'cloudinit_script'
  | 'nixos_configuration'
  | 'nixos_flake_configuration'
  | 'nixos_flake_uri';

export type ReinstallForm = {
  osTemplate: string;
  userDataEnabled: boolean;
  userDataFormat: ReinstallUserDataFormat;
  userDataContent: string;
};

export const reinstallUserDataFormats: ReadonlyArray<ReinstallUserDataFormat> = [
  'script',
  'cloudinit_config',
  'cloudinit_script',
  'nixos_configuration',
  'nixos_flake_configuration',
  'nixos_flake_uri',
];

export function defaultReinstallForm(osTemplateId: number | null | undefined): ReinstallForm {
  return {
    osTemplate: osTemplateId ? String(osTemplateId) : '',
    userDataEnabled: false,
    userDataFormat: 'cloudinit_config',
    userDataContent: '',
  };
}

export function parseRequiredReinstallId(raw: string): number {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) throw new Error('required-id');
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0) throw new Error('required-id');
  return n;
}

export function buildVpsReinstallPayload(form: ReinstallForm): VpsReinstallPayload {
  const payload: VpsReinstallPayload = {
    os_template: parseRequiredReinstallId(form.osTemplate),
  };

  const content = form.userDataContent.trim();
  if (form.userDataEnabled && content) {
    payload.user_data_format = form.userDataFormat;
    payload.user_data_content = content;
  }

  return payload;
}

export function vpsReinstallConfirmationTarget(vps: Pick<Vps, 'id' | 'hostname'>): string {
  return String(vps.hostname || `#${vps.id}`).trim();
}

export function vpsReinstallTemplateLabel(tpl: OsTemplate | undefined): string {
  if (!tpl) return '—';
  return String(tpl.label ?? tpl.name ?? `#${tpl.id}`).trim() || `#${tpl.id}`;
}

export function vpsCurrentTemplateLabel(vps: Pick<Vps, 'os_template'>): string {
  const tpl = vps.os_template;
  if (!tpl) return '—';
  return String(tpl.label ?? tpl.name ?? `#${tpl.id}`).trim() || `#${tpl.id}`;
}

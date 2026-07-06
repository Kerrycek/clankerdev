import type { VpsUserData, VpsUserDataFormat } from '../../lib/api/vpsUserData';

export const USER_DATA_FORMATS: VpsUserDataFormat[] = [
  'script',
  'cloudinit_config',
  'cloudinit_script',
  'nixos_configuration',
  'nixos_flake_configuration',
  'nixos_flake_uri',
];

export const MAX_USER_DATA_CONTENT_LEN = 65_536;

export type UserDataEditorState =
  | { mode: 'create' }
  | { mode: 'edit'; item: VpsUserData }
  | { mode: 'deploy'; item: VpsUserData }
  | null;

export type UserDataFormState = {
  label: string;
  format: string;
  content: string;
};

export interface UserDataValidationHint {
  ok: boolean;
  labelKey: string;
  vars?: Record<string, unknown>;
}

export interface UserDataCreatePayload {
  user?: number;
  label: string;
  format: string;
  content: string;
}

export interface UserDataUpdatePayload {
  label: string;
  format: string;
  content: string;
}

export function isKnownUserDataFormat(format: string): format is VpsUserDataFormat {
  return USER_DATA_FORMATS.includes(format as VpsUserDataFormat);
}

export function userDataFormatLabelKey(format: string): string {
  if (!isKnownUserDataFormat(format)) return 'user_data.format.unknown';
  return `user_data.format.${format}`;
}

export function userDataFormatHintKey(format: string): string | null {
  if (!isKnownUserDataFormat(format)) return null;
  if (format === 'script') return 'user_data.hint.script';
  if (format === 'cloudinit_config') return 'user_data.hint.cloudinit_config';
  if (format === 'cloudinit_script') return 'user_data.hint.cloudinit_script';
  if (format === 'nixos_configuration') return 'user_data.hint.nixos_configuration';
  if (format === 'nixos_flake_configuration') return 'user_data.hint.nixos_flake_configuration';
  if (format === 'nixos_flake_uri') return 'user_data.hint.nixos_flake_uri';
  return null;
}

export function resolveUserDataFormat(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return '';

  const exact = USER_DATA_FORMATS.find((format) => format === normalized);
  if (exact) return exact;

  const matches = USER_DATA_FORMATS.filter((format) => format.startsWith(normalized));
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

export function safeUserDataId(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export function safeUserDataString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function initUserDataForm(item?: VpsUserData): UserDataFormState {
  return {
    label: item ? safeUserDataString(item.label) : '',
    format: item ? safeUserDataString(item.format) : 'cloudinit_config',
    content: item ? safeUserDataString(item.content) : '',
  };
}

export function isShebangScript(content: string): boolean {
  const firstLine = content.split(/\r?\n/)[0] ?? '';
  return firstLine.trim().startsWith('#!');
}

export function looksLikeNixAttrSet(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  return trimmed.startsWith('{') && trimmed.endsWith('}');
}

export function looksLikeFlakeUri(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  return !/\s/.test(trimmed);
}

export function userDataContentOverLimit(content: string): boolean {
  return content.length > MAX_USER_DATA_CONTENT_LEN;
}

export function canSaveUserDataForm(form: UserDataFormState): boolean {
  const label = form.label.trim();
  return (
    label.length > 0 &&
    label.length <= 255 &&
    form.format.trim().length > 0 &&
    form.content.trim().length > 0 &&
    !userDataContentOverLimit(form.content)
  );
}

export function buildUserDataValidationHints(form: UserDataFormState): UserDataValidationHint[] {
  const contentLen = form.content.length;
  const contentOverLimit = userDataContentOverLimit(form.content);
  const hints: UserDataValidationHint[] = [
    {
      ok: form.label.trim().length > 0,
      labelKey: 'user_data.validation.label_required',
    },
    {
      ok: contentLen > 0,
      labelKey: 'user_data.validation.content_required',
    },
    {
      ok: !contentOverLimit,
      labelKey: 'user_data.validation.content_max',
      vars: { max: MAX_USER_DATA_CONTENT_LEN },
    },
  ];

  if (form.format === 'script' || form.format === 'cloudinit_script') {
    hints.push({
      ok: isShebangScript(form.content),
      labelKey: 'user_data.validation.shebang',
    });
  }

  if (form.format === 'nixos_configuration' || form.format === 'nixos_flake_configuration') {
    hints.push({
      ok: looksLikeNixAttrSet(form.content),
      labelKey: 'user_data.validation.nix_attrset',
    });
  }

  if (form.format === 'nixos_flake_uri') {
    hints.push({
      ok: looksLikeFlakeUri(form.content),
      labelKey: 'user_data.validation.flake_uri',
    });
  }

  return hints;
}

export function buildUserDataCreatePayload(form: UserDataFormState, userId?: number): UserDataCreatePayload {
  const payload: UserDataCreatePayload = {
    label: form.label.trim(),
    format: form.format.trim(),
    content: form.content,
  };

  if (userId) payload.user = userId;

  return payload;
}

export function buildUserDataUpdatePayload(form: UserDataFormState): UserDataUpdatePayload {
  return {
    label: form.label.trim(),
    format: form.format.trim(),
    content: form.content,
  };
}

export function userDataUpdatedTimestamp(item: VpsUserData): string | undefined {
  return safeUserDataString(item.updated_at) || safeUserDataString(item.created_at) || undefined;
}

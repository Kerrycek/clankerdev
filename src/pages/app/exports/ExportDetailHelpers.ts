import type { ExportHostFormState } from './ExportDetailDrawers';
import type { EditExportFormState } from './ExportModel';

export function defaultEditForm(): EditExportFormState {
  return {
    all_vps: true,
    rw: true,
    sync: true,
    subtree_check: false,
    root_squash: false,
    threads: '8',
    enabled: true,
  };
}

export function defaultHostForm(): ExportHostFormState {
  return {
    ip_address: null,
    rw: true,
    sync: true,
    subtree_check: false,
    root_squash: false,
  };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? '');
}

export function boolBadgeLabel(
  value: boolean,
  t: (key: string, vars?: Record<string, unknown>) => string,
) {
  return value ? t('common.enabled') : t('common.disabled');
}

import type { VpsPublicKey, VpsSshHostKey } from '../../../lib/api/vpsAccess';

export type VpsAccessChecklistItemId = 'ssh-command' | 'public-key' | 'host-key' | 'root-password';
export type VpsAccessChecklistState = 'ready' | 'attention' | 'blocked' | 'fallback' | 'pending';

export interface VpsAccessChecklistItem {
  id: VpsAccessChecklistItemId;
  state: VpsAccessChecklistState;
  titleKey: string;
  descriptionKey: string;
  values?: Record<string, string | number>;
}

export interface DuplicatePublicKeyGroup {
  identity: string;
  keys: VpsPublicKey[];
}

interface AccessChecklistOptions {
  isRunning: boolean;
  sshCommand: string | null;
  publicKeysLoaded: boolean;
  publicKeyCount: number;
  duplicatePublicKeyGroupCount: number;
  hostKeysLoaded: boolean;
  hostKeyCount: number;
  mutationAllowed: boolean;
}

function valueString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s ? s : undefined;
}

function normalizedIdentity(value: unknown): string | undefined {
  const s = valueString(value);
  return s ? s.toLowerCase().replace(/\s+/g, ' ') : undefined;
}

export function publicKeyDuplicateIdentity(key: VpsPublicKey): string | null {
  return normalizedIdentity(key.fingerprint) ?? normalizedIdentity(key.key) ?? null;
}

export function findDuplicatePublicKeyGroups(keys: VpsPublicKey[]): DuplicatePublicKeyGroup[] {
  const byIdentity = new Map<string, VpsPublicKey[]>();

  for (const key of keys) {
    const identity = publicKeyDuplicateIdentity(key);
    if (!identity) continue;
    const group = byIdentity.get(identity) ?? [];
    group.push(key);
    byIdentity.set(identity, group);
  }

  return Array.from(byIdentity.entries())
    .filter(([, group]) => group.length > 1)
    .map(([identity, group]) => ({ identity, keys: group }));
}

export function hostKeyDisplayType(key: VpsSshHostKey): string {
  return valueString(key.key_type) ?? valueString(key.type) ?? valueString(key.algorithm) ?? '—';
}

export function hostKeyDisplayFingerprint(key: VpsSshHostKey): string {
  return valueString(key.fingerprint) ?? valueString(key.sha256_fingerprint) ?? valueString(key.md5_fingerprint) ?? '—';
}

export function hostKeyMaterial(key: VpsSshHostKey): string {
  return valueString(key.public_key) ?? valueString(key.key) ?? valueString(key.host_key) ?? '';
}

export function hostKeyMeta(key: VpsSshHostKey): string {
  const parts = [valueString(key.bits), valueString(key.created_at)].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export function buildVpsAccessChecklist(options: AccessChecklistOptions): VpsAccessChecklistItem[] {
  const sshItem: VpsAccessChecklistItem = !options.isRunning
    ? {
        id: 'ssh-command',
        state: 'blocked',
        titleKey: 'vps.access.checklist.ssh.stopped.title',
        descriptionKey: 'vps.access.checklist.ssh.stopped.description',
      }
    : options.sshCommand
      ? {
          id: 'ssh-command',
          state: 'ready',
          titleKey: 'vps.access.checklist.ssh.ready.title',
          descriptionKey: 'vps.access.checklist.ssh.ready.description',
        }
      : {
          id: 'ssh-command',
          state: 'attention',
          titleKey: 'vps.access.checklist.ssh.no_address.title',
          descriptionKey: 'vps.access.checklist.ssh.no_address.description',
        };

  const publicKeyItem: VpsAccessChecklistItem = !options.publicKeysLoaded
    ? {
        id: 'public-key',
        state: 'pending',
        titleKey: 'vps.access.checklist.public_key.loading.title',
        descriptionKey: 'vps.access.checklist.public_key.loading.description',
      }
    : options.publicKeyCount === 0
      ? {
          id: 'public-key',
          state: 'attention',
          titleKey: 'vps.access.checklist.public_key.empty.title',
          descriptionKey: 'vps.access.checklist.public_key.empty.description',
        }
      : options.duplicatePublicKeyGroupCount > 0
        ? {
            id: 'public-key',
            state: 'attention',
            titleKey: 'vps.access.checklist.public_key.duplicates.title',
            descriptionKey: 'vps.access.checklist.public_key.duplicates.description',
            values: { count: options.duplicatePublicKeyGroupCount },
          }
        : {
            id: 'public-key',
            state: 'ready',
            titleKey: 'vps.access.checklist.public_key.ready.title',
            descriptionKey: 'vps.access.checklist.public_key.ready.description',
            values: { count: options.publicKeyCount },
          };

  const hostKeyItem: VpsAccessChecklistItem = !options.hostKeysLoaded
    ? {
        id: 'host-key',
        state: 'pending',
        titleKey: 'vps.access.checklist.host_key.loading.title',
        descriptionKey: 'vps.access.checklist.host_key.loading.description',
      }
    : options.hostKeyCount > 0
      ? {
          id: 'host-key',
          state: 'ready',
          titleKey: 'vps.access.checklist.host_key.ready.title',
          descriptionKey: 'vps.access.checklist.host_key.ready.description',
          values: { count: options.hostKeyCount },
        }
      : {
          id: 'host-key',
          state: 'attention',
          titleKey: 'vps.access.checklist.host_key.empty.title',
          descriptionKey: 'vps.access.checklist.host_key.empty.description',
        };

  const rootPasswordItem: VpsAccessChecklistItem = options.mutationAllowed
    ? {
        id: 'root-password',
        state: 'fallback',
        titleKey: 'vps.access.checklist.root_password.ready.title',
        descriptionKey: 'vps.access.checklist.root_password.ready.description',
      }
    : {
        id: 'root-password',
        state: 'blocked',
        titleKey: 'vps.access.checklist.root_password.blocked.title',
        descriptionKey: 'vps.access.checklist.root_password.blocked.description',
      };

  return [sshItem, publicKeyItem, hostKeyItem, rootPasswordItem];
}

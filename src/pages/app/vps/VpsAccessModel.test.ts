import { describe, expect, it } from 'vitest';

import type { VpsPublicKey, VpsSshHostKey } from '../../../lib/api/vpsAccess';
import {
  buildVpsAccessChecklist,
  findDuplicatePublicKeyGroups,
  hostKeyDisplayFingerprint,
  hostKeyDisplayType,
  hostKeyMaterial,
  publicKeyDuplicateIdentity,
} from './VpsAccessModel';

describe('VpsAccessModel', () => {
  it('builds a ready SSH/key/fingerprint checklist for a running VPS', () => {
    const items = buildVpsAccessChecklist({
      isRunning: true,
      sshCommand: 'ssh root@198.51.100.10',
      publicKeysLoaded: true,
      publicKeyCount: 2,
      duplicatePublicKeyGroupCount: 0,
      hostKeysLoaded: true,
      hostKeyCount: 2,
      mutationAllowed: true,
    });

    expect(items.map((item) => [item.id, item.state])).toEqual([
      ['ssh-command', 'ready'],
      ['public-key', 'ready'],
      ['host-key', 'ready'],
      ['root-password', 'fallback'],
    ]);
  });

  it('surfaces stopped/no-key/no-host-key/busy states as attention or blocked', () => {
    const items = buildVpsAccessChecklist({
      isRunning: false,
      sshCommand: 'ssh root@198.51.100.10',
      publicKeysLoaded: true,
      publicKeyCount: 0,
      duplicatePublicKeyGroupCount: 0,
      hostKeysLoaded: true,
      hostKeyCount: 0,
      mutationAllowed: false,
    });

    expect(items.map((item) => [item.id, item.state])).toEqual([
      ['ssh-command', 'blocked'],
      ['public-key', 'attention'],
      ['host-key', 'attention'],
      ['root-password', 'blocked'],
    ]);
  });

  it('detects duplicate saved public keys by fingerprint or raw key material', () => {
    const keys: VpsPublicKey[] = [
      { id: 1, label: 'laptop', fingerprint: 'SHA256:ABC' },
      { id: 2, label: 'laptop-copy', fingerprint: 'sha256:abc' },
      { id: 3, label: 'jumpbox', key: 'ssh-ed25519 AAAA jumpbox' },
      { id: 4, label: 'jumpbox-copy', key: 'ssh-ed25519 AAAA   jumpbox' },
      { id: 5, label: 'unique', fingerprint: 'SHA256:unique' },
    ];

    expect(publicKeyDuplicateIdentity(keys[0]!)).toBe('sha256:abc');
    const groups = findDuplicatePublicKeyGroups(keys);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.keys.map((key) => key.id))).toEqual([[1, 2], [3, 4]]);
  });

  it('normalizes host key display fields from multiple API shapes', () => {
    const key: VpsSshHostKey = {
      algorithm: 'ssh-ed25519',
      sha256_fingerprint: 'SHA256:host',
      host_key: 'ssh-ed25519 AAAA',
    };

    expect(hostKeyDisplayType(key)).toBe('ssh-ed25519');
    expect(hostKeyDisplayFingerprint(key)).toBe('SHA256:host');
    expect(hostKeyMaterial(key)).toBe('ssh-ed25519 AAAA');
  });
});

import { describe, expect, it } from 'vitest';

import type { ExportHost, ExportItem } from '../../../lib/api/exports';
import {
  buildCreateExportPayload,
  buildExportDiff,
  buildExportHostDiff,
  buildUpdateExportPayload,
  defaultCreateForm,
  editFormFromExport,
  exportAddress,
  exportDeleteConfirmText,
  hostDeleteConfirmText,
  hostLabel,
  parseBoolToken,
  parsePositiveInt,
  resourceLabel,
  sanitizeMountName,
  snippetFstab,
  snippetMountCommand,
  snippetNix,
  snippetSystemd,
  sourceLabel,
  sourceShortName,
  validateCreateExportForm,
} from './ExportModel';

const exportItem: ExportItem = {
  id: 9,
  dataset: { id: 4, full_name: 'tank/user/app', name: 'app' },
  snapshot: { id: 12, label: 'before-upgrade' },
  host_ip_address: { id: 50, addr: '192.0.2.50' },
  path: '/exports/9',
  all_vps: true,
  rw: true,
  sync: true,
  subtree_check: false,
  root_squash: false,
  threads: 8,
  enabled: true,
};

describe('ExportModel', () => {
  it('parses filter and form primitives defensively', () => {
    expect(parsePositiveInt('42.9')).toBe(42);
    expect(parsePositiveInt('0')).toBeNull();
    expect(parseBoolToken('enabled')).toBe(true);
    expect(parseBoolToken('off')).toBe(false);
    expect(parseBoolToken('maybe')).toBeUndefined();
  });

  it('labels sources, hosts and mount helpers without leaking raw objects', () => {
    expect(resourceLabel({ id: 4, full_name: 'tank/user/app' })).toBe('tank/user/app');
    expect(sourceLabel(exportItem)).toBe('tank/user/app · before-upgrade');
    expect(sourceShortName(exportItem)).toBe('before-upgrade');
    expect(exportAddress(exportItem)).toBe('192.0.2.50');
    expect(hostLabel({ id: 1, ip_address: { id: 2, addr: '198.51.100.2' } })).toBe('198.51.100.2');
    expect(sanitizeMountName('Before Upgrade / 2026!', 9)).toBe('before-upgrade-2026');
    expect(snippetMountCommand('192.0.2.50', '/exports/9', '/mnt/app')).toContain('mount -t nfs 192.0.2.50:/exports/9 /mnt/app');
    expect(snippetFstab('192.0.2.50', '/exports/9', '/mnt/app', false)).toContain('ro,defaults');
    expect(snippetSystemd('192.0.2.50', '/exports/9', '/mnt/app', true)).toContain('Where=/mnt/app');
    expect(snippetNix('192.0.2.50', '/exports/9', '/mnt/app', true)).toContain('fsType = "nfs"');
  });

  it('validates create requests before building HaveAPI payloads', () => {
    const empty = defaultCreateForm(null);
    expect(validateCreateExportForm(empty, true).issues).toEqual(['dataset_required', 'host_required']);

    const snapshotForm = {
      ...empty,
      datasetId: 4,
      sourceType: 'snapshot' as const,
      snapshotId: '12',
      hostIpId: 50,
      allVps: false,
      threads: '16',
    };

    expect(validateCreateExportForm(snapshotForm, true).ok).toBe(true);
    expect(buildCreateExportPayload(snapshotForm, true)).toEqual({
      dataset: undefined,
      snapshot: 12,
      host_ip_address: 50,
      all_vps: false,
      rw: true,
      sync: true,
      subtree_check: false,
      root_squash: false,
      threads: 16,
      enabled: true,
    });
  });

  it('builds edit payloads and review diffs from changed export fields only', () => {
    const form = { ...editFormFromExport(exportItem), rw: false, root_squash: true, threads: '12' };

    expect(buildUpdateExportPayload(form, true)).toEqual({
      all_vps: true,
      rw: false,
      sync: true,
      subtree_check: false,
      root_squash: true,
      threads: 12,
      enabled: true,
    });

    expect(buildExportDiff(exportItem, form, true)).toEqual([
      { field: 'rw', before: true, after: false },
      { field: 'root_squash', before: false, after: true },
      { field: 'threads', before: 8, after: 12 },
    ]);
  });

  it('builds host review diffs and typed delete confirmation targets', () => {
    const host: ExportHost = { id: 6, ip_address: { id: 2 }, rw: true, sync: true, subtree_check: false, root_squash: false };
    expect(buildExportHostDiff(host, { rw: false, sync: true, subtree_check: true, root_squash: false })).toEqual([
      { field: 'rw', before: true, after: false },
      { field: 'subtree_check', before: false, after: true },
    ]);
    expect(exportDeleteConfirmText(exportItem)).toBe('9');
    expect(hostDeleteConfirmText(host)).toBe('6');
  });
});

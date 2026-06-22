import { describe, expect, it } from 'vitest';

import {
  buildCreateMountPayload,
  buildMountDiff,
  buildUpdateMountPayload,
  capacityTone,
  computeCapacityPercent,
  defaultMountDraft,
  mountDeleteConfirmation,
  mountDraftFromMount,
  rootDatasetSummary,
  storageOverviewSummary,
  validateMountDraft,
} from './VpsStorageModel';
import type { VpsMount } from '../../../lib/api/vpsMounts';

describe('VpsStorageModel', () => {
  it('builds legacy-compatible create and update mount payloads', () => {
    const draft = {
      ...defaultMountDraft(),
      dataset: { id: 77, name: 'tank/data' },
      mountpoint: ' /srv/data ',
      type: 'bind' as const,
      mode: 'ro' as const,
      onStartFail: 'fail' as const,
      enabled: false,
      masterEnabled: false,
      useDefaultMap: false,
    };

    expect(buildCreateMountPayload(draft, true)).toEqual({
      dataset: 77,
      mountpoint: '/srv/data',
      type: 'bind',
      mode: 'ro',
      on_start_fail: 'fail',
      enabled: false,
      master_enabled: false,
      use_default_map: false,
    });

    expect(buildUpdateMountPayload(draft, false)).toEqual({
      mountpoint: '/srv/data',
      type: 'bind',
      mode: 'ro',
      on_start_fail: 'fail',
      enabled: false,
      use_default_map: false,
    });
  });

  it('validates dataset and mountpoint footguns before submit', () => {
    expect(validateMountDraft(defaultMountDraft(), { requireDataset: true }).issues).toEqual([
      'dataset_required',
      'mountpoint_required',
    ]);

    expect(
      validateMountDraft({ ...defaultMountDraft(), dataset: { id: 1 }, mountpoint: 'relative/path' }, { requireDataset: true }).issues
    ).toEqual(['mountpoint_absolute']);

    expect(validateMountDraft({ ...defaultMountDraft(), dataset: { id: 1 }, mountpoint: '/' }, { requireDataset: true }).issues).toEqual([
      'mountpoint_root',
    ]);
  });

  it('detects only changed mount fields for edit review', () => {
    const mount: VpsMount = {
      id: 10,
      dataset: { id: 7, name: 'tank/app' },
      mountpoint: '/srv/app',
      type: 'nfs',
      mode: 'rw',
      on_start_fail: 'ignore',
      enabled: true,
      master_enabled: true,
      use_default_map: true,
    };

    const draft = { ...mountDraftFromMount(mount), mode: 'ro' as const, onStartFail: 'umount' as const, masterEnabled: false };

    expect(buildMountDiff(draft, mount, false)).toEqual([
      { field: 'mode', before: 'rw', after: 'ro' },
      { field: 'on_start_fail', before: 'ignore', after: 'umount' },
    ]);

    expect(buildMountDiff(draft, mount, true)).toContainEqual({ field: 'master_enabled', before: true, after: false });
  });

  it('summarizes root dataset capacity without exposing backup creation as a normal action', () => {
    const summary = rootDatasetSummary(
      {
        id: 5,
        name: 'tank/vps/root',
        used: 900,
        avail: 100,
        refquota: 1000,
        quota: 0,
        referenced: 850,
        mount_count: 2,
        snapshots_count: 8,
        export_count: 1,
        object_state: 'active',
      },
      null
    );

    expect(summary).toMatchObject({
      id: 5,
      label: 'tank/vps/root',
      capacityPercent: 90,
      capacityTone: 'warn',
      snapshotCount: 8,
      exportCount: 1,
    });
  });

  it('summarizes mounts and confirmation targets', () => {
    const mounts: VpsMount[] = [
      { id: 1, mountpoint: '/srv/a', mode: 'rw', enabled: true, current_state: 'mounted' },
      { id: 2, mountpoint: '/srv/b', mode: 'ro', enabled: false, current_state: 'failed' },
    ];

    expect(storageOverviewSummary(mounts)).toEqual({
      mountCount: 2,
      enabledMountCount: 1,
      disabledMountCount: 1,
      writableMountCount: 1,
      readOnlyMountCount: 1,
      failedMountCount: 1,
    });
    expect(mountDeleteConfirmation(mounts[0]!)).toBe('/srv/a');
    expect(computeCapacityPercent(50, 50, null)).toBe(50);
    expect(capacityTone(96, 100)).toBe('danger');
  });
});

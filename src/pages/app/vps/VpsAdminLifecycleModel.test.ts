import type { Node } from '../../../lib/api/nodes';
import type { Vps } from '../../../lib/api/vps';
import {
  buildMigrateTargetContext,
  buildVpsBootPayload,
  buildVpsMigratePayload,
  buildVpsReplacePayload,
  buildVpsTemplatePayload,
  defaultBootForm,
  defaultMigrateForm,
  defaultReplaceForm,
  defaultTemplateForm,
  isMigrateReady,
  nextMigrateFormForNodeChange,
} from './VpsAdminLifecycleModel';

const sourceVps: Vps = {
  id: 123,
  hostname: 'prod.example',
  node: {
    id: 1,
    domain_name: 'node1.example',
    location: { id: 2, label: 'Praha', environment: { id: 10, label: 'prod' } },
  },
  os_template: { id: 6, label: 'Debian latest' },
};

const sameLocationNode: Node = {
  id: 2,
  domain_name: 'node2.example',
  location: { id: 2, label: 'Praha', environment: { id: 10, label: 'prod' } },
};

const crossEnvironmentNode: Node = {
  id: 5,
  domain_name: 'node5.example',
  location: { id: 5, label: 'Brno', environment: { id: 20, label: 'staging' } },
};

describe('VPS admin lifecycle model', () => {
  it('builds template metadata payload with legacy field names', () => {
    expect(buildVpsTemplatePayload({ ...defaultTemplateForm(6, false), osTemplate: '#7', autoUpdate: true })).toEqual({
      os_template: 7,
      enable_os_template_auto_update: true,
    });
  });

  it('builds rescue boot payload and omits mountpoint when mounting is disabled', () => {
    expect(buildVpsBootPayload({ ...defaultBootForm(6), osTemplate: '7', mountpoint: ' /mnt/rescue-root ' })).toEqual({
      os_template: 7,
      mount_root_dataset: '/mnt/rescue-root',
    });

    expect(buildVpsBootPayload({ ...defaultBootForm(6), mountRootDataset: false, mountpoint: '/ignored' })).toEqual({
      os_template: 6,
    });
  });

  it('builds replace payload with optional node, expiration, start and reason', () => {
    const expirationInput = '2026-07-01T12:30';

    expect(
      buildVpsReplacePayload({
        ...defaultReplaceForm(1),
        node: '#4',
        expirationDate: expirationInput,
        start: true,
        reason: ' staging replacement ',
      })
    ).toEqual({
      node: 4,
      expiration_date: new Date(expirationInput).toISOString(),
      start: true,
      reason: 'staging replacement',
    });
  });

  it('builds cross-environment migration payload with IP and custom schedule options', () => {
    const context = buildMigrateTargetContext(sourceVps, crossEnvironmentNode);
    const form = {
      ...defaultMigrateForm(),
      node: '#5',
      scheduleMode: 'custom' as const,
      finishWeekday: '2',
      finishHour: '1',
      replaceIpAddresses: true,
      transferIpAddresses: false,
      noStart: true,
      reason: ' rack maintenance ',
      confirm: true,
    };

    expect(context.canReplaceIpAddresses).toBe(true);
    expect(context.canTransferIpAddresses).toBe(true);
    expect(isMigrateReady(form)).toBe(true);
    expect(buildVpsMigratePayload(form, context)).toEqual({
      node: 5,
      replace_ip_addresses: true,
      transfer_ip_addresses: false,
      maintenance_window: false,
      stop_on_error: true,
      cleanup_data: true,
      no_start: true,
      skip_start: false,
      send_mail: true,
      finish_weekday: 2,
      finish_minutes: 60,
      reason: 'rack maintenance',
    });
  });

  it('resets IP flags and scheduling for same-location migrations', () => {
    const context = buildMigrateTargetContext(sourceVps, sameLocationNode);
    const previous = {
      ...defaultMigrateForm(),
      replaceIpAddresses: true,
      transferIpAddresses: true,
      scheduleMode: 'now' as const,
      confirm: true,
    };
    const next = nextMigrateFormForNodeChange(previous, '#2', context);

    expect(context.canReplaceIpAddresses).toBe(false);
    expect(context.canTransferIpAddresses).toBe(false);
    expect(next).toMatchObject({
      node: '#2',
      replaceIpAddresses: false,
      transferIpAddresses: false,
      scheduleMode: 'maintenance',
      confirm: false,
    });
    expect(buildVpsMigratePayload({ ...next, confirm: true }, context)).toMatchObject({
      node: 2,
      replace_ip_addresses: false,
      transfer_ip_addresses: false,
      maintenance_window: true,
    });
  });

});

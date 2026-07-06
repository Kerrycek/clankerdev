import React from 'react';

import { useI18n } from '../../app/i18n';
import type { UserKnownDevice } from '../../lib/api/userDossier';
import { formatDateTime } from '../../lib/time';

import { Button } from '../ui/Button';
import { Table } from '../ui/Table';

import { parseUserAgent, shortenUserAgent } from './UserKnownDevicesModel';

export function UserKnownDevicesList(props: {
  devices: readonly UserKnownDevice[];
  testIdPrefix: string;
  onForget: (deviceId: number) => void;
}) {
  const prefix = props.testIdPrefix;

  return (
    <>
      <div className="space-y-3 md:hidden">
        {props.devices.map((device) => (
          <KnownDeviceMobileCard key={device.id} device={device} testIdPrefix={prefix} onForget={props.onForget} />
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <KnownDevicesTable devices={props.devices} testIdPrefix={prefix} onForget={props.onForget} />
      </div>
    </>
  );
}

function KnownDeviceMobileCard(props: {
  device: UserKnownDevice;
  testIdPrefix: string;
  onForget: (deviceId: number) => void;
}) {
  const { t } = useI18n();
  const device = props.device;
  const ua = parseUserAgent(device.user_agent);

  return (
    <div
      data-testid={`${props.testIdPrefix}.known_devices.row.${device.id}`}
      className="rounded-md border border-border bg-surface-2 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">#{device.id}</div>
          <KnownDeviceTimestampRow label={t('profile.security.known_devices.field.last_seen')} value={device.last_seen_at} />
          <KnownDeviceTextRow label={t('profile.security.known_devices.field.api_ip')} value={device.api_ip_addr} />
          <KnownDeviceTextRow label={t('profile.security.known_devices.field.client_ip')} value={device.client_ip_addr} />
          <div className="mt-2" title={device.user_agent ?? ''}>
            <div className="text-sm font-medium">{ua.browser}</div>
            <div className="text-xs text-faint">{ua.os}</div>
            {device.user_agent ? (
              <div className="mt-1 text-xs text-muted break-words">{shortenUserAgent(device.user_agent)}</div>
            ) : null}
          </div>
          {device.skip_multi_factor_auth_until ? (
            <KnownDeviceTimestampRow
              label={t('profile.security.known_devices.field.skip_mfa_until')}
              value={device.skip_multi_factor_auth_until}
              className="mt-2"
            />
          ) : null}
        </div>
        <div className="shrink-0">
          <ForgetKnownDeviceButton deviceId={device.id} testIdPrefix={props.testIdPrefix} onForget={props.onForget} />
        </div>
      </div>
    </div>
  );
}

function KnownDevicesTable(props: {
  devices: readonly UserKnownDevice[];
  testIdPrefix: string;
  onForget: (deviceId: number) => void;
}) {
  const { t } = useI18n();

  return (
    <Table minWidth="lg" testId={`${props.testIdPrefix}.known_devices.table`}>
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted">
          <th className="px-4 py-2">{t('profile.security.known_devices.field.last_seen')}</th>
          <th className="px-4 py-2">{t('profile.security.known_devices.field.api_ip')}</th>
          <th className="px-4 py-2">{t('profile.security.known_devices.field.client_ip')}</th>
          <th className="px-4 py-2">{t('profile.security.known_devices.field.user_agent')}</th>
          <th className="px-4 py-2">{t('profile.security.known_devices.field.skip_mfa_until')}</th>
          <th className="px-4 py-2 text-right">{t('common.actions')}</th>
        </tr>
      </thead>
      <tbody>
        {props.devices.map((device) => (
          <KnownDeviceTableRow key={device.id} device={device} testIdPrefix={props.testIdPrefix} onForget={props.onForget} />
        ))}
      </tbody>
    </Table>
  );
}

function KnownDeviceTableRow(props: {
  device: UserKnownDevice;
  testIdPrefix: string;
  onForget: (deviceId: number) => void;
}) {
  const device = props.device;
  const ua = parseUserAgent(device.user_agent);

  return (
    <tr
      className="border-b border-border/60 last:border-b-0"
      data-testid={`${props.testIdPrefix}.known_devices.row.${device.id}`}
    >
      <td className="px-4 py-2 text-sm tabular-nums">{device.last_seen_at ? formatDateTime(device.last_seen_at) : '—'}</td>
      <td className="px-4 py-2">
        <KnownDeviceIpBlock address={device.api_ip_addr} ptr={device.api_ip_ptr} />
      </td>
      <td className="px-4 py-2">
        <KnownDeviceIpBlock address={device.client_ip_addr} ptr={device.client_ip_ptr} />
      </td>
      <td className="px-4 py-2">
        <div className="text-sm" title={device.user_agent ?? ''}>
          <div className="font-medium">{ua.browser}</div>
          <div className="text-xs text-faint">{ua.os}</div>
          {device.user_agent ? <div className="mt-1 text-xs text-muted">{shortenUserAgent(device.user_agent)}</div> : null}
        </div>
      </td>
      <td className="px-4 py-2 text-sm tabular-nums">
        {device.skip_multi_factor_auth_until ? formatDateTime(device.skip_multi_factor_auth_until) : '—'}
      </td>
      <td className="px-4 py-2 text-right">
        <ForgetKnownDeviceButton deviceId={device.id} testIdPrefix={props.testIdPrefix} onForget={props.onForget} />
      </td>
    </tr>
  );
}

function KnownDeviceTextRow(props: { label: string; value?: string | null }) {
  return (
    <div className="mt-1 text-xs text-muted">
      {props.label}: {props.value ?? '—'}
    </div>
  );
}

function KnownDeviceTimestampRow(props: { label: string; value?: string | null; className?: string }) {
  const spacing = props.className ?? 'mt-1';

  return (
    <div className={`${spacing} text-xs text-muted`}>
      {props.label}: {props.value ? formatDateTime(props.value) : '—'}
    </div>
  );
}

function KnownDeviceIpBlock(props: { address?: string | null; ptr?: string | null }) {
  return (
    <div className="text-sm">
      <div className="font-medium tabular-nums">{props.address ?? '—'}</div>
      {props.ptr ? <div className="text-xs text-faint">{props.ptr}</div> : null}
    </div>
  );
}

function ForgetKnownDeviceButton(props: {
  deviceId: number;
  testIdPrefix: string;
  onForget: (deviceId: number) => void;
}) {
  const { t } = useI18n();

  return (
    <Button
      variant="danger"
      size="sm"
      onClick={() => props.onForget(props.deviceId)}
      testId={`${props.testIdPrefix}.known_devices.forget.${props.deviceId}`}
    >
      {t('profile.security.known_devices.action.forget')}
    </Button>
  );
}

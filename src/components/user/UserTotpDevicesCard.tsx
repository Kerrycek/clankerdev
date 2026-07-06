import React from 'react';

import { useI18n } from '../../app/i18n';
import type { UserTotpDevice } from '../../lib/api/userDossier';
import { formatErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/time';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Spinner } from '../ui/Spinner';
import { Table } from '../ui/Table';

import { badgeForDevice, deviceLabel } from './UserTotpDevicesModel';

function TotpDeviceActions(props: {
  device: UserTotpDevice;
  prefix: string;
  onConfirm: (device: UserTotpDevice) => void;
  onEdit: (device: UserTotpDevice) => void;
  onDelete: (deviceId: number) => void;
}) {
  const { t } = useI18n();

  return (
    <>
      {!props.device.confirmed ? (
        <Button
          variant="warn"
          size="sm"
          onClick={() => props.onConfirm(props.device)}
          testId={`${props.prefix}.totp.row.${props.device.id}.confirm`}
        >
          {t('profile.mfa.totp.wizard.confirm')}
        </Button>
      ) : null}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => props.onEdit(props.device)}
        testId={`${props.prefix}.totp.row.${props.device.id}.edit`}
      >
        {t('common.edit')}
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={() => props.onDelete(props.device.id)}
        testId={`${props.prefix}.totp.row.${props.device.id}.delete`}
      >
        {t('common.delete')}
      </Button>
    </>
  );
}

function TotpDeviceMobileCard(props: {
  device: UserTotpDevice;
  prefix: string;
  onConfirm: (device: UserTotpDevice) => void;
  onEdit: (device: UserTotpDevice) => void;
  onDelete: (deviceId: number) => void;
}) {
  const { t } = useI18n();
  const b = badgeForDevice(props.device);

  return (
    <div data-testid={`${props.prefix}.totp.row.${props.device.id}`} className="rounded-md border border-border bg-surface-2 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium text-fg">{deviceLabel(props.device)}</div>
          <div className="mt-0.5 text-xs text-faint">#{props.device.id}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={b.variant}>{t(`profile.mfa.totp.badge.${b.label}`)}</Badge>
        </div>
      </div>

      <div className="mt-2 text-xs text-muted">
        <div>
          {t('profile.mfa.totp.field.last_use')}: {props.device.last_use_at ? formatDateTime(props.device.last_use_at) : '—'}
        </div>
        <div>
          {t('profile.mfa.totp.field.use_count')}:{' '}
          {typeof props.device.use_count === 'number' ? String(props.device.use_count) : '—'}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <TotpDeviceActions
          device={props.device}
          prefix={props.prefix}
          onConfirm={props.onConfirm}
          onEdit={props.onEdit}
          onDelete={props.onDelete}
        />
      </div>
    </div>
  );
}

function TotpDeviceDesktopRow(props: {
  device: UserTotpDevice;
  prefix: string;
  onConfirm: (device: UserTotpDevice) => void;
  onEdit: (device: UserTotpDevice) => void;
  onDelete: (deviceId: number) => void;
}) {
  const { t } = useI18n();
  const b = badgeForDevice(props.device);

  return (
    <tr className="border-b border-border/60 last:border-b-0" data-testid={`${props.prefix}.totp.row.${props.device.id}`}>
      <td className="px-4 py-2">
        <div className="font-medium text-fg">{deviceLabel(props.device)}</div>
        <div className="text-xs text-faint">#{props.device.id}</div>
      </td>
      <td className="px-4 py-2">
        <Badge variant={b.variant}>{t(`profile.mfa.totp.badge.${b.label}`)}</Badge>
      </td>
      <td className="px-4 py-2 text-xs text-muted tabular-nums">
        {props.device.last_use_at ? formatDateTime(props.device.last_use_at) : '—'}
      </td>
      <td className="px-4 py-2 text-xs text-muted tabular-nums">
        {typeof props.device.use_count === 'number' ? String(props.device.use_count) : '—'}
      </td>
      <td className="px-4 py-2 text-xs text-muted tabular-nums">
        {props.device.created_at ? formatDateTime(props.device.created_at) : '—'}
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex justify-end gap-2">
          <TotpDeviceActions
            device={props.device}
            prefix={props.prefix}
            onConfirm={props.onConfirm}
            onEdit={props.onEdit}
            onDelete={props.onDelete}
          />
        </div>
      </td>
    </tr>
  );
}

export function UserTotpDevicesCard(props: {
  prefix: string;
  allowCreate: boolean;
  devices: UserTotpDevice[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onCreate: () => void;
  onConfirm: (device: UserTotpDevice) => void;
  onEdit: (device: UserTotpDevice) => void;
  onDelete: (deviceId: number) => void;
}) {
  const { t } = useI18n();

  return (
    <Card testId={`${props.prefix}.totp.card`}>
      <CardHeader
        title={t('profile.mfa.totp.title')}
        subtitle={props.allowCreate ? t('profile.mfa.totp.subtitle') : t('profile.mfa.totp.subtitle_admin')}
        actions={
          props.allowCreate ? (
            <Button onClick={props.onCreate} testId={`${props.prefix}.totp.add`}>
              {t('profile.mfa.totp.add')}
            </Button>
          ) : null
        }
      />

      <CardBody>
        {props.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : props.isError ? (
          <Alert variant="danger" title={t('profile.mfa.totp.load_failed')}>
            {formatErrorMessage(props.error)}
          </Alert>
        ) : props.devices.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted" data-testid={`${props.prefix}.totp.empty`}>
            {t('profile.mfa.totp.empty')}
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {props.devices.map((d) => (
                <TotpDeviceMobileCard
                  key={d.id}
                  device={d}
                  prefix={props.prefix}
                  onConfirm={props.onConfirm}
                  onEdit={props.onEdit}
                  onDelete={props.onDelete}
                />
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <Table minWidth="md" testId={`${props.prefix}.totp.table`}>
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-4 py-2">{t('profile.mfa.totp.table.label')}</th>
                    <th className="px-4 py-2">{t('profile.mfa.totp.table.status')}</th>
                    <th className="px-4 py-2">{t('profile.mfa.totp.table.last_use')}</th>
                    <th className="px-4 py-2">{t('profile.mfa.totp.table.use_count')}</th>
                    <th className="px-4 py-2">{t('profile.mfa.totp.table.created')}</th>
                    <th className="px-4 py-2 text-right">{t('profile.mfa.totp.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {props.devices.map((d) => (
                    <TotpDeviceDesktopRow
                      key={d.id}
                      device={d}
                      prefix={props.prefix}
                      onConfirm={props.onConfirm}
                      onEdit={props.onEdit}
                      onDelete={props.onDelete}
                    />
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

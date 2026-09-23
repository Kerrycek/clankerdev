import React from 'react';

import { useI18n } from '../../../app/i18n';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { CopyButton } from '../../../components/ui/CopyButton';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import type { DnsServerZone } from '../../../lib/api/dns';
import { formatDateTime } from '../../../lib/format';

export function dnsZoneServerName(row: DnsServerZone): string {
  const server = row.dns_server;
  return String(server?.name ?? (typeof server?.id === 'number' ? `#${server.id}` : '—'));
}

function zoneTypeLabel(value: unknown, t: (key: string) => string): string {
  const type = String(value ?? '');
  if (type === 'primary_type' || type === 'primary') return t('dns.zone.servers.type.primary');
  if (type === 'secondary_type' || type === 'secondary') return t('dns.zone.servers.type.secondary');
  return type || t('common.na');
}

function dateTimeLabel(value: string | null | undefined, notAvailable: string): string {
  return value ? formatDateTime(value) : notAvailable;
}

function serverAddress(row: DnsServerZone, field: 'ipv4_addr' | 'ipv6_addr'): string | null {
  const server = row.dns_server;
  if (!server || !(field in server)) return null;

  const value = server[field];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function ServerAddresses(props: { row: DnsServerZone; testIdPrefix: string }) {
  const { t } = useI18n();

  return (
    <>
      {(['ipv4_addr', 'ipv6_addr'] as const).map((field) => {
        const address = serverAddress(props.row, field);
        if (!address) return null;

        const version = field === 'ipv4_addr' ? 'ipv4' : 'ipv6';
        return (
          <div
            key={field}
            className="mt-1 flex min-w-0 items-center gap-2 text-xs"
            data-testid={`${props.testIdPrefix}.${version}`}
          >
            <span className="shrink-0 text-muted">{t(`common.${version}`)}</span>
            <code className="min-w-0 break-all text-fg">{address}</code>
            <CopyButton
              className="shrink-0"
              text={address}
              label={t('dns.zone.servers.copy_address', { version: t(`common.${version}`) })}
              iconOnly
              testId={`${props.testIdPrefix}.${version}.copy`}
            />
          </div>
        );
      })}
    </>
  );
}

export function DnsZoneServersList(props: {
  rows: readonly DnsServerZone[];
  isAdmin: boolean;
  page: number;
  pageCount: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDelete: (row: DnsServerZone) => void;
}) {
  const { t } = useI18n();

  const paginationProps = {
    page: props.page,
    pageCount: props.pageCount,
    canPrev: props.canPrev,
    canNext: props.canNext,
    onPrev: props.onPrev,
    onNext: props.onNext,
  };

  return (
    <>
      <div className="space-y-3 md:hidden" data-testid="dns.servers.cards">
        {props.rows.map((row) => {
          const name = dnsZoneServerName(row);
          return (
            <Card key={row.id} testId={`dns.servers.card.${row.id}`}>
              <div className="min-w-0 p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-all text-base font-semibold text-fg">{name}</div>
                    <div className="mt-1 text-xs text-faint">#{row.id}</div>
                    <ServerAddresses row={row} testIdPrefix={`dns.servers.card.${row.id}`} />
                  </div>
                  <Badge variant="neutral" className="shrink-0">
                    {zoneTypeLabel(row.type, t)}
                  </Badge>
                </div>

                <dl className="mt-4 grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-xs text-faint">{t('dns.zone.servers.table.serial')}</dt>
                    <dd className="mt-1 break-all text-fg">
                      {typeof row.serial === 'number' ? row.serial : t('common.na')}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-faint">{t('dns.zone.servers.table.loaded')}</dt>
                    <dd className="mt-1 break-words text-fg">
                      {dateTimeLabel(row.loaded_at, t('common.na'))}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-faint">{t('dns.zone.servers.table.refresh')}</dt>
                    <dd className="mt-1 break-words text-fg">
                      {dateTimeLabel(row.refresh_at, t('common.na'))}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-faint">{t('dns.zone.servers.table.expires')}</dt>
                    <dd className="mt-1 break-words text-fg">
                      {dateTimeLabel(row.expires_at, t('common.na'))}
                    </dd>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-xs text-faint">{t('dns.zone.servers.table.last_check')}</dt>
                    <dd className="mt-1 break-words text-fg">
                      {dateTimeLabel(row.last_check_at, t('common.na'))}
                    </dd>
                  </div>
                </dl>

                {props.isAdmin ? (
                  <ActionButton
                    variant="danger"
                    size="lg"
                    className="mt-4 w-full"
                    onClick={() => props.onDelete(row)}
                    ariaLabel={t('dns.zone.servers.delete.description', { server: name })}
                    testId={`dns.servers.card.${row.id}.delete`}
                  >
                    {t('common.delete')}
                  </ActionButton>
                ) : null}
              </div>
            </Card>
          );
        })}

        <Card className="overflow-hidden">
          <KeysetPagination {...paginationProps} testId="dns.servers.pagination.mobile" />
        </Card>
      </div>

      <Card className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-list" data-testid="dns.servers.table">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-faint">
                <th className="py-2 pl-4 pr-3">{t('dns.zone.servers.table.server')}</th>
                <th className="py-2 pr-3">{t('dns.zone.servers.table.type')}</th>
                <th className="py-2 pr-3">{t('dns.zone.servers.table.serial')}</th>
                <th className="py-2 pr-3">{t('dns.zone.servers.table.loaded')}</th>
                <th className="py-2 pr-3">{t('dns.zone.servers.table.refresh')}</th>
                <th className="py-2 pr-3">{t('dns.zone.servers.table.expires')}</th>
                <th className="py-2 pr-3">{t('dns.zone.servers.table.last_check')}</th>
                {props.isAdmin ? <th className="py-2 pr-4">{t('common.actions')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row) => (
                <tr key={row.id} className="border-t border-border" data-testid={`dns.servers.row.${row.id}`}>
                  <td className="py-2 pl-4 pr-3 text-fg">
                    <div className="font-medium">{dnsZoneServerName(row)}</div>
                    <ServerAddresses row={row} testIdPrefix={`dns.servers.row.${row.id}`} />
                  </td>
                  <td className="py-2 pr-3"><Badge variant="neutral">{zoneTypeLabel(row.type, t)}</Badge></td>
                  <td className="py-2 pr-3">{typeof row.serial === 'number' ? row.serial : t('common.na')}</td>
                  <td className="py-2 pr-3">{dateTimeLabel(row.loaded_at, t('common.na'))}</td>
                  <td className="py-2 pr-3">{dateTimeLabel(row.refresh_at, t('common.na'))}</td>
                  <td className="py-2 pr-3">{dateTimeLabel(row.expires_at, t('common.na'))}</td>
                  <td className="py-2 pr-3">{dateTimeLabel(row.last_check_at, t('common.na'))}</td>
                  {props.isAdmin ? (
                    <td className="py-2 pr-4 text-right">
                      <ActionButton
                        variant="danger"
                        size="sm"
                        onClick={() => props.onDelete(row)}
                        testId={`dns.servers.row.${row.id}.delete`}
                      >
                        {t('common.delete')}
                      </ActionButton>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <KeysetPagination {...paginationProps} testId="dns.servers.pagination.desktop" />
      </Card>
    </>
  );
}

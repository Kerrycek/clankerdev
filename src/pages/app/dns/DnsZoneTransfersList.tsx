import React from 'react';

import { useI18n } from '../../../app/i18n';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { CopyButton } from '../../../components/ui/CopyButton';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import type { DnsZoneTransfer } from '../../../lib/api/dns';
import { formatDateTime } from '../../../lib/format';

export function dnsZoneTransferPeerLabel(transfer: DnsZoneTransfer): string {
  const host = transfer.host_ip_address;
  if (!host) return `#${transfer.id}`;
  const ip = 'ip_address' in host ? host.ip_address : undefined;
  const ipAddress = ip && typeof ip === 'object' && 'ip_addr' in ip ? ip.ip_addr : undefined;
  const address = 'addr' in host ? host.addr : undefined;
  return String(ipAddress ?? address ?? `#${host.id ?? transfer.id}`);
}

function peerTypeLabel(t: (key: string) => string, value: unknown): string {
  const type = String(value ?? '');
  if (type === 'primary_type' || type === 'primary') return t('dns.zone.transfers.peer_type.primary');
  if (type === 'secondary_type' || type === 'secondary') return t('dns.zone.transfers.peer_type.secondary');
  return type || t('common.na');
}

function transferSnippet(transfer: DnsZoneTransfer): string {
  const host = dnsZoneTransferPeerLabel(transfer);
  const keyName = transfer.dns_tsig_key?.name ?? '';
  return [
    `server ${host} {`,
    keyName ? `  keys { ${keyName}; };` : '  # no TSIG key configured',
    '};',
  ].join('\n');
}

export function DnsZoneTransfersList(props: {
  transfers: readonly DnsZoneTransfer[];
  page: number;
  pageCount: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDelete: (transfer: DnsZoneTransfer) => void;
}) {
  const { t } = useI18n();

  return (
    <>
      <div className="space-y-3 md:hidden" data-testid="dns.transfers.cards">
        {props.transfers.map((transfer) => {
          const peer = dnsZoneTransferPeerLabel(transfer);
          const snippet = transferSnippet(transfer);
          return (
            <Card key={transfer.id} testId={`dns.transfers.card.${transfer.id}`}>
              <div className="p-4">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-all text-base font-semibold text-fg">{peer}</div>
                    <div className="mt-1 text-xs text-faint">#{transfer.id}</div>
                  </div>
                  <Badge variant="neutral">{peerTypeLabel(t, transfer.peer_type)}</Badge>
                </div>

                <dl className="mt-3 grid min-w-0 grid-cols-1 gap-3 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs text-faint">{t('dns.zone.transfers.table.tsig')}</dt>
                    <dd className="mt-1 break-all text-fg">
                      {transfer.dns_tsig_key?.name ? (
                        <Badge variant="ok">{transfer.dns_tsig_key.name}</Badge>
                      ) : (
                        <Badge variant="neutral">{t('common.none')}</Badge>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-faint">{t('common.created')}</dt>
                    <dd className="mt-1 text-fg">
                      {transfer.created_at ? formatDateTime(String(transfer.created_at)) : t('common.na')}
                    </dd>
                  </div>
                </dl>

                <details className="mt-3 min-w-0 rounded-md border border-border bg-surface-2 p-3">
                  <summary className="cursor-pointer text-sm text-muted">
                    {t('dns.zone.transfers.table.show_config')}
                  </summary>
                  <pre
                    className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-all text-xs text-muted"
                    data-testid={`dns.transfers.card.${transfer.id}.config`}
                  >
                    {snippet}
                  </pre>
                  <div className="mt-2">
                    <CopyButton text={snippet} testId={`dns.transfers.card.${transfer.id}.copy`} />
                  </div>
                </details>

                <ActionButton
                  variant="danger"
                  size="lg"
                  className="mt-3 w-full"
                  onClick={() => props.onDelete(transfer)}
                  ariaLabel={t('dns.zone.transfers.delete.description', { peer })}
                  testId={`dns.transfers.card.${transfer.id}.delete`}
                >
                  {t('common.delete')}
                </ActionButton>
              </div>
            </Card>
          );
        })}

        <Card>
          <KeysetPagination
            page={props.page}
            pageCount={props.pageCount}
            canPrev={props.canPrev}
            canNext={props.canNext}
            onPrev={props.onPrev}
            onNext={props.onNext}
            testId="dns.transfers.pagination.mobile"
          />
        </Card>
      </div>

      <Card className="hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-list" data-testid="dns.transfers.table">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-faint">
                <th className="py-2 pl-4 pr-3">{t('dns.zone.transfers.table.peer')}</th>
                <th className="py-2 pr-3">{t('dns.zone.transfers.table.type')}</th>
                <th className="py-2 pr-3">{t('dns.zone.transfers.table.tsig')}</th>
                <th className="py-2 pr-3">{t('common.created')}</th>
                <th className="py-2 pr-3">{t('dns.zone.transfers.table.config')}</th>
                <th className="py-2 pr-4">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {props.transfers.map((transfer) => {
                const snippet = transferSnippet(transfer);
                return (
                  <tr key={transfer.id} className="border-t border-border" data-testid={`dns.transfers.row.${transfer.id}`}>
                    <td className="py-2 pl-4 pr-3 font-medium text-fg">{dnsZoneTransferPeerLabel(transfer)}</td>
                    <td className="py-2 pr-3"><Badge variant="neutral">{peerTypeLabel(t, transfer.peer_type)}</Badge></td>
                    <td className="py-2 pr-3">{transfer.dns_tsig_key?.name ? <Badge variant="ok">{transfer.dns_tsig_key.name}</Badge> : <Badge variant="neutral">{t('common.none')}</Badge>}</td>
                    <td className="py-2 pr-3">{transfer.created_at ? formatDateTime(String(transfer.created_at)) : t('common.na')}</td>
                    <td className="py-2 pr-3">
                      <details>
                        <summary className="cursor-pointer text-sm text-muted">{t('dns.zone.transfers.table.show_config')}</summary>
                        <pre className="mt-2 max-w-content-lg overflow-x-auto whitespace-pre-wrap text-xs text-muted">{snippet}</pre>
                        <div className="mt-2"><CopyButton text={snippet} /></div>
                      </details>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <ActionButton
                        variant="danger"
                        size="sm"
                        onClick={() => props.onDelete(transfer)}
                        testId={`dns.transfers.row.${transfer.id}.delete`}
                      >
                        {t('common.delete')}
                      </ActionButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <KeysetPagination
          page={props.page}
          pageCount={props.pageCount}
          canPrev={props.canPrev}
          canNext={props.canNext}
          onPrev={props.onPrev}
          onNext={props.onNext}
          testId="dns.transfers.pagination.desktop"
        />
      </Card>
    </>
  );
}

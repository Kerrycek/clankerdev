import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { useI18n } from '../../../app/i18n';
import { Card } from '../../../components/ui/Card';
import { CopyButton } from '../../../components/ui/CopyButton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Badge } from '../../../components/ui/Badge';
import { fetchDnssecRecords, type DnssecRecord } from '../../../lib/api/dns';
import { formatDateTime } from '../../../lib/format';

import { useDnsZoneContext } from './DnsZoneContext';

function dnskeyLine(zoneName: string, rec: DnssecRecord): string {
  return `${zoneName}. IN DNSKEY 257 3 ${String(rec.dnskey_algorithm ?? '')} ${String(rec.dnskey_pubkey ?? '')}`.trim();
}

function dsLine(zoneName: string, rec: DnssecRecord): string {
  return `${zoneName}. IN DS ${String(rec.keyid ?? '')} ${String(rec.ds_algorithm ?? '')} ${String(rec.ds_digest_type ?? '')} ${String(rec.ds_digest ?? '')}`.trim();
}

export function DnsZoneDnssecPage() {
  const { t } = useI18n();
  const { zone } = useDnsZoneContext();

  const listQ = useQuery({
    queryKey: ['dnssec_records', zone.id],
    queryFn: async () => (await fetchDnssecRecords({ dns_zone: zone.id, limit: 200 })).data,
  });

  if (listQ.isLoading) return <LoadingState testId="dns.dnssec.loading" label={t('dns.zone.dnssec.loading')} />;
  if (listQ.isError) return <ErrorState testId="dns.dnssec.error" title={t('dns.zone.dnssec.load_failed')} error={listQ.error} onRetry={() => void listQ.refetch()} showBack={false} />;

  const records = listQ.data ?? [];
  const zoneName = String(zone.name ?? zone.label ?? `zone-${zone.id}`);

  return (
    <div className="space-y-6" data-testid="dns.dnssec.page">
      <div>
        <h2 className="text-xl font-semibold text-fg">{t('dns.zone.dnssec.title')}</h2>
        <p className="mt-1 text-sm text-muted">{t('dns.zone.dnssec.description')}</p>
      </div>

      {records.length === 0 ? (
        <EmptyState testId="dns.dnssec.empty" title={t('dns.zone.dnssec.empty')} body={t('dns.zone.dnssec.empty_body')} />
      ) : (
        <div className="space-y-4">
          {records.map((rec) => {
            const keyLine = dnskeyLine(zoneName, rec);
            const digestLine = dsLine(zoneName, rec);
            return (
              <Card key={rec.id} testId={`dns.dnssec.card.${rec.id}`}>
                <div className="p-4 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="ok">DNSSEC</Badge>
                    <Badge variant="neutral">key {String(rec.keyid ?? rec.id)}</Badge>
                    <div className="text-xs text-faint">{rec.created_at ? formatDateTime(String(rec.created_at)) : t('common.na')}</div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-fg">{t('dns.zone.dnssec.dnskey')}</div>
                      <pre className="max-w-content-lg overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-surface-2 p-3 text-xs text-muted">{keyLine}</pre>
                      <CopyButton text={keyLine} />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-fg">{t('dns.zone.dnssec.ds')}</div>
                      <pre className="max-w-content-lg overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-surface-2 p-3 text-xs text-muted">{digestLine}</pre>
                      <CopyButton text={digestLine} />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

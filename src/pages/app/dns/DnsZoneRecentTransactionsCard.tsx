import React from 'react';
import { Link } from 'react-router-dom';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { formatDateTime } from '../../../lib/format';
import {
  chainBadgeFromState,
  chainProgressLabel,
  chainProgressPercent,
  isFailedChainState,
} from '../../../lib/taskStatus';

import { Card } from '../../../components/ui/Card';
import { ChipLink } from '../../../components/ui/ChipLink';
import { Badge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';

import { useDnsZoneContext } from './DnsZoneContext';

export function DnsZoneRecentTransactionsCard() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const { zone, chains, chainsLoading, chainsError, concernClasses } = useDnsZoneContext();

  const viewLogsHref = `${basePath}/dns/zones/${zone.id}/logs`;
  const firstConcernClass = concernClasses[0];

  const viewChainsHref =
    firstConcernClass
      ? `${basePath}/transactions?class_name=${encodeURIComponent(firstConcernClass)}&row_id=${zone.id}`
      : null;

  const content = () => {
    if (chainsLoading) {
      return (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted">
          <Spinner /> {t('common.loading')}
        </div>
      );
    }

    if (chainsError) {
      return <div className="mt-4 text-sm text-muted">{t('dns.zone.recent.load_failed')}</div>;
    }

    if (chains.length === 0) {
      return <div className="mt-4 text-sm text-muted">{t('dns.zone.recent.empty')}</div>;
    }

    return (
      <ul className="mt-4 divide-y divide-border">
        {chains.map((c) => {
          const b = chainBadgeFromState(c.state);
          const label = c.label ? String(c.label) : `#${c.id}`;
          const isError = isFailedChainState(c.state);
          const pct = chainProgressPercent(c);
          const prog = chainProgressLabel(c);
          const progText = pct !== null && prog ? `${prog} (${pct}%)` : pct !== null ? `${pct}%` : prog;

          return (
            <li
              key={c.id}
              className={
                'flex flex-wrap items-center justify-between gap-3 py-3 ' +
                (isError ? 'bg-danger-row px-2 -mx-2 rounded-md' : '')
              }
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  <Link className="text-accent hover:underline" to={`${basePath}/transactions/${c.id}`}>
                    {label}
                  </Link>
                </div>
                <div className="mt-1 text-xs text-muted">
                  #{c.id} · {formatDateTime(c.created_at)}
                  {progText ? <> · {progText}</> : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ChipLink
                  to={`${basePath}/transactions/items?transaction_chain=${c.id}`}
                  title={t('dns.zone.recent.action.tx_items_title', { id: c.id })}
                >
                  {t('dns.zone.recent.action.tx_items')}
                </ChipLink>
                <Badge variant={b.variant}>{b.label}</Badge>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{t('dns.zone.recent.title')}</div>
            <div className="mt-1 text-xs text-faint">{t('dns.zone.recent.description')}</div>
          </div>
          <div className="flex items-center gap-2">
            {viewChainsHref ? (
              <ChipLink
                to={viewChainsHref}
                title={
                  concernClasses.length === 1 && firstConcernClass
                    ? t('dns.zone.recent.action.chains_title', { class: firstConcernClass })
                    : t('dns.zone.recent.action.chains_title_best_effort', { class: firstConcernClass ?? '' })
                }
              >
                {t('dns.zone.recent.action.chains')}
              </ChipLink>
            ) : null}
            {viewLogsHref ? (
              <ChipLink to={viewLogsHref} title={t('dns.zone.recent.action.logs_title')}>
                {t('dns.zone.recent.action.logs')}
              </ChipLink>
            ) : null}
          </div>
        </div>

        {content()}
      </div>
    </Card>
  );
}

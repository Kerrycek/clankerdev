import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';

import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { ChipLink } from '../../../components/ui/ChipLink';
import { Spinner } from '../../../components/ui/Spinner';
import { StackedBar } from '../../../components/ui/StackedBar';

import { type TransactionChain } from '../../../lib/api/transactions';
import { formatDateTime, formatMiB } from '../../../lib/format';
import { usageSeverityFromRatio } from '../../../lib/usage';
import { objectStateBadge } from '../../../lib/taskStatus';

import { useDatasetContext } from './DatasetContext';

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function positive(v: unknown): number | undefined {
  const n = asNumber(v);
  return n !== undefined && n > 0 ? n : undefined;
}

function datasetLabel(ds: any): string {
  return String(ds?.full_name ?? ds?.name ?? ds?.label ?? `#${ds?.id ?? '?'}`);
}

function chainBadgeFromState(
  state: string | null | undefined,
  t: (k: any) => string
): { label: string; variant: React.ComponentProps<typeof Badge>['variant'] } {
  const st = String(state ?? '').trim();
  const norm = st.toLowerCase();
  if (norm === 'done' || norm === 'completed' || norm === 'resolved') return { label: t('state.done'), variant: 'ok' };
  if (norm === 'running') return { label: t('state.running'), variant: 'warn' };
  if (norm === 'failed' || norm === 'fatal') return { label: t('state.failed'), variant: 'danger' };
  if (norm === 'canceled' || norm === 'cancelled') return { label: t('state.canceled'), variant: 'neutral' };

  // Anything else that is not a finished state is treated as “working”.
  if (st) return { label: st, variant: 'warn' };
  return { label: t('state.unknown'), variant: 'neutral' };
}

function isFailedChainState(state: string | null | undefined): boolean {
  const st = String(state ?? '').trim().toLowerCase();
  return st === 'failed' || st === 'fatal';
}

function chainProgressLabel(c: TransactionChain, t: (k: any, vars?: any) => string): string | null {
  const prog = asNumber((c as any).progress);
  if (prog === undefined) return null;

  // Some backends report percent as 0..1, some as 0..100.
  const pct = prog <= 1 ? Math.round(prog * 100) : Math.round(prog);
  const clamped = Math.max(0, Math.min(100, pct));
  return t('common.progress_percent', { percent: clamped });
}

function SpaceCard(props: { dataset: any }) {
  const { t } = useI18n();

  const used = Math.max(0, asNumber(props.dataset.used) ?? 0);
  const avail = Math.max(0, asNumber(props.dataset.avail) ?? 0);

  const refquota = positive(props.dataset.refquota);
  const quota = positive(props.dataset.quota);
  const referenced = asNumber(props.dataset.referenced);

  const total = used + avail;
  const usageRatio = total > 0 ? used / total : 0;
  const usageVariant = usageSeverityFromRatio(usageRatio);

  const pctQuota = refquota ? Math.round((used / refquota) * 100) : null;
  const pctQuotaClamped = pctQuota !== null ? Math.max(0, Math.min(999, pctQuota)) : null;
  const pctVariant = pctQuotaClamped !== null ? usageSeverityFromRatio(pctQuotaClamped / 100) : undefined;

  const segs = useMemo(() => {
    if (total <= 0) return [{ value: 1, variant: 'neutral' as const, title: t('datasets.usage.no_data') }];
    return [
      { value: used, variant: usageVariant, title: t('datasets.usage.used_mib', { mib: used.toFixed(0) }) },
      {
        value: avail,
        variant: 'neutral' as const,
        title: t('datasets.usage.free_mib', { mib: avail.toFixed(0) }),
      },
    ];
  }, [avail, t, total, usageVariant, used]);


  return (
    <Card testId="dataset.overview.space">
      <CardHeader
        title={t('dataset.overview.space.title')}
        subtitle={t('dataset.overview.space.subtitle')}
        actions={
          pctQuotaClamped !== null ? (
            <Badge variant={pctVariant as any} title={t('dataset.overview.space.badge.title')}>
              {pctQuotaClamped}%
            </Badge>
          ) : (
            <Badge variant="neutral" title={t('dataset.overview.space.badge.infinity_title')}>
              ∞
            </Badge>
          )
        }
      />

      <CardBody>
        <StackedBar ariaLabel={t('datasets.usage.aria_label')} segments={segs} />

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-faint">{t('dataset.field.used')}</div>
            <div className="font-medium text-fg">{formatMiB(used)}</div>
          </div>
          <div>
            <div className="text-xs text-faint">{t('dataset.field.available')}</div>
            <div className="font-medium text-fg">{formatMiB(avail)}</div>
          </div>

          <div>
            <div className="text-xs text-faint">{t('dataset.field.reference_quota')}</div>
            <div className="font-medium text-fg">{refquota !== undefined ? formatMiB(refquota) : '∞'}</div>
          </div>

          <>
              <div>
                <div className="text-xs text-faint">{t('dataset.field.quota')}</div>
                <div className="font-medium text-fg">{quota !== undefined ? formatMiB(quota) : t('common.na')}</div>
              </div>
              <div>
                <div className="text-xs text-faint">{t('dataset.field.referenced')}</div>
                <div className="font-medium text-fg">
                  {referenced !== undefined ? formatMiB(referenced) : t('common.na')}
                </div>
              </div>
            </>
        </div>
      </CardBody>
    </Card>
  );
}

function CountsCard(props: { dataset: any }) {
  const { t } = useI18n();
  const ds = props.dataset;

  return (
    <Card testId="dataset.overview.counts">
      <CardHeader title={t('dataset.overview.counts.title')} />
      <CardBody>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-faint">{t('dataset.field.children')}</div>
            <div className="font-medium text-fg">{(ds as any).children_count ?? t('common.na')}</div>
          </div>
          <div>
            <div className="text-xs text-faint">{t('dataset.field.snapshots')}</div>
            <div className="font-medium text-fg">{(ds as any).snapshots_count ?? t('common.na')}</div>
          </div>
          <div>
            <div className="text-xs text-faint">{t('dataset.field.mounts')}</div>
            <div className="font-medium text-fg">{(ds as any).mount_count ?? t('common.na')}</div>
          </div>
          <div>
            <div className="text-xs text-faint">{t('dataset.field.exports')}</div>
            <div className="font-medium text-fg">{(ds as any).export_count ?? t('common.na')}</div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function DetailsCard(props: { dataset: any }) {
  const { t } = useI18n();

  const ds = props.dataset;

  const stateBadge = objectStateBadge((ds as any).object_state, t);
  const pool = (ds as any).pool ? String((ds as any).pool) : null;
  const type = (ds as any).type ? String((ds as any).type) : null;

  const created = (ds as any).created_at ? formatDateTime((ds as any).created_at) : null;
  const updated = (ds as any).updated_at ? formatDateTime((ds as any).updated_at) : null;

  return (
    <Card testId="dataset.overview.details">
      <CardHeader title={t('common.details')} />
      <CardBody>
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs text-faint">{t('dataset.field.full_name')}</div>
            <div className="break-words font-medium text-fg">{datasetLabel(ds)}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-faint">{t('common.state')}</div>
              <div className="mt-0.5">
                <Badge variant={stateBadge.variant}>{stateBadge.label}</Badge>
              </div>
            </div>

            {created ? (
              <div>
                <div className="text-xs text-faint">{t('common.created')}</div>
                <div className="font-medium text-fg">{created}</div>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-faint">{t('dataset.field.pool')}</div>
              <div className="font-medium text-fg">{pool ?? t('common.na')}</div>
            </div>
            <div>
              <div className="text-xs text-faint">{t('dataset.field.type')}</div>
              <div className="font-medium text-fg">{type ?? t('common.na')}</div>
            </div>
            {updated ? (
              <div>
                <div className="text-xs text-faint">{t('common.updated')}</div>
                <div className="font-medium text-fg">{updated}</div>
              </div>
            ) : null}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function QuickActionsCard(props: { dataset: any }) {
  const { t } = useI18n();
  const { basePath } = useAppMode();

  const ds = props.dataset;

  const vpsId =
    ds.vps && typeof ds.vps === 'object' && 'id' in ds.vps ? Number((ds.vps as any).id) : undefined;
  const vpsHostname = ds.vps && typeof ds.vps === 'object' ? String((ds.vps as any).hostname ?? '') : '';

  return (
    <Card testId="dataset.overview.actions">
      <CardHeader title={t('dataset.overview.actions.title')} subtitle={t('dataset.overview.actions.subtitle')} />
      <CardBody>
        <div className="flex flex-wrap gap-2">
          <ChipLink to={`${basePath}/datasets/${ds.id}/snapshots`}>
            {t('dataset.overview.actions.snapshots')}
          </ChipLink>
          <ChipLink to={`${basePath}/datasets/${ds.id}/downloads`}>
            {t('dataset.overview.actions.downloads')}
          </ChipLink>

          {vpsId ? (
            <ChipLink to={`${basePath}/vps/${vpsId}`} title={t('dataset.overview.actions.open_vps.title')}>
              {t('dataset.overview.actions.open_vps.label', { vps: vpsHostname ? vpsHostname : `#${vpsId}` })}
            </ChipLink>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

function TipsCard() {
  const { t } = useI18n();
  return (
    <Card testId="dataset.overview.tips">
      <CardHeader title={t('dataset.overview.tips.title')} />
      <CardBody>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>{t('dataset.overview.tips.item1')}</li>
          <li>{t('dataset.overview.tips.item2')}</li>
          <li>{t('dataset.overview.tips.item3')}</li>
        </ul>
      </CardBody>
    </Card>
  );
}

function TransactionsCard(props: {
  chainsLoading: boolean;
  chainsError: unknown | null;
  chains: TransactionChain[];
}) {
  const { t } = useI18n();
  const { basePath } = useAppMode();

  const sorted = useMemo(() => {
    const list = [...(props.chains ?? [])];
    list.sort((a, b) => Number(b.id) - Number(a.id));
    return list;
  }, [props.chains]);

  return (
    <Card testId="dataset.overview.transactions">
      <CardHeader
        title={t('dataset.overview.transactions.title')}
        subtitle={t('dataset.overview.transactions.subtitle')}
        actions={
          <ChipLink to={`${basePath}/transactions`} title={t('dataset.overview.transactions.open_chains_title')}>
            {t('dataset.overview.transactions.open_chains')}
          </ChipLink>
        }
      />
      <CardBody>
        {props.chainsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> {t('common.loading')}
          </div>
        ) : props.chainsError ? (
          <Alert title={t('dataset.overview.transactions.load_error.title')} variant="danger">
            {t('dataset.overview.transactions.load_error.body')}
          </Alert>
        ) : sorted.length === 0 ? (
          <div className="text-sm text-muted">{t('dataset.overview.transactions.empty')}</div>
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((c) => {
              const b = chainBadgeFromState(c.state, t);
              const label = c.label ? String(c.label) : `#${c.id}`;
              const isError = isFailedChainState(c.state);
              const prog = chainProgressLabel(c, t);
              return (
                <li
                  key={c.id}
                  className={
                    'flex flex-wrap items-center justify-between gap-3 py-3 ' +
                    (isError ? 'rounded-md bg-danger-bg px-2 -mx-2' : '')
                  }
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-fg">
                      <Link className="text-accent hover:underline" to={`${basePath}/transactions/${c.id}`}>
                        {label}
                      </Link>
                    </div>
                    <div className="mt-1 text-xs text-faint">
                      #{c.id} · {formatDateTime((c as any).created_at)}
                      {prog ? <> · {prog}</> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChipLink
                      to={`${basePath}/transactions/items?transaction_chain=${c.id}`}
                      title={t('dataset.overview.transactions.open_items_title', { id: c.id })}
                    >
                      {t('dataset.overview.transactions.open_items')}
                    </ChipLink>
                    <Badge variant={b.variant}>{b.label}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export function DatasetOverviewPage() {
  const { dataset, chains, chainsLoading, chainsError } = useDatasetContext();

  return (
    <div className="space-y-6" data-testid="dataset.overview">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <SpaceCard dataset={dataset as any} />
          <CountsCard dataset={dataset as any} />
          <QuickActionsCard dataset={dataset as any} />
        </div>
        <div className="space-y-6">
          <DetailsCard dataset={dataset as any} />
          <TipsCard />
        </div>
      </div>

      <TransactionsCard chains={chains} chainsLoading={chainsLoading} chainsError={chainsError} />
    </div>
  );
}

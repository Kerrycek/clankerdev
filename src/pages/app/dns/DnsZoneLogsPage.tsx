import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { fetchDnsRecordLogs } from '../../../lib/api/dns';
import { cursorFromDescendingPage } from '../../../lib/lockIndex';
import { formatDateTime } from '../../../lib/format';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';

import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Input } from '../../../components/ui/Input';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Select } from '../../../components/ui/Select';

import { useDnsZoneContext } from './DnsZoneContext';

const DNS_RECORD_LOG_TYPES = ['A', 'AAAA', 'CAA', 'CNAME', 'DS', 'MX', 'NS', 'PTR', 'SRV', 'SSHFP', 'TLSA', 'TXT'] as const;
const DNS_RECORD_LOG_CHANGE_TYPES = ['create_record', 'update_record', 'delete_record'] as const;

function supportedValue(value: string | null, supported: readonly string[]): string {
  return value && supported.includes(value) ? value : '';
}

function normalizeFilterSearchParams(source: URLSearchParams) {
  const next = new URLSearchParams(source);
  next.delete('q');

  const name = (next.get('name') ?? '').trim();
  if (name) next.set('name', name);
  else next.delete('name');

  const type = supportedValue(next.get('type'), DNS_RECORD_LOG_TYPES);
  if (type) next.set('type', type);
  else next.delete('type');

  const changeType = supportedValue(next.get('change_type'), DNS_RECORD_LOG_CHANGE_TYPES);
  if (changeType) next.set('change_type', changeType);
  else next.delete('change_type');

  const changed = next.toString() !== source.toString();
  if (changed) {
    next.delete('from_id');
    next.set('page', '1');
  }

  return { changed, searchParams: next };
}

export function DnsZoneLogsPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const { zone } = useDnsZoneContext();
  const changeBadge = (changeType: unknown, testId: string) => {
    const ct = String(changeType ?? '');
    if (ct === 'create_record') return <Badge variant="ok" testId={testId}>{t('common.created')}</Badge>;
    if (ct === 'update_record') return <Badge variant="warn" testId={testId}>{t('common.updated')}</Badge>;
    if (ct === 'delete_record') return <Badge variant="neutral" testId={testId}>{t('common.deleted')}</Badge>;
    return <Badge variant="neutral" testId={testId}>{ct || t('common.na')}</Badge>;
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const normalizedFilters = useMemo(() => normalizeFilterSearchParams(searchParams), [searchParams]);
  const normalizedSearchParams = normalizedFilters.searchParams;
  const normalizedSearch = normalizedSearchParams.toString();
  const appliedName = normalizedSearchParams.get('name') ?? '';
  const appliedType = normalizedSearchParams.get('type') ?? '';
  const appliedChangeType = normalizedSearchParams.get('change_type') ?? '';
  const [draftName, setDraftName] = useState(appliedName);
  const [draftType, setDraftType] = useState(appliedType);
  const [draftChangeType, setDraftChangeType] = useState(appliedChangeType);

  useLayoutEffect(() => {
    if (!normalizedFilters.changed) return;
    setSearchParams(normalizedSearch, { replace: true });
  }, [normalizedFilters.changed, normalizedSearch, setSearchParams]);

  useEffect(() => {
    setDraftName(appliedName);
    setDraftType(appliedType);
    setDraftChangeType(appliedChangeType);
  }, [appliedChangeType, appliedName, appliedType]);

  const updateFilters = (filters: { name: string; type: string; changeType: string }) => {
    const next = new URLSearchParams(searchParams);
    const name = filters.name.trim();

    if (name) next.set('name', name);
    else next.delete('name');

    if (DNS_RECORD_LOG_TYPES.includes(filters.type as (typeof DNS_RECORD_LOG_TYPES)[number])) {
      next.set('type', filters.type);
    } else {
      next.delete('type');
    }

    if (DNS_RECORD_LOG_CHANGE_TYPES.includes(filters.changeType as (typeof DNS_RECORD_LOG_CHANGE_TYPES)[number])) {
      next.set('change_type', filters.changeType);
    } else {
      next.delete('change_type');
    }

    next.delete('q');
    next.delete('from_id');
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateFilters({ name: draftName, type: draftType, changeType: draftChangeType });
  };

  const clearFilters = () => {
    setDraftName('');
    setDraftType('');
    setDraftChangeType('');
    updateFilters({ name: '', type: '', changeType: '' });
  };

  const pagination = useKeysetPagination({
    id: 'dns.logs.list',
    filterKey: JSON.stringify({
      zoneId: zone.id,
      name: appliedName,
      type: appliedType,
      changeType: appliedChangeType,
    }),
    searchParams: normalizedSearchParams,
    setSearchParams,
    wipeQueryKeys: ['q'],
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const logsQ = useQuery({
    queryKey: ['dns_record_logs', 'index', {
      dns_zone: zone.id,
      limit: pagination.limit,
      fromId: pagination.fromId,
      name: appliedName,
      type: appliedType,
      change_type: appliedChangeType,
    }],
    queryFn: async () =>
      fetchDnsRecordLogs({
        dns_zone: zone.id,
        limit: pagination.limit,
        fromId: pagination.fromId,
        name: appliedName || undefined,
        type: appliedType || undefined,
        change_type: appliedChangeType || undefined,
      }),
    enabled: !normalizedFilters.changed,
  });

  const pageData = logsQ.data?.data ?? [];
  const totalCount =
    typeof logsQ.data?.meta?.['total_count'] === 'number' ? Number(logsQ.data.meta['total_count']) : pageData.length;
  const rows = pageData;

  const pageCursor = useMemo(() => cursorFromDescendingPage(pageData as any), [pageData]);
  const hasMore = pageData.length >= pagination.limit;
  const filtersActive = Boolean(appliedName || appliedType || appliedChangeType);
  const hasDraftOrAppliedFilters = Boolean(draftName.trim() || draftType || draftChangeType || filtersActive);

  return (
    <div className="space-y-6" data-testid="dns.logs.list">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t('dns.zone.logs.page.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('dns.zone.logs.page.description')}</p>
          {filtersActive ? <p className="mt-1 text-xs text-faint">{t('list.meta.filters_active')}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
          <div className="text-xs text-faint">
            {t('common.showing_n_of_m', { shown: rows.length, total: totalCount })}
          </div>
          <Button
            variant="secondary"
            onClick={() => logsQ.refetch()}
            disabled={logsQ.isFetching}
            testId="dns.logs.refresh"
          >
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      <Card testId="dns.logs.filters">
        <form
          className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_10rem_12rem_auto] lg:items-end"
          onSubmit={applyFilters}
        >
          <div className="min-w-0">
            <Input
              label={t('dns.zone.logs.filter.name.label')}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder={t('dns.zone.logs.filter.name.placeholder')}
              autoComplete="off"
              testId="dns.logs.filter.name"
            />
          </div>

          <Select
            label={t('dns.zone.logs.filter.type.label')}
            value={draftType}
            onChange={(event) => setDraftType(event.target.value)}
            testId="dns.logs.filter.type"
            options={[
              { value: '', label: t('dns.zone.logs.filter.type.all') },
              ...DNS_RECORD_LOG_TYPES.map((type) => ({ value: type, label: type })),
            ]}
          />

          <Select
            label={t('dns.zone.logs.filter.change_type.label')}
            value={draftChangeType}
            onChange={(event) => setDraftChangeType(event.target.value)}
            testId="dns.logs.filter.change_type"
            options={[
              { value: '', label: t('dns.zone.logs.filter.change_type.all') },
              { value: 'create_record', label: t('dns.zone.logs.filter.change_type.create_record') },
              { value: 'update_record', label: t('dns.zone.logs.filter.change_type.update_record') },
              { value: 'delete_record', label: t('dns.zone.logs.filter.change_type.delete_record') },
            ]}
          />

          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
            <Button type="submit" testId="dns.logs.filter.apply">
              {t('dns.zone.logs.filter.apply')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={clearFilters}
              disabled={!hasDraftOrAppliedFilters}
              testId="dns.logs.filter.clear"
            >
              {t('dns.zone.logs.filter.clear')}
            </Button>
          </div>

          <p className="text-xs text-faint sm:col-span-2 lg:col-span-4">
            {t('dns.zone.logs.filter.note')}
          </p>
        </form>
      </Card>

      {logsQ.isLoading ? (
        <Card>
          <LoadingState testId="dns.logs.loading" />
        </Card>
      ) : logsQ.isError ? (
        <ErrorState
          testId="dns.logs.error"
          title={t('dns.zone.logs.load_failed')}
          error={logsQ.error}
          onRetry={() => void logsQ.refetch()}
          showBack={false}
          detailsExtra={{ page: 'dns.logs', zoneId: zone.id }}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {rows.length === 0 ? (
              <Card>
                <div className="p-4 text-center text-sm text-muted">{t('dns.zone.logs.empty')}</div>
              </Card>
            ) : (
              rows.map((l) => {
                const chainId =
                  l.transaction_chain && typeof l.transaction_chain === 'object' && 'id' in l.transaction_chain
                    ? Number((l.transaction_chain as any).id)
                    : undefined;

                return (
                  <Card key={l.id} testId={`dns.logs.card.${l.id}`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {changeBadge(l.change_type, `dns.logs.card.${l.id}.change`)}
                            <div className="truncate text-base font-semibold text-fg">{String(l.name ?? '')}</div>
                            <Badge variant="neutral">{String(l.type ?? t('common.na'))}</Badge>
                          </div>
                          <div className="mt-1 text-xs text-faint">#{l.id}</div>
                          <div className="mt-1 text-xs text-faint">
                            {l.created_at ? formatDateTime(String(l.created_at)) : t('common.na')}
                          </div>
                        </div>

                        {chainId ? (
                          <Link
                            className="text-sm font-medium text-accent hover:underline"
                            to={`${basePath}/transactions/${chainId}`}
                          >
                            #{chainId}
                          </Link>
                        ) : null}
                      </div>

                      {l.attr_changes ? (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm text-muted">{t('dns.zone.logs.table.changes')}</summary>
                          <pre className="mt-2 max-w-content-lg overflow-x-auto whitespace-pre-wrap text-xs text-muted">
                            {JSON.stringify(l.attr_changes, null, 2)}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-list">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-faint">
                    <th className="py-2 pl-4 pr-3">{t('common.time')}</th>
                    <th className="py-2 pr-3">{t('dns.zone.logs.table.change')}</th>
                    <th className="py-2 pr-3">{t('common.name')}</th>
                    <th className="py-2 pr-3">{t('common.type')}</th>
                    <th className="py-2 pr-3">{t('dns.zone.logs.table.transaction')}</th>
                    <th className="py-2 pr-4">{t('dns.zone.logs.table.changes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-muted">
                        {t('dns.zone.logs.empty')}
                      </td>
                    </tr>
                  ) : (
                    rows.map((l) => {
                      const chainId =
                        l.transaction_chain && typeof l.transaction_chain === 'object' && 'id' in l.transaction_chain
                          ? Number((l.transaction_chain as any).id)
                          : undefined;

                      return (
                        <tr key={l.id} className="border-t border-border" data-testid={`dns.logs.row.${l.id}`}>
                          <td className="py-2 pl-4 pr-3">
                            {l.created_at ? formatDateTime(String(l.created_at)) : t('common.na')}
                          </td>
                          <td className="py-2 pr-3">
                            {changeBadge(l.change_type, `dns.logs.row.${l.id}.change`)}
                          </td>
                          <td className="py-2 pr-3">
                            <div className="font-medium text-fg">{String(l.name ?? '')}</div>
                            {l.dns_zone_name ? (
                              <div className="mt-1 text-xs text-muted">{String(l.dns_zone_name)}</div>
                            ) : null}
                            <div className="mt-1 text-xs text-faint">#{l.id}</div>
                          </td>
                          <td className="py-2 pr-3">{String(l.type ?? t('common.na'))}</td>
                          <td className="py-2 pr-3">
                            {chainId ? (
                              <Link
                                className="text-sm font-medium text-accent hover:underline"
                                to={`${basePath}/transactions/${chainId}`}
                              >
                                #{chainId}
                              </Link>
                            ) : (
                              t('common.na')
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            <pre className="max-w-content-lg overflow-x-auto whitespace-pre-wrap text-xs text-muted">
                              {l.attr_changes ? JSON.stringify(l.attr_changes, null, 2) : t('common.na')}
                            </pre>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <KeysetPagination
              page={pagination.page}
              pageCount={pagination.stack.length}
              canPrev={pagination.canPrev}
              canNext={hasMore}
              onPrev={pagination.goPrev}
              onNext={() => pagination.goNext(pageCursor)}
              onGoToPage={pagination.goToPage}
              limit={pagination.limit}
              allowedLimits={pagination.allowedLimits}
              onLimitChange={pagination.setLimit}
              testId="dns.logs.pagination.desktop"
            />
          </Card>

          {/* Mobile pagination */}
          <div className="md:hidden">
            <Card>
              <KeysetPagination
                page={pagination.page}
                pageCount={pagination.stack.length}
                canPrev={pagination.canPrev}
                canNext={hasMore}
                onPrev={pagination.goPrev}
                onNext={() => pagination.goNext(pageCursor)}
                onGoToPage={pagination.goToPage}
                limit={pagination.limit}
                allowedLimits={pagination.allowedLimits}
                onLimitChange={pagination.setLimit}
                testId="dns.logs.pagination.mobile"
                className="border-t-0"
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

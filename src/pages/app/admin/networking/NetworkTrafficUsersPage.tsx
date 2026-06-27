import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import { useI18n } from '../../../../app/i18n';
import { fetchNetworkTrafficUserTop } from '../../../../lib/api/networking';
import { formatBytesIec } from '../../../../lib/bytes';
import { useKeysetPagination } from '../../../../lib/hooks/useKeysetPagination';
import { cursorFromDescendingNumber } from '../../../../lib/lockIndex';
import { parsePositiveInt } from '../../../../lib/parse';
import { ListShell } from '../../../../components/layout/ListShell';
import { PageHeader } from '../../../../components/layout/PageHeader';
import { FilterBar } from '../../../../components/layout/FilterBar';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { Input } from '../../../../components/ui/Input';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Select } from '../../../../components/ui/Select';
import { TableCard } from '../../../../components/ui/TableCard';
import { Button } from '../../../../components/ui/Button';

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function networkTrafficUserMatchesText(row: any, rawNeedle: string): boolean {
  const needle = rawNeedle.trim().toLowerCase();
  if (!needle) return true;

  const user = row.user;
  const parts = [
    typeof user === 'object' ? user?.id : user,
    typeof user === 'object' ? user?.login : undefined,
    typeof user === 'object' ? user?.full_name : undefined,
    typeof user === 'object' ? user?.email : undefined,
  ];

  return parts.some((part) => String(part ?? '').toLowerCase().includes(needle));
}

export function NetworkTrafficUsersPage() {
  const { t } = useI18n();
  const [sp, setSp] = useSearchParams();
  const now = currentYearMonth();

  const q = String(sp.get('q') ?? '').trim();
  const year = parsePositiveInt(sp.get('year')) ?? now.year;
  const month = parsePositiveInt(sp.get('month')) ?? now.month;
  const limit = parsePositiveInt(sp.get('limit')) ?? 50;

  const paging = useKeysetPagination({
    id: 'admin.network_traffic_users.list',
    filterKey: JSON.stringify({ q, year, month }),
    searchParams: sp,
    setSearchParams: setSp,
    defaultLimit: limit,
    allowedLimits: [25, 50, 100],
    cursorParam: 'from_bytes',
    cursorMin: 0,
  });

  const listQ = useQuery({
    queryKey: ['network_interface_accountings', 'user_top', { q, year, month, limit: paging.limit, fromBytes: paging.cursor ?? null }],
    queryFn: async () => (await fetchNetworkTrafficUserTop({ q: q || undefined, year, month, limit: paging.limit, fromBytes: paging.cursor ?? undefined })).data,
    placeholderData: (prev) => prev,
  });

  const rawRows = listQ.data ?? [];
  const rows = React.useMemo(() => (q ? rawRows.filter((row) => networkTrafficUserMatchesText(row, q)) : rawRows), [q, rawRows]);
  const nextCursor = cursorFromDescendingNumber(rawRows, (r: any) => Number(r.bytes ?? ((Number(r.bytes_in ?? 0) + Number(r.bytes_out ?? 0)) || 0)));
  const canNext = Boolean(nextCursor);

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(sp);
    if (value && value.trim()) next.set(key, value.trim());
    else next.delete(key);
    ['from_bytes', 'page'].forEach((k) => next.delete(k));
    setSp(next);
  };

  const filtersActive = Boolean(q || year !== now.year || month !== now.month);
  const clearFilters = () => {
    const next = new URLSearchParams();
    next.set('limit', String(limit));
    setSp(next);
  };

  return (
    <ListShell
      testId="admin.network_traffic_users.page"
      header={<PageHeader title={t('admin.network_traffic_users.title')} description={t('admin.network_traffic_users.subtitle')} meta={q ? t('filters.current_page_text_search_note') : undefined} />}
      filters={<FilterBar
        left={<div className="flex flex-wrap items-center gap-3"><div className="w-full max-w-sm"><Input testId="admin.network_traffic_users.filter.q" value={q} onChange={(e)=>setParam('q', e.target.value)} placeholder={t('admin.network_traffic_users.filter.q.placeholder')} /></div></div>}
        right={<div className="flex flex-wrap items-center gap-3">
          <div className="w-28"><Input testId="admin.network_traffic_users.filter.year" value={String(year)} onChange={(e)=>setParam('year', e.target.value)} ariaLabel={t('admin.network_traffic_users.filter.year')} /></div>
          <div className="w-28"><Select testId="admin.network_traffic_users.filter.month" value={String(month)} onChange={(e)=>setParam('month', e.target.value)} options={Array.from({length:12},(_,i)=>({value:String(i+1),label:String(i+1)}))} /></div>
          {filtersActive ? <Button variant="secondary" testId="admin.network_traffic_users.filter.clear" onClick={clearFilters}>{t('common.clear_filters')}</Button> : null}
        </div>}
      />}
    >
      {listQ.isLoading ? <LoadingState /> : listQ.isError ? <ErrorState title={t('admin.network_traffic_users.load_error')} /> : rows.length === 0 ? <EmptyState title={t('admin.network_traffic_users.empty')} /> : (
        <TableCard testId="admin.network_traffic_users.table" footer={<KeysetPagination testId="admin.network_traffic_users.pagination" page={paging.page} pageCount={paging.pageCount} canPrev={paging.canPrev} canNext={canNext} onPrev={paging.goPrev} onNext={() => paging.goNext(nextCursor ?? null)} onGoToPage={paging.goToPage} limit={paging.limit} onLimitChange={paging.setLimit} />}>
          <thead>
            <tr>
              <th>{t('admin.network_traffic_users.field.user')}</th>
              <th>{t('admin.network_traffic_users.field.total')}</th>
              <th>{t('admin.network_traffic_users.field.in')}</th>
              <th>{t('admin.network_traffic_users.field.out')}</th>
              <th>{t('admin.network_traffic_users.field.packets')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, idx) => {
              const user = row.user;
              const id = typeof user?.id === 'number' ? user.id : idx;
              const login = user && typeof user === 'object' ? String(user.login ?? '') : '';
              return (
                <tr key={id} data-testid={`admin.network_traffic_users.row.${id}`}>
                  <td>{login || `#${id}`}</td>
                  <td className="tabular-nums">{formatBytesIec(row.bytes ?? (Number(row.bytes_in ?? 0) + Number(row.bytes_out ?? 0)))}</td>
                  <td className="tabular-nums">{formatBytesIec(row.bytes_in)}</td>
                  <td className="tabular-nums">{formatBytesIec(row.bytes_out)}</td>
                  <td className="tabular-nums">{Number(row.packets ?? (Number(row.packets_in ?? 0) + Number(row.packets_out ?? 0))).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}
    </ListShell>
  );
}

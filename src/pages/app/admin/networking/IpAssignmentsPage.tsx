import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import { useI18n } from '../../../../app/i18n';
import { fetchIpAddressAssignments } from '../../../../lib/api/networking';
import { formatDateTime } from '../../../../lib/format';
import { useKeysetPagination } from '../../../../lib/hooks/useKeysetPagination';
import { cursorFromDescendingPage } from '../../../../lib/lockIndex';
import { parseBoolParam, parsePositiveInt } from '../../../../lib/parse';
import { ListShell } from '../../../../components/layout/ListShell';
import { PageHeader } from '../../../../components/layout/PageHeader';
import { FilterBar } from '../../../../components/layout/FilterBar';
import { Button } from '../../../../components/ui/Button';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { Input } from '../../../../components/ui/Input';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Select } from '../../../../components/ui/Select';
import { StatusDot } from '../../../../components/ui/StatusDot';
import { TableCard } from '../../../../components/ui/TableCard';
import { Badge } from '../../../../components/ui/Badge';
import { UserLookupInput } from '../../../../components/ui/UserLookupInput';
import { VpsLookupInput } from '../../../../components/ui/VpsLookupInput';

function idOf(v: any): number | null {
  if (!v) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && typeof v.id === 'number') return v.id;
  return null;
}

function resourceLabel(v: any, primary: string, fallback = '—') {
  if (!v) return fallback;
  if (typeof v === 'object') {
    const p = String(v[primary] ?? '').trim();
    const id = idOf(v);
    if (p && id) return `${p} (#${id})`;
    if (p) return p;
    if (id) return `#${id}`;
  }
  return fallback;
}

export function IpAssignmentsPage() {
  const { t } = useI18n();
  const [sp, setSp] = useSearchParams();

  const q = String(sp.get('q') ?? '').trim();
  const userId = parsePositiveInt(sp.get('user'));
  const vpsId = parsePositiveInt(sp.get('vps'));
  const active = parseBoolParam(sp.get('active'));
  const order = sp.get('order') === 'oldest' ? 'oldest' : 'newest';
  const limit = parsePositiveInt(sp.get('limit')) ?? 50;

  const paging = useKeysetPagination({
    id: 'admin.ip_address_assignments.list',
    filterKey: JSON.stringify({ q, userId, vpsId, active, order }),
    searchParams: sp,
    setSearchParams: setSp,
    defaultLimit: limit,
    allowedLimits: [25, 50, 100],
  });

  const listQ = useQuery({
    queryKey: ['ip_address_assignments', 'list', { q, userId, vpsId, active, order, limit: paging.limit, fromId: paging.cursor ?? null }],
    queryFn: async () =>
      (await fetchIpAddressAssignments({ q: q || undefined, user: userId, vps: vpsId, active, order, limit: paging.limit, fromId: paging.cursor ?? undefined })).data,
    placeholderData: (prev) => prev,
  });

  const rows = listQ.data ?? [];
  const nextCursor = cursorFromDescendingPage(rows, (r) => Number((r as any).id));
  const canNext = Boolean(nextCursor);

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(sp);
    if (value && value.trim()) next.set(key, value.trim());
    else next.delete(key);
    ['from_id', 'page'].forEach((k) => next.delete(k));
    setSp(next);
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    next.set('limit', String(paging.limit));
    setSp(next);
  };

  const filtersActive = Boolean(q || userId || vpsId || active !== undefined || order !== 'newest');

  return (
    <ListShell
      testId="admin.ip_assignments.page"
      header={<PageHeader title={t('admin.ip_assignments.title')} description={t('admin.ip_assignments.subtitle')} />}
      filters={
        <FilterBar
          left={<div className="flex flex-wrap items-center gap-3">
            <div className="w-full max-w-sm"><Input testId="admin.ip_assignments.filter.q" value={q} onChange={(e) => setParam('q', e.target.value)} placeholder={t('admin.ip_assignments.filter.q.placeholder')} /></div>
            <div className="w-64"><UserLookupInput testId="admin.ip_assignments.filter.user" value={userId ? String(userId) : ''} onChange={(v) => setParam('user', v)} placeholder={t('admin.ip_assignments.filter.user.placeholder')} /></div>
            <div className="w-64"><VpsLookupInput testId="admin.ip_assignments.filter.vps" value={vpsId ?? null} onChange={(v) => setParam('vps', v == null ? '' : String(v))} placeholder={t('admin.ip_assignments.filter.vps.placeholder')} /></div>
          </div>}
          right={<div className="flex flex-wrap items-center gap-3">
            <div className="w-40"><Select testId="admin.ip_assignments.filter.active" value={active === undefined ? 'all' : active ? 'true' : 'false'} onChange={(e) => setParam('active', e.target.value === 'all' ? '' : e.target.value)} options={[{value:'all',label:t('admin.ip_assignments.filter.active.all')},{value:'true',label:t('admin.ip_assignments.filter.active.true')},{value:'false',label:t('admin.ip_assignments.filter.active.false')}]} /></div>
            <div className="w-40"><Select testId="admin.ip_assignments.filter.order" value={order} onChange={(e) => setParam('order', e.target.value)} options={[{value:'newest',label:t('admin.ip_assignments.filter.order.newest')},{value:'oldest',label:t('admin.ip_assignments.filter.order.oldest')}]} /></div>
            {filtersActive ? <Button variant="secondary" testId="admin.ip_assignments.filter.clear" onClick={clearFilters}>{t('common.clear_filters')}</Button> : null}
          </div>}
        />
      }
    >
      {listQ.isLoading ? <LoadingState /> : listQ.isError ? <ErrorState title={t('admin.ip_assignments.load_error')} /> : rows.length === 0 ? <EmptyState title={t('admin.ip_assignments.empty')} /> : (
        <TableCard testId="admin.ip_assignments.table" footer={<KeysetPagination testId="admin.ip_assignments.pagination" page={paging.page} pageCount={paging.pageCount} canPrev={paging.canPrev} canNext={canNext} onPrev={paging.goPrev} onNext={() => paging.goNext(nextCursor ?? null)} onGoToPage={paging.goToPage} limit={paging.limit} onLimitChange={paging.setLimit} />}>
          <thead>
            <tr>
              <th aria-label={t('common.state')} />
              <th>{t('admin.ip_assignments.field.period')}</th>
              <th>{t('admin.ip_assignments.field.ip')}</th>
              <th>{t('admin.ip_assignments.field.user')}</th>
              <th>{t('admin.ip_assignments.field.vps')}</th>
              <th>{t('admin.ip_assignments.field.assigned_by')}</th>
              <th>{t('admin.ip_assignments.field.unassigned_by')}</th>
              <th>{t('admin.ip_assignments.field.flags')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any) => {
              const id = Number(row.id);
              const activeRow = !row.to_date;
              return (
                <tr key={id} data-testid={`admin.ip_assignments.row.${id}`}>
                  <td><StatusDot variant={activeRow ? 'ok' : 'neutral'} testId={`admin.ip_assignments.row.${id}.dot`} /></td>
                  <td className="tabular-nums text-sm">
                    <div>{formatDateTime(row.from_date)}</div>
                    <div className="text-muted">{row.to_date ? `→ ${formatDateTime(row.to_date)}` : t('common.current')}</div>
                  </td>
                  <td className="font-medium tabular-nums">{String(row.ip_addr ?? t('common.na'))}{typeof row.ip_prefix === 'number' ? `/${row.ip_prefix}` : ''}</td>
                  <td>{resourceLabel(row.user, 'login')}</td>
                  <td>{resourceLabel(row.vps, 'hostname')}</td>
                  <td>{resourceLabel(row.assigned_by_chain, 'name')}</td>
                  <td>{resourceLabel(row.unassigned_by_chain, 'name')}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={activeRow ? 'ok' : 'neutral'}>{activeRow ? t('common.active') : t('common.historical')}</Badge>
                      {row.reconstructed ? <Badge tone="warn">{t('admin.ip_assignments.badge.reconstructed')}</Badge> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}
    </ListShell>
  );
}

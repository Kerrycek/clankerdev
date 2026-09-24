import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';

import { useI18n } from '../../../../app/i18n';
import { fetchIpAddressAssignments } from '../../../../lib/api/networking';
import { formatDateTime } from '../../../../lib/format';
import { useKeysetPagination } from '../../../../lib/hooks/useKeysetPagination';
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

function IpAssignmentsPageContent() {
  const { t } = useI18n();
  const [sp, setSp] = useSearchParams();

  const ipAddr = String(sp.get('ip_addr') ?? '').trim();
  const userId = parsePositiveInt(sp.get('user'));
  const vpsId = parsePositiveInt(sp.get('vps'));
  const active = parseBoolParam(sp.get('active'));
  const order = sp.get('order') === 'oldest' ? 'oldest' : 'newest';
  const limit = parsePositiveInt(sp.get('limit')) ?? 50;

  const paging = useKeysetPagination({
    id: 'admin.ip_address_assignments.list',
    filterKey: JSON.stringify({ ipAddr, userId, vpsId, active, order }),
    searchParams: sp,
    setSearchParams: setSp,
    defaultLimit: limit,
    allowedLimits: [25, 50, 100],
    restoreUrlCursorOnSignatureChange: true,
  });

  const listQ = useQuery({
    queryKey: ['ip_address_assignments', 'list', { ipAddr, userId, vpsId, active, order, limit: paging.limit, fromId: paging.cursor ?? null }],
    queryFn: async ({ signal }) =>
      (await fetchIpAddressAssignments({ ipAddr: ipAddr || undefined, user: userId, vps: vpsId, active, order, limit: paging.limit + 1, fromId: paging.cursor ?? undefined, signal })).data,
  });

  const rows = (listQ.data ?? []).slice(0, paging.limit);
  // API44 orders by (from_date, id), not ID alone. The lookahead row is
  // intentionally excluded from the anchor so the next page still displays it.
  const nextCursor = rows.at(-1)?.id;
  const canNext = !listQ.isFetching && !listQ.isError
    && (listQ.data?.length ?? 0) > paging.limit
    && Number.isSafeInteger(nextCursor) && Number(nextCursor) > 0;
  const restart = () => paging.goToPageWithStack(1, [null]);
  const goNext = () => {
    if (!canNext || nextCursor == null) return;
    // Rebuild the forward edge after a refetch instead of reusing a stale
    // visited cursor (e.g. when assignments changed on a previous page).
    paging.goToPageWithStack(paging.page + 1, [
      ...paging.stack.slice(0, paging.index + 1), nextCursor,
    ]);
  };

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

  const filtersActive = Boolean(ipAddr || userId || vpsId || active !== undefined || order !== 'newest');

  return (
    <ListShell
      testId="admin.ip_assignments.page"
      header={<PageHeader title={t('admin.ip_assignments.title')} description={t('admin.ip_assignments.subtitle')} />}
      filters={
        <FilterBar
          left={<div className="flex flex-wrap items-center gap-3">
            <div className="w-full max-w-sm"><Input testId="admin.ip_assignments.filter.ip_addr" value={ipAddr} onChange={(e) => setParam('ip_addr', e.target.value)} placeholder={t('admin.ip_assignments.filter.ip_addr.placeholder')} /></div>
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
      {listQ.isLoading ? <LoadingState /> : listQ.isError ? <ErrorState
        testId="admin.ip_assignments.error"
        title={t('admin.ip_assignments.load_error')}
        error={listQ.error}
        actions={{
          primary: { label: t('common.retry'), onClick: () => listQ.refetch() },
          secondary: paging.cursor != null
            ? { label: t('admin.ip_assignments.restart'), onClick: restart }
            : undefined,
        }}
      /> : rows.length === 0 ? <EmptyState title={t('admin.ip_assignments.empty')} /> : (
        <TableCard testId="admin.ip_assignments.table">
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
      <KeysetPagination
        testId="admin.ip_assignments.pagination"
        page={paging.page} pageCount={paging.pageCount}
        canPrev={paging.canPrev && !listQ.isFetching} canNext={canNext}
        onPrev={paging.goPrev} onNext={goNext}
        onGoToPage={paging.goToPage} limit={paging.limit}
        onLimitChange={paging.setLimit}
      />
    </ListShell>
  );
}

export function IpAssignmentsPage() {
  const location = useLocation();
  const [sp] = useSearchParams();

  if (!sp.has('q')) return <IpAssignmentsPageContent />;

  // Older links used an unsupported free-text `q` filter. Canonicalize before
  // mounting the data-fetching page so a legacy URL can never issue an
  // unfiltered assignment request while still looking filtered.
  const next = new URLSearchParams(sp);
  const legacyIpAddr = String(next.get('q') ?? '').trim();
  const canonicalIpAddr = String(next.get('ip_addr') ?? '').trim();
  if (canonicalIpAddr) next.set('ip_addr', canonicalIpAddr);
  else if (legacyIpAddr) next.set('ip_addr', legacyIpAddr);
  else next.delete('ip_addr');
  next.delete('q');
  next.delete('from_id');
  next.delete('page');

  const search = next.toString();
  return <Navigate replace to={`${location.pathname}${search ? `?${search}` : ''}`} />;
}

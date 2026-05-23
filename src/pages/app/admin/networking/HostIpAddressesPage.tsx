import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import { useI18n } from '../../../../app/i18n';
import { fetchHostIpAddresses, type HostIpAddress } from '../../../../lib/api/networking';
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
import { clsx } from '../../../../components/ui/clsx';
import { UserLookupInput } from '../../../../components/ui/UserLookupInput';
import { VpsLookupInput } from '../../../../components/ui/VpsLookupInput';
import { toneSurfaceClass } from '../../../../components/ui/tone';

function idOf(v: any): number | null {
  if (!v) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && typeof v.id === 'number') return v.id;
  return null;
}

function ipAddrLabel(row: HostIpAddress): string {
  const ip = (row as any).ip_address;
  if (ip && typeof ip === 'object') {
    const addr = String((ip as any).ip_addr ?? (ip as any).addr ?? '').trim();
    if (addr) return addr;
  }
  return '—';
}

function vpsLabel(row: HostIpAddress): string {
  const ni = (row as any).ip_address?.network_interface;
  const vps = ni && typeof ni === 'object' ? (ni as any).vps : undefined;
  if (vps && typeof vps === 'object') {
    const hostname = String((vps as any).hostname ?? '').trim();
    const id = idOf(vps);
    if (hostname && id) return `${hostname} (#${id})`;
    if (hostname) return hostname;
    if (id) return `#${id}`;
  }
  return '—';
}

function userLabel(row: HostIpAddress): string {
  const user = (row as any).ip_address?.user;
  if (user && typeof user === 'object') {
    const login = String((user as any).login ?? '').trim();
    const id = idOf(user);
    if (login && id) return `${login} (#${id})`;
    if (login) return login;
    if (id) return `#${id}`;
  }
  return '—';
}

function ifaceLabel(row: HostIpAddress): string {
  const iface = (row as any).ip_address?.network_interface;
  if (iface && typeof iface === 'object') {
    const name = String((iface as any).name ?? '').trim();
    const id = idOf(iface);
    if (name && id) return `${name} (#${id})`;
    if (name) return name;
    if (id) return `#${id}`;
  }
  return '—';
}

function rowVariant(row: HostIpAddress): 'warn' | undefined {
  return row.assigned === false ? 'warn' : undefined;
}

export function HostIpAddressesPage() {
  const { t } = useI18n();
  const [sp, setSp] = useSearchParams();

  const q = String(sp.get('q') ?? '').trim();
  const userId = parsePositiveInt(sp.get('user'));
  const vpsId = parsePositiveInt(sp.get('vps'));
  const assigned = parseBoolParam(sp.get('assigned'));
  const limit = parsePositiveInt(sp.get('limit')) ?? 50;

  const paging = useKeysetPagination({
    id: 'admin.host_ip_addresses.list',
    filterKey: JSON.stringify({ q, userId, vpsId, assigned }),
    searchParams: sp,
    setSearchParams: setSp,
    defaultLimit: limit,
    allowedLimits: [25, 50, 100],
  });

  const listQ = useQuery({
    queryKey: ['host_ip_addresses', 'list', { q, userId, vpsId, assigned, limit: paging.limit, fromId: paging.cursor ?? null }],
    queryFn: async () =>
      (await fetchHostIpAddresses({ q: q || undefined, user: userId, vps: vpsId, assigned, limit: paging.limit, fromId: paging.cursor ?? undefined })).data,
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

  const filtersActive = Boolean(q || userId || vpsId || assigned !== undefined);

  return (
    <ListShell
      testId="admin.host_ip_addresses.page"
      header={<PageHeader title={t('admin.host_ip_addresses.title')} description={t('admin.host_ip_addresses.subtitle')} />}
      filters={
        <FilterBar
          left={
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-full max-w-sm">
                <Input testId="admin.host_ip_addresses.filter.q" value={q} onChange={(e) => setParam('q', e.target.value)} placeholder={t('admin.host_ip_addresses.filter.q.placeholder')} />
              </div>
              <div className="w-64">
                <UserLookupInput testId="admin.host_ip_addresses.filter.user" value={userId ? String(userId) : ''} onChange={(v) => setParam('user', v)} placeholder={t('admin.host_ip_addresses.filter.user.placeholder')} />
              </div>
              <div className="w-64">
                <VpsLookupInput testId="admin.host_ip_addresses.filter.vps" value={vpsId ?? null} onChange={(v) => setParam('vps', v == null ? '' : String(v))} placeholder={t('admin.host_ip_addresses.filter.vps.placeholder')} />
              </div>
            </div>
          }
          right={
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-40">
                <Select
                  testId="admin.host_ip_addresses.filter.assigned"
                  value={assigned === undefined ? 'all' : assigned ? 'true' : 'false'}
                  onChange={(e) => setParam('assigned', e.target.value === 'all' ? '' : e.target.value)}
                  options={[
                    { value: 'all', label: t('admin.host_ip_addresses.filter.assigned.all') },
                    { value: 'true', label: t('admin.host_ip_addresses.filter.assigned.true') },
                    { value: 'false', label: t('admin.host_ip_addresses.filter.assigned.false') },
                  ]}
                />
              </div>
              {filtersActive ? <Button variant="secondary" testId="admin.host_ip_addresses.filter.clear" onClick={clearFilters}>{t('common.clear_filters')}</Button> : null}
            </div>
          }
        />
      }
    >
      {listQ.isLoading ? <LoadingState /> : listQ.isError ? <ErrorState title={t('admin.host_ip_addresses.load_error')} /> : rows.length === 0 ? (
        <EmptyState title={t('admin.host_ip_addresses.empty')} />
      ) : (
        <TableCard
          testId="admin.host_ip_addresses.table"
          footer={<KeysetPagination testId="admin.host_ip_addresses.pagination" page={paging.page} pageCount={paging.pageCount} canPrev={paging.canPrev} canNext={canNext} onPrev={paging.goPrev} onNext={() => paging.goNext(nextCursor ?? null)} onGoToPage={paging.goToPage} limit={paging.limit} onLimitChange={paging.setLimit} />}
        >
          <thead>
            <tr>
              <th aria-label={t('common.state')} />
              <th>{t('admin.host_ip_addresses.field.address')}</th>
              <th>{t('admin.host_ip_addresses.field.route')}</th>
              <th>{t('admin.host_ip_addresses.field.interface')}</th>
              <th>{t('admin.host_ip_addresses.field.vps')}</th>
              <th>{t('admin.host_ip_addresses.field.user')}</th>
              <th>{t('admin.host_ip_addresses.field.ptr')}</th>
              <th>{t('admin.host_ip_addresses.field.flags')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = Number((row as any).id);
              const variant = rowVariant(row);
              return (
                <tr key={id} data-testid={`admin.host_ip_addresses.row.${id}`} data-row-variant={variant} className={clsx(variant ? toneSurfaceClass(variant) : undefined)}>
                  <td><StatusDot variant={variant ?? 'ok'} testId={`admin.host_ip_addresses.row.${id}.dot`} /></td>
                  <td className="font-medium tabular-nums">{String((row as any).addr ?? `#${id}`)}</td>
                  <td className="tabular-nums">{ipAddrLabel(row)}</td>
                  <td>{ifaceLabel(row)}</td>
                  <td>{vpsLabel(row)}</td>
                  <td>{userLabel(row)}</td>
                  <td className="max-w-80 truncate">{String((row as any).reverse_record_value ?? t('common.na'))}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={row.assigned === false ? 'warn' : 'ok'}>{row.assigned === false ? t('common.unassigned') : t('common.assigned')}</Badge>
                      {(row as any).user_created ? <Badge tone="neutral">{t('common.custom')}</Badge> : null}
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

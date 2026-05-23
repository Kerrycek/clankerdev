import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';

import { useI18n } from '../../../../app/i18n';
import { fetchNetworkInterfaceMonitor } from '../../../../lib/api/networking';
import { formatDateTime } from '../../../../lib/format';
import { formatBytesIec } from '../../../../lib/bytes';
import { parsePositiveInt } from '../../../../lib/parse';
import { ListShell } from '../../../../components/layout/ListShell';
import { PageHeader } from '../../../../components/layout/PageHeader';
import { FilterBar } from '../../../../components/layout/FilterBar';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { Input } from '../../../../components/ui/Input';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Select } from '../../../../components/ui/Select';
import { TableCard } from '../../../../components/ui/TableCard';
import { UserLookupInput } from '../../../../components/ui/UserLookupInput';
import { VpsLookupInput } from '../../../../components/ui/VpsLookupInput';
import { NodeLookupInput } from '../../../../components/ui/NodeLookupInput';
import { Button } from '../../../../components/ui/Button';

function label(v: any, key: string, fallback = '—') {
  if (!v) return fallback;
  if (typeof v === 'object') {
    const p = String(v[key] ?? '').trim();
    const id = typeof v.id === 'number' ? v.id : undefined;
    if (p && id) return `${p} (#${id})`;
    if (p) return p;
    if (id) return `#${id}`;
  }
  return fallback;
}

function rate(value: number | undefined | null, delta: number | undefined | null) {
  if (value === undefined || value === null) return '—';
  const d = Number(delta ?? 1);
  if (!Number.isFinite(d) || d <= 0) return formatBytesIec(value);
  return `${formatBytesIec(value / d)}/s`;
}

export function NetworkLivePage() {
  const { t } = useI18n();
  const [sp, setSp] = useSearchParams();

  const q = String(sp.get('q') ?? '').trim();
  const userId = parsePositiveInt(sp.get('user'));
  const vpsId = parsePositiveInt(sp.get('vps'));
  const nodeId = parsePositiveInt(sp.get('node'));
  const order = String(sp.get('order') ?? '-bytes');
  const limit = parsePositiveInt(sp.get('limit')) ?? 50;

  const listQ = useQuery({
    queryKey: ['network_interface_monitor', 'list', { q, userId, vpsId, nodeId, order, limit }],
    queryFn: async () => (await fetchNetworkInterfaceMonitor({ q: q || undefined, user: userId, vps: vpsId, node: nodeId, order, limit })).data,
    refetchInterval: 10_000,
    placeholderData: (prev) => prev,
  });

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(sp);
    if (value && value.trim()) next.set(key, value.trim());
    else next.delete(key);
    setSp(next);
  };

  const filtersActive = Boolean(q || userId || vpsId || nodeId || order !== '-bytes');
  const clearFilters = () => {
    const next = new URLSearchParams();
    next.set('limit', String(limit));
    setSp(next);
  };

  const rows = listQ.data ?? [];

  return (
    <ListShell
      testId="admin.network_live.page"
      header={<PageHeader title={t('admin.network_live.title')} description={t('admin.network_live.subtitle')} />}
      filters={<FilterBar
        left={<div className="flex flex-wrap items-center gap-3">
          <div className="w-full max-w-sm"><Input testId="admin.network_live.filter.q" value={q} onChange={(e)=>setParam('q', e.target.value)} placeholder={t('admin.network_live.filter.q.placeholder')} /></div>
          <div className="w-64"><UserLookupInput testId="admin.network_live.filter.user" value={userId ? String(userId) : ''} onChange={(v)=>setParam('user', v)} placeholder={t('admin.network_live.filter.user.placeholder')} /></div>
          <div className="w-64"><VpsLookupInput testId="admin.network_live.filter.vps" value={vpsId ?? null} onChange={(v)=>setParam('vps', v == null ? '' : String(v))} placeholder={t('admin.network_live.filter.vps.placeholder')} /></div>
          <div className="w-64"><NodeLookupInput testId="admin.network_live.filter.node" value={nodeId ? String(nodeId) : ''} onChange={(v)=>setParam('node', v)} placeholder={t('admin.network_live.filter.node.placeholder')} loadingLabel={t('common.loading')} noResultsLabel={t('common.no_results')} /></div>
        </div>}
        right={<div className="flex flex-wrap items-center gap-3">
          <div className="w-48"><Select testId="admin.network_live.filter.order" value={order} onChange={(e)=>setParam('order', e.target.value)} options={[{value:'-bytes',label:t('admin.network_live.filter.order.bytes_desc')},{value:'bytes',label:t('admin.network_live.filter.order.bytes_asc')},{value:'-bytes_in',label:t('admin.network_live.filter.order.in_desc')},{value:'-bytes_out',label:t('admin.network_live.filter.order.out_desc')},{value:'-packets',label:t('admin.network_live.filter.order.packets_desc')},{value:'updated_at',label:t('admin.network_live.filter.order.updated_asc')},{value:'-updated_at',label:t('admin.network_live.filter.order.updated_desc')}]} /></div>
          {filtersActive ? <Button variant="secondary" testId="admin.network_live.filter.clear" onClick={clearFilters}>{t('common.clear_filters')}</Button> : null}
        </div>}
      />}
    >
      {listQ.isLoading ? <LoadingState /> : listQ.isError ? <ErrorState title={t('admin.network_live.load_error')} /> : rows.length === 0 ? <EmptyState title={t('admin.network_live.empty')} /> : (
        <TableCard testId="admin.network_live.table">
          <thead>
            <tr>
              <th>{t('admin.network_live.field.interface')}</th>
              <th>{t('admin.network_live.field.vps')}</th>
              <th>{t('admin.network_live.field.user')}</th>
              <th>{t('admin.network_live.field.updated')}</th>
              <th>{t('admin.network_live.field.in')}</th>
              <th>{t('admin.network_live.field.out')}</th>
              <th>{t('admin.network_live.field.packets_in')}</th>
              <th>{t('admin.network_live.field.packets_out')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any) => {
              const ni = row.network_interface;
              const vps = ni && typeof ni === 'object' ? ni.vps : undefined;
              const user = vps && typeof vps === 'object' ? vps.user : undefined;
              const id = Number(row.id);
              return (
                <tr key={id} data-testid={`admin.network_live.row.${id}`}>
                  <td>{label(ni, 'name')}</td>
                  <td>{label(vps, 'hostname')}</td>
                  <td>{label(user, 'login')}</td>
                  <td className="tabular-nums text-sm">{formatDateTime(row.updated_at)}</td>
                  <td className="tabular-nums">{rate(row.bytes_in, row.delta)}</td>
                  <td className="tabular-nums">{rate(row.bytes_out, row.delta)}</td>
                  <td className="tabular-nums">{rate(row.packets_in, row.delta)}</td>
                  <td className="tabular-nums">{rate(row.packets_out, row.delta)}</td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}
    </ListShell>
  );
}

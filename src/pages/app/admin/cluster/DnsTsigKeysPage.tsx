import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';
import { FilterBar } from '../../../../components/layout/FilterBar';
import { Alert } from '../../../../components/ui/Alert';
import { ActionButton } from '../../../../components/ui/ActionButton';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { Input } from '../../../../components/ui/Input';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Modal } from '../../../../components/ui/Modal';
import { SecretField } from '../../../../components/ui/SecretField';
import { Select } from '../../../../components/ui/Select';
import { UserLookupInput } from '../../../../components/ui/UserLookupInput';
import { fetchDnsTsigKeys, createDnsTsigKey, deleteDnsTsigKey, type DnsTsigKey } from '../../../../lib/api/dns';
import { useKeysetPagination } from '../../../../lib/hooks/useKeysetPagination';
import { cursorFromDescendingPage } from '../../../../lib/lockIndex';
import { formatDateTime } from '../../../../lib/format';
import { formatErrorMessage } from '../../../../lib/errors';

export function DnsTsigKeysPage() {
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [algorithm, setAlgorithm] = useState(() => searchParams.get('algorithm') ?? '');
  const [userId, setUserId] = useState<number | null>(() => { const raw = searchParams.get('user'); if (!raw) return null; const n = Number(raw); return Number.isFinite(n) && n > 0 ? Math.floor(n) : null; });
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [newUserId, setNewUserId] = useState<number | null>(null);
  const [newAlgorithm, setNewAlgorithm] = useState('hmac-sha256');
  const [confirmDelete, setConfirmDelete] = useState<DnsTsigKey | null>(null);

  const pagination = useKeysetPagination({ id: 'admin.cluster.dns_tsig_keys', filterKey: JSON.stringify({ q, algorithm, userId }), searchParams, setSearchParams, defaultLimit: 50, allowedLimits: [25,50,100] });
  React.useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (q.trim()) next.set('q', q.trim()); else next.delete('q');
    if (algorithm) next.set('algorithm', algorithm); else next.delete('algorithm');
    if (userId) next.set('user', String(userId)); else next.delete('user');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [q, algorithm, userId, searchParams, setSearchParams]);

  const listQ = useQuery({
    queryKey: ['dns_tsig_keys', pagination.page, pagination.limit, pagination.fromId, q, algorithm, userId],
    queryFn: async () => fetchDnsTsigKeys({ limit: pagination.limit, fromId: pagination.fromId, q: q.trim() || undefined, algorithm: algorithm || undefined, user: userId ?? undefined }),
  });
  const rows = listQ.data?.data ?? [];
  const cursor = useMemo(() => cursorFromDescendingPage(rows as LegacyAny), [rows]);
  const hasMore = rows.length >= pagination.limit;

  const createM = useMutation({
    mutationFn: async () => createDnsTsigKey({ user: newUserId ?? undefined, name: name.trim(), algorithm: newAlgorithm || undefined }),
    onSuccess: () => { pushToast({ variant: 'ok', title: t('common.created') }); setCreateOpen(false); setName(''); setNewUserId(null); setNewAlgorithm('hmac-sha256'); void listQ.refetch(); },
  });
  const deleteM = useMutation({ mutationFn: async () => { if (!confirmDelete) throw new Error('missing key'); return deleteDnsTsigKey(confirmDelete.id); }, onSuccess: () => { pushToast({ variant: 'ok', title: t('common.deleted') }); setConfirmDelete(null); void listQ.refetch(); } });

  if (listQ.isLoading) return <LoadingState testId="admin.cluster.dns_tsig.loading" label={t('admin.cluster.dns_tsig.loading')} />;
  if (listQ.isError) return <ErrorState testId="admin.cluster.dns_tsig.error" title={t('admin.cluster.dns_tsig.load_failed')} error={listQ.error} onRetry={() => void listQ.refetch()} showBack={false} />;

  const filtersActive = Boolean(q.trim() || algorithm || userId);

  return (
    <div className="space-y-6" data-testid="admin.cluster.dns_tsig.page">
      <FilterBar
        left={<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin.cluster.dns_tsig.search.placeholder')} testId="admin.cluster.dns_tsig.search.input" />}
        right={<div className="flex flex-wrap items-end gap-2"><div><div className="mb-1 text-xs font-medium text-muted">{t('common.algorithm')}</div><Select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)} options={[{ value: '', label: t('common.all') }, { value: 'hmac-sha256', label: 'hmac-sha256' }, { value: 'hmac-sha512', label: 'hmac-sha512' }]} testId="admin.cluster.dns_tsig.filter.algorithm" /></div><div className="w-56"><div className="mb-1 text-xs font-medium text-muted">{t('common.user')}</div><UserLookupInput value={userId} onChange={(value) => setUserId(value ? Number(value) : null)} testId="admin.cluster.dns_tsig.filter.user" /></div><Button variant="secondary" onClick={() => listQ.refetch()}>{t('common.refresh')}</Button><Button onClick={() => setCreateOpen(true)}>{t('common.create')}</Button></div>}
      />
      {filtersActive ? <div className="text-xs text-faint">{t('list.meta.filters_active')}</div> : null}
      {rows.length === 0 ? <EmptyState testId="admin.cluster.dns_tsig.empty" title={t('admin.cluster.dns_tsig.empty')} body={t('admin.cluster.dns_tsig.empty_body')} /> : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-list">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-faint"><th className="py-2 pl-4 pr-3">{t('common.name')}</th><th className="py-2 pr-3">{t('common.user')}</th><th className="py-2 pr-3">{t('common.algorithm')}</th><th className="py-2 pr-3">{t('common.secret')}</th><th className="py-2 pr-3">{t('common.created')}</th><th className="py-2 pr-4">{t('common.actions')}</th></tr></thead>
              <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border" data-testid={`admin.cluster.dns_tsig.row.${row.id}`}><td className="py-2 pl-4 pr-3 font-medium text-fg">{String(row.name ?? `#${row.id}`)}</td><td className="py-2 pr-3">{typeof (row as LegacyAny).user?.login === 'string' ? String((row as LegacyAny).user.login) : t('common.na')}</td><td className="py-2 pr-3"><Badge variant="neutral">{String(row.algorithm ?? t('common.na'))}</Badge></td><td className="py-2 pr-3"><SecretField value={typeof row.secret === 'string' ? row.secret : ''} testId={`admin.cluster.dns_tsig.row.${row.id}.secret`} /></td><td className="py-2 pr-3">{row.created_at ? formatDateTime(String(row.created_at)) : t('common.na')}</td><td className="py-2 pr-4 text-right"><ActionButton size="sm" variant="danger" onClick={() => setConfirmDelete(row)}>{t('common.delete')}</ActionButton></td></tr>)}</tbody>
            </table>
          </div>
          <KeysetPagination page={pagination.page} pageCount={pagination.stack.length} canPrev={pagination.canPrev} canNext={hasMore} onPrev={pagination.goPrev} onNext={() => pagination.goNext(cursor)} />
        </Card>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('admin.cluster.dns_tsig.create.title')}>
        <div className="space-y-4">
          {createM.isError ? <Alert variant="danger" title={t('admin.cluster.dns_tsig.create.failed')}>{formatErrorMessage(createM.error)}</Alert> : null}
          <div><div className="mb-1 text-sm font-medium text-fg">{t('common.name')}</div><Input value={name} onChange={(e) => setName(e.target.value)} testId="admin.cluster.dns_tsig.create.name" /></div>
          <div><div className="mb-1 text-sm font-medium text-fg">{t('common.user')}</div><UserLookupInput value={newUserId} onChange={(value) => setNewUserId(value ? Number(value) : null)} testId="admin.cluster.dns_tsig.create.user" /></div>
          <div><div className="mb-1 text-sm font-medium text-fg">{t('common.algorithm')}</div><Select value={newAlgorithm} onChange={(e) => setNewAlgorithm(e.target.value)} options={[{ value: 'hmac-sha256', label: 'hmac-sha256' }, { value: 'hmac-sha512', label: 'hmac-sha512' }]} testId="admin.cluster.dns_tsig.create.algorithm" /></div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button><ActionButton onClick={() => createM.mutate()} loading={createM.isPending} disabled={!name.trim()}>{t('common.create')}</ActionButton></div>
        </div>
      </Modal>

      <ConfirmDialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)} title={t('admin.cluster.dns_tsig.delete.title')} description={confirmDelete ? t('admin.cluster.dns_tsig.delete.description', { name: String(confirmDelete.name ?? `#${confirmDelete.id}`) }) : ''} confirmLabel={t('common.delete')} confirmVariant="danger" onConfirm={() => deleteM.mutate()} loading={deleteM.isPending} />
    </div>
  );
}

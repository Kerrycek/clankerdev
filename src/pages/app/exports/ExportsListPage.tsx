import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleHelp, Plus, SlidersHorizontal } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';

import { useChrome } from '../../../components/layout/ChromeContext';
import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import { FilterBar } from '../../../components/layout/FilterBar';

import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { CopyButton } from '../../../components/ui/CopyButton';
import { DatasetLookupInput } from '../../../components/ui/DatasetLookupInput';
import { Drawer } from '../../../components/ui/Drawer';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FilterChip } from '../../../components/ui/FilterChip';
import { HostIpLookupInput } from '../../../components/ui/HostIpLookupInput';
import { Input } from '../../../components/ui/Input';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Select } from '../../../components/ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../components/ui/SmartInputHelp';
import { StatusDot } from '../../../components/ui/StatusDot';
import { TableCard } from '../../../components/ui/TableCard';
import { TableRowLink } from '../../../components/ui/TableRowLink';
import { clsx } from '../../../components/ui/clsx';

import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { createExport, fetchExports, type ExportItem } from '../../../lib/api/exports';
import { fetchDataset, fetchDatasetSnapshots } from '../../../lib/api/datasets';
import { formatDateTime } from '../../../lib/format';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';
import { cursorFromDescendingPage } from '../../../lib/lockIndex';
import { objectRef } from '../../../lib/objectRef';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../../lib/smartFilter';
import { searchUsers } from '../../../lib/api/users';
import { useDebouncedValue } from '../../../lib/hooks/useDebouncedValue';

function parseBoolToken(raw: string): boolean | undefined {
  const s = raw.trim().toLowerCase();
  if (!s) return undefined;
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(s)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(s)) return false;
  return undefined;
}

function sourceLabel(ex: ExportItem): string {
  const ds: any = ex.dataset;
  const dataset = String(ds?.full_name ?? ds?.name ?? (ds?.id ? `#${ds.id}` : '#?'));
  const snap: any = ex.snapshot;
  if (snap?.id) {
    return `${dataset} · ${String(snap.label ?? snap.name ?? `#${snap.id}`)}`;
  }
  return dataset;
}

function exportRowVariant(ex: ExportItem): 'ok' | 'warn' {
  return ex.enabled === false ? 'warn' : 'ok';
}

function exportBadge(ex: ExportItem, t: (k: string, vars?: any) => string) {
  return ex.enabled === false
    ? { variant: 'warn' as const, label: t('common.disabled') }
    : { variant: 'ok' as const, label: t('common.enabled') };
}

function exportAddress(ex: ExportItem): string {
  const host: any = ex.host_ip_address;
  return String(host?.addr ?? (host?.id ? `#${host.id}` : '—'));
}

type CreateFormState = {
  datasetId: number | null;
  sourceType: 'dataset' | 'snapshot';
  snapshotId: string;
  hostIpId: number | null;
  allVps: boolean;
  rw: boolean;
  sync: boolean;
  subtreeCheck: boolean;
  rootSquash: boolean;
  threads: string;
  enabled: boolean;
};

function defaultCreateForm(datasetId: number | null): CreateFormState {
  return {
    datasetId,
    sourceType: 'dataset',
    snapshotId: '',
    hostIpId: null,
    allVps: true,
    rw: true,
    sync: true,
    subtreeCheck: false,
    rootSquash: false,
    threads: '8',
    enabled: true,
  };
}

export function ExportsListPage(props?: { fixedDatasetId?: number; embedded?: boolean }) {
  const fixedDatasetId = props?.fixedDatasetId;
  const embedded = props?.embedded ?? false;
  const { basePath, mode } = useAppMode();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pushToast } = useToasts();
  const qc = useQueryClient();
  const chrome = useChrome();

  const [searchParams, setSearchParams] = useSearchParams();
  const smartInputRef = useRef<HTMLInputElement | null>(null);

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [enabledFilter, setEnabledFilter] = useState(() => searchParams.get('enabled') ?? '');
  const [datasetFilter, setDatasetFilter] = useState<number | null>(() => fixedDatasetId ?? parseNumericToken(searchParams.get('dataset') ?? ''));
  const [userFilter, setUserFilter] = useState(() => searchParams.get('user') ?? '');
  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(() => defaultCreateForm(fixedDatasetId ?? null));

  const qTrim = useMemo(() => q.trim(), [q]);
  const userTrim = useMemo(() => userFilter.trim(), [userFilter]);
  const enabledValue = useMemo(() => parseBoolToken(enabledFilter), [enabledFilter]);
  const activeDatasetId = fixedDatasetId ?? datasetFilter;

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (qTrim) next.set('q', qTrim); else next.delete('q');
    if (enabledValue === true) next.set('enabled', 'true');
    else if (enabledValue === false) next.set('enabled', 'false');
    else next.delete('enabled');
    if (fixedDatasetId === undefined && activeDatasetId) next.set('dataset', String(activeDatasetId));
    else if (fixedDatasetId === undefined) next.delete('dataset');
    if (mode === 'admin' && userTrim) next.set('user', userTrim); else next.delete('user');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [qTrim, enabledValue, fixedDatasetId, activeDatasetId, mode, userTrim, searchParams, setSearchParams]);

  const pagination = useKeysetPagination({
    id: embedded ? `dataset.${fixedDatasetId}.exports.list` : 'exports.list',
    filterKey: JSON.stringify({ q: qTrim, enabled: enabledValue, dataset: activeDatasetId ?? null, user: mode === 'admin' ? userTrim || null : null }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const listQ = useQuery({
    queryKey: ['exports', 'list', { limit: pagination.limit, fromId: pagination.fromId, q: qTrim, enabled: enabledValue, dataset: activeDatasetId ?? null, user: mode === 'admin' ? userTrim || null : null }],
    queryFn: async () => (await fetchExports({
      limit: pagination.limit,
      fromId: pagination.fromId,
      q: qTrim || undefined,
      enabled: enabledValue,
      dataset: activeDatasetId ?? undefined,
      user: mode === 'admin' && userTrim ? Number(userTrim) : undefined,
      includes: 'dataset,snapshot,host_ip_address,user',
    })).data,
    staleTime: 10_000,
  });

  const rows = listQ.data ?? [];
  const pageCursor = useMemo(() => cursorFromDescendingPage(rows as any), [rows]);
  const hasMore = rows.length >= pagination.limit;
  const canPaginate = pagination.stack.length > 1 || rows.length > 0;

  const selectedDatasetQ = useQuery({
    queryKey: ['datasets', 'show', createForm.datasetId, 'for_export_form'],
    enabled: createOpen && createForm.datasetId !== null,
    queryFn: async () => (await fetchDataset(createForm.datasetId as number, { includes: 'user' })).data,
    staleTime: 15_000,
  });

  const snapshotsQ = useQuery({
    queryKey: ['datasets', createForm.datasetId, 'snapshots', 'export_create'],
    enabled: createOpen && createForm.datasetId !== null,
    queryFn: async () => (await fetchDatasetSnapshots(createForm.datasetId as number, { limit: 100 })).data,
    staleTime: 15_000,
  });

  const selectedDatasetOwnerId = (() => {
    const ds: any = selectedDatasetQ.data;
    return typeof ds?.user?.id === 'number' ? Number(ds.user.id) : undefined;
  })();

  const createM = useMutation({
    mutationFn: async () => {
      if (!createForm.datasetId) throw new Error('dataset missing');
      if (!createForm.hostIpId) throw new Error('host ip missing');
      const threads = Number(createForm.threads);
      return createExport({
        dataset: createForm.sourceType === 'dataset' ? createForm.datasetId : undefined,
        snapshot: createForm.sourceType === 'snapshot' ? Number(createForm.snapshotId) : undefined,
        host_ip_address: createForm.hostIpId,
        all_vps: createForm.allVps,
        rw: createForm.rw,
        sync: createForm.sync,
        subtree_check: createForm.subtreeCheck,
        root_squash: createForm.rootSquash,
        threads: mode === 'admin' && Number.isFinite(threads) && threads > 0 ? threads : undefined,
        enabled: createForm.enabled,
      });
    },
    onMutate: () => {
      if (createForm.datasetId) chrome.acquireLocalLock(objectRef('Dataset', createForm.datasetId));
    },
    onSuccess: async (res) => {
      const asId = getMetaActionStateId((res as any).meta);
      const dsId = createForm.datasetId;
      if (asId !== undefined && dsId) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.export.create.label',
          objectLabel: `Dataset #${dsId}`,
          object: objectRef('Dataset', dsId),
        });
      }
      await qc.invalidateQueries({ queryKey: ['exports'] });
      if (dsId) await qc.invalidateQueries({ queryKey: ['datasets', 'show', dsId] });
      setCreateOpen(false);
      setCreateForm(defaultCreateForm(fixedDatasetId ?? null));
      pushToast({ variant: 'ok', title: t('exports.create.success') });
      const created: any = (res as any).data ?? res;
      const exportId = Number(created?.id);
      if (Number.isFinite(exportId) && exportId > 0) navigate(`${basePath}/exports/${exportId}`);
    },
    onError: (err: any) => {
      pushToast({ variant: 'danger', title: t('exports.create.error'), body: String(err?.message ?? err ?? '') });
    },
    onSettled: () => {
      if (createForm.datasetId) chrome.releaseLocalLock(objectRef('Dataset', createForm.datasetId));
    },
  });

  function clearFilters() {
    setQ('');
    setEnabledFilter('');
    if (fixedDatasetId === undefined) setDatasetFilter(null);
    setUserFilter('');
    setSmart('');
    setSmartErrors([]);
  }

  function applySmartText(raw: string) {
    const needle = String(raw ?? '').trim();
    if (!needle) {
      setSmart('');
      setSmartErrors([]);
      return;
    }
    if (needle === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(needle);
    const nextErrors: string[] = [];
    const freeText: string[] = [];
    let nextQ = qTrim;
    let nextEnabled = enabledFilter;
    let nextDataset = fixedDatasetId ?? datasetFilter;
    let nextUser = userTrim;

    if (tokens.length === 1) {
      const firstToken = tokens[0];
      const id = firstToken ? parseNumericToken(firstToken) : null;
      if (id !== null) {
        navigate(`${basePath}/exports/${id}`);
        setSmart('');
        setSmartErrors([]);
        return;
      }
    }

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (!kv) {
        freeText.push(unquoteSmartValue(token));
        continue;
      }
      const key = kv.rawKey.trim().toLowerCase();
      const value = unquoteSmartValue(kv.rawValue);
      if (!value) {
        nextErrors.push(t('exports.smart.error.empty_value', { key }));
        continue;
      }

      if (['q', 'search'].includes(key)) nextQ = value;
      else if (['enabled', 'active'].includes(key)) {
        const b = parseBoolToken(value);
        if (b === undefined) nextErrors.push(t('exports.smart.error.invalid_enabled', { value }));
        else nextEnabled = b ? 'true' : 'false';
      } else if (['dataset', 'ds'].includes(key)) {
        if (fixedDatasetId !== undefined) {
          nextErrors.push(t('exports.smart.error.dataset_fixed'));
        } else {
          const id = parseNumericToken(value);
          if (id === null) nextErrors.push(t('exports.smart.error.dataset_numeric', { value }));
          else nextDataset = id;
        }
      } else if (key === 'user') {
        if (mode !== 'admin') nextErrors.push(t('filters.smart.error.admin_only'));
        else {
          const id = parseNumericToken(value);
          if (id !== null) nextUser = String(id);
          else nextErrors.push(t('exports.smart.error.user_numeric', { value }));
        }
      } else if (key === 'id') {
        const id = parseNumericToken(value);
        if (id === null) nextErrors.push(t('filters.smart.error.numeric_only', { value }));
        else {
          navigate(`${basePath}/exports/${id}`);
          setSmart('');
          setSmartErrors([]);
          return;
        }
      } else {
        nextErrors.push(t('exports.smart.error.unknown_key', { key }));
      }
    }

    const free = freeText.join(' ').trim();
    if (free) nextQ = free;

    setQ(nextQ);
    setEnabledFilter(nextEnabled);
    if (fixedDatasetId === undefined) setDatasetFilter(nextDataset ?? null);
    if (mode === 'admin') setUserFilter(nextUser);
    setSmart('');
    setSmartErrors(nextErrors);
  }

  const smartNeedle = useMemo(() => smart.trim(), [smart]);
  const userSuggestNeedle = useDebouncedValue(smartNeedle, 150);
  const userSearchQ = useQuery({
    queryKey: ['users', 'search', 'exports', userSuggestNeedle],
    enabled: mode === 'admin' && !!userSuggestNeedle && !splitKeyValueToken(userSuggestNeedle) && !/^\d+$/.test(userSuggestNeedle) && userSuggestNeedle.length >= 2,
    queryFn: async () => (await searchUsers({ q: userSuggestNeedle, limit: 5 })).data,
    staleTime: 10_000,
  });

  const smartSuggestions: SmartFilterSuggestion[] = useMemo(() => {
    const s: SmartFilterSuggestion[] = [];
    if (!smartNeedle) return s;
    if (smartNeedle === '?') {
      s.push({ id: 'help', primary: t('filters.help.open'), secondary: t('exports.smart.help.hint'), onPick: () => setHelpOpen(true), testId: 'exports.smart_filter.suggest.help' });
      return s;
    }
    const numeric = parseNumericToken(smartNeedle);
    if (numeric !== null) {
      s.push({ id: 'open', primary: t('exports.smart.suggest.open', { id: String(numeric) }), secondary: t('exports.smart.suggest.open.secondary'), onPick: () => navigate(`${basePath}/exports/${numeric}`), testId: 'exports.smart_filter.suggest.open' });
      s.push({ id: 'search', primary: t('exports.smart.suggest.search', { value: String(numeric) }), secondary: t('exports.smart.suggest.search.secondary'), onPick: () => applySmartText(String(numeric)), testId: 'exports.smart_filter.suggest.search' });
      return s;
    }
    const kv = splitKeyValueToken(smartNeedle);
    if (kv) {
      s.push({ id: 'apply', primary: t('filters.smart.suggest.apply', { value: smartNeedle }), secondary: t('filters.smart.suggest.apply.secondary'), onPick: () => applySmartText(smartNeedle), testId: 'exports.smart_filter.suggest.apply' });
      return s;
    }
    s.push({ id: 'search', primary: t('exports.smart.suggest.search', { value: smartNeedle }), secondary: t('exports.smart.suggest.search.secondary'), onPick: () => applySmartText(smartNeedle), testId: 'exports.smart_filter.suggest.search' });
    if (mode === 'admin') {
      for (const u of userSearchQ.data ?? []) {
        const login = String((u as any).login ?? `#${u.id}`);
        s.push({ id: `user-${u.id}`, primary: t('exports.smart.suggest.user', { login }), secondary: `user:${u.id}`, onPick: () => applySmartText(`user:${u.id}`), testId: `exports.smart_filter.suggest.user.${u.id}` });
      }
    }
    return s;
  }, [smartNeedle, t, navigate, basePath, mode, userSearchQ.data]);

  const filtersActive = Boolean(qTrim || enabledValue !== undefined || (fixedDatasetId === undefined && activeDatasetId) || (mode === 'admin' && userTrim) || smartErrors.length);
  const copyUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}${window.location.search}` : '';

  const header = embedded ? undefined : (
    <PageHeader
      title={t('exports.page.title')}
      description={t('exports.page.description')}
      testId="exports.header"
      actions={
        <Button variant="primary" onClick={() => {
          setCreateForm(defaultCreateForm(fixedDatasetId ?? null));
          setCreateOpen(true);
        }} testId="exports.create.open">
          <Plus size={16} /> {t('exports.create.open')}
        </Button>
      }
    />
  );

  const filters = (
    <FilterBar>
      <div className="space-y-2">
        <SmartFilterInput
          ref={smartInputRef}
          value={smart}
          onChange={setSmart}
          onSubmit={() => applySmartText(smart)}
          suggestions={smartSuggestions}
          placeholder={t('exports.smart.placeholder')}
          ariaLabel={t('exports.smart.aria')}
          testId={embedded ? 'dataset.exports.smart_filter.input' : 'exports.smart_filter.input'}
          suffix={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setHelpOpen(true)} ariaLabel={t('filters.help.open')} testId={embedded ? 'dataset.exports.smart_filter.help' : 'exports.smart_filter.help'}>
                <CircleHelp size={16} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAdvancedOpen(true)} ariaLabel={t('filters.advanced')} testId={embedded ? 'dataset.exports.smart_filter.advanced' : 'exports.smart_filter.advanced'}>
                <SlidersHorizontal size={16} />
              </Button>
            </div>
          }
        />
        {(filtersActive || smartErrors.length) ? (
          <div className="flex flex-wrap items-center gap-2">
            {qTrim ? <FilterChip label={`q:${qTrim}`} onRemove={() => setQ('')} /> : null}
            {enabledValue !== undefined ? <FilterChip label={`${t('common.state')}:${enabledValue ? t('common.enabled') : t('common.disabled')}`} onRemove={() => setEnabledFilter('')} /> : null}
            {fixedDatasetId === undefined && activeDatasetId ? <FilterChip label={`${t('common.dataset')}:#${activeDatasetId}`} onRemove={() => setDatasetFilter(null)} /> : null}
            {mode === 'admin' && userTrim ? <FilterChip label={`${t('common.user')}:#${userTrim}`} onRemove={() => setUserFilter('')} /> : null}
            {smartErrors.map((e, i) => <FilterChip key={`${e}-${i}`} label={e} tone="danger" onRemove={() => setSmartErrors((prev) => prev.filter((_, idx) => idx !== i))} />)}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={copyUrl} label={t('common.copy_link')} testId={embedded ? 'dataset.exports.copy_link' : 'exports.copy_link'} />
        {filtersActive ? <Button variant="secondary" onClick={clearFilters} testId={embedded ? 'dataset.exports.filters.clear' : 'exports.filters.clear'}>{t('filters.clear')}</Button> : null}
        <Button variant="secondary" onClick={() => listQ.refetch()} testId={embedded ? 'dataset.exports.refresh' : 'exports.refresh'}>{t('common.refresh')}</Button>
        {embedded ? (
          <Button variant="primary" onClick={() => {
            setCreateForm(defaultCreateForm(fixedDatasetId ?? null));
            setCreateOpen(true);
          }} testId="dataset.exports.create.open">{t('exports.create.open')}</Button>
        ) : null}
      </div>
    </FilterBar>
  );

  if (listQ.isLoading && !rows.length) return <LoadingState testId={embedded ? 'dataset.exports.loading' : 'exports.loading'} />;
  if (listQ.isError) {
    return <ErrorState testId={embedded ? 'dataset.exports.error' : 'exports.error'} title={t('exports.page.load_error.title')} error={listQ.error} onRetry={() => void listQ.refetch()} />;
  }

  return (
    <>
      <ListShell header={header} filters={filters} testId={embedded ? 'dataset.exports.page' : 'exports.page'}>
        {rows.length === 0 ? (
          <EmptyState
            testId={embedded ? 'dataset.exports.empty' : 'exports.empty'}
            title={t('exports.empty.title')}
            body={filtersActive ? t('list.meta.filters_active') : t('exports.empty.body')}
            action={!filtersActive ? { label: t('exports.create.open'), onClick: () => setCreateOpen(true) } : undefined}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <TableCard testId={embedded ? 'dataset.exports.table' : 'exports.table'}>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-fixed text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wide text-faint">
                        <th className="w-8 px-3 py-2" />
                        <th className="w-24 px-3 py-2">{t('common.id')}</th>
                        <th className="px-3 py-2">{t('common.dataset')}</th>
                        <th className="px-3 py-2">{t('exports.field.address')}</th>
                        <th className="px-3 py-2">{t('exports.field.path')}</th>
                        <th className="w-28 px-3 py-2">{t('common.state')}</th>
                        <th className="w-28 px-3 py-2">{t('exports.field.mode')}</th>
                        <th className="w-36 px-3 py-2">{t('common.updated')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((ex) => {
                        const variant = exportRowVariant(ex);
                        const badge = exportBadge(ex, t as any);
                        return (
                          <TableRowLink
                            key={ex.id}
                            to={`${basePath}/exports/${ex.id}`}
                            variant={variant}
                            testId={`exports.row.${ex.id}`}
                            className="border-b border-border/80 hover:bg-surface-2"
                          >
                            <td className="px-3 py-2 align-top"><StatusDot variant={variant === 'warn' ? 'warn' : 'ok'} /></td>
                            <td className="px-3 py-2 align-top font-medium text-fg">#{ex.id}</td>
                            <td className="px-3 py-2 align-top text-muted">{sourceLabel(ex)}</td>
                            <td className="px-3 py-2 align-top font-mono text-xs text-fg">{exportAddress(ex)}</td>
                            <td className="px-3 py-2 align-top font-mono text-xs text-fg">{String(ex.path ?? '—')}</td>
                            <td className="px-3 py-2 align-top"><Badge variant={badge.variant}>{badge.label}</Badge></td>
                            <td className="px-3 py-2 align-top text-muted">{ex.rw ? t('exports.mode.rw') : t('exports.mode.ro')}</td>
                            <td className="px-3 py-2 align-top text-muted">{ex.updated_at ? formatDateTime(ex.updated_at) : '—'}</td>
                          </TableRowLink>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </TableCard>
            </div>

            <div className="space-y-3 md:hidden">
              {rows.map((ex) => {
                const variant = exportRowVariant(ex);
                const badge = exportBadge(ex, t as any);
                return (
                  <TableCard key={ex.id} testId={`exports.card.${ex.id}`} className={clsx(variant === 'warn' ? 'bg-warn-row border-warn-border' : undefined)}>
                    <Link to={`${basePath}/exports/${ex.id}`} className="block p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <StatusDot variant={variant === 'warn' ? 'warn' : 'ok'} />
                            <div className="font-medium text-fg">#{ex.id}</div>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                          </div>
                          <div className="mt-1 text-sm text-muted">{sourceLabel(ex)}</div>
                          <div className="mt-2 font-mono text-xs text-fg">{exportAddress(ex)}:{String(ex.path ?? '')}</div>
                        </div>
                      </div>
                    </Link>
                  </TableCard>
                );
              })}
            </div>

            {canPaginate ? (
              <KeysetPagination
                page={pagination.page}
                pageCount={pagination.page + (hasMore ? 1 : 0)}
                limit={pagination.limit}
                allowedLimits={pagination.allowedLimits}
                onLimitChange={pagination.setLimit}
                onPrev={() => pagination.goPrev()}
                onNext={() => pagination.goNext(pageCursor)}
                onGoToPage={pagination.goToPage}
                canPrev={pagination.canPrev}
                canNext={hasMore}
                testId={embedded ? 'dataset.exports.pagination' : 'exports.pagination'}
              />
            ) : null}
          </>
        )}
      </ListShell>

      <SmartInputHelp
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t('exports.smart.help.title')}
        intro={t('exports.smart.help.intro')}
        examples={[
          { example: 'tank/vps', description: t('exports.smart.help.example_search') },
          { example: 'enabled:false', description: t('exports.smart.help.example_enabled') },
          { example: 'dataset:123', description: t('exports.smart.help.example_dataset') },
          { example: '#42', description: t('exports.smart.help.example_open') },
        ]}
        topKeys={[
          { key: 'q', description: t('exports.smart.help.key.q') },
          { key: 'enabled', description: t('exports.smart.help.key.enabled') },
          { key: 'dataset', description: t('exports.smart.help.key.dataset') },
          ...(mode === 'admin' ? [{ key: 'user', description: t('exports.smart.help.key.user') }] : []),
          { key: 'id', description: t('exports.smart.help.key.id') },
        ]}
        inference={[
          t('exports.smart.help.inference.1'),
          t('exports.smart.help.inference.2'),
        ]}
        onInsertKey={(key) => {
          setHelpOpen(false);
          const suffix = `${key}:`;
          setSmart((prev) => (prev ? `${prev} ${suffix}` : suffix));
          window.setTimeout(() => smartInputRef.current?.focus(), 0);
        }}
      />

      <Drawer open={advancedOpen} onClose={() => setAdvancedOpen(false)} title={t('filters.advanced')} width="lg" testId={embedded ? 'dataset.exports.advanced' : 'exports.advanced'}>
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-sm font-medium text-fg">{t('filters.search')}</div>
            <Input value={q} onChange={(e) => setQ(e.target.value)} testId={embedded ? 'dataset.exports.filter.q' : 'exports.filter.q'} ariaLabel={t('filters.search')} />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-fg">{t('common.state')}</div>
            <Select value={enabledFilter} onChange={(e) => setEnabledFilter(e.target.value)} testId={embedded ? 'dataset.exports.filter.enabled' : 'exports.filter.enabled'} ariaLabel={t('common.state')}>
            <option value="">{t('common.all')}</option>
            <option value="true">{t('common.enabled')}</option>
            <option value="false">{t('common.disabled')}</option>
          </Select>
          </div>
          {fixedDatasetId === undefined ? (
            <div>
              <div className="mb-1 text-sm font-medium text-fg">{t('common.dataset')}</div>
              <DatasetLookupInput value={datasetFilter} onChange={setDatasetFilter} testId={embedded ? 'dataset.exports.filter.dataset' : 'exports.filter.dataset'} ariaLabel={t('common.dataset')} placeholder={t('exports.form.dataset.placeholder')} />
            </div>
          ) : null}
          {mode === 'admin' ? (
            <div>
              <div className="mb-1 text-sm font-medium text-fg">{t('common.user')}</div>
              <Input value={userFilter} onChange={(e) => setUserFilter(e.target.value)} testId={embedded ? 'dataset.exports.filter.user' : 'exports.filter.user'} ariaLabel={t('common.user')} />
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={clearFilters}>{t('filters.clear')}</Button>
            <Button variant="primary" onClick={() => setAdvancedOpen(false)}>{t('common.done')}</Button>
          </div>
        </div>
      </Drawer>

      <Drawer open={createOpen} onClose={() => setCreateOpen(false)} title={t('exports.create.title')} width="lg" testId={embedded ? 'dataset.exports.create' : 'exports.create'}>
        <div className="space-y-4">
          {fixedDatasetId === undefined ? (
            <div>
              <div className="mb-1 text-sm font-medium text-fg">{t('common.dataset')}</div>
              <DatasetLookupInput value={createForm.datasetId} onChange={(v) => setCreateForm((prev) => ({ ...prev, datasetId: v, snapshotId: '' }))} testId="exports.create.dataset" ariaLabel={t('common.dataset')} placeholder={t('exports.form.dataset.placeholder')} />
            </div>
          ) : (
            <Card><CardBody><div className="text-sm text-muted">{selectedDatasetQ.data ? sourceLabel({ dataset: selectedDatasetQ.data } as any) : `#${fixedDatasetId}`}</div></CardBody></Card>
          )}

          <div>
            <div className="mb-1 text-sm font-medium text-fg">{t('exports.form.source')}</div>
            <Select value={createForm.sourceType} onChange={(e) => setCreateForm((prev) => ({ ...prev, sourceType: e.target.value as 'dataset' | 'snapshot', snapshotId: '' }))} ariaLabel={t('exports.form.source')}>
              <option value="dataset">{t('exports.form.source.dataset')}</option>
              <option value="snapshot">{t('exports.form.source.snapshot')}</option>
            </Select>
          </div>

          {createForm.sourceType === 'snapshot' ? (
            <div>
              <div className="mb-1 text-sm font-medium text-fg">{t('common.snapshot')}</div>
              <Select value={createForm.snapshotId} onChange={(e) => setCreateForm((prev) => ({ ...prev, snapshotId: e.target.value }))} disabled={!createForm.datasetId} ariaLabel={t('common.snapshot')}>
                <option value="">{t('exports.form.snapshot.placeholder')}</option>
                {(snapshotsQ.data ?? []).map((s: any) => (
                  <option key={s.id} value={String(s.id)}>{String(s.label ?? s.name ?? `#${s.id}`)}</option>
                ))}
              </Select>
            </div>
          ) : null}

          <div>
            <div className="mb-1 text-sm font-medium text-fg">{t('exports.field.address')}</div>
            <HostIpLookupInput value={createForm.hostIpId} onChange={(v) => setCreateForm((prev) => ({ ...prev, hostIpId: v }))} userId={selectedDatasetOwnerId} testId="exports.create.host_ip" ariaLabel={t('exports.field.address')} placeholder={t('exports.form.address.placeholder')} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox checked={createForm.allVps} onChange={(v) => setCreateForm((prev) => ({ ...prev, allVps: v }))} label={t('exports.field.all_vps')} />
            <Checkbox checked={createForm.enabled} onChange={(v) => setCreateForm((prev) => ({ ...prev, enabled: v }))} label={t('common.enabled')} />
            <Checkbox checked={createForm.rw} onChange={(v) => setCreateForm((prev) => ({ ...prev, rw: v }))} label={t('exports.field.rw')} />
            <Checkbox checked={createForm.sync} onChange={(v) => setCreateForm((prev) => ({ ...prev, sync: v }))} label={t('exports.field.sync')} />
            <Checkbox checked={createForm.subtreeCheck} onChange={(v) => setCreateForm((prev) => ({ ...prev, subtreeCheck: v }))} label={t('exports.field.subtree_check')} />
            <Checkbox checked={createForm.rootSquash} onChange={(v) => setCreateForm((prev) => ({ ...prev, rootSquash: v }))} label={t('exports.field.root_squash')} />
          </div>

          {mode === 'admin' ? (
            <div>
              <div className="mb-1 text-sm font-medium text-fg">{t('exports.field.threads')}</div>
              <Input value={createForm.threads} onChange={(e) => setCreateForm((prev) => ({ ...prev, threads: e.target.value }))} ariaLabel={t('exports.field.threads')} />
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              disabled={!createForm.datasetId || !createForm.hostIpId || (createForm.sourceType === 'snapshot' && !createForm.snapshotId) || createM.isPending}
              onClick={() => createM.mutate()}
              testId="exports.create.submit"
            >
              {createM.isPending ? t('common.working') : t('exports.create.submit')}
            </Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}

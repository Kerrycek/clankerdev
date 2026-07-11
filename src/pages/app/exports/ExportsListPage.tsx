import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CircleHelp, Plus, SlidersHorizontal } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useObjectScope } from '../../../app/objectScope';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';
import { useChrome } from '../../../components/layout/ChromeContext';
import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import { FilterBar } from '../../../components/layout/FilterBar';
import { Button } from '../../../components/ui/Button';
import { CopyButton } from '../../../components/ui/CopyButton';
import { DatasetLookupInput } from '../../../components/ui/DatasetLookupInput';
import { Drawer } from '../../../components/ui/Drawer';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FilterChip } from '../../../components/ui/FilterChip';
import { Input } from '../../../components/ui/Input';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Select } from '../../../components/ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../components/ui/SmartInputHelp';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { createExport, fetchExports } from '../../../lib/api/exports';
import { fetchDataset, fetchDatasetSnapshots } from '../../../lib/api/datasets';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';
import { cursorFromDescendingPage } from '../../../lib/lockIndex';
import { objectRef } from '../../../lib/objectRef';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../../lib/smartFilter';
import { searchUsers } from '../../../lib/api/users';
import { useDebouncedValue } from '../../../lib/hooks/useDebouncedValue';
import { ExportCreateDrawer } from './ExportCreateDrawer';
import { ExportsListResults } from './ExportsListResults';
import {
  buildCreateExportPayload,
  defaultCreateForm,
  parseBoolToken,
  parsePositiveInt,
  type CreateExportFormState,
} from './ExportModel';

export function ExportsListPage(props?: { fixedDatasetId?: number; embedded?: boolean }) {
  const fixedDatasetId = props?.fixedDatasetId;
  const embedded = props?.embedded ?? false;
  const { basePath, mode } = useAppMode();
  const scope = useObjectScope();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pushToast } = useToasts();
  const qc = useQueryClient();
  const chrome = useChrome();

  const [searchParams, setSearchParams] = useSearchParams();
  const smartInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = mode === 'admin';

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [enabledFilter, setEnabledFilter] = useState(() => searchParams.get('enabled') ?? '');
  const [datasetFilter, setDatasetFilter] = useState<number | null>(() => fixedDatasetId ?? parseNumericToken(searchParams.get('dataset') ?? ''));
  const [userFilter, setUserFilter] = useState(() => searchParams.get('user') ?? '');
  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateExportFormState>(() => defaultCreateForm(fixedDatasetId ?? null));

  const qTrim = useMemo(() => q.trim(), [q]);
  const userTrim = useMemo(() => userFilter.trim(), [userFilter]);
  const enabledValue = useMemo(() => parseBoolToken(enabledFilter), [enabledFilter]);
  const activeDatasetId = fixedDatasetId ?? datasetFilter;
  const adminUserId = useMemo(() => parsePositiveInt(userTrim), [userTrim]);
  const effectiveUserId = isAdmin ? adminUserId ?? undefined : scope.mineUserId;

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (qTrim) next.set('q', qTrim); else next.delete('q');
    if (enabledValue === true) next.set('enabled', 'true');
    else if (enabledValue === false) next.set('enabled', 'false');
    else next.delete('enabled');
    if (fixedDatasetId === undefined && activeDatasetId) next.set('dataset', String(activeDatasetId));
    else if (fixedDatasetId === undefined) next.delete('dataset');
    if (isAdmin && userTrim) next.set('user', userTrim); else next.delete('user');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [qTrim, enabledValue, fixedDatasetId, activeDatasetId, isAdmin, userTrim, searchParams, setSearchParams]);

  const pagination = useKeysetPagination({
    id: embedded ? `dataset.${fixedDatasetId}.exports.list` : 'exports.list',
    filterKey: JSON.stringify({
      q: qTrim,
      enabled: enabledValue,
      dataset: activeDatasetId ?? null,
      user: effectiveUserId ?? null,
      scope: scope.scope,
    }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const listQ = useQuery({
    queryKey: ['exports', 'list', {
      limit: pagination.limit,
      fromId: pagination.fromId,
      q: qTrim,
      enabled: enabledValue,
      dataset: activeDatasetId ?? null,
      user: effectiveUserId ?? null,
      scope: scope.scope,
    }],
    queryFn: async () => (await fetchExports({
      limit: pagination.limit,
      fromId: pagination.fromId,
      q: qTrim || undefined,
      enabled: enabledValue,
      dataset: activeDatasetId ?? undefined,
      user: effectiveUserId,
      includes: 'dataset,snapshot,host_ip_address,user',
    })).data,
    staleTime: 10_000,
  });

  const rows = listQ.data ?? [];
  const pageCursor = useMemo(() => cursorFromDescendingPage(rows), [rows]);
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

  const selectedDatasetOwnerId = parsePositiveInt(selectedDatasetQ.data?.user?.id) ?? undefined;

  const createM = useMutation({
    mutationFn: async () => {
      return createExport(buildCreateExportPayload(createForm, isAdmin));
    },
    onMutate: () => {
      if (createForm.datasetId) chrome.acquireLocalLock(objectRef('Dataset', createForm.datasetId));
    },
    onSuccess: async (res) => {
      const asId = getMetaActionStateId(res.meta);
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
      const exportId = parsePositiveInt(res.data?.id);
      if (exportId) navigate(`${basePath}/exports/${exportId}`);
    },
    onError: (err: unknown) => {
      pushToast({ variant: 'danger', title: t('exports.create.error'), body: err instanceof Error ? err.message : String(err) });
    },
    onSettled: () => {
      if (createForm.datasetId) chrome.releaseLocalLock(objectRef('Dataset', createForm.datasetId));
    },
  });

  function openCreateDrawer() {
    setCreateForm(defaultCreateForm(fixedDatasetId ?? null));
    setCreateOpen(true);
  }

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
        if (!isAdmin) nextErrors.push(t('filters.smart.error.admin_only'));
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
    if (isAdmin) setUserFilter(nextUser);
    setSmart('');
    setSmartErrors(nextErrors);
  }

  const smartNeedle = useMemo(() => smart.trim(), [smart]);
  const userSuggestNeedle = useDebouncedValue(smartNeedle, 150);
  const userSearchQ = useQuery({
    queryKey: ['users', 'search', 'exports', userSuggestNeedle],
    enabled: isAdmin && !!userSuggestNeedle && !splitKeyValueToken(userSuggestNeedle) && !/^\d+$/.test(userSuggestNeedle) && userSuggestNeedle.length >= 2,
    queryFn: async () => (await searchUsers({ q: userSuggestNeedle, limit: 5 })).data,
    staleTime: 10_000,
  });

  const smartSuggestions: SmartFilterSuggestion[] = useMemo(() => {
    const suggestions: SmartFilterSuggestion[] = [];
    if (!smartNeedle) return suggestions;
    if (smartNeedle === '?') {
      suggestions.push({ id: 'help', primary: t('filters.help.open'), secondary: t('exports.smart.help.hint'), onPick: () => setHelpOpen(true), testId: 'exports.smart_filter.suggest.help' });
      return suggestions;
    }
    const numeric = parseNumericToken(smartNeedle);
    if (numeric !== null) {
      suggestions.push({ id: 'open', primary: t('exports.smart.suggest.open', { id: String(numeric) }), secondary: t('exports.smart.suggest.open.secondary'), onPick: () => navigate(`${basePath}/exports/${numeric}`), testId: 'exports.smart_filter.suggest.open' });
      suggestions.push({ id: 'search', primary: t('exports.smart.suggest.search', { value: String(numeric) }), secondary: t('exports.smart.suggest.search.secondary'), onPick: () => applySmartText(String(numeric)), testId: 'exports.smart_filter.suggest.search' });
      return suggestions;
    }
    const kv = splitKeyValueToken(smartNeedle);
    if (kv) {
      suggestions.push({ id: 'apply', primary: t('filters.smart.suggest.apply', { value: smartNeedle }), secondary: t('filters.smart.suggest.apply.secondary'), onPick: () => applySmartText(smartNeedle), testId: 'exports.smart_filter.suggest.apply' });
      return suggestions;
    }
    suggestions.push({ id: 'search', primary: t('exports.smart.suggest.search', { value: smartNeedle }), secondary: t('exports.smart.suggest.search.secondary'), onPick: () => applySmartText(smartNeedle), testId: 'exports.smart_filter.suggest.search' });
    if (isAdmin) {
      for (const user of userSearchQ.data ?? []) {
        const login = String(user.login ?? `#${user.id}`);
        suggestions.push({ id: `user-${user.id}`, primary: t('exports.smart.suggest.user', { login }), secondary: `user:${user.id}`, onPick: () => applySmartText(`user:${user.id}`), testId: `exports.smart_filter.suggest.user.${user.id}` });
      }
    }
    return suggestions;
  }, [smartNeedle, t, navigate, basePath, isAdmin, userSearchQ.data]);

  const filtersActive = Boolean(qTrim || enabledValue !== undefined || (fixedDatasetId === undefined && activeDatasetId) || (isAdmin && userTrim) || smartErrors.length);
  const copyUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}${window.location.search}` : '';
  const prefix = embedded ? 'dataset.exports' : 'exports';

  const header = embedded ? undefined : (
    <PageHeader
      title={t('exports.page.title')}
      description={t('exports.page.description')}
      testId="exports.header"
      actions={
        <Button variant="primary" onClick={openCreateDrawer} testId="exports.create.open">
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
          testId={`${prefix}.smart_filter.input`}
          suffix={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setHelpOpen(true)} ariaLabel={t('filters.help.open')} testId={`${prefix}.smart_filter.help`}>
                <CircleHelp size={16} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAdvancedOpen(true)} ariaLabel={t('filters.advanced')} testId={`${prefix}.smart_filter.advanced`}>
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
            {isAdmin && userTrim ? <FilterChip label={`${t('common.user')}:#${userTrim}`} onRemove={() => setUserFilter('')} /> : null}
            {smartErrors.map((e, i) => <FilterChip key={`${e}-${i}`} label={e} tone="danger" onRemove={() => setSmartErrors((prev) => prev.filter((_, idx) => idx !== i))} />)}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={copyUrl} label={t('common.copy_link')} testId={`${prefix}.copy_link`} />
        {filtersActive ? <Button variant="secondary" onClick={clearFilters} testId={`${prefix}.filters.clear`}>{t('filters.clear')}</Button> : null}
        <Button variant="secondary" onClick={() => listQ.refetch()} testId={`${prefix}.refresh`}>{t('common.refresh')}</Button>
        {embedded ? <Button variant="primary" onClick={openCreateDrawer} testId="dataset.exports.create.open">{t('exports.create.open')}</Button> : null}
      </div>
    </FilterBar>
  );

  if (listQ.isLoading && !rows.length) return <LoadingState testId={`${prefix}.loading`} />;
  if (listQ.isError) {
    return <ErrorState testId={`${prefix}.error`} title={t('exports.page.load_error.title')} error={listQ.error} onRetry={() => void listQ.refetch()} />;
  }

  return (
    <>
      <ListShell header={header} filters={filters} testId={`${prefix}.page`}>
        {rows.length === 0 ? (
          <EmptyState
            testId={`${prefix}.empty`}
            title={t('exports.empty.title')}
            body={filtersActive ? t('list.meta.filters_active') : t('exports.empty.body')}
            action={!filtersActive ? { label: t('exports.create.open'), onClick: openCreateDrawer } : undefined}
          />
        ) : (
          <ExportsListResults
            rows={rows}
            basePath={basePath}
            embedded={embedded}
            canPaginate={canPaginate}
            pagination={{
              page: pagination.page,
              pageCount: pagination.page + (hasMore ? 1 : 0),
              limit: pagination.limit,
              allowedLimits: pagination.allowedLimits,
              onLimitChange: pagination.setLimit,
              onPrev: pagination.goPrev,
              onNext: () => pagination.goNext(pageCursor),
              onGoToPage: pagination.goToPage,
              canPrev: pagination.canPrev,
              canNext: hasMore,
            }}
          />
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
          ...(isAdmin ? [{ key: 'user', description: t('exports.smart.help.key.user') }] : []),
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

      <Drawer open={advancedOpen} onClose={() => setAdvancedOpen(false)} title={t('filters.advanced')} width="lg" testId={`${prefix}.advanced`}>
        <div className="space-y-4">
          <div>
            <div className="mb-1 text-sm font-medium text-fg">{t('filters.search')}</div>
            <Input value={q} onChange={(e) => setQ(e.target.value)} testId={`${prefix}.filter.q`} ariaLabel={t('filters.search')} />
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-fg">{t('common.state')}</div>
            <Select value={enabledFilter} onChange={(e) => setEnabledFilter(e.target.value)} testId={`${prefix}.filter.enabled`} ariaLabel={t('common.state')}>
              <option value="">{t('common.all')}</option>
              <option value="true">{t('common.enabled')}</option>
              <option value="false">{t('common.disabled')}</option>
            </Select>
          </div>
          {fixedDatasetId === undefined ? (
            <div>
              <div className="mb-1 text-sm font-medium text-fg">{t('common.dataset')}</div>
              <DatasetLookupInput value={datasetFilter} onChange={setDatasetFilter} testId={`${prefix}.filter.dataset`} ariaLabel={t('common.dataset')} placeholder={t('exports.form.dataset.placeholder')} />
            </div>
          ) : null}
          {isAdmin ? (
            <div>
              <div className="mb-1 text-sm font-medium text-fg">{t('common.user')}</div>
              <Input value={userFilter} onChange={(e) => setUserFilter(e.target.value)} testId={`${prefix}.filter.user`} ariaLabel={t('common.user')} />
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={clearFilters}>{t('filters.clear')}</Button>
            <Button variant="primary" onClick={() => setAdvancedOpen(false)}>{t('common.done')}</Button>
          </div>
        </div>
      </Drawer>

      <ExportCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        embedded={embedded}
        fixedDatasetId={fixedDatasetId}
        form={createForm}
        onFormChange={setCreateForm}
        selectedDataset={selectedDatasetQ.data}
        snapshots={snapshotsQ.data ?? []}
        selectedDatasetOwnerId={selectedDatasetOwnerId}
        isAdmin={isAdmin}
        pending={createM.isPending}
        onSubmit={() => createM.mutate()}
      />
    </>
  );
}

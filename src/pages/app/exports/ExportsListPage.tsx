import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CircleHelp, Plus, SlidersHorizontal } from 'lucide-react';

import { useAppMode } from '../../../app/appMode';
import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import { useObjectScope } from '../../../app/objectScope';
import { FilterBar } from '../../../components/layout/FilterBar';
import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Drawer } from '../../../components/ui/Drawer';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FilterChip } from '../../../components/ui/FilterChip';
import { LoadingState } from '../../../components/ui/LoadingState';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../components/ui/SmartInputHelp';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';
import { fetchExports } from '../../../lib/api/exports';
import { searchUsers } from '../../../lib/api/users';
import { useDebouncedValue } from '../../../lib/hooks/useDebouncedValue';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';
import { cursorFromAscendingPage } from '../../../lib/lockIndex';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../../lib/smartFilter';

import { ExportCreateDialog } from './ExportCreateDialog';
import { ExportsListResults } from './ExportsListResults';
import {
  canonicalExportSmartKey,
  normalizeExportListSearchParams,
  parseExportListUserId,
} from './exportsListSemantics';

export function ExportsListPage() {
  const { basePath, mode } = useAppMode();
  const auth = useAuth();
  const scope = useObjectScope();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const isGlobalAdminView = mode === 'admin' && auth.role === 'admin';

  const normalizedSearch = useMemo(
    () => normalizeExportListSearchParams(new URLSearchParams(searchParamsKey), isGlobalAdminView),
    [isGlobalAdminView, searchParamsKey]
  );
  const activeSearchParamsKey = normalizedSearch.searchParams.toString();
  const activeSearchParams = useMemo(() => new URLSearchParams(activeSearchParamsKey), [activeSearchParamsKey]);
  const hydratingFiltersFromUrlRef = useRef(false);
  const smartInputRef = useRef<HTMLInputElement | null>(null);

  const [userFilter, setUserFilter] = useState(() => activeSearchParams.get('user') ?? '');
  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  useLayoutEffect(() => {
    if (!normalizedSearch.changed) return;
    setSearchParams(activeSearchParams, { replace: true });
  }, [activeSearchParams, normalizedSearch.changed, setSearchParams]);

  useLayoutEffect(() => {
    hydratingFiltersFromUrlRef.current = true;
    const current = new URLSearchParams(activeSearchParamsKey);
    setUserFilter(current.get('user') ?? '');
  }, [activeSearchParamsKey]);

  const userTrim = userFilter.trim();
  const draftAdminUserId = useMemo(() => parseExportListUserId(userTrim), [userTrim]);
  const activeAdminUserId = useMemo(
    () => (isGlobalAdminView ? parseExportListUserId(activeSearchParams.get('user')) : null),
    [activeSearchParams, isGlobalAdminView]
  );
  const effectiveUserId =
    auth.role === 'admin'
      ? isGlobalAdminView
        ? activeAdminUserId ?? undefined
        : scope.mineUserId
      : undefined;

  useEffect(() => {
    if (hydratingFiltersFromUrlRef.current) {
      hydratingFiltersFromUrlRef.current = false;
      return;
    }

    const next = new URLSearchParams(activeSearchParams);
    const ownerChanged = (isGlobalAdminView ? draftAdminUserId : null) !== activeAdminUserId;
    if (isGlobalAdminView && draftAdminUserId) next.set('user', String(draftAdminUserId));
    else next.delete('user');
    if (ownerChanged) {
      next.delete('from_id');
      next.set('page', '1');
    }
    if (next.toString() !== searchParamsKey) setSearchParams(next, { replace: true });
  }, [activeAdminUserId, activeSearchParams, draftAdminUserId, isGlobalAdminView, searchParamsKey, setSearchParams]);

  useEffect(() => {
    if (smart.trim() === '?') setHelpOpen(true);
  }, [smart]);

  const pagination = useKeysetPagination({
    id: 'exports.list',
    filterKey: JSON.stringify({ user: effectiveUserId ?? null, scope: basePath }),
    searchParams: activeSearchParams,
    setSearchParams,
    restoreUrlCursorOnSignatureChange: true,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const listQ = useQuery({
    queryKey: ['exports', 'list', {
      limit: pagination.limit,
      fromId: pagination.fromId,
      user: effectiveUserId ?? null,
      scope: basePath,
    }],
    queryFn: async () => (
      await fetchExports({
        limit: pagination.limit,
        fromId: pagination.fromId,
        user: effectiveUserId,
        includes: isGlobalAdminView
          ? 'dataset,snapshot,host_ip_address,user'
          : 'dataset,snapshot,host_ip_address',
      })
    ).data,
    enabled: !normalizedSearch.changed,
    staleTime: 10_000,
  });

  const rows = listQ.data ?? [];
  const pageCursor = useMemo(() => cursorFromAscendingPage(rows), [rows]);
  const hasMore = rows.length >= pagination.limit;
  const canPaginate = pagination.stack.length > 1 || rows.length > 0;
  const smartNeedle = smart.trim();
  const userSuggestNeedle = useDebouncedValue(smartNeedle, 150);

  const userSearchQ = useQuery({
    queryKey: ['users', 'search', 'exports', userSuggestNeedle],
    enabled:
      isGlobalAdminView &&
      !!userSuggestNeedle &&
      !splitKeyValueToken(userSuggestNeedle) &&
      !/^#?\d+$/.test(userSuggestNeedle) &&
      userSuggestNeedle.length >= 2,
    queryFn: async () => (await searchUsers({ q: userSuggestNeedle, limit: 5 })).data,
    staleTime: 10_000,
  });

  function clearFilters() {
    setUserFilter('');
    setSmart('');
    setSmartErrors([]);
  }

  function openExport(id: number) {
    navigate(`${basePath}/exports/${id}`);
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
    if (tokens.length === 1) {
      const id = parseNumericToken(tokens[0] ?? '');
      if (id !== null) {
        openExport(id);
        setSmart('');
        setSmartErrors([]);
        return;
      }
    }

    let nextUser = userTrim;
    const errors: string[] = [];
    let exportId: number | null = null;

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (!kv) {
        errors.push(t('exports.smart.error.unsupported_text'));
        continue;
      }

      const rawKey = kv.rawKey.trim().toLowerCase();
      const key = canonicalExportSmartKey(rawKey);
      const value = unquoteSmartValue(kv.rawValue);
      if (!value) {
        errors.push(t('exports.smart.error.empty_value', { key: rawKey }));
        continue;
      }

      if (key === 'id') {
        const id = parseNumericToken(value);
        if (id === null) errors.push(t('filters.smart.error.numeric_only', { value }));
        else exportId = id;
      } else if (key === 'user') {
        if (!isGlobalAdminView) errors.push(t('filters.smart.error.admin_only'));
        else {
          const id = parseNumericToken(value);
          if (id === null) errors.push(t('exports.smart.error.user_numeric', { value }));
          else nextUser = String(id);
        }
      } else if (key === 'unsupported') {
        errors.push(t('exports.smart.error.unsupported_filter', { key: rawKey }));
      } else {
        errors.push(t('exports.smart.error.unknown_key', { key: rawKey }));
      }
    }

    setSmart('');
    if (errors.length > 0) {
      setSmartErrors(errors);
      return;
    }

    if (exportId !== null) {
      openExport(exportId);
      setSmartErrors([]);
      return;
    }
    if (isGlobalAdminView) setUserFilter(nextUser);
    setSmartErrors([]);
  }

  const smartSuggestions: SmartFilterSuggestion[] = [];
  if (smartNeedle === '?') {
    smartSuggestions.push({
      id: 'help',
      primary: t('filters.help.open'),
      secondary: t('exports.smart.help.hint'),
      onPick: () => setHelpOpen(true),
      testId: 'exports.smart_filter.suggest.help',
    });
  } else if (smartNeedle) {
    const numeric = parseNumericToken(smartNeedle);
    if (numeric !== null) {
      smartSuggestions.push({
        id: 'open',
        primary: t('exports.smart.suggest.open', { id: String(numeric) }),
        secondary: t('exports.smart.suggest.open.secondary'),
        onPick: () => openExport(numeric),
        testId: 'exports.smart_filter.suggest.open',
      });
    } else if (splitKeyValueToken(smartNeedle)) {
      smartSuggestions.push({
        id: 'apply',
        primary: t('filters.smart.suggest.apply', { value: smartNeedle }),
        secondary: t('filters.smart.suggest.apply.secondary'),
        onPick: () => applySmartText(smartNeedle),
        testId: 'exports.smart_filter.suggest.apply',
      });
    } else {
      smartSuggestions.push({
        id: 'unsupported',
        primary: t('exports.smart.suggest.unsupported'),
        secondary: t('exports.smart.suggest.unsupported.secondary'),
        onPick: () => applySmartText(smartNeedle),
        testId: 'exports.smart_filter.suggest.unsupported',
      });

      if (isGlobalAdminView) {
        for (const user of userSearchQ.data ?? []) {
          const login = String(user.login ?? `#${user.id}`);
          smartSuggestions.push({
            id: `user-${user.id}`,
            primary: t('exports.smart.suggest.user', { id: String(user.id), login }),
            secondary: `user:${user.id}`,
            onPick: () => applySmartText(`user:${user.id}`),
            testId: `exports.smart_filter.suggest.user.${user.id}`,
          });
        }
      }
    }
  }

  const filtersActive = Boolean((isGlobalAdminView && activeAdminUserId) || smartErrors.length);
  const copyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}${window.location.search}`
    : '';

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
          testId="exports.smart_filter.input"
          suffix={
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setHelpOpen(true)}
                ariaLabel={t('filters.help.open')}
                testId="exports.smart_filter.help"
              >
                <CircleHelp size={16} />
              </Button>
              {isGlobalAdminView ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdvancedOpen(true)}
                  ariaLabel={t('filters.advanced')}
                  testId="exports.smart_filter.advanced"
                >
                  <SlidersHorizontal size={16} />
                </Button>
              ) : null}
            </div>
          }
        />
        {filtersActive ? (
          <div className="flex flex-wrap items-center gap-2">
            {isGlobalAdminView && activeAdminUserId ? (
              <FilterChip
                label={`${t('common.user')}:#${activeAdminUserId}`}
                onRemove={() => setUserFilter('')}
                testId="exports.chip.user"
              />
            ) : null}
            {smartErrors.map((error, index) => (
              <FilterChip
                key={`${error}-${index}`}
                label={error}
                tone="danger"
                onRemove={() => setSmartErrors((previous) => previous.filter((_, i) => i !== index))}
                testId={`exports.chip.err.${index}`}
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={copyUrl} label={t('common.copy_link')} testId="exports.copy_link" />
        {filtersActive ? (
          <Button variant="secondary" onClick={clearFilters} testId="exports.filters.clear">
            {t('filters.clear')}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => listQ.refetch()} testId="exports.refresh">
          {t('common.refresh')}
        </Button>
      </div>
    </FilterBar>
  );

  if (listQ.isLoading && !rows.length) return <LoadingState testId="exports.loading" />;
  if (listQ.isError) {
    return (
      <ErrorState
        testId="exports.error"
        title={t('exports.page.load_error.title')}
        error={listQ.error}
        onRetry={() => void listQ.refetch()}
      />
    );
  }

  return (
    <>
      <ListShell
        header={
          <PageHeader
            title={t('exports.page.title')}
            description={t('exports.page.description')}
            testId="exports.header"
            actions={
              <Button variant="primary" onClick={() => setCreateOpen(true)} testId="exports.create.open">
                <Plus size={16} /> {t('exports.create.open')}
              </Button>
            }
          />
        }
        filters={filters}
        testId="exports.page"
      >
        {rows.length === 0 ? (
          <EmptyState
            testId="exports.empty"
            title={t('exports.empty.title')}
            body={filtersActive ? t('list.meta.filters_active') : t('exports.empty.body')}
            action={!filtersActive ? { label: t('exports.create.open'), onClick: () => setCreateOpen(true) } : undefined}
          />
        ) : (
          <ExportsListResults
            rows={rows}
            basePath={basePath}
            embedded={false}
            showUser={isGlobalAdminView}
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
          { example: '#42', description: t('exports.smart.help.example_open') },
          ...(isGlobalAdminView
            ? [{ example: 'user:123', description: t('exports.smart.help.example_user') }]
            : []),
        ]}
        topKeys={[
          ...(isGlobalAdminView ? [{ key: 'user', description: t('exports.smart.help.key.user') }] : []),
          { key: 'id', description: t('exports.smart.help.key.id') },
        ]}
        inference={[t('exports.smart.help.inference.1'), t('exports.smart.help.inference.2')]}
        onInsertKey={(key) => {
          setHelpOpen(false);
          const suffix = `${key}:`;
          setSmart((previous) => (previous ? `${previous} ${suffix}` : suffix));
          window.setTimeout(() => smartInputRef.current?.focus(), 0);
        }}
      />

      {isGlobalAdminView ? (
        <Drawer
          open={advancedOpen}
          onClose={() => setAdvancedOpen(false)}
          title={t('filters.advanced')}
          width="lg"
          testId="exports.advanced"
        >
          <div className="space-y-4">
            <UserLookupInput
              value={userFilter}
              onChange={setUserFilter}
              testId="exports.filter.user"
              ariaLabel={t('common.user')}
              label={t('common.user')}
              allowRawId
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={clearFilters}>{t('filters.clear')}</Button>
              <Button variant="primary" onClick={() => setAdvancedOpen(false)}>{t('common.done')}</Button>
            </div>
          </div>
        </Drawer>
      ) : null}

      <ExportCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

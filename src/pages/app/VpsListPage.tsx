import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

import { fetchActiveTransactionChains, fetchTransactionChains } from '../../lib/api/transactions';
import { fetchNodes } from '../../lib/api/nodes';
import { fetchVpsList, vpsRestart, vpsStart, vpsStop } from '../../lib/api/vps';
import { searchUsers } from '../../lib/api/users';
import { getMetaActionStateId } from '../../lib/api/haveapi';
import { useDebouncedValue } from '../../lib/hooks/useDebouncedValue';
import { useAppMode } from '../../app/appMode';
import { useObjectScope } from '../../app/objectScope';
import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';
import { useChrome } from '../../components/layout/ChromeContext';
import { ListShell } from '../../components/layout/ListShell';
import { SyncStaleBanner } from '../../components/layout/SyncStaleBanner';
import { PageHeader } from '../../components/layout/PageHeader';
import { objectRef } from '../../lib/objectRef';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Checkbox } from '../../components/ui/Checkbox';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Button } from '../../components/ui/Button';
import type { SmartFilterSuggestion } from '../../components/ui/SmartFilterInput';
import { FilterChip } from '../../components/ui/FilterChip';
import {
  parseNumericToken,
  splitKeyValueToken,
  tokenizeSmartInput,
  unquoteSmartValue,
} from '../../lib/smartFilter';
import { buildTransactionLockIndex, cursorFromDescendingPage } from '../../lib/lockIndex';
import { hasActiveChains } from '../../lib/taskStatus';
import { useKeysetPagination } from '../../lib/hooks/useKeysetPagination';
import { useTierAIntervalMs } from '../../lib/refreshTiers';
import { useNetworkStatus } from '../../lib/useNetworkStatus';
import { isDataStale } from '../../lib/lockState';
import { VpsListFilters } from './vps/VpsListFilters';
import { VpsListMobile } from './vps/VpsListMobile';
import { VpsListTable } from './vps/VpsListTable';
import { buildVpsListRecord } from './vps/vpsListSemantics';


export function VpsListPage() {
  const { basePath, mode } = useAppMode();
  const uiMode = mode === 'admin' ? 'admin' : 'app';
  const scope = useObjectScope();
  const { t } = useI18n();
  const chrome = useChrome();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const online = useNetworkStatus();

  const navigate = useNavigate();
  const toasts = useToasts();

  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const [nodeId, setNodeId] = useState(() => searchParams.get('node') ?? '');
  const [userId, setUserId] = useState(() => searchParams.get('user') ?? '');
  const [userNamespaceMapId, setUserNamespaceMapId] = useState(() => searchParams.get('user_namespace_map') ?? '');

  // Smart filter input (unapplied text).
  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const smartNeedle = smart.trim();
  const debouncedSmartNeedle = useDebouncedValue(smartNeedle, 150);

  const nodeIdNum = useMemo(() => {
    const trimmed = nodeId.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }, [nodeId]);

  const userIdNum = useMemo(() => {
    if (mode !== 'admin') return undefined;
    const trimmed = userId.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }, [mode, userId]);

  const userNamespaceMapIdNum = useMemo(() => {
    const trimmed = userNamespaceMapId.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }, [userNamespaceMapId]);

  useEffect(() => {
    if (smartNeedle === '?') setHelpOpen(true);
  }, [smartNeedle]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (search.trim()) next.set('q', search.trim());
    else next.delete('q');

    if (nodeIdNum !== undefined) next.set('node', String(nodeIdNum));
    else next.delete('node');

    // Admin-only filter: user id
    if (mode === 'admin') {
      if (userIdNum !== undefined) next.set('user', String(userIdNum));
      else next.delete('user');
    } else {
      next.delete('user');
    }

    if (userNamespaceMapIdNum !== undefined) next.set('user_namespace_map', String(userNamespaceMapIdNum));
    else next.delete('user_namespace_map');

    // NOTE: pagination params are managed by useKeysetPagination.

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [mode, nodeIdNum, search, searchParams, setSearchParams, userIdNum, userNamespaceMapIdNum]);

  const pagination = useKeysetPagination({
    id: 'vps.list',
    filterKey: JSON.stringify({ q: search.trim(), node: nodeIdNum ?? null, user: ((mode === 'admin' ? userIdNum : scope.mineUserId) ?? null), user_namespace_map: userNamespaceMapIdNum ?? null, scope: scope.scope }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100],
  });

  const q = useQuery({
    queryKey: [
      'vps',
      'list',
      {
        limit: pagination.limit,
        fromId: pagination.fromId,
        hostnameAny: search.trim() || undefined,
        node: nodeIdNum,
        user: mode === 'admin' ? userIdNum : scope.mineUserId,
        userNamespaceMap: userNamespaceMapIdNum,
      },
    ],
    queryFn: async () =>
      (
        await fetchVpsList({
          limit: pagination.limit,
          fromId: pagination.fromId,
          hostnameAny: search.trim() || undefined,
          node: nodeIdNum,
          user: mode === 'admin' ? userIdNum : scope.mineUserId,
          userNamespaceMap: userNamespaceMapIdNum,
        })
      ).data,
  });

  const [actionError, setActionError] = useState<null | { title: string; body?: string }>(null);

  const tierARefetchMs = useTierAIntervalMs();

  // Best-effort "busy" index for list rows (non-authoritative; actions still preflight).
  const activeChainsQ = useQuery({
    queryKey: ['transaction_chain', 'active', { limit: 200 }],
    queryFn: async () => fetchActiveTransactionChains({ limit: 200 }),
    refetchInterval: tierARefetchMs,
  });

  // If the busy index cannot refresh for longer than the lock-state TTL,
  // degrade it to avoid showing rows "stuck busy" forever.
  const lockIndexStale = isDataStale({
    updatedAt: activeChainsQ.dataUpdatedAt,
    unreliable: !online || activeChainsQ.isError,
  });

  const lockIndex = useMemo(() => {
    if (lockIndexStale) return buildTransactionLockIndex(undefined, { onlyActive: true });
    return buildTransactionLockIndex(activeChainsQ.data, { onlyActive: true });
  }, [activeChainsQ.data, lockIndexStale]);

  const [confirm, setConfirm] = useState<null | { vpsId: number; kind: 'stop' | 'restart'; force: boolean }>(null);

  const [inFlight, setInFlight] = useState<Record<number, 'start' | 'stop' | 'restart'>>({});

  const powerM = useMutation({
    mutationFn: async (vars: { vpsId: number; kind: 'start' | 'stop' | 'restart'; force?: boolean; objectLabel?: string }) => {
      const vpsId = vars.vpsId;

      // Preflight: re-check active chains for this VPS so we don't act on stale busy index.
      const chainsRes = await fetchTransactionChains({ className: 'Vps', rowId: vpsId, limit: 10 });
      const busy = hasActiveChains(chainsRes.data);
      if (busy) {
        const err: any = new Error('busy');
        err.code = 'BUSY';
        throw err;
      }

      if (vars.kind === 'start') return vpsStart(vpsId);
      if (vars.kind === 'stop') return vpsStop(vpsId, { force: Boolean(vars.force) });
      return vpsRestart(vpsId, { force: Boolean(vars.force) });
    },
    onMutate: ({ vpsId, kind }) => {
      setActionError(null);
      chrome.acquireLocalLock(objectRef('Vps', vpsId));
      setInFlight((prev) => ({ ...prev, [vpsId]: kind }));
    },
    onSuccess: (res, vars) => {
      const asId = getMetaActionStateId(res.meta);
      if (asId !== undefined) {
        const key = vars.kind === 'start' ? 'action.vps.start.label' : vars.kind === 'stop' ? 'action.vps.stop.label' : 'action.vps.restart.label';
        const objectLabel = vars.objectLabel ? String(vars.objectLabel) : t('common.vps_ref', { id: vars.vpsId });
        chrome.trackActionState(asId, { actionLabelKey: key, objectLabel, object: objectRef('Vps', vars.vpsId) });
      }
      // Refresh list data (runtime state changes) and busy index.
      void qc.invalidateQueries({ queryKey: ['vps', 'list'] });
      void qc.invalidateQueries({ queryKey: ['transaction_chain', 'active'] });
    },
    onError: (err: any) => {
      if (err?.code === 'BUSY') {
        chrome.openTasks();
        setActionError({ title: t('toast.action_blocked.title'), body: t('toast.action_blocked.body') });
        return;
      }

      setActionError({ title: t('common.action_failed'), body: String(err?.message ?? err) });
    },
    onSettled: (_res, _err, vars) => {
      if (vars) {
        chrome.releaseLocalLock(objectRef('Vps', vars.vpsId));
      }
      setInFlight((prev) => {
        const next = { ...prev };
        if (vars) delete next[vars.vpsId];
        return next;
      });
    },
  });

  const rows = useMemo(() => (q.data ?? []), [q.data]);

  const pageCursor = useMemo(() => cursorFromDescendingPage(q.data), [q.data]);
  const hasMore = (q.data ?? []).length >= pagination.limit;
  const canPaginate = pagination.canPrev || pagination.hasForward || hasMore;

  const filtersActive =
    Boolean(search.trim()) ||
    Boolean(nodeId.trim()) ||
    Boolean(userIdNum !== undefined) ||
    Boolean(userNamespaceMapId.trim());

  const displayRows = useMemo(
    () =>
      rows.map((vps) =>
        buildVpsListRecord({
          vps,
          lockIndex,
          isLocallyLocked: (id) => chrome.isLocallyLocked(objectRef('Vps', id)),
          inFlightKind: inFlight[vps.id],
          t,
        })
      ),
    [rows, lockIndex, chrome, inFlight, t]
  );

  const smartInputRef = useRef<HTMLInputElement>(null);

  function clearFilters() {
    setSearch('');
    setNodeId('');
    setUserId('');
    setUserNamespaceMapId('');
    setSmartErrors([]);
  }

  async function copyCurrentLink() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toasts.pushToast({ variant: 'ok', title: t('toast.copied.title') });
    } catch {
      toasts.pushToast({ variant: 'warn', title: t('toast.copied_failed.title') });
    }
  }

  function canonicalKey(raw: string): 'hostname' | 'node' | 'user' | 'user_namespace_map' | 'id' | null {
    const k = raw.trim().toLowerCase();
    if (!k) return null;

    if (['q', 'host', 'hostname', 'h'].includes(k)) return 'hostname';
    if (['node', 'n'].includes(k)) return 'node';
    if (['user', 'u', 'owner'].includes(k)) return 'user';
    if (['map', 'nsmap', 'user_namespace_map', 'uidmap'].includes(k)) return 'user_namespace_map';
    if (['id', 'vps', '#'].includes(k)) return 'id';

    return null;
  }


  const userSuggestQuery = useQuery({
    queryKey: ['users', 'search', { q: debouncedSmartNeedle }],
    enabled:
      mode === 'admin' &&
      debouncedSmartNeedle.length >= 2 &&
      debouncedSmartNeedle !== '?' &&
      !debouncedSmartNeedle.includes(':') &&
      !debouncedSmartNeedle.includes(' ') &&
      parseNumericToken(debouncedSmartNeedle) === null,
    queryFn: async () => (await searchUsers({ q: debouncedSmartNeedle, limit: 6 })).data,
    staleTime: 10_000,
  });

  const nodesSuggestQuery = useQuery({
    queryKey: ['nodes', 'index', { limit: 250 }],
    enabled:
      mode === 'admin' &&
      debouncedSmartNeedle.length >= 1 &&
      debouncedSmartNeedle !== '?' &&
      !debouncedSmartNeedle.includes(':') &&
      !debouncedSmartNeedle.includes(' '),
    queryFn: async () => (await fetchNodes({ limit: 250 })).data,
    staleTime: 60_000,
  });

  async function applySmartText(raw: string) {
    const input = raw.trim();

    if (!input) return;

    if (input === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(input).map((t) => t.trim()).filter(Boolean);

    // Pure numeric → open VPS detail by default.
    const firstToken = tokens[0];
    const numericOnly = tokens.length === 1 && firstToken ? parseNumericToken(firstToken) : null;
    if (numericOnly !== null) {
      setSmart('');
      setSmartErrors([]);
      navigate(`${basePath}/vps/${numericOnly}`);
      return;
    }

    let nextSearch = search;
    let nextNode = nodeId;
    let nextUser = userId;
    let nextMap = userNamespaceMapId;

    const free: string[] = [];
    const errors: string[] = [];

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (kv) {
        const rawKey = kv.rawKey;
        const rawValue = kv.rawValue;
        const key = canonicalKey(rawKey);
        const value = unquoteSmartValue(rawValue);

        if (!key) {
          errors.push(t('filters.smart.error.unknown_key', { key: rawKey }));
          continue;
        }

        if (!value.trim()) {
          errors.push(t('filters.smart.error.missing_value', { key: rawKey }));
          continue;
        }

        if (key === 'hostname') {
          nextSearch = value;
          continue;
        }

        if (key === 'node') {
          const n = parseNumericToken(value);
          if (n !== null) {
            nextNode = String(n);
            continue;
          }

          const nodes = nodesSuggestQuery.data ?? [];
          const exact = nodes.filter(
            (x) => String(x.domain_name ?? x.name ?? '').toLowerCase() === value.toLowerCase()
          );

          const [resolvedNode] = exact;
          if (resolvedNode) {
            nextNode = String(resolvedNode.id);
            continue;
          }

          errors.push(t('filters.smart.error.node_unresolved', { value }));
          continue;
        }

        if (key === 'user') {
          if (mode !== 'admin') {
            errors.push(t('filters.smart.error.user_admin_only'));
            continue;
          }

          const n = parseNumericToken(value);
          if (n !== null) {
            nextUser = String(n);
            continue;
          }

          const users = (await searchUsers({ q: value, limit: 10 })).data;
          const exact = users.filter((u) => u.login.toLowerCase() === value.toLowerCase());
          const [resolvedUser] = exact;
          if (resolvedUser) {
            nextUser = String(resolvedUser.id);
            continue;
          }

          errors.push(t('filters.smart.error.user_unresolved', { value }));
          continue;
        }

        if (key === 'user_namespace_map') {
          const n = parseNumericToken(value);
          if (n !== null) {
            nextMap = String(n);
            continue;
          }

          errors.push(t('filters.smart.error.map_numeric_only', { value }));
          continue;
        }

        if (key === 'id') {
          const n = parseNumericToken(value);
          if (n !== null) {
            setSmart('');
            setSmartErrors([]);
            navigate(`${basePath}/vps/${n}`);
            return;
          }

          errors.push(t('filters.smart.error.id_numeric_only', { value }));
          continue;
        }
      } else {
        free.push(unquoteSmartValue(token));
      }
    }

    if (free.length > 0) {
      nextSearch = free.join(' ');
    }

    if (errors.length > 0) {
      setSmartErrors(errors);
      toasts.pushToast({ variant: 'danger', title: errors[0] ?? t('common.unknown_error') });
      return;
    }

    setSearch(nextSearch);
    setNodeId(nextNode);
    setUserId(nextUser);
    setUserNamespaceMapId(nextMap);
    setSmart('');
    setSmartErrors([]);
  }

  const smartSuggestions = useMemo((): SmartFilterSuggestion[] => {
    const needle = smartNeedle;
    if (!needle) return [];

    if (needle === '?') {
      return [
        {
          id: 'help',
          primary: t('filters.help.title'),
          secondary: t('filters.help.suggestion.secondary'),
          onPick: () => setHelpOpen(true),
          testId: 'vps.smart_filter.suggest.help',
        },
      ];
    }

    const suggestions: SmartFilterSuggestion[] = [];

    const numeric = parseNumericToken(needle);
    if (numeric !== null) {
      const id = String(numeric);

      suggestions.push({
        id: 'open',
        primary: t('filters.smart.suggest.open_vps', { id }),
        secondary: t('filters.smart.suggest.open_vps.secondary'),
        onPick: () => {
          setSmart('');
          setSmartErrors([]);
          navigate(`${basePath}/vps/${id}`);
        },
        testId: 'vps.smart_filter.suggest.open',
      });

      suggestions.push({
        id: 'hostname',
        primary: t('filters.smart.suggest.hostname', { value: id }),
        secondary: t('filters.smart.suggest.hostname.secondary'),
        onPick: () => {
          setSearch(id);
          setSmart('');
          setSmartErrors([]);
        },
        testId: 'vps.smart_filter.suggest.hostname',
      });

      if (mode === 'admin') {
        suggestions.push({
          id: 'user',
          primary: t('filters.smart.suggest.user_id', { id }),
          secondary: t('filters.smart.suggest.user_id.secondary'),
          onPick: () => {
            setUserId(id);
            setSmart('');
            setSmartErrors([]);
          },
          testId: 'vps.smart_filter.suggest.user',
        });

        suggestions.push({
          id: 'node',
          primary: t('filters.smart.suggest.node_id', { id }),
          secondary: t('filters.smart.suggest.node_id.secondary'),
          onPick: () => {
            setNodeId(id);
            setSmart('');
            setSmartErrors([]);
          },
          testId: 'vps.smart_filter.suggest.node',
        });

        suggestions.push({
          id: 'map',
          primary: t('filters.smart.suggest.map_id', { id }),
          secondary: t('filters.smart.suggest.map_id.secondary'),
          onPick: () => {
            setUserNamespaceMapId(id);
            setSmart('');
            setSmartErrors([]);
          },
          testId: 'vps.smart_filter.suggest.map',
        });
      }

      return suggestions;
    }

    if (needle.includes(':')) {
      suggestions.push({
        id: 'apply',
        primary: t('filters.smart.suggest.apply.primary'),
        secondary: t('filters.smart.suggest.apply.secondary'),
        onPick: () => void applySmartText(needle),
        testId: 'vps.smart_filter.suggest.apply',
      });

      return suggestions;
    }

    suggestions.push({
      id: 'hostname',
      primary: t('filters.smart.suggest.hostname', { value: needle }),
      secondary: t('filters.smart.suggest.hostname.secondary'),
      onPick: () => {
        setSearch(needle);
        setSmart('');
        setSmartErrors([]);
      },
      testId: 'vps.smart_filter.suggest.hostname',
    });

    if (mode === 'admin') {
      const users = userSuggestQuery.data ?? [];
      for (const u of users.slice(0, 5)) {
        suggestions.push({
          id: `user.${u.id}`,
          primary: t('filters.smart.suggest.user_login', { login: u.login }),
          secondary: `#${u.id}`,
          onPick: () => {
            setUserId(String(u.id));
            setSmart('');
            setSmartErrors([]);
          },
          testId: `vps.smart_filter.suggest.user.${u.id}`,
        });
      }

      const nodes = nodesSuggestQuery.data ?? [];
      const low = needle.toLowerCase();
      for (const n of nodes
        .filter((x) => String(x.domain_name ?? x.name ?? '').toLowerCase().includes(low))
        .slice(0, 4)) {
        suggestions.push({
          id: `node.${n.id}`,
          primary: t('filters.smart.suggest.node_name', {
            name: String(n.domain_name ?? n.name ?? n.id),
          }),
          secondary: `#${n.id}`,
          onPick: () => {
            setNodeId(String(n.id));
            setSmart('');
            setSmartErrors([]);
          },
          testId: `vps.smart_filter.suggest.node.${n.id}`,
        });
      }
    }

    return suggestions;
  }, [basePath, mode, navigate, nodesSuggestQuery.data, smartNeedle, t, userSuggestQuery.data]);

  const activeFilterChips = useMemo(() => {
    const chips: React.ReactNode[] = [];

    const q = search.trim();
    if (q) {
      chips.push(
        <FilterChip
          key="hostname"
          label={`hostname:${q}`}
          onRemove={() => setSearch('')}
          testId="vps.chip.hostname"
        />
      );
    }

    if (nodeIdNum !== undefined) {
      chips.push(
        <FilterChip
          key="node"
          label={`node:${nodeIdNum}`}
          onRemove={() => setNodeId('')}
          testId="vps.chip.node"
        />
      );
    }

    if (mode === 'admin' && userIdNum !== undefined) {
      chips.push(
        <FilterChip
          key="user"
          label={`user:${userIdNum}`}
          onRemove={() => setUserId('')}
          testId="vps.chip.user"
        />
      );
    }

    if (userNamespaceMapIdNum !== undefined) {
      chips.push(
        <FilterChip
          key="map"
          label={`map:${userNamespaceMapIdNum}`}
          onRemove={() => setUserNamespaceMapId('')}
          testId="vps.chip.map"
        />
      );
    }

    smartErrors.forEach((e, idx) => {
      chips.push(
        <FilterChip
          key={`err.${idx}`}
          label={e}
          tone="danger"
          onRemove={() => setSmartErrors([])}
          testId={`vps.chip.error.${idx}`}
        />
      );
    });

    return chips;
  }, [mode, nodeIdNum, search, smartErrors, userIdNum, userNamespaceMapIdNum]);
  const emptyNone = (q.data ?? []).length === 0 && !filtersActive;
  const emptyTitle = emptyNone
    ? scope.scope === 'mine'
      ? t('empty.vps.none.title')
      : t('empty.list.none.title')
    : t('empty.list.no_matches.title');
  const emptyBody = emptyNone
    ? scope.scope === 'mine'
      ? t('empty.vps.none.body_basic')
      : t('empty.list.none.body')
    : t('empty.list.no_matches.body');

  return (
    <ListShell
      variant="wide"
      testId="vps.list"
      banner={<SyncStaleBanner />}
      header={
        <PageHeader
          testId="vps.list.header"
          title={t('nav.vps')}
          description={t('vps.list.description')}
          actions={
            <Button to={`${basePath}/vps/new`} testId="vps.list.create">
              <Plus className="h-4 w-4" />
              {t('vps.create.open')}
            </Button>
          }
        />
      }
      filters={
        <VpsListFilters
          mode={uiMode}
          t={t}
          smart={smart}
          smartNeedle={smartNeedle}
          smartErrors={smartErrors}
          setSmart={setSmart}
          setSmartErrors={setSmartErrors}
          smartSuggestions={smartSuggestions}
          applySmartText={applySmartText}
          activeFilterChips={activeFilterChips}
          filtersActive={filtersActive}
          helpOpen={helpOpen}
          setHelpOpen={setHelpOpen}
          advancedOpen={advancedOpen}
          setAdvancedOpen={setAdvancedOpen}
          smartInputRef={smartInputRef}
          clearFilters={clearFilters}
          nodeId={nodeId}
          setNodeId={setNodeId}
          userId={userId}
          setUserId={setUserId}
          userNamespaceMapId={userNamespaceMapId}
          setUserNamespaceMapId={setUserNamespaceMapId}
          onCopyLink={() => void copyCurrentLink()}
        />
      }
    >
      {actionError ? (
        <Alert
          variant="warn"
          title={
            <div className="flex items-center justify-between gap-2">
              <span>{actionError.title}</span>
              <button
                type="button"
                className="text-xs underline"
                onClick={() => setActionError(null)}
              >
                {t('common.close')}
              </button>
            </div>
          }
        >
          {actionError.body}
        </Alert>
      ) : null}

      {q.isLoading ? (
        <LoadingState testId="vps.list.loading" />
      ) : q.isError ? (
        <ErrorState
          testId="vps.list.error"
          title={t('vps.list.load_error.title')}
          error={q.error}
          onRetry={() => void q.refetch()}
          showBack={false}
          detailsExtra={{ page: 'vps.list', scope: scope.scope }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          testId="vps.list.empty"
          title={emptyTitle}
          body={emptyBody}
          actionLabel={filtersActive ? t('common.clear_filters') : undefined}
          onAction={filtersActive ? clearFilters : undefined}
        />
      ) : (
        <>
          <VpsListMobile
            rows={displayRows}
            basePath={basePath}
            t={t}
            pagination={pagination}
            canPaginate={canPaginate}
            hasMore={hasMore}
            pageCursor={pageCursor}
            onStart={(row) =>
              powerM.mutate({
                vpsId: row.vps.id,
                kind: 'start',
                objectLabel: String(row.vps.hostname ?? t('common.vps_ref', { id: row.vps.id })),
              })
            }
            onRequestStop={(row) => setConfirm({ vpsId: row.vps.id, kind: 'stop', force: false })}
            onRequestRestart={(row) => setConfirm({ vpsId: row.vps.id, kind: 'restart', force: false })}
          />

          <VpsListTable
            rows={displayRows}
            basePath={basePath}
            t={t}
            pagination={pagination}
            canPaginate={canPaginate}
            hasMore={hasMore}
            pageCursor={pageCursor}
            onStart={(row) =>
              powerM.mutate({
                vpsId: row.vps.id,
                kind: 'start',
                objectLabel: String(row.vps.hostname ?? t('common.vps_ref', { id: row.vps.id })),
              })
            }
            onRequestStop={(row) => setConfirm({ vpsId: row.vps.id, kind: 'stop', force: false })}
            onRequestRestart={(row) => setConfirm({ vpsId: row.vps.id, kind: 'restart', force: false })}
          />
        </>
      )}

      {confirm ? (
        <ConfirmDialog
          open
          testId="vps.list.power_confirm"
          title={confirm.kind === 'stop' ? t('vps.power.stop.confirm_title') : t('vps.power.restart.confirm_title')}
          description={
            confirm.kind === 'stop'
              ? t('vps.power.stop.confirm_desc_basic')
              : t('vps.power.restart.confirm_desc_basic')
          }
          danger={confirm.kind === 'stop'}
          confirmLabel={confirm.kind === 'stop' ? t('action.vps.stop.label') : t('action.vps.restart.label')}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const found = (q.data ?? []).find((v) => Number(v.id) === Number(confirm.vpsId));
            const objectLabel = found?.hostname ? String(found.hostname) : t('common.vps_ref', { id: confirm.vpsId });
            const vars = { vpsId: confirm.vpsId, kind: confirm.kind, force: confirm.force, objectLabel } as const;
            setConfirm(null);
            powerM.mutate(vars);
          }}
        >
          <Checkbox
            checked={confirm.force}
            onChange={(checked) => setConfirm((prev) => (prev ? { ...prev, force: checked } : prev))}
            label={t('common.force')}
            testId="vps.list.power_confirm.force"
          />
        </ConfirmDialog>
      ) : null}
    </ListShell>
  );
}

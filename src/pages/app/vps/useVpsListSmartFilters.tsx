import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { ObjectScopeValue } from '../../../app/objectScope';
import type { ToastsContextValue } from '../../../app/toasts';
import { searchUsers } from '../../../lib/api/users';
import { useDebouncedValue } from '../../../lib/hooks/useDebouncedValue';
import { currentSuggestionRows } from '../../../lib/currentSuggestionRows';
import {
  parseNumericToken,
  splitKeyValueToken,
  tokenizeSmartInput,
  unquoteSmartValue,
} from '../../../lib/smartFilter';
import { FilterChip } from '../../../components/ui/FilterChip';

import {
  normalizeVpsListStateFilter,
  type VpsListStateFilter,
  type VpsListTranslator,
} from './vpsListSemantics';
import { buildVpsListSmartSuggestions, stateFilterLabelKey } from './VpsListSmartSuggestions';
import {
  canonicalKey,
  isStateLiteral,
  normalizeVpsListSearchParams,
  numericParam,
  useVpsListSmartSuggestionQueries,
  type VpsListMode,
} from './vpsListSmartFilterHelpers';

interface UseVpsListSmartFiltersArgs {
  basePath: string;
  mode: VpsListMode;
  scope: ObjectScopeValue;
  t: VpsListTranslator;
  toasts: ToastsContextValue;
}

export function useVpsListSmartFilters(args: UseVpsListSmartFiltersArgs) {
  const { basePath, mode, scope, t, toasts } = args;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const searchParamsKey = searchParams.toString();
  const normalizedSearch = useMemo(
    () => normalizeVpsListSearchParams(new URLSearchParams(searchParamsKey), mode),
    [mode, searchParamsKey]
  );
  const activeSearchParamsKey = normalizedSearch.searchParams.toString();
  const activeSearchParams = useMemo(
    () => new URLSearchParams(activeSearchParamsKey),
    [activeSearchParamsKey]
  );
  const activeSearch = activeSearchParams.get('q') ?? '';
  const activeNodeIdNum = numericParam(activeSearchParams.get('node') ?? '');
  const activeUserIdNum = mode === 'admin' ? numericParam(activeSearchParams.get('user') ?? '') : undefined;
  const activeUserNamespaceMapIdNum = numericParam(activeSearchParams.get('user_namespace_map') ?? '');
  const activeLocationIdNum = numericParam(activeSearchParams.get('location') ?? '');
  const activeStateFilter = normalizeVpsListStateFilter(activeSearchParams.get('state'));
  const hydratingFiltersFromUrlRef = useRef(false);

  const [search, setSearch] = useState(() => activeSearch);
  const [nodeId, setNodeId] = useState(() => activeNodeIdNum === undefined ? '' : String(activeNodeIdNum));
  const [userId, setUserId] = useState(() => activeUserIdNum === undefined ? '' : String(activeUserIdNum));
  const [userNamespaceMapId, setUserNamespaceMapId] = useState(
    () => activeUserNamespaceMapIdNum === undefined ? '' : String(activeUserNamespaceMapIdNum)
  );
  const [locationId, setLocationId] = useState(
    () => activeLocationIdNum === undefined ? '' : String(activeLocationIdNum)
  );
  const [stateFilter, setStateFilter] = useState<VpsListStateFilter>(() => activeStateFilter);

  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const smartInputRef = useRef<HTMLInputElement>(null);
  const smartNeedle = smart.trim();
  const debouncedSmartNeedle = useDebouncedValue(smartNeedle, 150);

  const nodeIdNum = useMemo(() => numericParam(nodeId), [nodeId]);
  const userIdNum = useMemo(() => (mode === 'admin' ? numericParam(userId) : undefined), [mode, userId]);
  const userNamespaceMapIdNum = useMemo(() => numericParam(userNamespaceMapId), [userNamespaceMapId]);
  const locationIdNum = useMemo(() => numericParam(locationId), [locationId]);

  useLayoutEffect(() => {
    if (!normalizedSearch.changed) return;
    setSearchParams(activeSearchParams, { replace: true });
  }, [activeSearchParams, normalizedSearch.changed, setSearchParams]);

  useLayoutEffect(() => {
    hydratingFiltersFromUrlRef.current = true;
    setSearch(activeSearch);
    setNodeId(activeNodeIdNum === undefined ? '' : String(activeNodeIdNum));
    setUserId(activeUserIdNum === undefined ? '' : String(activeUserIdNum));
    setUserNamespaceMapId(
      activeUserNamespaceMapIdNum === undefined ? '' : String(activeUserNamespaceMapIdNum)
    );
    setLocationId(activeLocationIdNum === undefined ? '' : String(activeLocationIdNum));
    setStateFilter(activeStateFilter);
  }, [
    activeLocationIdNum,
    activeNodeIdNum,
    activeSearch,
    activeSearchParamsKey,
    activeStateFilter,
    activeUserIdNum,
    activeUserNamespaceMapIdNum,
  ]);

  useEffect(() => {
    if (smartNeedle === '?') setHelpOpen(true);
  }, [smartNeedle]);

  useEffect(() => {
    if (hydratingFiltersFromUrlRef.current) {
      hydratingFiltersFromUrlRef.current = false;
      return;
    }

    const next = new URLSearchParams(activeSearchParams);

    if (search.trim()) next.set('q', search.trim());
    else next.delete('q');

    if (nodeIdNum !== undefined) next.set('node', String(nodeIdNum));
    else next.delete('node');

    if (mode === 'admin') {
      if (userIdNum !== undefined) next.set('user', String(userIdNum));
      else next.delete('user');
    } else {
      next.delete('user');
    }

    if (userNamespaceMapIdNum !== undefined) next.set('user_namespace_map', String(userNamespaceMapIdNum));
    else next.delete('user_namespace_map');

    if (locationIdNum !== undefined) next.set('location', String(locationIdNum));
    else next.delete('location');

    if (stateFilter !== 'all') next.set('state', stateFilter);
    else next.delete('state');

    const filterKeys = ['q', 'node', 'user', 'user_namespace_map', 'location', 'state'] as const;
    const filtersChanged = filterKeys.some((key) => next.get(key) !== activeSearchParams.get(key));
    if (filtersChanged) {
      next.delete('from_id');
      next.set('page', '1');
    }

    if (next.toString() !== searchParamsKey) {
      setSearchParams(next, { replace: true });
    }
  }, [
    activeSearchParams,
    locationIdNum,
    mode,
    nodeIdNum,
    search,
    searchParamsKey,
    setSearchParams,
    stateFilter,
    userIdNum,
    userNamespaceMapIdNum,
  ]);

  const { userSuggestQuery, nodesSuggestQuery } = useVpsListSmartSuggestionQueries(debouncedSmartNeedle, mode);

  function clearFilters() {
    setSearch('');
    setNodeId('');
    setUserId('');
    setUserNamespaceMapId('');
    setLocationId('');
    setStateFilter('all');
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

  async function applySmartText(raw: string) {
    const input = raw.trim();

    if (!input) return;

    if (input === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(input).map((token) => token.trim()).filter(Boolean);

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
    let nextLocation = locationId;
    let nextState = stateFilter;

    const free: string[] = [];
    const errors: string[] = [];

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (!kv) {
        const value = unquoteSmartValue(token);
        if (isStateLiteral(value)) {
          nextState = normalizeVpsListStateFilter(value);
        } else {
          free.push(value);
        }
        continue;
      }

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

      if (key === 'hostname' || key === 'ip') {
        nextSearch = value;
        continue;
      }

      if (key === 'state') {
        if (!isStateLiteral(value)) {
          errors.push(t('vps.list.smart.error.state_unknown', { value }));
          continue;
        }
        nextState = normalizeVpsListStateFilter(value);
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
          (item) => String(item.domain_name ?? item.name ?? '').toLowerCase() === value.toLowerCase()
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
        const exact = users.filter((user) => user.login.toLowerCase() === value.toLowerCase());
        const [resolvedUser] = exact;
        if (resolvedUser) {
          nextUser = String(resolvedUser.id);
          continue;
        }

        errors.push(t('filters.smart.error.user_unresolved', { value }));
        continue;
      }

      if (key === 'user_namespace_map' || key === 'location') {
        const n = parseNumericToken(value);
        if (n !== null) {
          if (key === 'location') nextLocation = String(n);
          else nextMap = String(n);
          continue;
        }

        errors.push(
          key === 'location'
            ? t('vps.list.smart.error.location_numeric_only', { value })
            : t('filters.smart.error.map_numeric_only', { value })
        );
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
    setLocationId(nextLocation);
    setStateFilter(nextState);
    setSmart('');
    setSmartErrors([]);
  }

  const smartSuggestions = useMemo(
    () =>
      buildVpsListSmartSuggestions({
        needle: smartNeedle,
        basePath,
        mode,
        t,
        navigate,
        users: currentSuggestionRows(smartNeedle, debouncedSmartNeedle, userSuggestQuery.data),
        nodes: nodesSuggestQuery.data ?? [],
        setHelpOpen,
        setSmart,
        setSmartErrors,
        setSearch,
        setUserId,
        setNodeId,
        setLocationId,
        setUserNamespaceMapId,
        setStateFilter,
        applySmartText: (value) => void applySmartText(value),
      }),
    [basePath, debouncedSmartNeedle, mode, navigate, nodesSuggestQuery.data, smartNeedle, t, userSuggestQuery.data]
  );

  const activeFilterChips = useMemo(() => {
    const chips: React.ReactNode[] = [];
    const q = search.trim();

    if (q) {
      chips.push(<FilterChip key="hostname" label={`q:${q}`} onRemove={() => setSearch('')} testId="vps.chip.hostname" />);
    }

    if (stateFilter !== 'all') {
      chips.push(
        <FilterChip
          key="state"
          label={`state:${t(stateFilterLabelKey(stateFilter))}`}
          onRemove={() => setStateFilter('all')}
          testId="vps.chip.state"
        />
      );
    }

    if (nodeIdNum !== undefined) {
      chips.push(<FilterChip key="node" label={`node:${nodeIdNum}`} onRemove={() => setNodeId('')} testId="vps.chip.node" />);
    }

    if (locationIdNum !== undefined) {
      chips.push(
        <FilterChip key="location" label={`location:${locationIdNum}`} onRemove={() => setLocationId('')} testId="vps.chip.location" />
      );
    }

    if (mode === 'admin' && userIdNum !== undefined) {
      chips.push(<FilterChip key="user" label={`user:${userIdNum}`} onRemove={() => setUserId('')} testId="vps.chip.user" />);
    }

    if (userNamespaceMapIdNum !== undefined) {
      chips.push(
        <FilterChip key="map" label={`map:${userNamespaceMapIdNum}`} onRemove={() => setUserNamespaceMapId('')} testId="vps.chip.map" />
      );
    }

    smartErrors.forEach((error, index) => {
      chips.push(
        <FilterChip
          key={`err.${index}`}
          label={error}
          tone="danger"
          onRemove={() => setSmartErrors([])}
          testId={`vps.chip.error.${index}`}
        />
      );
    });

    return chips;
  }, [locationIdNum, mode, nodeIdNum, search, smartErrors, stateFilter, t, userIdNum, userNamespaceMapIdNum]);

  const filtersActive =
    Boolean(activeSearch) ||
    activeNodeIdNum !== undefined ||
    activeUserIdNum !== undefined ||
    activeUserNamespaceMapIdNum !== undefined ||
    activeLocationIdNum !== undefined ||
    activeStateFilter !== 'all';

  const filterKey = JSON.stringify({
    q: activeSearch,
    node: activeNodeIdNum ?? null,
    user: (mode === 'admin' ? activeUserIdNum : scope.mineUserId) ?? null,
    user_namespace_map: activeUserNamespaceMapIdNum ?? null,
    location: activeLocationIdNum ?? null,
    state: activeStateFilter,
    scope: scope.scope,
  });

  return {
    searchParams: activeSearchParams,
    setSearchParams,
    search: activeSearch,
    nodeIdNum: activeNodeIdNum,
    userIdNum: activeUserIdNum,
    userNamespaceMapIdNum: activeUserNamespaceMapIdNum,
    locationIdNum: activeLocationIdNum,
    stateFilter: activeStateFilter,
    filtersActive,
    filterKey,
    filterProps: {
      mode,
      t,
      smart,
      smartNeedle,
      smartErrors,
      setSmart,
      setSmartErrors,
      smartSuggestions,
      applySmartText,
      activeFilterChips,
      filtersActive,
      helpOpen,
      setHelpOpen,
      advancedOpen,
      setAdvancedOpen,
      smartInputRef,
      clearFilters,
      nodeId,
      setNodeId,
      userId,
      setUserId,
      userNamespaceMapId,
      setUserNamespaceMapId,
      locationId,
      setLocationId,
      stateFilter,
      setStateFilter,
      onCopyLink: () => void copyCurrentLink(),
    },
    clearFilters,
  };
}

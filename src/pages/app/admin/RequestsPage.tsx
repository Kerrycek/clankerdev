import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';

import { searchUsers } from '../../../lib/api/users';
import {
  fetchChangeRequest,
  fetchChangeRequests,
  fetchRegistrationRequest,
  fetchRegistrationRequests,
} from '../../../lib/api/requests';
import { formatDateTime } from '../../../lib/format';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';
import { useDebouncedValue } from '../../../lib/hooks/useDebouncedValue';
import { cursorFromDescendingPage } from '../../../lib/lockIndex';
import { useTierSlowIntervalMs } from '../../../lib/refreshTiers';
import {
  parseNumericToken,
  splitKeyValueToken,
  tokenizeSmartInput,
  unquoteSmartValue,
} from '../../../lib/smartFilter';
import {
  fraudRiskBadge,
  requestStateLabelKey,
  requestTypeLabelKey,
} from '../../../lib/requestsBadges';

import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';

import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import type { SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import {
  RequestOperationalLinks,
  RequestReviewActions,
} from './RequestReviewActions';
import { RequestsFilters } from './RequestsFilters';
import { RequestsListContent } from './RequestsListContent';
import {
  canonicalKey,
  changeRows,
  defaultStateOptions,
  mergeByIdDesc,
  parseTypeValue,
  registrationRows,
  requestDateValue,
  requestId,
  requestKey,
  requestState,
  requestType,
  requestTypeFilterFromUrl,
  resolveStateValue,
  safeNumber,
  type RequestTypeFilter,
  type UnifiedRequestRow,
  userLabel,
  visibleRequestRows,
} from './RequestsModel';

export function RequestsPage() {
  const { basePath, mode } = useAppMode();
  const isAdmin = mode === 'admin';
  const { t } = useI18n();
  const toasts = useToasts();
  const navigate = useNavigate();

  const tierSlowRefetchMs = useTierSlowIntervalMs();
  const [sp, setSp] = useSearchParams();

  const [type, setType] = useState<RequestTypeFilter>(() => requestTypeFilterFromUrl(sp.get('type')));
  const [state, setState] = useState(() => sp.get('state') ?? '');
  const [qText, setQText] = useState(() => sp.get('q') ?? '');
  const [userId, setUserId] = useState(() => sp.get('user') ?? '');
  const [adminId, setAdminId] = useState(() => sp.get('admin') ?? '');
  const [apiIp, setApiIp] = useState(() => sp.get('api_ip') ?? '');
  const [clientIp, setClientIp] = useState(() => sp.get('client_ip') ?? '');
  const [clientPtr, setClientPtr] = useState(() => sp.get('client_ptr') ?? '');

  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const smartInputRef = useRef<HTMLInputElement>(null);

  // Sync from URL on navigation.
  useEffect(() => {
    setType(requestTypeFilterFromUrl(sp.get('type')));
    setState(sp.get('state') ?? '');
    setQText(sp.get('q') ?? '');
    setUserId(isAdmin ? sp.get('user') ?? '' : '');
    setAdminId(isAdmin ? sp.get('admin') ?? '' : '');
    setApiIp(sp.get('api_ip') ?? '');
    setClientIp(sp.get('client_ip') ?? '');
    setClientPtr(sp.get('client_ptr') ?? '');
  }, [isAdmin, sp]);

  // Keep filters in the URL.
  useEffect(() => {
    const next = new URLSearchParams(sp);

    if (type && type !== 'all') next.set('type', type);
    else next.delete('type');

    const st = state.trim();
    if (st && defaultStateOptions().includes(st)) next.set('state', st);
    else next.delete('state');

    const q = qText.trim();
    if (q) next.set('q', q);
    else next.delete('q');

    if (isAdmin && userId.trim()) next.set('user', userId.trim());
    else next.delete('user');

    if (isAdmin && adminId.trim()) next.set('admin', adminId.trim());
    else next.delete('admin');

    if (apiIp.trim()) next.set('api_ip', apiIp.trim());
    else next.delete('api_ip');

    if (clientIp.trim()) next.set('client_ip', clientIp.trim());
    else next.delete('client_ip');

    if (clientPtr.trim()) next.set('client_ptr', clientPtr.trim());
    else next.delete('client_ptr');

    if (next.toString() !== sp.toString()) setSp(next, { replace: true });
  }, [adminId, apiIp, clientIp, clientPtr, isAdmin, qText, setSp, sp, state, type, userId]);

  const stateTrim = state.trim() || undefined;
  const qTrim = qText.trim() || undefined;
  const userIdNum = safeNumber(userId);
  const adminIdNum = safeNumber(adminId);

  const filtersActive = Boolean(
    qTrim ||
      (type && type !== 'all') ||
      stateTrim ||
      (isAdmin && userIdNum !== undefined) ||
      (isAdmin && adminIdNum !== undefined) ||
      apiIp.trim() ||
      clientIp.trim() ||
      clientPtr.trim()
  );

  function clearFilters() {
    setType('all');
    setState('');
    setQText('');
    setUserId('');
    setAdminId('');
    setApiIp('');
    setClientIp('');
    setClientPtr('');
    setSmart('');
    setSmartErrors([]);
  }

  const pagination = useKeysetPagination({
    id: 'admin.requests.list',
    filterKey: JSON.stringify({
      scope: basePath,
      type,
      state: stateTrim,
      q: qTrim,
      user: isAdmin ? userIdNum : undefined,
      admin: isAdmin ? adminIdNum : undefined,
      api_ip: apiIp.trim() || undefined,
      client_ip: clientIp.trim() || undefined,
      client_ptr: clientPtr.trim() || undefined,
    }),
    searchParams: sp,
    setSearchParams: setSp,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100, 200],
  });

  const needRegs = isAdmin && (type === 'all' || type === 'registration');
  const needChanges = isAdmin && (type === 'all' || type === 'change');

  const regQ = useQuery({
    queryKey: [
      'user_request',
      'registrations',
      'index',
      {
        enabled: needRegs,
        limit: pagination.limit,
        fromId: pagination.fromId,
        state: stateTrim,
        q: qTrim,
        userId: isAdmin ? userIdNum : undefined,
        adminId: isAdmin ? adminIdNum : undefined,
        apiIp: apiIp.trim(),
        clientIp: clientIp.trim(),
        clientPtr: clientPtr.trim(),
      },
    ],
    enabled: needRegs,
    queryFn: async () =>
      await fetchRegistrationRequests({
        limit: pagination.limit,
        fromId: pagination.fromId,
        state: stateTrim,
        q: qTrim,
        userId: isAdmin ? userIdNum : undefined,
        adminId: isAdmin ? adminIdNum : undefined,
        apiIpAddr: apiIp.trim() || undefined,
        clientIpAddr: clientIp.trim() || undefined,
        clientIpPtr: clientPtr.trim() || undefined,
      }),
    staleTime: 15000,
    refetchInterval: tierSlowRefetchMs,
  });

  const changeQ = useQuery({
    queryKey: [
      'user_request',
      'changes',
      'index',
      {
        enabled: needChanges,
        limit: pagination.limit,
        fromId: pagination.fromId,
        state: stateTrim,
        q: qTrim,
        userId: isAdmin ? userIdNum : undefined,
        adminId: isAdmin ? adminIdNum : undefined,
        apiIp: apiIp.trim(),
        clientIp: clientIp.trim(),
        clientPtr: clientPtr.trim(),
      },
    ],
    enabled: needChanges,
    queryFn: async () =>
      await fetchChangeRequests({
        limit: pagination.limit,
        fromId: pagination.fromId,
        state: stateTrim,
        q: qTrim,
        userId: isAdmin ? userIdNum : undefined,
        adminId: isAdmin ? adminIdNum : undefined,
        apiIpAddr: apiIp.trim() || undefined,
        clientIpAddr: clientIp.trim() || undefined,
        clientIpPtr: clientPtr.trim() || undefined,
      }),
    staleTime: 15000,
    refetchInterval: tierSlowRefetchMs,
  });

  const reg = regQ.data?.data ?? [];
  const ch = changeQ.data?.data ?? [];

  const rows = useMemo(() => {
    const raw =
      type === 'registration'
        ? registrationRows(reg)
        : type === 'change'
          ? changeRows(ch)
          : mergeByIdDesc(reg, ch, pagination.limit);

    return visibleRequestRows(raw, stateTrim);
  }, [ch, pagination.limit, reg, stateTrim, type]);

  const visibleKeys = useMemo(() => new Set(rows.map((r) => requestKey(r))), [rows]);
  const allVisibleExpanded = rows.length > 0 && rows.every((r) => expandedKeys.has(requestKey(r)));

  useEffect(() => {
    setExpandedKeys((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const key of prev) {
        if (visibleKeys.has(key)) next.add(key);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [visibleKeys]);

  const refreshRequests = useCallback(async () => {
    const tasks: Promise<unknown>[] = [];
    if (needRegs) tasks.push(regQ.refetch());
    if (needChanges) tasks.push(changeQ.refetch());
    await Promise.all(tasks);
  }, [changeQ, needChanges, needRegs, regQ]);

  function toggleExpanded(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAllVisible() {
    setExpandedKeys(new Set(rows.map((r) => requestKey(r))));
  }

  function collapseAllVisible() {
    setExpandedKeys(new Set());
  }

  const pageCursor = useMemo(() => cursorFromDescendingPage(rows, requestId) ?? undefined, [rows]);

  const fetchedCount = reg.length + ch.length;
  const canNext = useMemo(() => {
    if (type === 'registration') return reg.length === pagination.limit;
    if (type === 'change') return ch.length === pagination.limit;

    // Unified: if we fetched more than we display, we definitely have a next page.
    if (fetchedCount > rows.length) return true;
    // Otherwise, if any source hit its limit, there might be more beyond.
    if (reg.length === pagination.limit) return true;
    if (ch.length === pagination.limit) return true;
    return false;
  }, [ch.length, fetchedCount, pagination.limit, reg.length, rows.length, type]);

  const isLoading = (needRegs && regQ.isLoading) || (needChanges && changeQ.isLoading);
  const error = (needRegs && regQ.isError ? regQ.error : null) || (needChanges && changeQ.isError ? changeQ.error : null);

  const smartNeedle = useMemo(() => smart.trim(), [smart]);
  const debouncedNeedle = useDebouncedValue(smartNeedle, 200);

  const userSuggestEnabled =
    isAdmin && smartNeedle.length >= 2 && debouncedNeedle === smartNeedle && !smartNeedle.includes(':') && parseNumericToken(smartNeedle) === null;

  const userSuggestQuery = useQuery({
    queryKey: ['users', 'search', { q: debouncedNeedle, limit: 8 }],
    enabled: userSuggestEnabled,
    queryFn: async () => (await searchUsers({ q: debouncedNeedle, limit: 8 })).data,
    staleTime: 10_000,
  });

  const openRequestById = useCallback(
    async (id: number) => {
      // If the id is already on the page, we know the type and can open directly.
      const onPage = rows.find((request) => requestId(request) === id);
      if (onPage) {
        navigate(`${basePath}/requests/${requestType(onPage)}/${id}`);
        return;
      }

      try {
        await fetchRegistrationRequest(id);
        navigate(`${basePath}/requests/registration/${id}`);
        return;
      } catch {
        // ignore and try change
      }

      try {
        await fetchChangeRequest(id);
        navigate(`${basePath}/requests/change/${id}`);
        return;
      } catch {
        // ignore
      }

      toasts.pushToast({ variant: 'danger', title: t('requests.smart.error.not_found', { id: String(id) }) });
    },
    [basePath, navigate, rows, t, toasts]
  );

  async function applySmartText(raw: string) {
    const input = raw.trim();
    if (!input) return;

    if (input === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(input).map((x) => x.trim()).filter(Boolean);

    // Pure numeric → open request by id.
    const firstToken = tokens[0];
    const numericOnly = tokens.length === 1 && firstToken ? parseNumericToken(firstToken) : null;
    if (numericOnly !== null) {
      setSmart('');
      setSmartErrors([]);
      void openRequestById(numericOnly);
      return;
    }

    let nextType = type;
    let nextState = state;
    let nextQ = qText;
    let nextUser = userId;
    let nextAdmin = adminId;
    let nextApiIp = apiIp;
    let nextClientIp = clientIp;
    let nextClientPtr = clientPtr;

    const free: string[] = [];
    const errors: string[] = [];

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (kv) {
        const key = canonicalKey(kv.rawKey);
        const value = unquoteSmartValue(kv.rawValue);

        if (!key) {
          errors.push(t('filters.smart.error.unknown_key', { key: kv.rawKey }));
          continue;
        }

        if (!value.trim()) {
          errors.push(t('filters.smart.error.missing_value', { key: kv.rawKey }));
          continue;
        }

        if (key === 'q') {
          nextQ = value;
          continue;
        }

        if (key === 'type') {
          const tv = parseTypeValue(value);
          if (!tv) {
            errors.push(t('requests.smart.error.type_unresolved', { value }));
            continue;
          }
          nextType = tv;
          continue;
        }

        if (key === 'state') {
          const sv = resolveStateValue(value);
          if (!sv) {
            errors.push(t('requests.smart.error.state_unresolved', { value }));
            continue;
          }
          nextState = sv;
          continue;
        }

        if (key === 'user') {
          if (!isAdmin) {
            errors.push(t('filters.smart.error.admin_only', { key: kv.rawKey }));
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

        if (key === 'admin') {
          if (!isAdmin) {
            errors.push(t('filters.smart.error.admin_only', { key: kv.rawKey }));
            continue;
          }
          const n = parseNumericToken(value);
          if (n !== null) {
            nextAdmin = String(n);
            continue;
          }

          const users = (await searchUsers({ q: value, limit: 10 })).data;
          const exact = users.filter((u) => u.login.toLowerCase() === value.toLowerCase());
          const [resolvedAdmin] = exact;
          if (resolvedAdmin) {
            nextAdmin = String(resolvedAdmin.id);
            continue;
          }

          errors.push(t('requests.smart.error.admin_unresolved', { value }));
          continue;
        }

        if (key === 'api_ip') {
          nextApiIp = value;
          continue;
        }

        if (key === 'client_ip') {
          nextClientIp = value;
          continue;
        }

        if (key === 'client_ptr') {
          nextClientPtr = value;
          continue;
        }

        if (key === 'id') {
          const n = parseNumericToken(value);
          if (n !== null) {
            setSmart('');
            setSmartErrors([]);
            void openRequestById(n);
            return;
          }

          errors.push(t('requests.smart.error.id_numeric_only', { value }));
          continue;
        }

        errors.push(t('filters.smart.error.unknown_key', { key: kv.rawKey }));
      } else {
        free.push(unquoteSmartValue(token));
      }
    }

    if (free.length > 0) {
      nextQ = free.join(' ');
    }

    if (errors.length > 0) {
      setSmartErrors(errors);
      toasts.pushToast({ variant: 'danger', title: errors[0] ?? t('common.unknown_error') });
      return;
    }

    setType(nextType);
    setState(nextState);
    setQText(nextQ);
    setUserId(nextUser);
    setAdminId(nextAdmin);
    setApiIp(nextApiIp);
    setClientIp(nextClientIp);
    setClientPtr(nextClientPtr);
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
          testId: 'admin.requests.smart.suggest.help',
        },
      ];
    }

    const suggestions: SmartFilterSuggestion[] = [];

    const numeric = parseNumericToken(needle);
    if (numeric !== null) {
      const id = String(numeric);

      suggestions.push({
        id: 'open',
        primary: t('requests.smart.suggest.open', { id }),
        secondary: t('requests.smart.suggest.open.secondary'),
        onPick: () => {
          setSmart('');
          setSmartErrors([]);
          void openRequestById(numeric);
        },
        testId: 'admin.requests.smart.suggest.open',
      });

      suggestions.push({
        id: 'q',
        primary: t('requests.smart.suggest.q', { value: id }),
        secondary: t('requests.smart.suggest.q.secondary'),
        onPick: () => {
          setQText(id);
          setSmart('');
          setSmartErrors([]);
        },
        testId: 'admin.requests.smart.suggest.q',
      });

      if (isAdmin) suggestions.push({
        id: 'user',
        primary: t('requests.smart.suggest.user_id', { id }),
        secondary: t('requests.smart.suggest.user_id.secondary'),
        onPick: () => {
          setUserId(id);
          setSmart('');
          setSmartErrors([]);
        },
        testId: 'admin.requests.smart.suggest.user',
      });

      if (isAdmin) suggestions.push({
        id: 'admin',
        primary: t('requests.smart.suggest.admin_id', { id }),
        secondary: t('requests.smart.suggest.admin_id.secondary'),
        onPick: () => {
          setAdminId(id);
          setSmart('');
          setSmartErrors([]);
        },
        testId: 'admin.requests.smart.suggest.admin',
      });

      return suggestions;
    }

    if (needle.includes(':')) {
      suggestions.push({
        id: 'apply',
        primary: t('filters.smart.suggest.apply.primary'),
        secondary: t('filters.smart.suggest.apply.secondary'),
        onPick: () => void applySmartText(needle),
        testId: 'admin.requests.smart.suggest.apply',
      });
      return suggestions;
    }

    // Default free text: server-side search.
    suggestions.push({
      id: 'q',
      primary: t('requests.smart.suggest.q', { value: needle }),
      secondary: t('requests.smart.suggest.q.secondary'),
      onPick: () => {
        setQText(needle);
        setSmart('');
        setSmartErrors([]);
      },
      testId: 'admin.requests.smart.suggest.q',
    });

    // State quick pick.
    const st = resolveStateValue(needle);
    if (st) {
      suggestions.push({
        id: `state.${st}`,
        primary: t('requests.smart.suggest.state', { state: t(requestStateLabelKey(st)) }),
        secondary: `state:${st}`,
        onPick: () => {
          setState(st);
          setSmart('');
          setSmartErrors([]);
        },
        testId: `admin.requests.smart.suggest.state.${st}`,
      });
    }

    // Type quick pick.
    const tv = parseTypeValue(needle);
    if (tv && tv !== 'all') {
      suggestions.push({
        id: `type.${tv}`,
        primary: t('requests.smart.suggest.type', { type: t(requestTypeLabelKey(tv)) }),
        secondary: `type:${tv}`,
        onPick: () => {
          setType(tv);
          setSmart('');
          setSmartErrors([]);
        },
        testId: `admin.requests.smart.suggest.type.${tv}`,
      });
    }

    // User login suggestions (admin only).
    if (isAdmin) {
      const users = userSuggestQuery.data ?? [];
      for (const u of users.slice(0, 5)) {
        suggestions.push({
          id: `user.${u.id}`,
          primary: t('requests.smart.suggest.user_login', { login: u.login }),
          secondary: `#${u.id}`,
          onPick: () => {
            setUserId(String(u.id));
            setSmart('');
            setSmartErrors([]);
          },
          testId: `admin.requests.smart.suggest.user.${u.id}`,
        });
      }
    }

    return suggestions;
  }, [applySmartText, isAdmin, openRequestById, smartNeedle, t, userSuggestQuery.data]);

  const shareUrl = useMemo(() => (typeof window !== 'undefined' ? window.location.href : ''), [sp]);

  if (!isAdmin) return <Navigate to="/app" replace />;

  function renderExpandedContent(request: UnifiedRequestRow, compact = false) {
    const id = requestId(request);
    const reqType = requestType(request);
    const testPrefix = `admin.requests.expanded.${reqType}.${id}`;
    const risk = request._type === 'registration' ? fraudRiskBadge(request) : null;
    const updatedAt = requestDateValue(request, 'updated_at');

    return (
      <div className="space-y-3" data-testid={testPrefix}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="text-xs text-muted">{t('common.user')}</div>
            <div className="text-sm">{userLabel(request.user)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{t('requests.detail.admin')}</div>
            <div className="text-sm">{userLabel(request.admin)}</div>
          </div>
          <div>
            <div className="text-xs text-muted">{t('common.updated')}</div>
            <div className="text-sm">{updatedAt ? formatDateTime(updatedAt) : '—'}</div>
          </div>
          {request._type === 'registration' ? (
            <>
              <div>
                <div className="text-xs text-muted">{t('requests.field.login')}</div>
                <div className="text-sm">{String(request.login ?? '—')}</div>
              </div>
              <div>
                <div className="text-xs text-muted">{t('requests.field.full_name')}</div>
                <div className="text-sm">{String(request.full_name ?? '—')}</div>
              </div>
              <div>
                <div className="text-xs text-muted">{t('requests.field.email')}</div>
                <div className="text-sm">{String(request.email ?? '—')}</div>
              </div>
              <div className="md:col-span-3">
                <div className="text-xs text-muted">{t('requests.field.address')}</div>
                <div className="whitespace-pre-line text-sm">{String(request.address ?? '—')}</div>
              </div>
              <div className="md:col-span-3">
                <div className="text-xs text-muted">{t('requests.field.note')}</div>
                <div className="whitespace-pre-line text-sm">{String(request.note ?? '—')}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-xs text-muted">{t('requests.field.full_name')}</div>
                <div className="text-sm">{String(request.full_name ?? '—')}</div>
              </div>
              <div>
                <div className="text-xs text-muted">{t('requests.field.email')}</div>
                <div className="text-sm">{String(request.email ?? '—')}</div>
              </div>
              <div className="md:col-span-3">
                <div className="text-xs text-muted">{t('requests.field.change_reason')}</div>
                <div className="whitespace-pre-line text-sm">{String(request.change_reason ?? '—')}</div>
              </div>
            </>
          )}
        </div>

        {request.admin_response ? (
          <div className="rounded-md border border-border bg-surface p-3">
            <div className="text-xs text-muted">{t('requests.detail.admin_response')}</div>
            <div className="mt-1 whitespace-pre-line text-sm">{String(request.admin_response)}</div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && risk ? (
            <Badge variant={risk.variant} title={t('requests.risk.tooltip', { score: risk.score })}>
              {t(risk.labelKey)} {risk.score}
            </Badge>
          ) : null}
          <RequestOperationalLinks request={request} basePath={basePath} compact testIdPrefix={testPrefix} />
        </div>

        {isAdmin ? (
          <RequestReviewActions
            request={request}
            reqType={reqType}
            reqId={id}
            isAdmin={isAdmin}
            basePath={basePath}
            compact={compact}
            showDetailLink
            testIdPrefix={`${testPrefix}.resolve`}
            onResolved={refreshRequests}
          />
        ) : null}
      </div>
    );
  }


  return (
    <ListShell
      testId="admin.requests.list"
      header={<PageHeader title={isAdmin ? t('requests.list.title') : t('requests.my.title')} description={isAdmin ? t('requests.list.description') : t('requests.my.description')} />}
      filters={
        <RequestsFilters
          isAdmin={isAdmin}
          type={type}
          state={state}
          qText={qText}
          userId={userId}
          adminId={adminId}
          apiIp={apiIp}
          clientIp={clientIp}
          clientPtr={clientPtr}
          smart={smart}
          smartNeedle={smartNeedle}
          smartErrors={smartErrors}
          smartSuggestions={smartSuggestions}
          helpOpen={helpOpen}
          advancedOpen={advancedOpen}
          filtersActive={filtersActive}
          shareUrl={shareUrl}
          rowsLength={rows.length}
          allVisibleExpanded={allVisibleExpanded}
          smartInputRef={smartInputRef}
          setType={setType}
          setState={setState}
          setQText={setQText}
          setUserId={setUserId}
          setAdminId={setAdminId}
          setApiIp={setApiIp}
          setClientIp={setClientIp}
          setClientPtr={setClientPtr}
          setSmart={setSmart}
          setSmartErrors={setSmartErrors}
          setHelpOpen={setHelpOpen}
          setAdvancedOpen={setAdvancedOpen}
          applySmartText={applySmartText}
          clearFilters={clearFilters}
          expandAllVisible={expandAllVisible}
          collapseAllVisible={collapseAllVisible}
        />
      }

    >
      {isLoading ? (
        <LoadingState testId="admin.requests.loading" title={t('common.loading')} />
      ) : error ? (
        <ErrorState
          testId="admin.requests.error"
          title={t('requests.list.load_error.title')}
          error={error}
          onRetry={() => {
            if (needRegs) void regQ.refetch();
            if (needChanges) void changeQ.refetch();
          }}
          showBack={false}
          detailsExtra={{ page: isAdmin ? 'admin.requests' : 'app.requests', scope: basePath }}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          testId="admin.requests.empty"
          title={filtersActive ? t('empty.list.no_matches.title') : t('requests.list.empty')}
          body={filtersActive ? t('empty.list.no_matches.body') : undefined}
          actionLabel={filtersActive ? t('common.clear_filters') : undefined}
          onAction={filtersActive ? clearFilters : undefined}
        />
      ) : (
        <RequestsListContent
          rows={rows}
          isAdmin={isAdmin}
          basePath={basePath}
          expandedKeys={expandedKeys}
          canNext={canNext}
          pageCursor={pageCursor}
          pagination={pagination}
          onToggleExpanded={toggleExpanded}
          renderExpandedContent={renderExpandedContent}
        />
      )}
    </ListShell>
  );
}

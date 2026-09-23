import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';
import { useChrome } from '../../../components/layout/ChromeContext';
import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import type { SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import { getMetaActionStateId, HaveApiError, isAmbiguousMutationError } from '../../../lib/api/haveapi';
import {
  fetchChangeRequest,
  fetchChangeRequests,
  fetchRegistrationRequest,
  fetchRegistrationRequests,
  resolveChangeRequest,
  resolveRegistrationRequest,
  type ResolveUserRequestAction,
} from '../../../lib/api/requests';
import { searchUsers } from '../../../lib/api/users';
import { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';
import { useDebouncedValue } from '../../../lib/hooks/useDebouncedValue';
import { cursorFromDescendingPage } from '../../../lib/lockIndex';
import { useTierSlowIntervalMs } from '../../../lib/refreshTiers';
import { parseNumericToken } from '../../../lib/smartFilter';
import { isLocalLockPersistenceError, type LocalMutationGeneration } from '../../../lib/localLocks';
import { objectRef } from '../../../lib/objectRef';
import { RequestsBulkActions } from './RequestsBulkActions';
import { RequestsExpandedContent } from './RequestsExpandedContent';
import { RequestsFilters } from './RequestsFilters';
import { RequestsListContent } from './RequestsListContent';
import { RequestsListStatus } from './RequestsListStatus';
import { requestMatchesReviewTarget, requestReviewQueueAfter } from './RequestDetailModel';
import { fetchAwaitingReviewTarget, RequestReviewPreconditionError } from './RequestResolveMutation';
import {
  requestActionNeedsReason,
  requestBulkReviewActions,
  requestCanEnterBulkReview,
  requestReviewActions,
} from './RequestReviewModel';
import {
  ALL_ADMIN_REQUEST_STATES,
  DEFAULT_ADMIN_REQUEST_STATE,
  adminRequestApiState,
  adminRequestStateFilterFromUrl,
  buildRequestPage,
  defaultStateOptions,
  resetAdminRequestPaginationOnFilterChange,
  requestId,
  requestKey,
  requestType,
  requestTypeFilterFromUrl,
  safeNumber,
  type RequestRowType,
  type RequestTypeFilter,
  type UnifiedRequestRow,
} from './RequestsModel';

function commonBulkActions(rows: UnifiedRequestRow[], canResolve: boolean): ResolveUserRequestAction[] {
  if (rows.length === 0) return [];
  const [first, ...rest] = rows;
  if (!first) return [];
  const firstActions = requestBulkReviewActions(requestType(first), first, canResolve);
  return firstActions.filter((action) => rest.every((row) => (
    requestBulkReviewActions(requestType(row), row, canResolve).includes(action)
  )));
}

function isRequestNotFoundError(error: unknown): boolean {
  if (!(error instanceof HaveApiError)) return false;
  if (error.httpStatus === 404) return true;
  return /not found|nenalezen/i.test(error.message);
}

function requestApplicantSearchValues(row: UnifiedRequestRow): string[] {
  const values: unknown[] = [row.login, row.full_name, row.email];
  if (row.user && typeof row.user === 'object') {
    const user = row.user as Record<string, unknown>;
    values.push(user['login'], user['label']);
  }
  return values
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .map((value) => value.trim());
}

export function RequestsPage() {
  const { basePath, mode } = useAppMode();
  const auth = useAuth();
  const isAdmin = mode === 'admin' && auth.role === 'admin';
  const canResolve = isAdmin;
  const { t } = useI18n();
  const toasts = useToasts();
  const chrome = useChrome();
  const navigate = useNavigate();
  const tierSlowRefetchMs = useTierSlowIntervalMs();
  const [sp, setSp] = useSearchParams();

  const [type, setType] = useState<RequestTypeFilter>(() => requestTypeFilterFromUrl(sp.get('type')));
  const [state, setState] = useState(() => adminRequestStateFilterFromUrl(sp.get('state')));
  const [userId, setUserId] = useState(() => sp.get('user') ?? '');
  const [adminId, setAdminId] = useState(() => sp.get('admin') ?? '');
  const [apiIp, setApiIp] = useState(() => sp.get('api_ip') ?? '');
  const [clientIp, setClientIp] = useState(() => sp.get('client_ip') ?? '');
  const [clientPtr, setClientPtr] = useState(() => sp.get('client_ptr') ?? '');
  const [smart, setSmart] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [bulkAction, setBulkAction] = useState<ResolveUserRequestAction>('ignore');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [openingRequestId, setOpeningRequestId] = useState<number | null>(null);
  const smartInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setType(requestTypeFilterFromUrl(sp.get('type')));
    setState(adminRequestStateFilterFromUrl(sp.get('state')));
    setUserId(isAdmin ? sp.get('user') ?? '' : '');
    setAdminId(isAdmin ? sp.get('admin') ?? '' : '');
    setApiIp(sp.get('api_ip') ?? '');
    setClientIp(sp.get('client_ip') ?? '');
    setClientPtr(sp.get('client_ptr') ?? '');
  }, [isAdmin, sp]);

  useEffect(() => {
    const next = new URLSearchParams(sp);

    if (type !== 'all') next.set('type', type);
    else next.delete('type');

    const normalizedState = adminRequestStateFilterFromUrl(state);
    if (
      normalizedState !== DEFAULT_ADMIN_REQUEST_STATE &&
      (normalizedState === ALL_ADMIN_REQUEST_STATES || defaultStateOptions().includes(normalizedState))
    ) {
      next.set('state', normalizedState);
    } else {
      next.delete('state');
    }

    // `q` was previously advertised but is not part of the deployed requests API.
    next.delete('q');

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

    resetAdminRequestPaginationOnFilterChange(next, sp);
    if (next.toString() !== sp.toString()) setSp(next, { replace: true });
  }, [adminId, apiIp, clientIp, clientPtr, isAdmin, setSp, sp, state, type, userId]);

  const stateFilter = adminRequestStateFilterFromUrl(state);
  const apiState = adminRequestApiState(stateFilter);
  const userIdNum = safeNumber(userId);
  const adminIdNum = safeNumber(adminId);
  const filtersActive = Boolean(
    type !== 'all' ||
      stateFilter !== DEFAULT_ADMIN_REQUEST_STATE ||
      userIdNum !== undefined ||
      adminIdNum !== undefined ||
      apiIp.trim() ||
      clientIp.trim() ||
      clientPtr.trim(),
  );

  function clearFilters() {
    setType('all');
    setState(DEFAULT_ADMIN_REQUEST_STATE);
    setUserId('');
    setAdminId('');
    setApiIp('');
    setClientIp('');
    setClientPtr('');
    setSmart('');
  }

  function changeSelectionMode(enabled: boolean) {
    setSelectionMode(enabled);
    if (!enabled) {
      setSelectedKeys(new Set());
      setBulkReason('');
    }
  }

  const pagination = useKeysetPagination({
    id: 'admin.requests.list',
    filterKey: JSON.stringify({
      scope: basePath,
      type,
      state: stateFilter,
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
  const apiPageLimit = pagination.limit + 1;

  const regQ = useQuery({
    queryKey: [
      'user_request',
      'registrations',
      'index',
      {
        enabled: needRegs,
        limit: apiPageLimit,
        fromId: pagination.fromId,
        state: apiState,
        userId: userIdNum,
        adminId: adminIdNum,
        apiIp: apiIp.trim(),
        clientIp: clientIp.trim(),
        clientPtr: clientPtr.trim(),
      },
    ],
    enabled: needRegs,
    queryFn: async () =>
      await fetchRegistrationRequests({
        limit: apiPageLimit,
        fromId: pagination.fromId,
        state: apiState,
        userId: userIdNum,
        adminId: adminIdNum,
        apiIpAddr: apiIp.trim() || undefined,
        clientIpAddr: clientIp.trim() || undefined,
        clientIpPtr: clientPtr.trim() || undefined,
      }),
    staleTime: 15_000,
    refetchInterval: tierSlowRefetchMs,
  });

  const changeQ = useQuery({
    queryKey: [
      'user_request',
      'changes',
      'index',
      {
        enabled: needChanges,
        limit: apiPageLimit,
        fromId: pagination.fromId,
        state: apiState,
        userId: userIdNum,
        adminId: adminIdNum,
        apiIp: apiIp.trim(),
        clientIp: clientIp.trim(),
        clientPtr: clientPtr.trim(),
      },
    ],
    enabled: needChanges,
    queryFn: async () =>
      await fetchChangeRequests({
        limit: apiPageLimit,
        fromId: pagination.fromId,
        state: apiState,
        userId: userIdNum,
        adminId: adminIdNum,
        apiIpAddr: apiIp.trim() || undefined,
        clientIpAddr: clientIp.trim() || undefined,
        clientIpPtr: clientPtr.trim() || undefined,
      }),
    staleTime: 15_000,
    refetchInterval: tierSlowRefetchMs,
  });

  const reg = regQ.data?.data ?? [];
  const ch = changeQ.data?.data ?? [];
  const requestPage = useMemo(
    () => buildRequestPage(reg, ch, type, pagination.limit, stateFilter),
    [ch, pagination.limit, reg, stateFilter, type],
  );
  const rows = requestPage.rows;

  const lockedRequestIds = useMemo(
    () => new Set(chrome.localLocks.filter((lock) => lock.kind === 'UserRequest').map((lock) => lock.id)),
    [chrome.localLocks],
  );
  const bulkSelectableKeys = useMemo(() => new Set(rows.filter((row) => requestCanEnterBulkReview(
    requestType(row),
    row,
    canResolve,
    lockedRequestIds.has(requestId(row)),
  )).map(requestKey)), [canResolve, lockedRequestIds, rows]);
  const reviewableRows = useMemo(() => rows.filter((row) => (
    !lockedRequestIds.has(requestId(row))
      && requestReviewActions(requestType(row), row, canResolve).length > 0
  )), [canResolve, lockedRequestIds, rows]);

  useEffect(() => {
    const visibleKeys = new Set(rows.map(requestKey));
    setExpandedKeys((previous) => {
      const next = new Set([...previous].filter((key) => visibleKeys.has(key)));
      return next.size === previous.size ? previous : next;
    });
  }, [rows]);

  useEffect(() => {
    setSelectedKeys((previous) => {
      const next = new Set([...previous].filter((key) => bulkSelectableKeys.has(key)));
      return next.size === previous.size ? previous : next;
    });
  }, [bulkSelectableKeys]);
  function toggleSelected(key: string, selected: boolean) {
    if (selected && !bulkSelectableKeys.has(key)) return;
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (selected) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleAllVisible(selected: boolean) {
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      for (const row of rows) {
        const key = requestKey(row);
        if (selected && bulkSelectableKeys.has(key)) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }

  function toggleExpanded(key: string) {
    setExpandedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAll() {
    setExpandedKeys(new Set(rows.map(requestKey)));
  }

  function collapseAll() {
    setExpandedKeys(new Set());
  }

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedKeys.has(requestKey(row)) && bulkSelectableKeys.has(requestKey(row))),
    [bulkSelectableKeys, rows, selectedKeys],
  );
  const allowedBulkActions = useMemo(
    () => commonBulkActions(selectedRows, canResolve),
    [canResolve, selectedRows],
  );
  const containsSelectedRegistration = selectedRows.some((row) => requestType(row) === 'registration');
  const bulkNeedsReason = bulkAction === 'deny' || bulkAction === 'request_correction';

  function changeBulkAction(action: ResolveUserRequestAction) {
    if (action !== bulkAction) setBulkReason('');
    setBulkAction(action);
  }

  useEffect(() => {
    if (allowedBulkActions.length === 0 || allowedBulkActions.includes(bulkAction)) return;
    const next = allowedBulkActions.includes('ignore') ? 'ignore' : allowedBulkActions[0] ?? 'ignore';
    if (next !== bulkAction) setBulkReason('');
    setBulkAction(next);
  }, [allowedBulkActions, bulkAction]);

  const refreshRequests = useCallback(async () => {
    const tasks: Promise<unknown>[] = [];
    if (needRegs) tasks.push(regQ.refetch());
    if (needChanges) tasks.push(changeQ.refetch());
    await Promise.all(tasks);
  }, [changeQ, needChanges, needRegs, regQ]);

  async function applyBulkAction() {
    if (!canResolve || selectedRows.length === 0 || bulkSubmitting || !allowedBulkActions.includes(bulkAction)) return;
    const reason = bulkReason.trim();
    if (bulkNeedsReason && !reason) {
      toasts.pushToast({ variant: 'danger', title: t('requests.bulk.reason_required') });
      return;
    }

    setBulkSubmitting(true);
    let succeeded = 0;
    const failures: string[] = [];
    const failedKeys = new Set<string>();
    const uncertainIds: number[] = [];
    let preconditionChanged = false;

    for (const [rowIndex, row] of selectedRows.entries()) {
      const id = requestId(row);
      const key = requestKey(row);
      const requestRef = objectRef('UserRequest', id);
      let mutationGeneration: LocalMutationGeneration | undefined;
      let mutationStarted = false;
      let settleError: unknown;
      try {
        if (requestType(row) === 'registration' && bulkAction === 'approve') {
          throw new Error(t('requests.bulk.registration_approve_blocked'));
        }
        await fetchAwaitingReviewTarget(requestType(row), id);
        mutationGeneration = await chrome.acquireLocalLock(requestRef, { durable: true });
        const payload = { action: bulkAction, reason: bulkNeedsReason ? reason : undefined };
        mutationStarted = true;
        const response = requestType(row) === 'registration'
          ? await resolveRegistrationRequest(id, payload)
          : await resolveChangeRequest(id, payload);
        const actionStateId = getMetaActionStateId(response.meta);
        if (actionStateId) chrome.trackActionState(actionStateId, {
          object: requestRef,
          mutationGeneration,
          objectLabel: `#${id}`,
        });
        succeeded += 1;
      } catch (error: unknown) {
        settleError = error;
        if (error instanceof RequestReviewPreconditionError) {
          preconditionChanged = true;
          failedKeys.add(key);
          failures.push(`#${id}: ${t('requests.bulk.precondition_changed')}`);
        } else if (mutationStarted && isAmbiguousMutationError(error)) {
          uncertainIds.push(id);
          for (const untouched of selectedRows.slice(rowIndex + 1)) failedKeys.add(requestKey(untouched));
          break;
        } else {
          failedKeys.add(key);
          const message = isLocalLockPersistenceError(error)
            ? t('requests.resolve.toast.blocked.title')
            : error instanceof Error ? error.message : String(error);
          failures.push(`#${id}: ${message}`);
        }
      } finally {
        if (mutationGeneration) chrome.settleLocalLock(requestRef, settleError, mutationGeneration);
      }
    }

    setBulkSubmitting(false);
    setSelectedKeys(failedKeys);
    if (failedKeys.size === 0) {
      setBulkReason('');
      setSelectionMode(false);
    }

    if (succeeded > 0) {
      toasts.pushToast({
        variant: 'ok',
        title: t('requests.bulk.toast.title', { count: String(succeeded) }),
        body: failures.length ? t('requests.bulk.toast.partial', { count: String(failures.length) }) : undefined,
      });
    }

    if (succeeded > 0 || uncertainIds.length > 0 || preconditionChanged) await refreshRequests();

    if (uncertainIds.length > 0) {
      toasts.pushToast({
        variant: 'warn',
        title: t('requests.bulk.toast.uncertain.title'),
        body: t('requests.bulk.toast.uncertain.body', { count: String(uncertainIds.length) }),
        autoDismissMs: false,
      });
    }

    if (failures.length > 0) {
      toasts.pushToast({
        variant: 'danger',
        title: t('requests.bulk.toast.error.title'),
        body: `${failures.slice(0, 3).join('\n')}\n${t('requests.bulk.toast.failed_stay_selected')}`,
        autoDismissMs: false,
      });
    }
  }

  const pageCursor = useMemo(() => cursorFromDescendingPage(rows, requestId) ?? undefined, [rows]);
  const canNext = pagination.hasForward || (requestPage.hasMore && pageCursor !== undefined);

  const isLoading = (needRegs && regQ.isLoading) || (needChanges && changeQ.isLoading);
  const error = (needRegs && regQ.isError ? regQ.error : null) || (needChanges && changeQ.isError ? changeQ.error : null);
  const listReturnTo = useMemo(() => {
    const query = sp.toString();
    return `${basePath}/requests${query ? `?${query}` : ''}`;
  }, [basePath, sp]);

  const requestDetailHref = useCallback(
    (requestTypeValue: RequestRowType, id: number) => {
      const detailParams = new URLSearchParams({ returnTo: listReturnTo });
      return `${basePath}/requests/${requestTypeValue}/${id}?${detailParams.toString()}`;
    },
    [basePath, listReturnTo],
  );

  const reviewQueueTargets = useMemo(() => reviewableRows.map((request) => ({
    type: requestType(request),
    id: requestId(request),
  })), [reviewableRows]);

  const requestReviewState = useCallback((request: UnifiedRequestRow) => {
    const remaining = requestReviewQueueAfter(reviewQueueTargets, {
      type: requestType(request),
      id: requestId(request),
    });
    if (remaining === null) return undefined;
    return {
      returnTo: listReturnTo,
      reviewQueueActive: true,
      reviewQueue: remaining,
    };
  }, [listReturnTo, reviewQueueTargets]);

  const startSequentialReview = useCallback(() => {
    const [first, ...remaining] = reviewableRows;
    if (!first) return;
    navigate(requestDetailHref(requestType(first), requestId(first)), {
      state: {
        returnTo: listReturnTo,
        reviewQueueActive: true,
        reviewQueue: remaining.map((request) => ({
          type: requestType(request),
          id: requestId(request),
        })),
      },
    });
  }, [listReturnTo, navigate, requestDetailHref, reviewableRows]);

  const openRequestById = useCallback(async (id: number) => {
    if (openingRequestId !== null) return;
    const onPage = rows.find((request) => requestId(request) === id);
    if (onPage) {
      navigate(requestDetailHref(requestType(onPage), id), { state: requestReviewState(onPage) });
      return;
    }

    setOpeningRequestId(id);
    try {
      const results = await Promise.allSettled([
        fetchRegistrationRequest(id),
        fetchChangeRequest(id),
      ]);
      const fulfilled: Array<{ endpoint: RequestRowType; data: unknown }> = [];
      const [registrationResult, changeResult] = results;
      if (registrationResult?.status === 'fulfilled') {
        fulfilled.push({ endpoint: 'registration', data: registrationResult.value.data });
      }
      if (changeResult?.status === 'fulfilled') {
        fulfilled.push({ endpoint: 'change', data: changeResult.value.data });
      }

      const matches = [...new Set(
        fulfilled
          .filter((candidate) => requestMatchesReviewTarget(candidate.data, candidate.endpoint, id))
          .map((candidate) => candidate.endpoint),
      )];
      if (matches.length === 1 && matches[0]) {
        navigate(requestDetailHref(matches[0], id));
        return;
      }

      const rejected = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => result.reason);
      const definitelyMissing = fulfilled.length === 0
        && rejected.length === results.length
        && rejected.every(isRequestNotFoundError);
      toasts.pushToast({
        variant: 'danger',
        title: definitelyMissing
          ? t('requests.smart.error.not_found', { id: String(id) })
          : t('requests.smart.error.lookup_failed', { id: String(id) }),
      });
    } finally {
      setOpeningRequestId(null);
    }
  }, [navigate, openingRequestId, requestDetailHref, requestReviewState, rows, t, toasts]);

  const smartNeedle = smart.trim();
  const debouncedNeedle = useDebouncedValue(smartNeedle, 200);
  const userSuggestEnabled =
    smartNeedle.length >= 2 &&
    debouncedNeedle === smartNeedle &&
    parseNumericToken(smartNeedle) === null;
  const userSuggestQuery = useQuery({
    queryKey: ['users', 'search', { q: debouncedNeedle, limit: 8 }],
    enabled: userSuggestEnabled,
    queryFn: async () => (await searchUsers({ q: debouncedNeedle, limit: 8 })).data,
    staleTime: 10_000,
  });

  async function selectApplicant(raw: string) {
    const needle = raw.trim();
    if (!needle) return;
    const numeric = parseNumericToken(needle);
    if (numeric !== null) {
      setSmart('');
      await openRequestById(numeric);
      return;
    }

    try {
      const users = (await searchUsers({ q: needle, limit: 10 })).data;
      const exact = users.find((user) => user.login.toLowerCase() === needle.toLowerCase());
      const selected = exact ?? (users.length === 1 ? users[0] : undefined);
      if (!selected) {
        toasts.pushToast({ variant: 'danger', title: t('requests.smart.error.choose_applicant') });
        return;
      }
      setUserId(String(selected.id));
      setSmart('');
    } catch (searchError: unknown) {
      toasts.pushToast({
        variant: 'danger',
        title: t('requests.smart.error.applicant_lookup'),
        body: searchError instanceof Error ? searchError.message : String(searchError),
      });
    }
  }

  const smartSuggestions = useMemo((): SmartFilterSuggestion[] => {
    if (!smartNeedle) return [];
    const numeric = parseNumericToken(smartNeedle);
    if (numeric !== null) {
      return [{
        id: 'open',
        primary: t('requests.smart.suggest.open', { id: String(numeric) }),
        secondary: t('requests.smart.suggest.open.secondary'),
        onPick: () => {
          setSmart('');
          void openRequestById(numeric);
        },
        testId: 'admin.requests.smart.suggest.open',
      }];
    }

    const needle = smartNeedle.toLowerCase();
    const visibleRequestSuggestions = rows
      .filter((row) => requestApplicantSearchValues(row).some((value) => value.toLowerCase().includes(needle)))
      .slice(0, 4)
      .map((row) => {
        const id = requestId(row);
        const rowType = requestType(row);
        const applicant = requestApplicantSearchValues(row)[0] ?? `#${id}`;
        return {
          id: `request.${rowType}.${id}`,
          primary: t('requests.smart.suggest.request', { applicant, id: String(id) }),
          secondary: t(`requests.type.${rowType}`),
          onPick: () => {
            setSmart('');
            navigate(requestDetailHref(rowType, id), { state: requestReviewState(row) });
          },
          testId: `admin.requests.smart.suggest.request.${rowType}.${id}`,
        } satisfies SmartFilterSuggestion;
      });

    const userSuggestions = (userSuggestQuery.data ?? []).slice(0, 8).map((user) => ({
      id: `user.${user.id}`,
      primary: t('requests.smart.suggest.user_login', { login: user.login }),
      secondary: user.full_name ? `${user.full_name} · #${user.id}` : `#${user.id}`,
      onPick: () => {
        setUserId(String(user.id));
        setSmart('');
      },
      testId: `admin.requests.smart.suggest.user.${user.id}`,
    }));
    return [...visibleRequestSuggestions, ...userSuggestions].slice(0, 8);
  }, [navigate, openRequestById, requestDetailHref, requestReviewState, rows, smartNeedle, t, userSuggestQuery.data]);

  const shareUrl = useMemo(() => (typeof window !== 'undefined' ? window.location.href : ''), [sp]);
  if (!isAdmin) return <Navigate to="/app" replace />;

  return (
    <ListShell
      testId="admin.requests.list"
      header={<PageHeader title={t('requests.list.title')} description={t('requests.list.description')} />}
      filters={
        <RequestsFilters
          type={type}
          state={state}
          userId={userId}
          adminId={adminId}
          apiIp={apiIp}
          clientIp={clientIp}
          clientPtr={clientPtr}
          smart={smart}
          smartSuggestions={smartSuggestions}
          smartBusy={openingRequestId !== null}
          advancedOpen={advancedOpen}
          filtersActive={filtersActive}
          shareUrl={shareUrl}
          selectionMode={selectionMode}
          canSelect={canResolve && (selectionMode || bulkSelectableKeys.size > 0)}
          smartInputRef={smartInputRef}
          setType={setType}
          setState={setState}
          setUserId={setUserId}
          setAdminId={setAdminId}
          setApiIp={setApiIp}
          setClientIp={setClientIp}
          setClientPtr={setClientPtr}
          setSmart={setSmart}
          setAdvancedOpen={setAdvancedOpen}
          setSelectionMode={changeSelectionMode}
          applySmartText={selectApplicant}
          clearFilters={clearFilters}
        />
      }
    >
      {canResolve && selectionMode && selectedRows.length > 0 ? (
        <RequestsBulkActions
          rowsLength={bulkSelectableKeys.size}
          selectedRowsLength={selectedRows.length}
          action={bulkAction}
          allowedActions={allowedBulkActions}
          containsRegistration={containsSelectedRegistration}
          reason={bulkReason}
          needsReason={bulkNeedsReason}
          submitting={bulkSubmitting}
          targets={selectedRows.map((row) => ({ id: requestId(row), type: requestType(row) }))}
          onActionChange={changeBulkAction}
          onReasonChange={setBulkReason}
          onSelectAll={() => toggleAllVisible(true)}
          onDeselectAll={() => toggleAllVisible(false)}
          onClear={() => changeSelectionMode(false)}
          onApply={applyBulkAction}
        />
      ) : null}

      <RequestsListStatus
        loading={isLoading}
        error={error}
        empty={rows.length === 0}
        filtersActive={filtersActive}
        scope={basePath}
        onRetry={() => {
          if (needRegs) void regQ.refetch();
          if (needChanges) void changeQ.refetch();
        }}
        onClear={clearFilters}
      >
        <RequestsListContent
          rows={rows}
          isAdmin={isAdmin}
          basePath={basePath}
          returnTo={listReturnTo}
          expandedKeys={expandedKeys}
          selectionMode={selectionMode}
          selectedKeys={selectedKeys}
          bulkSelectableKeys={bulkSelectableKeys}
          lockedRequestIds={lockedRequestIds}
          canNext={canNext}
          pageCursor={pageCursor}
          pagination={pagination}
          reviewableCount={reviewableRows.length}
          onStartReview={startSequentialReview}
          reviewStateFor={requestReviewState}
          onToggleExpanded={toggleExpanded}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
          onToggleSelected={toggleSelected}
          onToggleAllVisible={toggleAllVisible}
          renderExpandedContent={(request, compact) => (
            <RequestsExpandedContent
              request={request}
              isAdmin={isAdmin}
              basePath={basePath}
              returnTo={listReturnTo}
              detailState={requestReviewState(request)}
              compact={compact}
              onResolved={async () => {
                setExpandedKeys((previous) => {
                  const next = new Set(previous);
                  next.delete(requestKey(request));
                  return next;
                });
                await refreshRequests();
              }}
            />
          )}
        />
      </RequestsListStatus>
    </ListShell>
  );
}

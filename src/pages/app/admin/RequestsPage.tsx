import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleHelp, SlidersHorizontal } from 'lucide-react';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';
import { useChrome } from '../../../components/layout/ChromeContext';

import { searchUsers } from '../../../lib/api/users';
import {
  fetchChangeRequest,
  fetchChangeRequests,
  fetchRegistrationRequest,
  fetchRegistrationRequests,
  resolveChangeRequest,
  resolveRegistrationRequest,
  type ChangeRequest,
  type RegistrationRequest,
  type ResolveUserRequestAction,
} from '../../../lib/api/requests';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
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
  requestRowVariant,
  requestStateBadgeVariant,
  requestStateLabelKey,
  requestTypeBadgeVariant,
  requestTypeLabelKey,
} from '../../../lib/requestsBadges';
import { dotVariantFromBadgeVariant, tableVariantFromBadgeVariant } from '../../../lib/variantMap';

import { FilterBar } from '../../../components/layout/FilterBar';
import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';

import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { CopyButton } from '../../../components/ui/CopyButton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { FilterChip } from '../../../components/ui/FilterChip';
import { Input } from '../../../components/ui/Input';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Select } from '../../../components/ui/Select';
import { SmartFilterInput, type SmartFilterSuggestion } from '../../../components/ui/SmartFilterInput';
import { SmartInputHelp } from '../../../components/ui/SmartInputHelp';
import { StatusDot } from '../../../components/ui/StatusDot';
import { TableCard } from '../../../components/ui/TableCard';
import { TableRowLink } from '../../../components/ui/TableRowLink';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';

type RequestTypeFilter = 'all' | 'registration' | 'change';
type RequestStateFilter = 'all' | 'awaiting' | 'pending_correction' | 'approved' | 'denied' | 'ignored';

const DEFAULT_REQUEST_STATE: RequestStateFilter = 'awaiting';
const ALL_REQUEST_STATES: RequestStateFilter = 'all';

const REQUEST_RESOLVE_ACTIONS: ResolveUserRequestAction[] = ['approve', 'deny', 'ignore', 'request_correction'];

const REQUEST_ACTION_TARGET_STATE: Record<ResolveUserRequestAction, RequestStateFilter> = {
  approve: 'approved',
  deny: 'denied',
  ignore: 'ignored',
  request_correction: 'pending_correction',
};

const REQUEST_ACTION_VARIANT: Record<ResolveUserRequestAction, 'primary' | 'secondary' | 'danger'> = {
  approve: 'primary',
  deny: 'danger',
  ignore: 'secondary',
  request_correction: 'secondary',
};

type UnifiedRequestRow =
  | (RegistrationRequest & { _type: 'registration' })
  | (ChangeRequest & { _type: 'change' });

function requestRowKey(row: UnifiedRequestRow): string {
  return `${row._type}:${String((row as LegacyAny).id)}`;
}

function requestStateOptions(): RequestStateFilter[] {
  return [ALL_REQUEST_STATES, 'awaiting', 'pending_correction', 'approved', 'denied', 'ignored'];
}

function isRequestStateFilter(value: string): value is RequestStateFilter {
  return requestStateOptions().includes(value as RequestStateFilter);
}

function stateFromSearchParams(sp: URLSearchParams): RequestStateFilter {
  const raw = sp.get('state');
  if (raw === null || !raw.trim()) return DEFAULT_REQUEST_STATE;

  const state = raw.trim().toLowerCase();
  if (isRequestStateFilter(state)) return state;
  return DEFAULT_REQUEST_STATE;
}

function requestStateFilterForApi(state: RequestStateFilter): string | undefined {
  return state === ALL_REQUEST_STATES ? undefined : state;
}

function requestStateFilterLabel(t: (key: any, vars?: Record<string, unknown>) => string, state: RequestStateFilter): string {
  if (state === ALL_REQUEST_STATES) return t('requests.state.all');
  return t(requestStateLabelKey(state));
}

function requestResolveActionLabelKey(action: ResolveUserRequestAction): string {
  return `requests.resolve.action.${action}`;
}

function availableResolveActions(state: string): ResolveUserRequestAction[] {
  const normalized = state.trim();
  return REQUEST_RESOLVE_ACTIONS.filter((action) => REQUEST_ACTION_TARGET_STATE[action] !== normalized);
}

function stringifySearchValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(stringifySearchValue).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return [obj['id'], obj['login'], obj['label'], obj['name'], obj['full_name'], obj['email']]
      .map(stringifySearchValue)
      .filter(Boolean)
      .join(' ');
  }
  return '';
}

function requestSearchHaystack(row: UnifiedRequestRow): string {
  const r = row as LegacyAny;
  const fields = [
    r.id,
    row._type,
    r.state,
    r.label,
    r.user,
    r.admin,
    r.login,
    r.full_name,
    r.org_name,
    r.org_id,
    r.email,
    r.address,
    r.how,
    r.note,
    r.change_reason,
    r.api_ip_addr,
    r.api_ip_ptr,
    r.client_ip_addr,
    r.client_ip_ptr,
    r.admin_response,
    r.currency,
    r.language,
    r.location,
    r.os_template,
  ];

  return fields.map(stringifySearchValue).filter(Boolean).join(' ').toLowerCase();
}

function requestMatchesSearch(row: UnifiedRequestRow, query: string): boolean {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (terms.length === 0) return true;

  const haystack = requestSearchHaystack(row);
  return terms.every((term) => haystack.includes(term));
}

function requestUserLabel(r: any): string {
  if (typeof r?.user?.login === 'string') return String(r.user.login);
  if (typeof r?.user?.label === 'string') return String(r.user.label);
  if (r?.user) return `#${String(r.user.id)}`;
  return '—';
}

function safeNumber(value: string): number | undefined {
  const t = value.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i <= 0) return undefined;
  return i;
}

function mergeByIdDesc(reg: RegistrationRequest[], ch: ChangeRequest[], limit: number): UnifiedRequestRow[] {
  const out: UnifiedRequestRow[] = [];

  let i = 0;
  let j = 0;

  const r = reg.map((x) => ({ ...x, _type: 'registration' as const }));
  const c = ch.map((x) => ({ ...x, _type: 'change' as const }));

  while (out.length < limit && (i < r.length || j < c.length)) {
    const a = i < r.length ? Number(r[i]?.id) : -1;
    const b = j < c.length ? Number(c[j]?.id) : -1;

    if (a >= b) {
      const item = r[i];
      if (item) out.push(item);
      i++;
    } else {
      const item = c[j];
      if (item) out.push(item);
      j++;
    }
  }

  return out;
}

function canonicalKey(rawKey: string):
  | 'q'
  | 'type'
  | 'state'
  | 'user'
  | 'admin'
  | 'api_ip'
  | 'client_ip'
  | 'client_ptr'
  | 'id'
  | null {
  const k = rawKey.trim().toLowerCase();
  if (!k) return null;
  if (k === 'q' || k === 'search' || k === 'text' || k === 'query') return 'q';
  if (k === 'type' || k === 't' || k === 'kind') return 'type';
  if (k === 'state' || k === 's' || k === 'status') return 'state';
  if (k === 'user' || k === 'u' || k === 'owner') return 'user';
  if (k === 'admin' || k === 'a' || k === 'operator' || k === 'op') return 'admin';
  if (k === 'api' || k === 'api_ip' || k === 'api_ip_addr' || k === 'apiip') return 'api_ip';
  if (k === 'client' || k === 'client_ip' || k === 'client_ip_addr' || k === 'clientip') return 'client_ip';
  if (k === 'ptr' || k === 'client_ptr' || k === 'client_ip_ptr' || k === 'clientptr') return 'client_ptr';
  if (k === 'id' || k === '#') return 'id';
  return null;
}

function parseTypeValue(value: string): RequestTypeFilter | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v === 'all' || v === '*') return 'all';
  if (v === 'registration' || v === 'registrations' || v === 'reg' || v === 'r') return 'registration';
  if (v === 'change' || v === 'changes' || v === 'c') return 'change';
  return null;
}

function resolveStateValue(value: string): RequestStateFilter | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;

  const known = requestStateOptions();
  const exact = known.find((s) => s.toLowerCase() === v);
  if (exact) return exact;

  const pref = known.filter((s) => s.toLowerCase().startsWith(v));
  if (pref.length === 1) return pref[0] ?? null;
  return null;
}

export function RequestsPage() {
  const { basePath, mode } = useAppMode();
  const isAdmin = mode === 'admin';
  const { t } = useI18n();
  const toasts = useToasts();
  const chrome = useChrome();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const tierSlowRefetchMs = useTierSlowIntervalMs();
  const [sp, setSp] = useSearchParams();

  const [type, setType] = useState<RequestTypeFilter>(() => (sp.get('type') as LegacyAny) || 'all');
  const [state, setState] = useState<RequestStateFilter>(() => stateFromSearchParams(sp));
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
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  const smartInputRef = useRef<HTMLInputElement>(null);

  // Sync from URL on navigation.
  useEffect(() => {
    setType(((sp.get('type') as LegacyAny) || 'all') as RequestTypeFilter);
    setState(stateFromSearchParams(sp));
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

    const st = isRequestStateFilter(state) ? state : DEFAULT_REQUEST_STATE;
    if (st !== DEFAULT_REQUEST_STATE) next.set('state', st);
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

  const stateFilter = isRequestStateFilter(state) ? state : DEFAULT_REQUEST_STATE;
  const stateTrim = requestStateFilterForApi(stateFilter);
  const qTrim = qText.trim() || undefined;
  const userIdNum = safeNumber(userId);
  const adminIdNum = safeNumber(adminId);

  const filtersActive = Boolean(
    qTrim ||
      (type && type !== 'all') ||
      stateFilter !== DEFAULT_REQUEST_STATE ||
      (isAdmin && userIdNum !== undefined) ||
      (isAdmin && adminIdNum !== undefined) ||
      apiIp.trim() ||
      clientIp.trim() ||
      clientPtr.trim()
  );

  function clearFilters() {
    setType('all');
    setState(DEFAULT_REQUEST_STATE);
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

  const rawRows = useMemo(() => {
    return (
      type === 'registration'
        ? (reg.map((x) => ({ ...x, _type: 'registration' as const })) as UnifiedRequestRow[])
        : type === 'change'
          ? (ch.map((x) => ({ ...x, _type: 'change' as const })) as UnifiedRequestRow[])
          : mergeByIdDesc(reg, ch, pagination.limit)
    );
  }, [ch, pagination.limit, reg, type]);

  const rows = useMemo(() => {
    const stateScopedRows =
      stateFilter === ALL_REQUEST_STATES
        ? rawRows
        : rawRows.filter((row) => String((row as LegacyAny).state ?? '').trim() === stateFilter);

    if (!qTrim) return stateScopedRows;
    return stateScopedRows.filter((row) => requestMatchesSearch(row, qTrim));
  }, [qTrim, rawRows, stateFilter]);

  const visibleRowKeys = useMemo(() => rows.map(requestRowKey), [rows]);
  const visibleRowKeySet = useMemo(() => new Set(visibleRowKeys), [visibleRowKeys]);

  useEffect(() => {
    setExpandedKeys((prev) => {
      const next = new Set([...prev].filter((key) => visibleRowKeySet.has(key)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleRowKeySet]);

  const allRowsExpanded = rows.length > 0 && visibleRowKeys.every((key) => expandedKeys.has(key));

  function toggleExpanded(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAllRows() {
    setExpandedKeys(new Set(visibleRowKeys));
  }

  function collapseAllRows() {
    setExpandedKeys(new Set());
  }

  const pageCursor = useMemo(() => cursorFromDescendingPage(rawRows as LegacyAny), [rawRows]);

  const fetchedCount = reg.length + ch.length;
  const canNext = useMemo(() => {
    if (type === 'registration') return reg.length === pagination.limit;
    if (type === 'change') return ch.length === pagination.limit;

    // Unified: if we fetched more than we display, we definitely have a next page.
    if (fetchedCount > rawRows.length) return true;
    // Otherwise, if any source hit its limit, there might be more beyond.
    if (reg.length === pagination.limit) return true;
    if (ch.length === pagination.limit) return true;
    return false;
  }, [ch.length, fetchedCount, pagination.limit, rawRows.length, reg.length, type]);

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
      const onPage = rows.find((r) => Number((r as LegacyAny).id) === id);
      if (onPage) {
        navigate(`${basePath}/requests/${(onPage as LegacyAny)._type}/${id}`);
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

  async function submitRowResolve(row: UnifiedRequestRow, action: ResolveUserRequestAction) {
    const id = Number((row as LegacyAny).id);
    if (!Number.isFinite(id) || id <= 0) return;

    const key = `${requestRowKey(row)}:${action}`;
    setResolvingKey(key);

    try {
      const res =
        row._type === 'registration'
          ? await resolveRegistrationRequest(id, { action })
          : await resolveChangeRequest(id, { action });

      const asId = getMetaActionStateId(res.meta);
      if (asId) chrome.trackActionState(asId);

      toasts.pushToast({
        variant: 'ok',
        title: t('requests.resolve.toast.title'),
        body: t('requests.resolve.toast.message'),
      });

      await qc.invalidateQueries({ queryKey: ['user_request'] });
      if (needRegs) void regQ.refetch();
      if (needChanges) void changeQ.refetch();
    } catch (e: any) {
      toasts.pushToast({
        variant: 'danger',
        title: t('requests.resolve.toast.error.title'),
        body: e?.message ?? String(e),
      });
    } finally {
      setResolvingKey((current) => (current === key ? null : current));
    }
  }

  function renderRowActions(row: UnifiedRequestRow) {
    const state = String((row as LegacyAny).state ?? '').trim();
    const actions = availableResolveActions(state);
    if (actions.length === 0) return <span className="text-xs text-faint">—</span>;

    return (
      <div className="flex flex-wrap gap-1" data-row-no-nav="true">
        {actions.map((action) => {
          const key = `${requestRowKey(row)}:${action}`;
          return (
            <Button
              key={action}
              variant={REQUEST_ACTION_VARIANT[action]}
              size="sm"
              loading={resolvingKey === key}
              disabled={Boolean(resolvingKey && resolvingKey !== key)}
              onClick={() => void submitRowResolve(row, action)}
              testId={`admin.requests.row.${row._type}.${String((row as LegacyAny).id)}.action.${action}`}
            >
              {t(requestResolveActionLabelKey(action))}
            </Button>
          );
        })}
      </div>
    );
  }

  function renderExpandedRow(row: UnifiedRequestRow) {
    const r = row as LegacyAny;
    const reqType = row._type;

    const detailItems =
      reqType === 'registration'
        ? [
            [t('requests.field.login'), String(r.login ?? '—')],
            [t('requests.field.full_name'), String(r.full_name ?? '—')],
            [t('requests.field.org'), [r.org_name, r.org_id ? `(${String(r.org_id)})` : ''].filter(Boolean).join(' ') || '—'],
            [t('requests.field.email'), String(r.email ?? '—')],
            [t('requests.field.address'), String(r.address ?? '—')],
            [t('requests.field.how'), String(r.how ?? '—')],
            [t('requests.field.note'), String(r.note ?? '—')],
          ]
        : [
            [t('requests.field.full_name'), String(r.full_name ?? '—')],
            [t('requests.field.email'), String(r.email ?? '—')],
            [t('requests.field.address'), String(r.address ?? '—')],
            [t('requests.field.change_reason'), String(r.change_reason ?? '—')],
          ];

    return (
      <div className="rounded-lg border border-border bg-surface-2 p-3" data-testid={`admin.requests.row.${reqType}.${String(r.id)}.expanded`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {detailItems.map(([label, value]) => (
            <div key={String(label)}>
              <div className="text-xs text-muted">{label}</div>
              <div className="whitespace-pre-line break-words text-sm">{value}</div>
            </div>
          ))}

          <div>
            <div className="text-xs text-muted">{t('requests.detail.api_ip')}</div>
            <div className="break-words text-sm">{String(r.api_ip_addr ?? '—')}</div>
            {r.api_ip_ptr ? <div className="break-words text-xs text-muted">{String(r.api_ip_ptr)}</div> : null}
          </div>

          <div>
            <div className="text-xs text-muted">{t('requests.detail.client_ip')}</div>
            <div className="break-words text-sm">{String(r.client_ip_addr ?? '—')}</div>
            {r.client_ip_ptr ? <div className="break-words text-xs text-muted">{String(r.client_ip_ptr)}</div> : null}
          </div>

          {r.admin_response ? (
            <div className="md:col-span-2 xl:col-span-3">
              <div className="text-xs text-muted">{t('requests.detail.admin_response')}</div>
              <div className="whitespace-pre-line break-words text-sm">{String(r.admin_response)}</div>
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <Link className="text-sm font-medium text-accent hover:underline" to={`${basePath}/requests/${reqType}/${String(r.id)}`}>
            {t('requests.list.open_detail')}
          </Link>
          <div>{renderRowActions(row)}</div>
        </div>
      </div>
    );
  }

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

    // Default free text: current loaded page search. The legacy HaveAPI index does not accept q.
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
        primary: t('requests.smart.suggest.state', { state: requestStateFilterLabel(t, st) }),
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

  const activeFilterChips = useMemo(() => {
    const chips: React.ReactNode[] = [];

    if (type && type !== 'all') {
      chips.push(
        <FilterChip
          key="type"
          label={`type:${t(requestTypeLabelKey(type))}`}
          onRemove={() => setType('all')}
          testId="admin.requests.chip.type"
        />
      );
    }

    if (stateFilter !== DEFAULT_REQUEST_STATE) {
      const tone =
        stateFilter === ALL_REQUEST_STATES
          ? 'neutral'
          : ((tableVariantFromBadgeVariant(requestStateBadgeVariant(stateFilter)) ?? 'neutral') as LegacyAny);

      chips.push(
        <FilterChip
          key="state"
          label={`state:${requestStateFilterLabel(t, stateFilter)}`}
          tone={tone}
          onRemove={() => setState(DEFAULT_REQUEST_STATE)}
          testId="admin.requests.chip.state"
        />
      );
    }

    if (qTrim) {
      chips.push(
        <FilterChip
          key="q"
          label={`q:${qTrim}`}
          onRemove={() => setQText('')}
          testId="admin.requests.chip.q"
        />
      );
    }

    if (isAdmin && userIdNum !== undefined) {
      chips.push(
        <FilterChip
          key="user"
          label={`user:#${userIdNum}`}
          onRemove={() => setUserId('')}
          testId="admin.requests.chip.user"
        />
      );
    }

    if (isAdmin && adminIdNum !== undefined) {
      chips.push(
        <FilterChip
          key="admin"
          label={`admin:#${adminIdNum}`}
          onRemove={() => setAdminId('')}
          testId="admin.requests.chip.admin"
        />
      );
    }

    if (apiIp.trim()) {
      chips.push(
        <FilterChip
          key="api_ip"
          label={`api_ip:${apiIp.trim()}`}
          onRemove={() => setApiIp('')}
          testId="admin.requests.chip.api_ip"
        />
      );
    }

    if (clientIp.trim()) {
      chips.push(
        <FilterChip
          key="client_ip"
          label={`client_ip:${clientIp.trim()}`}
          onRemove={() => setClientIp('')}
          testId="admin.requests.chip.client_ip"
        />
      );
    }

    if (clientPtr.trim()) {
      chips.push(
        <FilterChip
          key="client_ptr"
          label={`client_ptr:${clientPtr.trim()}`}
          onRemove={() => setClientPtr('')}
          testId="admin.requests.chip.client_ptr"
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
          testId={`admin.requests.chip.error.${idx}`}
        />
      );
    });

    return chips;
  }, [adminIdNum, apiIp, clientIp, clientPtr, isAdmin, qTrim, smartErrors, stateFilter, t, type, userIdNum]);

  const shareUrl = useMemo(() => (typeof window !== 'undefined' ? window.location.href : ''), [sp]);
  const tableColumnCount = isAdmin ? 11 : 9;

  const helpExamples = isAdmin
    ? [
        { example: '?', description: t('requests.list.smart_help.examples.help') },
        { example: '123', description: t('requests.list.smart_help.examples.open_id') },
        { example: 'alice', description: t('requests.list.smart_help.examples.search') },
        { example: 'state:awaiting', description: t('requests.list.smart_help.examples.state') },
        { example: 'type:registration', description: t('requests.list.smart_help.examples.type') },
        { example: 'user:alice', description: t('requests.list.smart_help.examples.user') },
      ]
    : [
        { example: '?', description: t('requests.list.smart_help.examples.help') },
        { example: '123', description: t('requests.list.smart_help.examples.open_id') },
        { example: 'address change', description: t('requests.list.smart_help.examples.search') },
        { example: 'state:awaiting', description: t('requests.list.smart_help.examples.state') },
        { example: 'type:change', description: t('requests.list.smart_help.examples.type') },
      ];

  const helpTopKeys = isAdmin
    ? [
        { key: 'q', description: t('requests.list.smart_help.keys.q'), example: 'q:alice' },
        { key: 'state', description: t('requests.list.smart_help.keys.state'), example: 'state:awaiting' },
        { key: 'type', description: t('requests.list.smart_help.keys.type'), example: 'type:change' },
        { key: 'user', description: t('requests.list.smart_help.keys.user'), example: 'user:alice' },
        { key: 'admin', description: t('requests.list.smart_help.keys.admin'), example: 'admin:root' },
      ]
    : [
        { key: 'q', description: t('requests.list.smart_help.keys.q'), example: 'q:address change' },
        { key: 'state', description: t('requests.list.smart_help.keys.state'), example: 'state:awaiting' },
        { key: 'type', description: t('requests.list.smart_help.keys.type'), example: 'type:change' },
      ];

  const helpMoreKeys = [
    { key: 'api_ip', description: t('requests.list.smart_help.keys.api_ip'), example: 'api_ip:203.0.113.10' },
    { key: 'client_ip', description: t('requests.list.smart_help.keys.client_ip'), example: 'client_ip:198.51.100.20' },
    { key: 'client_ptr', description: t('requests.list.smart_help.keys.client_ptr'), example: 'client_ptr:example.net' },
    { key: 'id', description: t('requests.list.smart_help.keys.id'), example: 'id:123' },
  ];

  if (!isAdmin) return <Navigate to="/app" replace />;

  return (
    <ListShell
      testId="admin.requests.list"
      header={<PageHeader title={isAdmin ? t('requests.list.title') : t('requests.my.title')} description={isAdmin ? t('requests.list.description') : t('requests.my.description')} />}
      filters={
        <>
          <div className="relative">
          <FilterBar testId="admin.requests.filters">
            <div className="w-full sm:max-w-xl">
              <SmartFilterInput
                ref={smartInputRef}
                value={smart}
                onChange={(v) => {
                  setSmart(v);
                  if (smartErrors.length) setSmartErrors([]);
                }}
                placeholder={t('requests.list.search.placeholder')}
                ariaLabel={t('requests.list.search.placeholder')}
                testId="admin.requests.smart_filter.input"
                suggestions={smartSuggestions}
                onSubmit={() => void applySmartText(smart)}
                suffix={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 px-0"
                    onClick={() => setHelpOpen(true)}
                    aria-label={t('filters.help.open')}
                    title={t('filters.help.open')}
                  >
                    <CircleHelp className="h-4 w-4" aria-hidden />
                  </Button>
                }
              />

              {activeFilterChips.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1" data-testid="admin.requests.active_filters">
                  {activeFilterChips}
                </div>
              ) : null}
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setAdvancedOpen(true)}
              aria-label={t('filters.advanced.open')}
              title={t('filters.advanced.open')}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              <span className="ml-2 hidden sm:inline">{t('filters.advanced.label')}</span>
            </Button>

            <Button
              variant={stateFilter === DEFAULT_REQUEST_STATE ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setState(DEFAULT_REQUEST_STATE)}
              testId="admin.requests.quick.awaiting"
            >
              {t(requestStateLabelKey('awaiting'))}
            </Button>

            <Button
              variant={stateFilter === 'pending_correction' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setState(stateFilter === 'pending_correction' ? DEFAULT_REQUEST_STATE : 'pending_correction')}
              testId="admin.requests.quick.pending_correction"
            >
              {t(requestStateLabelKey('pending_correction'))}
            </Button>

            <Button
              variant={stateFilter === ALL_REQUEST_STATES ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setState(stateFilter === ALL_REQUEST_STATES ? DEFAULT_REQUEST_STATE : ALL_REQUEST_STATES)}
              testId="admin.requests.quick.all"
            >
              {t('requests.state.all')}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={expandAllRows}
              disabled={rows.length === 0 || allRowsExpanded}
              testId="admin.requests.expand_all"
            >
              {t('requests.list.expand_all')}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={collapseAllRows}
              disabled={expandedKeys.size === 0}
              testId="admin.requests.collapse_all"
            >
              {t('requests.list.collapse_all')}
            </Button>

            <CopyButton
              size="sm"
              variant="secondary"
              label={t('common.copy_link')}
              text={shareUrl}
              testId="admin.requests.copy_link"
            />

            {filtersActive ? (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                {t('common.clear_filters')}
              </Button>
            ) : null}
          </FilterBar>

          {advancedOpen ? (
            <div
              className="absolute left-0 top-full z-40 mt-2 w-full max-w-content-lg rounded-lg border border-border bg-overlay-surface p-4 shadow-panel"
              data-testid="admin.requests.advanced_filters"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <div className="text-sm font-semibold">{t('filters.advanced.title')}</div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 px-0"
                  onClick={() => setAdvancedOpen(false)}
                  aria-label={t('common.close')}
                >
                  ×
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium">{t('requests.list.filter.type.label')}</div>
                  <div className="mt-1">
                    <Select
                      value={type}
                      onChange={(e) => setType((e.target.value as RequestTypeFilter) || 'all')}
                      aria-label={t('requests.list.filter.type.aria')}
                    >
                      <option value="all">{t('requests.list.filter.type.all')}</option>
                      <option value="registration">{t('requests.type.registration')}</option>
                      <option value="change">{t('requests.type.change')}</option>
                    </Select>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">{t('requests.list.filter.state.label')}</div>
                  <div className="mt-1">
                    <Select
                      value={stateFilter}
                      onChange={(e) => {
                        const next = e.target.value;
                        setState(isRequestStateFilter(next) ? next : DEFAULT_REQUEST_STATE);
                      }}
                      aria-label={t('requests.list.filter.state.aria')}
                    >
                      {requestStateOptions().map((s) => (
                        <option key={s} value={s}>
                          {requestStateFilterLabel(t, s)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">{t('requests.list.filter.user.label')}</div>
                  <div className="mt-1">
                    <UserLookupInput
                      value={userId}
                      onChange={setUserId}
                      placeholder={t('requests.list.filter.user.placeholder')}
                      testId="admin.requests.filter.user.lookup"
                      loadingLabel={t('common.loading')}
                      noResultsLabel={t('palette.empty.no_results')}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">{t('requests.list.filter.admin.label')}</div>
                  <div className="mt-1">
                    <UserLookupInput
                      value={adminId}
                      onChange={setAdminId}
                      placeholder={t('requests.list.filter.admin.placeholder')}
                      testId="admin.requests.filter.admin.lookup"
                      loadingLabel={t('common.loading')}
                      noResultsLabel={t('palette.empty.no_results')}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">{t('requests.list.filter.api_ip.label')}</div>
                  <div className="mt-1">
                    <Input
                      value={apiIp}
                      onChange={(e) => setApiIp(e.target.value)}
                      placeholder={t('requests.list.filter.api_ip.placeholder')}
                      testId="admin.requests.filter.api_ip"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">{t('requests.list.filter.client_ip.label')}</div>
                  <div className="mt-1">
                    <Input
                      value={clientIp}
                      onChange={(e) => setClientIp(e.target.value)}
                      placeholder={t('requests.list.filter.client_ip.placeholder')}
                      testId="admin.requests.filter.client_ip"
                    />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium">{t('requests.list.filter.client_ptr.label')}</div>
                  <div className="mt-1">
                    <Input
                      value={clientPtr}
                      onChange={(e) => setClientPtr(e.target.value)}
                      placeholder={t('requests.list.filter.client_ptr.placeholder')}
                      testId="admin.requests.filter.client_ptr"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
                {filtersActive ? (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    {t('common.clear_filters')}
                  </Button>
                ) : null}
                <Button variant="primary" size="sm" onClick={() => setAdvancedOpen(false)}>
                  {t('common.done')}
                </Button>
              </div>
            </div>
          ) : null}
          </div>

          <SmartInputHelp
            open={helpOpen}
            onClose={() => {
              setHelpOpen(false);
              if (smartNeedle === '?') setSmart('');
            }}
            title={t('filters.help.title')}
            intro={t('requests.list.smart_help.intro')}
            examples={helpExamples}
            topKeys={helpTopKeys}
            moreKeys={helpMoreKeys}
            inference={[
              t('requests.list.smart_help.inference.enter_applies'),
              t('requests.list.smart_help.inference.number_opens'),
              t('requests.list.smart_help.inference.key_value'),
            ]}
            onInsertKey={(key) => {
              setHelpOpen(false);
              setSmart(`${key}:`);
              window.requestAnimationFrame(() => smartInputRef.current?.focus());
            }}
            actions={[
              {
                label: t('filters.help.open_advanced'),
                onClick: () => {
                  setHelpOpen(false);
                  setAdvancedOpen(true);
                },
              },
              {
                label: t('common.copy_link'),
                onClick: async () => {
                  const url = typeof window !== 'undefined' ? window.location.href : '';
                  if (!url) return;
                  try {
                    await navigator.clipboard.writeText(url);
                    toasts.pushToast({ variant: 'ok', title: t('toast.copied.title') });
                  } catch {
                    toasts.pushToast({ variant: 'warn', title: t('toast.copied_failed.title') });
                  }
                },
              },
            ]}
            testId="admin.requests.smart_filter.help"
            keyRowTestIdPrefix="admin.requests.smart_filter.help.key"
          />
        </>
      }
    >
      {isLoading ? (
        <LoadingState testId="admin.requests.loading" title={t('common.loading')} />
      ) : error ? (
        <ErrorState
          testId="admin.requests.error"
          title={t('requests.list.load_error.title')}
          error={error as LegacyAny}
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
        <>
          {/* Mobile: cards */}
          <div className="space-y-2 md:hidden">
            {rows.map((r) => {
              const id = Number((r as LegacyAny).id);
              const reqType = (r as LegacyAny)._type as 'registration' | 'change';
              const key = requestRowKey(r);
              const expanded = expandedKeys.has(key);
              const st = String((r as LegacyAny).state ?? '').trim();
              const stateVar = requestStateBadgeVariant(st);
              const dotVar = dotVariantFromBadgeVariant(stateVar);
              const userLabel = requestUserLabel(r);
              const label = String((r as LegacyAny).label ?? '').trim() || '—';
              const risk = reqType === 'registration' ? fraudRiskBadge(r as LegacyAny) : null;

              return (
                <Card key={`${reqType}-${id}`} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusDot variant={dotVar} testId={`admin.requests.row.${reqType}.${id}.dot`} />
                        <div className="text-sm font-semibold">#{id}</div>
                        <Badge variant={requestTypeBadgeVariant(reqType)}>{t(requestTypeLabelKey(reqType))}</Badge>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted">{label}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant={stateVar}>{t(requestStateLabelKey(st))}</Badge>
                        {isAdmin && risk ? (
                          <Badge variant={risk.variant} title={t('requests.risk.tooltip', { score: risk.score })}>
                            {t(risk.labelKey)} {risk.score}
                          </Badge>
                        ) : null}
                      </div>
                      {isAdmin ? (
                        <div className="mt-2 text-xs text-muted">
                          <span className="text-faint">{t('common.user')}:</span> {userLabel}
                        </div>
                      ) : null}
                      <div className="mt-1 text-xs text-muted">
                        <span className="text-faint">{t('common.created')}:</span>{' '}
                        {(r as LegacyAny).created_at ? formatDateTime(String((r as LegacyAny).created_at)) : '—'}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 px-0"
                        onClick={() => toggleExpanded(key)}
                        aria-label={expanded ? t('requests.list.collapse_row') : t('requests.list.expand_row')}
                        testId={`admin.requests.row.${reqType}.${id}.toggle`}
                      >
                        {expanded ? '−' : '+'}
                      </Button>
                      <Link
                        className="text-xs font-medium text-accent hover:underline"
                        to={`${basePath}/requests/${reqType}/${id}`}
                      >
                        {t('common.open')}
                      </Link>
                    </div>
                  </div>
                  <div className="mt-3">{renderRowActions(r)}</div>
                  {expanded ? <div className="mt-3">{renderExpandedRow(r)}</div> : null}
                </Card>
              );
            })}

            <Card>
              <KeysetPagination
                page={pagination.page}
                pageCount={pagination.stack.length}
                canPrev={pagination.canPrev}
                canNext={canNext}
                onPrev={pagination.goPrev}
                onNext={() => pagination.goNext(pageCursor)}
                onGoToPage={pagination.goToPage}
                limit={pagination.limit}
                allowedLimits={pagination.allowedLimits}
                onLimitChange={pagination.setLimit}
                testId="admin.requests.pagination.mobile"
              />
            </Card>
          </div>

          {/* Desktop: table */}
          <TableCard
            className="hidden md:block"
            minWidth="lg"
            tableTestId="admin.requests.table"
            footer={
              <KeysetPagination
                page={pagination.page}
                pageCount={pagination.stack.length}
                canPrev={pagination.canPrev}
                canNext={canNext}
                onPrev={pagination.goPrev}
                onNext={() => pagination.goNext(pageCursor)}
                onGoToPage={pagination.goToPage}
                limit={pagination.limit}
                allowedLimits={pagination.allowedLimits}
                onLimitChange={pagination.setLimit}
                testId="admin.requests.pagination.desktop"
              />
            }
          >
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2" aria-label={t('requests.list.expand_row')} />
                <th className="px-4 py-2">{t('common.id')}</th>
                <th className="px-4 py-2">{t('common.type')}</th>
                <th className="px-4 py-2">{t('common.label')}</th>
                {isAdmin ? <th className="px-4 py-2">{t('common.user')}</th> : null}
                <th className="px-4 py-2">{t('common.state')}</th>
                <th className="px-4 py-2">{t('common.created')}</th>
                <th className="px-4 py-2">{t('requests.list.col.api_ip')}</th>
                <th className="px-4 py-2">{t('requests.list.col.client_ip')}</th>
                {isAdmin ? <th className="px-4 py-2">{t('requests.list.col.risk')}</th> : null}
                <th className="px-4 py-2">{t('requests.list.col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = Number((r as LegacyAny).id);
                const reqType = (r as LegacyAny)._type as 'registration' | 'change';
                const key = requestRowKey(r);
                const expanded = expandedKeys.has(key);
                const st = String((r as LegacyAny).state ?? '').trim();
                const rowVar = requestRowVariant(st);
                const stateVar = requestStateBadgeVariant(st);
                const dotVar = dotVariantFromBadgeVariant(stateVar);
                const label = String((r as LegacyAny).label ?? '').trim() || '—';
                const userLabel = requestUserLabel(r);

                const apiIpStr = typeof (r as LegacyAny).api_ip_addr === 'string' ? String((r as LegacyAny).api_ip_addr) : '—';
                const clientIpStr =
                  typeof (r as LegacyAny).client_ip_addr === 'string' ? String((r as LegacyAny).client_ip_addr) : '—';

                const risk = reqType === 'registration' ? fraudRiskBadge(r as LegacyAny) : null;

                return (
                  <React.Fragment key={key}>
                    <TableRowLink
                      testId={`admin.requests.row.${reqType}.${id}`}
                      to={`${basePath}/requests/${reqType}/${id}`}
                      variant={rowVar}
                      className="border-b border-border/60 last:border-b-0"
                    >
                      <td className="px-4 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 px-0"
                          onClick={() => toggleExpanded(key)}
                          aria-label={expanded ? t('requests.list.collapse_row') : t('requests.list.expand_row')}
                          testId={`admin.requests.row.${reqType}.${id}.toggle`}
                        >
                          {expanded ? '−' : '+'}
                        </Button>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <StatusDot variant={dotVar} testId={`admin.requests.row.${reqType}.${id}.dot`} />
                          <span className="font-medium text-accent">#{id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={requestTypeBadgeVariant(reqType)}>{t(requestTypeLabelKey(reqType))}</Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted">{label}</td>
                      {isAdmin ? <td className="px-4 py-2 text-xs text-muted">{userLabel}</td> : null}
                      <td className="px-4 py-2">
                        <Badge variant={stateVar}>{t(requestStateLabelKey(st))}</Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted">
                        {(r as LegacyAny).created_at ? formatDateTime(String((r as LegacyAny).created_at)) : '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted">{apiIpStr}</td>
                      <td className="px-4 py-2 text-xs text-muted">{clientIpStr}</td>
                      {isAdmin ? (
                        <td className="px-4 py-2">
                          {risk ? (
                            <Badge variant={risk.variant} title={t('requests.risk.tooltip', { score: risk.score })}>
                              {t(risk.labelKey)} {risk.score}
                            </Badge>
                          ) : (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                      ) : null}
                      <td className="px-4 py-2">{renderRowActions(r)}</td>
                    </TableRowLink>
                    {expanded ? (
                      <tr className="border-b border-border/60 bg-surface-1">
                        <td className="px-4 py-3" colSpan={tableColumnCount}>
                          {renderExpandedRow(r)}
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </TableCard>
        </>
      )}
    </ListShell>
  );
}

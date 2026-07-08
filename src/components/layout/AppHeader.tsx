import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, Globe, LogOut, Menu, Search, User, WifiOff } from 'lucide-react';

import { useAuth } from '../../app/auth';
import { useAppMode } from '../../app/appMode';
import { useObjectScope } from '../../app/objectScope';
import { clusterSearch, type ClusterSearchHit } from '../../lib/api/clusterSearch';
import { fetchVps, fetchVpsList, type Vps } from '../../lib/api/vps';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { clsx } from '../ui/clsx';
import { formatErrorMessage } from '../../lib/errors';
import { useDebouncedValue } from '../../lib/hooks/useDebouncedValue';

interface AppHeaderProps {
  t: (key: any, vars?: Record<string, unknown>) => string;
  mode: 'user' | 'admin';
  canSwitchMode: boolean;
  shortcutHint: string;
  onOpenMobileNav: () => void;
  showSyncIndicator: boolean;
  syncRef: React.RefObject<HTMLDivElement | null>;
  syncOpen: boolean;
  setSyncOpen: React.Dispatch<React.SetStateAction<boolean>>;
  syncStatus: 'offline' | 'error';
  syncTitle: string;
  syncBody: string;
  syncError: unknown;
  onRetrySync: () => void;
  tasksFailedCount: number;
  tasksActiveCount: number;
  onOpenTasks: () => void;
  userMenuRef: React.RefObject<HTMLDivElement | null>;
  userMenuOpen: boolean;
  setUserMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  authLogin?: string;
  authRole?: string;
  sessionExpiresAt?: number;
  theme: 'system' | 'light' | 'dark';
  language: 'system' | 'en' | 'cs';
  onSetTheme: (next: 'system' | 'light' | 'dark') => void;
  onSetLanguage: (next: 'system' | 'en' | 'cs') => void;
  onGoToOtherMode: () => void;
  onGoToProfile: () => void;
  onGoToPublicStatus: () => void;
  loginLogoutHref: string;
}

function AppSyncPopover(props: Pick<AppHeaderProps,
  't' | 'syncRef' | 'syncOpen' | 'setSyncOpen' | 'syncStatus' | 'syncTitle' | 'syncBody' | 'syncError' | 'onRetrySync'
>) {
  const { t, syncRef, syncOpen, setSyncOpen, syncStatus, syncTitle, syncBody, syncError, onRetrySync } = props;

  return (
    <div className="relative order-8 md:order-6" ref={syncRef}>
      <button
        className={clsx(
          'inline-flex h-11 w-12 items-center justify-center rounded-md border border-border bg-overlay-surface text-sm shadow-card hover:bg-surface-2',
          'sm:h-10 sm:w-auto sm:justify-start sm:gap-2 sm:px-3',
          syncStatus === 'offline' ? 'text-danger' : 'text-warn'
        )}
        onClick={() => setSyncOpen((v) => !v)}
        aria-label={syncStatus === 'offline' ? t('sync.offline.indicator') : t('sync.error.indicator')}
        title={syncStatus === 'offline' ? t('sync.offline.indicator') : t('sync.error.indicator')}
        data-testid="shell.sync-indicator"
      >
        {syncStatus === 'offline' ? <WifiOff size={18} /> : <AlertTriangle size={18} />}
        <span className="hidden sm:inline">{syncTitle}</span>
      </button>

      {syncOpen ? (
        <div
          className="absolute right-0 mt-2 w-64 rounded-md border border-border bg-overlay-surface p-2 shadow-panel"
          data-testid="shell.sync-panel"
          data-overlay="popover"
          data-overlay-surface="overlay"
        >
          <div className="px-2 py-1">
            <div className="text-sm font-semibold">{syncTitle}</div>
            <p className="mt-1 text-xs text-muted">{syncBody}</p>

            {syncStatus === 'error' && syncError ? (
              <p className="mt-2 text-xs text-muted" data-testid="shell.sync-panel.last-error">
                {t('sync.error.last_error', { message: formatErrorMessage(syncError) })}
              </p>
            ) : null}

            <div className="mt-3 flex gap-2">
              <Button
                testId="shell.sync-panel.retry"
                size="sm"
                variant="primary"
                onClick={() => {
                  onRetrySync();
                  setSyncOpen(false);
                }}
              >
                {t('common.retry')}
              </Button>
              <Button
                testId="shell.sync-panel.reload"
                size="sm"
                variant="secondary"
                onClick={() => window.location.reload()}
              >
                {t('common.reload')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AppUserMenu(props: Pick<AppHeaderProps,
  't' | 'mode' | 'canSwitchMode' | 'userMenuRef' | 'userMenuOpen' | 'setUserMenuOpen' | 'authLogin' | 'authRole' |
  'sessionExpiresAt' | 'theme' | 'language' | 'onSetTheme' | 'onSetLanguage' | 'onGoToOtherMode' | 'onGoToProfile' | 'onGoToPublicStatus' | 'loginLogoutHref'
> & { sessionIdleLimitSeconds: number | null }) {
  const {
    t,
    mode,
    canSwitchMode,
    userMenuRef,
    userMenuOpen,
    setUserMenuOpen,
    authLogin,
    authRole,
    sessionExpiresAt,
    sessionIdleLimitSeconds,
    theme,
    language,
    onSetTheme,
    onSetLanguage,
    onGoToOtherMode,
    onGoToProfile,
    onGoToPublicStatus,
    loginLogoutHref,
  } = props;
  const sessionRemaining = useSessionRemainingLabel(t, sessionExpiresAt);
  const sessionIdleLimit = formatSessionIdleLimit(t, sessionIdleLimitSeconds);
  const sessionDisplay = sessionIdleLimit
    ? {
        compact: t('auth.session_idle.compact', { time: sessionIdleLimit }),
        menuLabel: t('auth.session_idle.menu_label'),
        value: sessionIdleLimit,
      }
    : sessionRemaining
      ? {
          compact: t('auth.session_remaining.compact', { time: sessionRemaining }),
          menuLabel: t('auth.session_remaining.menu_label'),
          value: sessionRemaining,
        }
      : null;

  return (
    <div className="relative order-10 md:order-8" ref={userMenuRef}>
      <button
        className={clsx(
          'inline-flex h-11 w-12 items-center justify-center gap-2 rounded-md border border-border bg-overlay-surface text-sm shadow-card hover:bg-surface-2',
          'sm:h-10 sm:w-auto sm:justify-start sm:px-3'
        )}
        onClick={() => setUserMenuOpen((v) => !v)}
        aria-label={t('user_menu.open')}
        data-testid="shell.user-menu-button"
      >
        <User size={18} />
        <span className="hidden sm:inline font-medium">{authLogin ?? '—'}</span>
        <span className="hidden md:inline text-xs text-muted">{String(authRole ?? '—')}</span>
        {sessionDisplay ? (
          <span className="hidden lg:inline text-xs text-muted" data-testid="shell.session-remaining">
            {sessionDisplay.compact}
          </span>
        ) : null}
      </button>

      {userMenuOpen ? (
        <div
          className="absolute right-0 mt-2 w-64 rounded-md border border-border bg-overlay-surface p-2 shadow-panel"
          data-testid="shell.user-menu"
          data-overlay="popover"
          data-overlay-surface="overlay"
        >
          {sessionDisplay ? (
            <div className="px-2 py-1" data-testid="shell.user-menu.session-remaining">
              <div className="text-xs text-muted">{sessionDisplay.menuLabel}</div>
              <div className="mt-0.5 text-sm font-medium">{sessionDisplay.value}</div>
            </div>
          ) : null}

          {canSwitchMode ? (
            <div className={clsx('px-2 py-1', sessionDisplay ? 'mt-2 border-t border-border pt-2' : '')}>
              <div className="text-xs text-muted">{t('settings.scope.label')}</div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Button
                  testId="shell.user-menu.scope.mine"
                  variant={mode === 'user' ? 'primary' : 'secondary'}
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (mode === 'user') return;
                    setUserMenuOpen(false);
                    onGoToOtherMode();
                  }}
                >
                  {t('settings.scope.mine')}
                </Button>
                <Button
                  testId="shell.user-menu.scope.all"
                  variant={mode === 'admin' ? 'primary' : 'secondary'}
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (mode === 'admin') return;
                    setUserMenuOpen(false);
                    onGoToOtherMode();
                  }}
                >
                  {t('settings.scope.all')}
                </Button>
              </div>
              <p className={clsx('mt-2 text-xs', mode === 'admin' ? 'text-warn' : 'text-muted')}>
                {mode === 'admin' ? t('scope.indicator.admin_hint') : t('scope.indicator.my_hint')}
              </p>
            </div>
          ) : null}

          <div className="mt-2 border-t border-border px-2 pt-2">
            <div className="text-xs text-muted">{t('settings.theme.label')}</div>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <Button
                testId="shell.user-menu.theme.system"
                variant={theme === 'system' ? 'primary' : 'secondary'}
                size="sm"
                className="w-full"
                onClick={() => onSetTheme('system')}
              >
                {t('settings.theme.system')}
              </Button>
              <Button
                testId="shell.user-menu.theme.light"
                variant={theme === 'light' ? 'primary' : 'secondary'}
                size="sm"
                className="w-full"
                onClick={() => onSetTheme('light')}
              >
                {t('settings.theme.light')}
              </Button>
              <Button
                testId="shell.user-menu.theme.dark"
                variant={theme === 'dark' ? 'primary' : 'secondary'}
                size="sm"
                className="w-full"
                onClick={() => onSetTheme('dark')}
              >
                {t('settings.theme.dark')}
              </Button>
            </div>
          </div>

          <div className="mt-2 border-t border-border px-2 pt-2">
            <div className="text-xs text-muted">{t('settings.language.label')}</div>
            <div className="mt-1 grid grid-cols-3 gap-2">
              <Button
                testId="shell.user-menu.language.system"
                variant={language === 'system' ? 'primary' : 'secondary'}
                size="sm"
                className="w-full"
                onClick={() => onSetLanguage('system')}
              >
                {t('settings.language.system')}
              </Button>
              <Button
                testId="shell.user-menu.language.en"
                variant={language === 'en' ? 'primary' : 'secondary'}
                size="sm"
                className="w-full"
                title={t('settings.language.en')}
                onClick={() => onSetLanguage('en')}
              >
                EN
              </Button>
              <Button
                testId="shell.user-menu.language.cs"
                variant={language === 'cs' ? 'primary' : 'secondary'}
                size="sm"
                className="w-full"
                title={t('settings.language.cs')}
                onClick={() => onSetLanguage('cs')}
              >
                CS
              </Button>
            </div>
          </div>

          <div className="mt-2 border-t border-border pt-2">
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-surface-2"
              onClick={() => {
                setUserMenuOpen(false);
                onGoToProfile();
              }}
              data-testid="shell.user-menu.account"
            >
              <User size={16} />
              <span>{t('user_menu.account')}</span>
            </button>
            <button
              className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-surface-2"
              onClick={() => {
                setUserMenuOpen(false);
                onGoToPublicStatus();
              }}
              data-testid="shell.user-menu.public-status"
            >
              <Globe size={16} />
              <span>{t('user_menu.public_status')}</span>
            </button>
          </div>

          <div className="mt-2 border-t border-border pt-2">
            <a
              data-testid="shell.user-menu.logout"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-surface-2"
              href={loginLogoutHref}
            >
              <LogOut size={16} />
              <span>{t('user_menu.logout')}</span>
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatSessionRemaining(t: AppHeaderProps['t'], expiresAt: number, now: number): string {
  const remainingMs = expiresAt - now;
  if (remainingMs <= 0) return t('auth.session_remaining.expired');
  if (remainingMs < 60_000) return t('auth.session_remaining.less_than_minute');

  const minutesTotal = Math.ceil(remainingMs / 60_000);
  if (minutesTotal < 60) return t('auth.session_remaining.minutes', { minutes: minutesTotal });

  const hours = Math.floor(minutesTotal / 60);
  const minutes = minutesTotal % 60;
  if (minutes === 0) return t('auth.session_remaining.hours', { hours });
  return t('auth.session_remaining.hours_minutes', { hours, minutes });
}

function useSessionRemainingLabel(t: AppHeaderProps['t'], expiresAt?: number): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return undefined;

    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt || !Number.isFinite(expiresAt)) return null;
  return formatSessionRemaining(t, expiresAt, now);
}

function readSessionIdleLimitSeconds(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function formatSessionIdleLimit(t: AppHeaderProps['t'], seconds: number | null): string | null {
  if (seconds === null) return null;
  if (seconds === 0) return t('security.settings.session_length.preset.never');
  if (seconds < 60) return t('auth.session_remaining.less_than_minute');

  const minutesTotal = Math.ceil(seconds / 60);
  if (minutesTotal < 60) return t('auth.session_remaining.minutes', { minutes: minutesTotal });

  const hours = Math.floor(minutesTotal / 60);
  const minutes = minutesTotal % 60;
  if (minutes === 0) return t('auth.session_remaining.hours', { hours });
  return t('auth.session_remaining.hours_minutes', { hours, minutes });
}

interface InlineSearchResult {
  key: string;
  primary: string;
  secondary: string;
  href: string;
}

function parseInlineVpsId(raw: string): number | null {
  const m = String(raw ?? '').trim().match(/^(?:vps\s*)?#?(\d+)$/i);
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

function normalizeInlineResource(value: unknown): string {
  const lower = String(value ?? '').trim().toLowerCase();
  if (lower === 'vps') return 'Vps';
  if (lower === 'user') return 'User';
  if (lower === 'ipaddress' || lower === 'ip_address' || lower === 'ip-address') return 'IpAddress';
  if (lower === 'transactionchain' || lower === 'transaction_chain' || lower === 'transaction-chain') return 'TransactionChain';
  if (lower === 'transaction') return 'Transaction';
  if (lower === 'actionstate' || lower === 'action_state' || lower === 'action-state') return 'ActionState';
  if (lower === 'dataset') return 'Dataset';
  if (lower === 'dnszone' || lower === 'dns_zone' || lower === 'dns-zone') return 'DnsZone';
  if (lower === 'migrationplan' || lower === 'migration_plan' || lower === 'migration-plan') return 'MigrationPlan';
  if (lower === 'node') return 'Node';
  if (lower === 'network') return 'Network';
  return String(value ?? '').trim();
}

function parseInlineId(value: unknown): number | null {
  const id = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

function inlineResourceHref(basePath: string, resource: string, id: number): string | null {
  if (resource === 'Vps') return `${basePath}/vps/${id}`;
  if (resource === 'User') return `${basePath}/users/${id}`;
  if (resource === 'IpAddress') return `${basePath}/ip-addresses/${id}`;
  if (resource === 'TransactionChain') return `${basePath}/transactions/${id}`;
  if (resource === 'Transaction') return `${basePath}/transactions/items/${id}`;
  if (resource === 'ActionState') return `${basePath}/action-states/${id}`;
  if (resource === 'Dataset') return `${basePath}/datasets/${id}`;
  if (resource === 'DnsZone') return `${basePath}/dns/zones/${id}`;
  if (resource === 'MigrationPlan') return `${basePath}/migration-plans/${id}`;
  if (resource === 'Node') return `${basePath}/nodes/${id}`;
  if (resource === 'Network') return `${basePath}/cluster/networks/${id}`;
  return null;
}

function inlineResultFromVps(basePath: string, t: AppHeaderProps['t'], vps: Vps): InlineSearchResult {
  return {
    key: `vps:${vps.id}`,
    primary: vps.hostname ?? t('common.vps_ref', { id: vps.id }),
    secondary: t('common.vps_ref', { id: vps.id }),
    href: `${basePath}/vps/${vps.id}`,
  };
}

function inlineResultsFromClusterSearch(basePath: string, t: AppHeaderProps['t'], hits: ClusterSearchHit[]): InlineSearchResult[] {
  const out: InlineSearchResult[] = [];
  const seen = new Set<string>();

  for (const hit of hits ?? []) {
    const resource = normalizeInlineResource(hit.resource);
    const id = parseInlineId(hit.id);
    if (!resource || id === null) continue;

    const href = inlineResourceHref(basePath, resource, id);
    if (!href) continue;

    const key = `${resource}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const fallback = t('common.resource_ref', { resource, id });
    const primary = String(hit.value ?? hit.label ?? fallback).trim();
    const attr = String(hit.attribute ?? '').trim();

    out.push({
      key,
      primary: primary || fallback,
      secondary: attr ? `${fallback} · ${attr}` : fallback,
      href,
    });
  }

  return out.slice(0, 8);
}

export function AppHeader(props: AppHeaderProps) {
  const {
    t,
    mode,
    canSwitchMode,
    shortcutHint,
    onOpenMobileNav,
    showSyncIndicator,
    syncRef,
    syncOpen,
    setSyncOpen,
    syncStatus,
    syncTitle,
    syncBody,
    syncError,
    onRetrySync,
    tasksFailedCount,
    tasksActiveCount,
    onOpenTasks,
    userMenuRef,
    userMenuOpen,
    setUserMenuOpen,
    authLogin,
    authRole,
    sessionExpiresAt,
    theme,
    language,
    onSetTheme,
    onSetLanguage,
    onGoToOtherMode,
    onGoToProfile,
    onGoToPublicStatus,
    loginLogoutHref,
  } = props;
  const auth = useAuth();
  const { basePath } = useAppMode();
  const scope = useObjectScope();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<InlineSearchResult[]>([]);
  const [selectedSearchResult, setSelectedSearchResult] = useState(0);
  const debouncedSearch = useDebouncedValue(search.trim(), 180);
  const sessionIdleLimitSeconds = readSessionIdleLimitSeconds(auth.user?.preferred_session_length);

  useEffect(() => {
    setSearch('');
    setSearchOpen(false);
    setSearchResults([]);
  }, [location.pathname]);

  const canUseClusterSearch = auth.canUseAdminUi && mode === 'admin';

  useEffect(() => {
    const q = debouncedSearch;
    if (!q || q === '?') {
      setSearchLoading(false);
      setSearchError(null);
      setSearchResults([]);
      return undefined;
    }

    const ac = new AbortController();
    let alive = true;
    setSearchLoading(true);
    setSearchError(null);

    const run = async () => {
      try {
        if (canUseClusterSearch) {
          const res = await clusterSearch({ query: q, signal: ac.signal });
          if (!alive || ac.signal.aborted) return;
          setSearchResults(inlineResultsFromClusterSearch(basePath, t, res.data));
          return;
        }

        const maybeId = parseInlineVpsId(q);
        if (maybeId !== null) {
          try {
            const one = await fetchVps(maybeId, { includes: 'user', signal: ac.signal });
            const vps = one.data;
            if (
              scope.mineUserId !== undefined &&
              typeof (vps as any)?.user?.id === 'number' &&
              (vps as any).user.id !== scope.mineUserId
            ) {
              if (!alive || ac.signal.aborted) return;
              setSearchResults([]);
              return;
            }
            if (!alive || ac.signal.aborted) return;
            setSearchResults([inlineResultFromVps(basePath, t, vps)]);
            return;
          } catch (e: any) {
            if (e?.name === 'AbortError') return;
          }
        }

        const res = await fetchVpsList({
          limit: 8,
          hostnameAny: q,
          user: scope.mineUserId,
          signal: ac.signal,
        });
        if (!alive || ac.signal.aborted) return;
        setSearchResults((res.data ?? []).slice(0, 8).map((vps) => inlineResultFromVps(basePath, t, vps)));
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        if (!alive || ac.signal.aborted) return;
        setSearchError(String(e?.message ?? e));
        setSearchResults([]);
      } finally {
        if (!alive || ac.signal.aborted) return;
        setSearchLoading(false);
      }
    };

    void run();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [basePath, canUseClusterSearch, debouncedSearch, mode, scope.mineUserId, t]);

  useEffect(() => {
    setSelectedSearchResult(0);
  }, [debouncedSearch, searchResults.length]);

  const searchStatus = useMemo(() => {
    if (!search.trim()) return t('palette.empty.type_to_search');
    if (searchLoading) return t('palette.loading');
    if (searchError) return `${t('palette.error_prefix')}: ${searchError}`;
    if (searchResults.length === 0) return t('palette.empty.no_results');
    return null;
  }, [search, searchError, searchLoading, searchResults.length, t]);

  const openInlineResult = (result: InlineSearchResult) => {
    navigate(result.href);
    setSearch('');
    setSearchOpen(false);
  };

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg" data-testid="shell.header">
      <div className="flex items-center gap-2 px-4 py-2 md:py-3">
        <button
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-overlay-surface shadow-card hover:bg-surface-2 md:hidden"
          onClick={onOpenMobileNav}
          aria-label={t('nav.open')}
          data-testid="shell.mobile-nav-button"
        >
          <Menu size={20} />
        </button>

        <form
          className={clsx(
            'relative order-6 flex h-11 w-12 items-center gap-2 rounded-md border border-border bg-overlay-surface px-3 text-sm shadow-card',
            'focus-within:ring-2 focus-within:ring-accent/40',
            'sm:w-56 md:order-3 md:h-10 md:w-72 lg:w-80'
          )}
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            const selected = searchResults[selectedSearchResult] ?? searchResults[0];
            if (selected) openInlineResult(selected);
          }}
          onBlur={() => {
            window.setTimeout(() => setSearchOpen(false), 120);
          }}
          data-testid="shell.inline-search"
        >
          <Search size={18} className="shrink-0 text-muted" />
          <input
            value={search}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setSearchOpen(false);
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSearchOpen(true);
                setSelectedSearchResult((prev) => Math.min(prev + 1, Math.max(0, searchResults.length - 1)));
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSearchOpen(true);
                setSelectedSearchResult((prev) => Math.max(prev - 1, 0));
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted"
            placeholder={mode === 'admin' ? t('palette.placeholder.admin') : t('palette.placeholder.user')}
            aria-label={t('search.inline.aria')}
            data-testid="shell.inline-search.input"
          />
          <span className="hidden shrink-0 rounded border border-border bg-surface-2 px-2 py-0.5 text-xs text-faint lg:inline" title={t('palette.shortcut_title')}>
            {shortcutHint}
          </span>

          {searchOpen && (search.trim() || searchResults.length > 0) ? (
            <div
              className="absolute left-0 top-full z-50 mt-2 w-drawer-md overflow-hidden rounded-md border border-border bg-overlay-surface shadow-panel"
              data-testid="shell.inline-search.results"
              data-overlay="popover"
              data-overlay-surface="overlay"
            >
              {searchResults.length > 0 ? (
                <div className="py-1">
                  {searchResults.map((result, index) => (
                    <button
                      key={result.key}
                      type="button"
                      className={clsx(
                        'flex w-full flex-col items-start px-3 py-2 text-left text-sm',
                        index === selectedSearchResult ? 'bg-surface-2' : 'hover:bg-surface-2'
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setSelectedSearchResult(index)}
                      onClick={() => openInlineResult(result)}
                      data-testid={`shell.inline-search.result.${index}`}
                    >
                      <span className="font-medium text-fg">{result.primary}</span>
                      <span className="text-xs text-muted">{result.secondary}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-2 text-sm text-muted" data-testid="shell.inline-search.status">
                  {searchStatus}
                </div>
              )}
            </div>
          ) : null}
        </form>

        <div className="order-5 flex-1 md:order-4" />

        {canSwitchMode ? (
          <Badge
            variant={mode === 'admin' ? 'black' : 'neutral'}
            testId="scope.indicator"
            title={mode === 'admin' ? t('scope.indicator.admin_hint') : t('scope.indicator.my_hint')}
            className="order-7 md:order-5"
          >
            <span className="md:hidden">
              {mode === 'admin' ? t('scope.indicator.admin_short') : t('scope.indicator.my_short')}
            </span>
            <span className="hidden md:inline">
              {mode === 'admin' ? t('scope.indicator.admin') : t('scope.indicator.my')}
            </span>
          </Badge>
        ) : null}

        {showSyncIndicator ? (
          <AppSyncPopover
            t={t}
            syncRef={syncRef}
            syncOpen={syncOpen}
            setSyncOpen={setSyncOpen}
            syncStatus={syncStatus}
            syncTitle={syncTitle}
            syncBody={syncBody}
            syncError={syncError}
            onRetrySync={onRetrySync}
          />
        ) : null}

        <button
          className={clsx(
            'relative inline-flex h-11 w-12 items-center justify-center rounded-md border border-border bg-overlay-surface text-sm shadow-card hover:bg-surface-2',
            'order-9 md:order-7 sm:h-10 sm:w-auto sm:justify-start sm:gap-2 sm:px-3'
          )}
          onClick={onOpenTasks}
          aria-label={t('common.open_tasks')}
          data-testid="tasks.open-button"
        >
          <Activity size={18} />
          <span className="hidden sm:inline">{t('tasks.title')}</span>

          {tasksFailedCount > 0 || tasksActiveCount > 0 ? (
            <span className="ml-1 hidden items-center gap-1 sm:flex">
              {tasksFailedCount > 0 ? <Badge variant="danger">{tasksFailedCount}</Badge> : null}
              {tasksActiveCount > 0 ? <Badge variant="warn">{tasksActiveCount}</Badge> : null}
            </span>
          ) : null}

          {tasksFailedCount > 0 || tasksActiveCount > 0 ? (
            <span className="absolute -right-1 -top-1 sm:hidden">
              <Badge variant={tasksFailedCount > 0 ? 'danger' : 'warn'}>
                {tasksFailedCount > 0 ? tasksFailedCount : tasksActiveCount}
              </Badge>
            </span>
          ) : null}
        </button>

        <AppUserMenu
          t={t}
          mode={mode}
          canSwitchMode={canSwitchMode}
          userMenuRef={userMenuRef}
          userMenuOpen={userMenuOpen}
          setUserMenuOpen={setUserMenuOpen}
          authLogin={authLogin}
          authRole={authRole}
          sessionExpiresAt={sessionExpiresAt}
          sessionIdleLimitSeconds={sessionIdleLimitSeconds}
          theme={theme}
          language={language}
          onSetTheme={onSetTheme}
          onSetLanguage={onSetLanguage}
          onGoToOtherMode={onGoToOtherMode}
          onGoToProfile={onGoToProfile}
          onGoToPublicStatus={onGoToPublicStatus}
          loginLogoutHref={loginLogoutHref}
        />
      </div>
    </header>
  );
}

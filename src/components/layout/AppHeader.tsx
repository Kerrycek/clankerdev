import React from 'react';
import { Activity, AlertTriangle, Globe, LogOut, Menu, Search, User, WifiOff } from 'lucide-react';

import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { clsx } from '../ui/clsx';
import { formatErrorMessage } from '../../lib/errors';

interface AppHeaderProps {
  t: (key: any, vars?: Record<string, unknown>) => string;
  mode: 'user' | 'admin';
  canSwitchMode: boolean;
  shortcutHint: string;
  mobileNavOpen: boolean;
  onOpenMobileNav: () => void;
  onOpenPalette: () => void;
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
  tasksOpen: boolean;
  onOpenTasks: () => void;
  userMenuRef: React.RefObject<HTMLDivElement | null>;
  userMenuOpen: boolean;
  setUserMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  authLogin?: string;
  authRole?: string;
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
          'inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-overlay-surface text-sm shadow-card hover:bg-surface-2',
          'sm:h-10 sm:w-auto sm:justify-start sm:gap-2 sm:px-3',
          syncStatus === 'offline' ? 'text-danger' : 'text-warn'
        )}
        onClick={() => setSyncOpen((v) => !v)}
        aria-label={syncStatus === 'offline' ? t('sync.offline.indicator') : t('sync.error.indicator')}
        aria-controls="shell-sync-panel"
        aria-expanded={syncOpen}
        aria-haspopup="dialog"
        title={syncStatus === 'offline' ? t('sync.offline.indicator') : t('sync.error.indicator')}
        data-testid="shell.sync-indicator"
      >
        {syncStatus === 'offline' ? <WifiOff size={18} /> : <AlertTriangle size={18} />}
        <span className="hidden sm:inline">{syncTitle}</span>
      </button>

      {syncOpen ? (
        <div
          id="shell-sync-panel"
          role="dialog"
          aria-label={syncTitle}
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
  'theme' | 'language' | 'onSetTheme' | 'onSetLanguage' | 'onGoToOtherMode' | 'onGoToProfile' | 'onGoToPublicStatus' | 'loginLogoutHref'
>) {
  const {
    t,
    mode,
    canSwitchMode,
    userMenuRef,
    userMenuOpen,
    setUserMenuOpen,
    authLogin,
    authRole,
    theme,
    language,
    onSetTheme,
    onSetLanguage,
    onGoToOtherMode,
    onGoToProfile,
    onGoToPublicStatus,
    loginLogoutHref,
  } = props;

  return (
    <div className="relative order-10 md:order-8" ref={userMenuRef}>
      <button
        className={clsx(
          'inline-flex h-11 w-11 items-center justify-center gap-2 rounded-md border border-border bg-overlay-surface text-sm shadow-card hover:bg-surface-2',
          'sm:h-10 sm:w-auto sm:justify-start sm:px-3'
        )}
        onClick={() => setUserMenuOpen((v) => !v)}
        aria-label={t('user_menu.open')}
        aria-controls="shell-user-menu"
        aria-expanded={userMenuOpen}
        aria-haspopup="dialog"
        data-testid="shell.user-menu-button"
      >
        <User size={18} />
        <span className="hidden sm:inline font-medium">{authLogin ?? '—'}</span>
        <span className="hidden md:inline text-xs text-muted">{String(authRole ?? '—')}</span>
      </button>

      {userMenuOpen ? (
        <div
          id="shell-user-menu"
          role="dialog"
          aria-label={t('user_menu.settings')}
          className="absolute right-0 mt-2 w-64 rounded-md border border-border bg-overlay-surface p-2 shadow-panel"
          data-testid="shell.user-menu"
          data-overlay="popover"
          data-overlay-surface="overlay"
        >
          {canSwitchMode ? (
            <div className="px-2 py-1">
              <div className="text-xs text-muted">{t('settings.scope.label')}</div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Button
                  testId="shell.user-menu.scope.mine"
                  variant={mode === 'user' ? 'primary' : 'secondary'}
                  size="sm"
                  aria-pressed={mode === 'user'}
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
                  aria-pressed={mode === 'admin'}
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
                aria-pressed={theme === 'system'}
                className="w-full"
                onClick={() => onSetTheme('system')}
              >
                {t('settings.theme.system')}
              </Button>
              <Button
                testId="shell.user-menu.theme.light"
                variant={theme === 'light' ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={theme === 'light'}
                className="w-full"
                onClick={() => onSetTheme('light')}
              >
                {t('settings.theme.light')}
              </Button>
              <Button
                testId="shell.user-menu.theme.dark"
                variant={theme === 'dark' ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={theme === 'dark'}
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
                aria-pressed={language === 'system'}
                className="w-full"
                onClick={() => onSetLanguage('system')}
              >
                {t('settings.language.system')}
              </Button>
              <Button
                testId="shell.user-menu.language.en"
                variant={language === 'en' ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={language === 'en'}
                className="w-full"
                title={t('settings.language.en')}
                ariaLabel={t('settings.language.en')}
                onClick={() => onSetLanguage('en')}
              >
                EN
              </Button>
              <Button
                testId="shell.user-menu.language.cs"
                variant={language === 'cs' ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={language === 'cs'}
                className="w-full"
                title={t('settings.language.cs')}
                ariaLabel={t('settings.language.cs')}
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

export function AppHeader(props: AppHeaderProps) {
  const {
    t,
    mode,
    canSwitchMode,
    shortcutHint,
    mobileNavOpen,
    onOpenMobileNav,
    onOpenPalette,
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
    tasksOpen,
    onOpenTasks,
    userMenuRef,
    userMenuOpen,
    setUserMenuOpen,
    authLogin,
    authRole,
    theme,
    language,
    onSetTheme,
    onSetLanguage,
    onGoToOtherMode,
    onGoToProfile,
    onGoToPublicStatus,
    loginLogoutHref,
  } = props;

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg" data-testid="shell.header">
      <div className="flex items-center gap-2 px-4 py-2 md:py-3">
        <button
          className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-overlay-surface shadow-card hover:bg-surface-2 md:hidden"
          onClick={onOpenMobileNav}
          aria-label={t('nav.open')}
          aria-controls="app-mobile-navigation"
          aria-expanded={mobileNavOpen}
          data-testid="shell.mobile-nav-button"
        >
          <Menu size={20} />
        </button>

        <button
          type="button"
          className={clsx(
            'inline-flex h-11 w-11 items-center justify-center gap-2 rounded-md border border-border bg-overlay-surface px-0 text-sm shadow-card',
            'text-muted hover:bg-surface-2 hover:text-fg',
            'order-6 md:order-3 md:h-10 md:w-auto md:justify-start md:px-3'
          )}
          onClick={onOpenPalette}
          aria-label={t('palette.open')}
          aria-haspopup="dialog"
          data-testid="palette.open"
        >
          <Search size={18} />
          <span className="hidden md:inline">{t('palette.open')}</span>
          <span className="ml-2 hidden rounded border border-border bg-surface-2 px-2 py-0.5 text-xs text-faint md:inline">
            {shortcutHint}
          </span>
        </button>

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
            'relative inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-overlay-surface text-sm shadow-card hover:bg-surface-2',
            'order-9 md:order-7 sm:h-10 sm:w-auto sm:justify-start sm:gap-2 sm:px-3'
          )}
          onClick={onOpenTasks}
          aria-label={t('common.open_tasks')}
          aria-controls="app-tasks-drawer"
          aria-expanded={tasksOpen}
          aria-haspopup="dialog"
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

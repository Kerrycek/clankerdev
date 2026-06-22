import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import { useUiSettings, type UiLanguagePreference, type UiThemePreference } from '../../../app/uiSettings';
import { useAppMode } from '../../../app/appMode';
import { useToasts } from '../../../app/toasts';

import { DetailShell } from '../../../components/layout/DetailShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import { SummaryGrid } from '../../../components/layout/SummaryGrid';

import { ProfileTabs } from './ProfileTabs';

import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Select } from '../../../components/ui/Select';

import { formatDateTime } from '../../../lib/time';
import { computeOtherModeUrl } from '../../../lib/modeSwitch';
import { queueScopeAllObjectsWarning } from '../../../lib/pendingToasts';

function isUiThemePreference(value: string): value is UiThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isUiLanguagePreference(value: string): value is UiLanguagePreference {
  return value === 'system' || value === 'en' || value === 'cs';
}

export function ProfilePage() {
  const auth = useAuth();
  const appMode = useAppMode();
  const ui = useUiSettings();
  const toasts = useToasts();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [includeTipsReset, setIncludeTipsReset] = React.useState(false);
  const [resettingPrefs, setResettingPrefs] = React.useState(false);
  const [retryingPrefs, setRetryingPrefs] = React.useState(false);

  const syncModeLabel =
    ui.sync.mode === 'server'
      ? t('profile.prefs.persistence.server')
      : t('profile.prefs.persistence.local');

  const syncStatusLabel =
    ui.sync.status === 'loading'
      ? t('profile.prefs.sync_status.loading')
      : ui.sync.status === 'saving'
        ? t('profile.prefs.sync_status.saving')
        : ui.sync.status === 'error'
          ? t('profile.prefs.sync_status.error')
          : t('profile.prefs.sync_status.idle');

  const canSwitchScope = auth.canUseAdminUi;

  const setScope = (target: 'user' | 'admin') => {
    if (!canSwitchScope) return;
    if (target === appMode.mode) return;

    const storage = typeof window !== 'undefined' ? window.sessionStorage : undefined;
    if (target === 'admin') {
      // Queue a one-time warning toast shown after we land in the All objects view.
      queueScopeAllObjectsWarning(storage);
    }

    navigate(
      computeOtherModeUrl({
        mode: appMode.mode,
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      })
    );
  };

  const lastLoadedAtLabel = formatDateTime(ui.sync.lastLoadedAt);
  const lastSavedAtLabel = formatDateTime(ui.sync.lastSavedAt);

  const retrySettingsLoad = async () => {
    setRetryingPrefs(true);
    try {
      await ui.retryLoad();
      toasts.pushToast({ variant: 'ok', title: t('profile.prefs.toast.load_retried.title') });
    } catch (e) {
      toasts.pushToast({
        variant: 'danger',
        title: t('profile.prefs.toast.load_failed.title'),
        body: e instanceof Error ? e.message : String(e),
        autoDismissMs: false,
      });
    } finally {
      setRetryingPrefs(false);
    }
  };

  const resetPreferences = async () => {
    const confirmed = window.confirm(
      includeTipsReset
        ? t('profile.prefs.reset.confirm_with_tips')
        : t('profile.prefs.reset.confirm')
    );
    if (!confirmed) return;

    setResettingPrefs(true);
    try {
      await ui.resetPreferences({ includeTips: includeTipsReset });
      toasts.pushToast({ variant: 'ok', title: t('profile.prefs.toast.reset.title') });
    } catch (e) {
      toasts.pushToast({
        variant: 'danger',
        title: t('profile.prefs.toast.reset_failed.title'),
        body: e instanceof Error ? e.message : String(e),
        autoDismissMs: false,
      });
    } finally {
      setResettingPrefs(false);
    }
  };

  return (
    <DetailShell testId="profile.page">
      <PageHeader
        testId="profile.header"
        title={t('profile.page.title')}
        description={t('profile.page.description')}
      />

      <ProfileTabs />

      <SummaryGrid testId="profile.summary">
        <Card testId="profile.user.card" className="md:col-span-4">
          <CardHeader title={t('profile.user.title')} subtitle={t('profile.user.subtitle')} />
          <CardBody>
            {auth.user ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted">{t('profile.user.login')}</span>
                  <span className="font-medium text-fg">{auth.user.login}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted">{t('profile.user.id')}</span>
                  <span className="font-medium text-fg tabular-nums">{auth.user.id}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted">{t('profile.user.role')}</span>
                  <span className="font-medium text-fg">{String(auth.role || '—')}</span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-sm text-muted">{t('profile.user.loading')}</div>
            )}
          </CardBody>
        </Card>

        <Card testId="profile.prefs.card" className="md:col-span-5">
          <CardHeader title={t('profile.prefs.title')} subtitle={t('profile.prefs.subtitle')} />
          <CardBody>
            <div
              className={`grid grid-cols-1 gap-3 ${canSwitchScope ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}
            >
              {canSwitchScope ? (
                <div>
                  <div className="text-xs font-medium text-muted">{t('settings.scope.label')}</div>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <Button
                      testId="prefs.scope.mine"
                      variant={appMode.mode === 'user' ? 'primary' : 'secondary'}
                      size="sm"
                      className="w-full"
                      onClick={() => setScope('user')}
                    >
                      {t('settings.scope.mine')}
                    </Button>
                    <Button
                      testId="prefs.scope.all"
                      variant={appMode.mode === 'admin' ? 'primary' : 'secondary'}
                      size="sm"
                      className="w-full"
                      onClick={() => setScope('admin')}
                    >
                      {t('settings.scope.all')}
                    </Button>
                  </div>
                  <div
                    className={`mt-1 text-xs ${appMode.mode === 'admin' ? 'text-warn' : 'text-faint'}`}
                  >
                    {appMode.mode === 'admin'
                      ? t('scope.indicator.admin_hint')
                      : t('scope.indicator.my_hint')}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="text-xs font-medium text-muted">{t('settings.theme.label')}</div>
                <div className="mt-1">
                  <Select
                    value={ui.settings.theme}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (isUiThemePreference(value)) ui.setTheme(value);
                    }}
                    options={[
                      { value: 'system', label: t('settings.theme.system') },
                      { value: 'light', label: t('settings.theme.light') },
                      { value: 'dark', label: t('settings.theme.dark') },
                    ]}
                    testId="prefs.theme"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-muted">{t('settings.language.label')}</div>
                <div className="mt-1">
                  <Select
                    value={ui.settings.language}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (isUiLanguagePreference(value)) ui.setLanguage(value);
                    }}
                    options={[
                      { value: 'system', label: t('settings.language.system') },
                      { value: 'en', label: t('settings.language.en') },
                      { value: 'cs', label: t('settings.language.cs') },
                    ]}
                    testId="prefs.language"
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-1 text-xs" data-testid="profile.prefs.sync">
              <div className="text-faint">
                {t('profile.prefs.persistence.label')}: <span className="font-medium text-fg">{syncModeLabel}</span>
                <span className="mx-2">•</span>
                {t('profile.prefs.sync_status.label')}: <span className="font-medium text-fg">{syncStatusLabel}</span>
                {ui.sync.error ? <span className="ml-2 text-danger">{ui.sync.error}</span> : null}
              </div>
              <div className="text-muted">
                {t('profile.prefs.last_loaded')}: <span className="font-medium text-fg">{lastLoadedAtLabel}</span>
                <span className="mx-2">•</span>
                {t('profile.prefs.last_saved')}: <span className="font-medium text-fg">{lastSavedAtLabel}</span>
              </div>
            </div>

            {ui.sync.mode === 'server' && ui.sync.status === 'error' ? (
              <div className="mt-3 text-xs text-muted">{t('profile.prefs.server_sync_warning')}</div>
            ) : null}

            <details className="mt-4 rounded-md border border-border bg-surface-2 px-3 py-2" data-testid="profile.prefs.diagnostics">
              <summary className="cursor-pointer text-sm font-medium text-fg">
                {t('profile.prefs.diagnostics.title')}
              </summary>

              <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="font-medium text-muted">{t('profile.prefs.diagnostics.status')}</div>
                  <div>
                    {t('profile.prefs.persistence.label')}: <span className="font-medium text-fg">{syncModeLabel}</span>
                  </div>
                  <div>
                    {t('profile.prefs.sync_status.label')}: <span className="font-medium text-fg">{syncStatusLabel}</span>
                  </div>
                  <div>
                    {t('profile.prefs.last_load_error')}: <span className="font-medium text-fg">{ui.sync.lastLoadError || t('common.na')}</span>
                  </div>
                  <div>
                    {t('profile.prefs.last_save_error')}: <span className="font-medium text-fg">{ui.sync.lastSaveError || t('common.na')}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="font-medium text-muted">{t('profile.prefs.diagnostics.current')}</div>
                  <div>
                    {t('settings.theme.label')}: <span className="font-medium text-fg">{ui.settings.theme}</span>
                  </div>
                  <div>
                    {t('settings.language.label')}: <span className="font-medium text-fg">{ui.settings.language}</span>
                  </div>
                  <div>
                    {t('settings.sidebar.collapse')}: <span className="font-medium text-fg">{ui.settings.sidebarCollapsed ? t('common.yes') : t('common.no')}</span>
                  </div>
                  <div>
                    {t('profile.prefs.tip.sidebar_time_zone')}: <span className="font-medium text-fg">{ui.settings.tips.sidebarTimeZone}</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={includeTipsReset}
                    onChange={(e) => setIncludeTipsReset(e.target.checked)}
                    data-testid="profile.prefs.reset.include_tips"
                  />
                  <span>{t('profile.prefs.reset.include_tips')}</span>
                </label>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={retrySettingsLoad}
                    loading={retryingPrefs}
                    disabled={ui.sync.mode !== 'server'}
                    testId="profile.prefs.retry_load"
                  >
                    {t('common.retry')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={resetPreferences}
                    loading={resettingPrefs}
                    testId="profile.prefs.reset"
                  >
                    {t('profile.prefs.reset.action')}
                  </Button>
                </div>
              </div>
            </details>
          </CardBody>
        </Card>

        <Card testId="profile.tips.card" className="md:col-span-3">
          <CardHeader title={t('profile.tips.title')} subtitle={t('profile.tips.subtitle')} />
          <CardBody>
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
              <li>{t('profile.tips.item.0')}</li>
              <li>{t('profile.tips.item.2')}</li>
            </ul>
          </CardBody>
        </Card>
      </SummaryGrid>
    </DetailShell>
  );
}

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import { useUiSettings } from '../../../app/uiSettings';
import { useAppMode } from '../../../app/appMode';

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

export function ProfilePage() {
  const auth = useAuth();
  const appMode = useAppMode();
  const ui = useUiSettings();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

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
                    onChange={(e) => ui.setTheme(e.target.value as LegacyAny)}
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
                    onChange={(e) => ui.setLanguage(e.target.value as LegacyAny)}
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

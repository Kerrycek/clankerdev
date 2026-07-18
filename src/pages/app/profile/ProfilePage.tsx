import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../../app/auth';
import { getRuntimeConfig } from '../../../app/config';
import { useI18n } from '../../../app/i18n';
import { useUiSettings, type UiLanguagePreference, type UiThemePreference } from '../../../app/uiSettings';
import { useAppMode } from '../../../app/appMode';
import { useToasts } from '../../../app/toasts';

import { DetailShell } from '../../../components/layout/DetailShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import { SummaryGrid } from '../../../components/layout/SummaryGrid';

import { ProfileTabs } from './ProfileTabs';

import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';

import { formatDateTime } from '../../../lib/time';
import { computeOtherModeUrl } from '../../../lib/modeSwitch';
import { queueScopeAllObjectsWarning } from '../../../lib/pendingToasts';
import { fetchUser, updateUser, type User } from '../../../lib/api/users';
import { createChangeRequest } from '../../../lib/api/requests';
import { formatErrorMessage } from '../../../lib/errors';

function isUiThemePreference(value: string): value is UiThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isUiLanguagePreference(value: string): value is UiLanguagePreference {
  return value === 'system' || value === 'en' || value === 'cs';
}

function PreferenceRow(props: {
  label: React.ReactNode;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-border bg-surface-2 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)] sm:items-start">
      <div>
        <div className="text-sm font-semibold text-fg">{props.label}</div>
        <div className="mt-1 text-xs leading-5 text-muted">{props.description}</div>
      </div>
      <div className="min-w-0">{props.children}</div>
    </div>
  );
}

const FALLBACK_TIME_ZONES = [
  'Europe/Prague',
  'Europe/Bratislava',
  'Europe/Berlin',
  'Europe/London',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
];

function supportedTimeZones(): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: 'timeZone') => string[];
  };

  if (typeof intl.supportedValuesOf === 'function') {
    return intl.supportedValuesOf('timeZone');
  }

  return FALLBACK_TIME_ZONES;
}

function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function timeZoneOptions(current?: string | null, server?: string | null, browser?: string | null) {
  const pinned = ['Europe/Prague', server, browser, current, 'UTC'].filter(
    (v): v is string => typeof v === 'string' && v.trim() !== ''
  );

  const seen = new Set<string>();
  const all = [...pinned, ...supportedTimeZones()].filter((zone) => {
    if (seen.has(zone)) return false;
    seen.add(zone);
    return true;
  });

  return all.map((zone) => ({ value: zone, label: zone }));
}

function userString(user: User | null | undefined, key: keyof User): string {
  const value = user?.[key];
  return typeof value === 'string' ? value : '';
}

function AccountShortcut(props: {
  to: string;
  title: React.ReactNode;
  body: React.ReactNode;
  testId: string;
}) {
  return (
    <Button
      to={props.to}
      variant="secondary"
      className="h-auto w-full justify-start rounded-lg border-border bg-surface-2 p-3 text-left shadow-none hover:bg-surface"
      testId={props.testId}
    >
      <span className="block">
        <span className="block text-sm font-semibold text-fg">{props.title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted">{props.body}</span>
      </span>
    </Button>
  );
}

export function ProfilePage() {
  const auth = useAuth();
  const appMode = useAppMode();
  const ui = useUiSettings();
  const toasts = useToasts();
  const qc = useQueryClient();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [includeTipsReset, setIncludeTipsReset] = React.useState(false);
  const [resettingPrefs, setResettingPrefs] = React.useState(false);
  const [retryingPrefs, setRetryingPrefs] = React.useState(false);
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [changeReason, setChangeReason] = React.useState('');
  const [timeZone, setTimeZone] = React.useState('');
  const [changeSubmitted, setChangeSubmitted] = React.useState(false);

  const userId = auth.user?.id ?? null;
  const cfg = getRuntimeConfig();
  const serverTimeZone = cfg.serverTimeZone ?? null;
  const detectedBrowserTimeZone = browserTimeZone();

  const profileUserQ = useQuery({
    queryKey: ['users', userId],
    enabled: typeof userId === 'number',
    queryFn: async () => (await fetchUser(userId as number)).data,
    staleTime: 30_000,
  });

  const profileUser = profileUserQ.data ?? auth.user ?? null;

  React.useEffect(() => {
    if (!profileUser) return;
    setFullName(userString(profileUser, 'full_name'));
    setEmail(userString(profileUser, 'email'));
    setAddress(userString(profileUser, 'address'));
    setTimeZone(profileUser.time_zone ?? '');
    setChangeSubmitted(false);
  }, [profileUser]);

  const personalDirty =
    fullName !== userString(profileUser, 'full_name') ||
    email !== userString(profileUser, 'email') ||
    address !== userString(profileUser, 'address');

  const timeZoneDirty = timeZone !== (profileUser?.time_zone ?? '');

  const saveTimeZoneM = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      await updateUser(userId, { time_zone: timeZone });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
      toasts.pushToast({
        variant: 'ok',
        title: t('profile.personal.time_zone.toast.saved.title'),
        body: t('profile.personal.time_zone.toast.saved.body'),
      });
    },
    onError: (e) => {
      toasts.pushToast({
        variant: 'danger',
        title: t('profile.personal.time_zone.toast.failed.title'),
        body: formatErrorMessage(e),
      });
    },
  });

  const submitChangeM = useMutation({
    mutationFn: async () => {
      if (!userId || !profileUser) return;

      const payload: Parameters<typeof createChangeRequest>[0] = {
        change_reason: changeReason.trim(),
      };

      if (fullName !== userString(profileUser, 'full_name')) payload.full_name = fullName.trim();
      if (email !== userString(profileUser, 'email')) payload.email = email.trim();
      if (address !== userString(profileUser, 'address')) payload.address = address.trim();

      await createChangeRequest(payload);
    },
    onSuccess: async () => {
      setChangeReason('');
      setChangeSubmitted(true);
      await qc.invalidateQueries({ queryKey: ['user_request', 'changes'] });
      toasts.pushToast({
        variant: 'ok',
        title: t('profile.personal.change.toast.sent.title'),
        body: t('profile.personal.change.toast.sent.body'),
      });
    },
    onError: (e) => {
      toasts.pushToast({
        variant: 'danger',
        title: t('profile.personal.change.toast.failed.title'),
        body: formatErrorMessage(e),
      });
    },
  });

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

      <SummaryGrid testId="profile.summary" className="items-start">
        <Card testId="profile.user.card" className="md:col-span-5 lg:col-span-4">
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
                {profileUser?.time_zone ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted">{t('profile.personal.time_zone.label')}</span>
                    <span className="font-medium text-fg">{profileUser.time_zone}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="py-6 text-sm text-muted">{t('profile.user.loading')}</div>
            )}
          </CardBody>
        </Card>

        <Card testId="profile.shortcuts.card" className="md:col-span-7 lg:col-span-8">
          <CardHeader title={t('profile.shortcuts.title')} subtitle={t('profile.shortcuts.subtitle')} />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <AccountShortcut
                to={`${appMode.basePath}/profile/security`}
                testId="profile.shortcuts.security"
                title={t('profile.shortcuts.security.title')}
                body={t('profile.shortcuts.security.body')}
              />
              <AccountShortcut
                to={`${appMode.basePath}/profile/mfa`}
                testId="profile.shortcuts.mfa"
                title={t('profile.shortcuts.mfa.title')}
                body={t('profile.shortcuts.mfa.body')}
              />
              <AccountShortcut
                to={`${appMode.basePath}/profile/sessions`}
                testId="profile.shortcuts.sessions"
                title={t('profile.shortcuts.sessions.title')}
                body={t('profile.shortcuts.sessions.body')}
              />
              <AccountShortcut
                to={`${appMode.basePath}/profile/keys`}
                testId="profile.shortcuts.keys"
                title={t('profile.shortcuts.keys.title')}
                body={t('profile.shortcuts.keys.body')}
              />
              <AccountShortcut
                to={`${appMode.basePath}/profile/mail`}
                testId="profile.shortcuts.mail"
                title={t('profile.shortcuts.mail.title')}
                body={t('profile.shortcuts.mail.body')}
              />
              <AccountShortcut
                to={`${appMode.basePath}/incidents`}
                testId="profile.shortcuts.incidents"
                title={t('profile.shortcuts.incidents.title')}
                body={t('profile.shortcuts.incidents.body')}
              />
              <AccountShortcut
                to={`${appMode.basePath}/profile/user-data`}
                testId="profile.shortcuts.user_data"
                title={t('profile.shortcuts.user_data.title')}
                body={t('profile.shortcuts.user_data.body')}
              />
              <AccountShortcut
                to={`${appMode.basePath}/profile/resources`}
                testId="profile.shortcuts.resources"
                title={t('profile.shortcuts.resources.title')}
                body={t('profile.shortcuts.resources.body')}
              />
              <AccountShortcut
                to={`${appMode.basePath}/payments`}
                testId="profile.shortcuts.payments"
                title={t('profile.shortcuts.payments.title')}
                body={t('profile.shortcuts.payments.body')}
              />
            </div>
          </CardBody>
        </Card>

        <Card testId="profile.personal.card" className="md:col-span-12 lg:col-span-7">
          <CardHeader title={t('profile.personal.title')} subtitle={t('profile.personal.subtitle')} />
          <CardBody>
            {profileUserQ.isError ? (
              <Alert variant="danger" title={t('profile.personal.load_failed.title')}>
                {formatErrorMessage(profileUserQ.error)}
              </Alert>
            ) : null}

            {changeSubmitted ? (
              <Alert
                variant="ok"
                title={t('profile.personal.change.sent.title')}
                testId="profile.personal.change.sent"
                className="mb-3"
              >
                {t('profile.personal.change.sent.body')}
              </Alert>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label={t('profile.personal.full_name.label')}
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setChangeSubmitted(false);
                }}
                disabled={!profileUser}
                testId="profile.personal.full_name"
                autoComplete="name"
              />
              <Input
                label={t('profile.personal.email.label')}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setChangeSubmitted(false);
                }}
                disabled={!profileUser}
                testId="profile.personal.email"
                autoComplete="email"
              />
              <div className="sm:col-span-2">
                <Input
                  label={t('profile.personal.address.label')}
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setChangeSubmitted(false);
                  }}
                  disabled={!profileUser}
                  testId="profile.personal.address"
                  autoComplete="street-address"
                />
              </div>
              <div className="sm:col-span-2">
                <Textarea
                  label={t('profile.personal.change_reason.label')}
                  value={changeReason}
                  rows={3}
                  onChange={(e) => setChangeReason(e.target.value)}
                  disabled={!personalDirty || submitChangeM.isPending}
                  placeholder={t('profile.personal.change_reason.placeholder')}
                  testId="profile.personal.change_reason"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs leading-5 text-muted">{t('profile.personal.change.help')}</div>
              <Button
                onClick={() => submitChangeM.mutate()}
                disabled={!personalDirty || !changeReason.trim() || submitChangeM.isPending}
                loading={submitChangeM.isPending}
                testId="profile.personal.change.submit"
              >
                {t('profile.personal.change.submit')}
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card testId="profile.time_zone.card" className="md:col-span-6 lg:col-span-5">
          <CardHeader title={t('profile.personal.time_zone.title')} subtitle={t('profile.personal.time_zone.subtitle')} />
          <CardBody>
            <div className="space-y-3">
              <PreferenceRow
                label={t('profile.personal.time_zone.label')}
                description={t('profile.personal.time_zone.description')}
              >
                <Select
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  options={[
                    { value: '', label: t('profile.personal.time_zone.server_default') },
                    ...timeZoneOptions(profileUser?.time_zone, serverTimeZone, detectedBrowserTimeZone),
                  ]}
                  disabled={!profileUser || saveTimeZoneM.isPending}
                  testId="profile.personal.time_zone"
                />
              </PreferenceRow>

              <div className="rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
                {t('profile.personal.time_zone.current')}: {' '}
                <span className="font-medium text-fg">{profileUser?.time_zone || t('profile.personal.time_zone.server_default')}</span>
                {detectedBrowserTimeZone ? (
                  <>
                    {' · '}
                    {t('profile.personal.time_zone.browser')}: {' '}
                    <span className="font-medium text-fg">{detectedBrowserTimeZone}</span>
                  </>
                ) : null}
              </div>

              <div className="flex justify-end gap-2">
                {detectedBrowserTimeZone ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setTimeZone(detectedBrowserTimeZone)}
                    disabled={saveTimeZoneM.isPending}
                    testId="profile.personal.time_zone.use_browser"
                  >
                    {t('profile.personal.time_zone.use_browser')}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  onClick={() => saveTimeZoneM.mutate()}
                  disabled={!timeZoneDirty || saveTimeZoneM.isPending}
                  loading={saveTimeZoneM.isPending}
                  testId="profile.personal.time_zone.save"
                >
                  {t('common.save')}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card testId="profile.prefs.card" className="md:col-span-12 lg:col-span-7">
          <CardHeader title={t('profile.prefs.title')} subtitle={t('profile.prefs.subtitle')} />
          <CardBody>
            <div className="space-y-3">
              {canSwitchScope ? (
                <PreferenceRow
                  label={t('settings.scope.label')}
                  description={
                    appMode.mode === 'admin'
                      ? t('scope.indicator.admin_hint')
                      : t('scope.indicator.my_hint')
                  }
                >
                  <div className="grid grid-cols-2 gap-2">
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
                </PreferenceRow>
              ) : null}

              <PreferenceRow
                label={t('settings.theme.label')}
                description={t('profile.prefs.theme.desc')}
              >
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
              </PreferenceRow>

              <PreferenceRow
                label={t('settings.language.label')}
                description={t('profile.prefs.language.desc')}
              >
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
              </PreferenceRow>
            </div>

            <div className="mt-4 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs" data-testid="profile.prefs.sync">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted">
                <span>
                  {t('profile.prefs.persistence.label')}: <span className="font-medium text-fg">{syncModeLabel}</span>
                </span>
                <span>
                  {t('profile.prefs.sync_status.label')}: <span className="font-medium text-fg">{syncStatusLabel}</span>
                </span>
                <span>
                  {t('profile.prefs.last_loaded')}: <span className="font-medium text-fg">{lastLoadedAtLabel}</span>
                </span>
                <span>
                  {t('profile.prefs.last_saved')}: <span className="font-medium text-fg">{lastSavedAtLabel}</span>
                </span>
                {ui.sync.error ? <span className="text-danger">{ui.sync.error}</span> : null}
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

        <Card testId="profile.tips.card" className="md:col-span-6 lg:col-span-5">
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

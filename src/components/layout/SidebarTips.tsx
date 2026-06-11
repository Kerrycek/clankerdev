import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { getRuntimeConfig } from '../../app/config';
import { useAuth } from '../../app/auth';
import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';
import { fetchWebuiUserSetting, saveWebuiUserSetting } from '../../lib/api/webuiUserSettings';
import { updateUser } from '../../lib/api/users';
import { hardReplace } from '../../lib/browserNavigation';
import { formatErrorMessage } from '../../lib/errors';
import { areEquivalentTimeZones, browserTimeZone, isValidTimeZone } from '../../lib/timeZones';

import { Button } from '../ui/Button';

const TIP_NAMESPACE = 'tips';
const TIME_ZONE_TIP_KEY = 'time_zone';

function configuredServerTimeZone(): string | null {
  const cfg = getRuntimeConfig();
  const win = typeof window !== 'undefined' ? window : undefined;
  const raw = cfg.serverTimeZone ?? (win as any)?.vpsAdmin?.serverTimeZone ?? 'Europe/Prague';

  return isValidTimeZone(raw) ? raw : null;
}

async function syncSessionTimeZone(timeZone: string): Promise<void> {
  const cfg = getRuntimeConfig();
  const base = cfg.webuiUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) return;

  const url = `${base.replace(/\/+$/, '')}/session-time-zone.php`;
  const body = new URLSearchParams({ time_zone: timeZone });

  await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    credentials: 'same-origin',
    body,
  });
}

function isDismissed(value: unknown): boolean {
  if (value && typeof value === 'object') {
    return isDismissed((value as any).decision);
  }

  return value === true || value === 'true' || value === 'dismissed' || value === 'server_default' || value === 'used_browser';
}

export function SidebarTips(props: { collapsed: boolean }) {
  const auth = useAuth();
  const i18n = useI18n();
  const toasts = useToasts();
  const qc = useQueryClient();

  const browserZone = useMemo(() => browserTimeZone(), []);
  const serverZone = useMemo(() => configuredServerTimeZone(), []);
  const userTimeZone = auth.user?.['time_zone'];
  const userHasTimeZone = typeof userTimeZone === 'string' && userTimeZone.trim() !== '';
  const canSuggestTimeZone =
    !props.collapsed &&
    auth.status === 'authenticated' &&
    !userHasTimeZone &&
    Boolean(browserZone && serverZone && !areEquivalentTimeZones(browserZone, serverZone));

  const dismissedQ = useQuery({
    queryKey: ['webui_user_settings', TIP_NAMESPACE, TIME_ZONE_TIP_KEY],
    queryFn: () => fetchWebuiUserSetting(TIP_NAMESPACE, TIME_ZONE_TIP_KEY),
    enabled: canSuggestTimeZone,
    retry: false,
    staleTime: 60_000,
  });

  const persistDecision = async (decision: 'dismissed' | 'server_default' | 'used_browser') => {
    const value = {
      decision,
      browser_time_zone: browserZone,
      server_time_zone: serverZone,
      decided_at: new Date().toISOString(),
    };

    await saveWebuiUserSetting(TIP_NAMESPACE, TIME_ZONE_TIP_KEY, value);
    qc.setQueryData(['webui_user_settings', TIP_NAMESPACE, TIME_ZONE_TIP_KEY], value);
    await qc.invalidateQueries({ queryKey: ['webui_user_settings', TIP_NAMESPACE, TIME_ZONE_TIP_KEY] });
  };

  const dismissM = useMutation({
    mutationFn: () => persistDecision('dismissed'),
    onError: (error) => {
      toasts.pushToast({
        variant: 'danger',
        title: i18n.t('tips.time_zone.toast.dismiss_failed.title'),
        body: formatErrorMessage(error),
      });
    },
  });

  const keepDefaultM = useMutation({
    mutationFn: () => persistDecision('server_default'),
    onError: (error) => {
      toasts.pushToast({
        variant: 'danger',
        title: i18n.t('tips.time_zone.toast.save_failed.title'),
        body: formatErrorMessage(error),
      });
    },
  });

  const useBrowserM = useMutation({
    mutationFn: async () => {
      if (!auth.user?.id || !browserZone) return;
      await updateUser(auth.user.id, { time_zone: browserZone });
      await syncSessionTimeZone(browserZone).catch(() => undefined);
      await persistDecision('used_browser');
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
      hardReplace(window.location.pathname + window.location.search + window.location.hash);
    },
    onError: (error) => {
      toasts.pushToast({
        variant: 'danger',
        title: i18n.t('tips.time_zone.toast.use_failed.title'),
        body: formatErrorMessage(error),
      });
    },
  });

  if (!canSuggestTimeZone || !browserZone || !serverZone) return null;
  if (dismissedQ.isLoading || dismissedQ.isError) return null;
  if (isDismissed(dismissedQ.data)) return null;

  const busy = dismissM.isPending || keepDefaultM.isPending || useBrowserM.isPending;

  return (
    <section
      className="mx-2 mb-2 rounded-md border border-warn-border bg-warn-bg p-3 text-sm"
      data-testid="tips.time-zone"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-fg">{i18n.t('tips.time_zone.title')}</div>
          <p className="mt-1 text-xs leading-5 text-muted">
            {i18n.t('tips.time_zone.body', { browser: browserZone, server: serverZone })}
          </p>
        </div>
        <button
          type="button"
          className="rounded p-1 text-muted hover:bg-surface-2 hover:text-fg"
          aria-label={i18n.t('tips.time_zone.action.dismiss')}
          title={i18n.t('tips.time_zone.action.dismiss')}
          disabled={busy}
          onClick={() => dismissM.mutate()}
          data-testid="tips.time-zone.dismiss"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        <Button
          size="sm"
          variant="primary"
          loading={useBrowserM.isPending}
          disabled={busy}
          onClick={() => useBrowserM.mutate()}
          testId="tips.time-zone.use-browser"
        >
          {i18n.t('tips.time_zone.action.use_browser')}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={keepDefaultM.isPending}
          disabled={busy}
          onClick={() => keepDefaultM.mutate()}
          testId="tips.time-zone.keep-default"
        >
          {i18n.t('tips.time_zone.action.keep_default')}
        </Button>
      </div>
    </section>
  );
}

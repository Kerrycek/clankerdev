import React, { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';

import { getRuntimeConfig } from '../../app/config';
import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';

import { clearImpersonationState, readImpersonationState } from '../../lib/auth/impersonation';
import { closeUserSession } from '../../lib/api/userDossier';
import { formatDateTime } from '../../lib/time';
import { formatErrorMessage } from '../../lib/errors';
import { withRouterBasename } from '../../lib/routerPaths';

import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export function ImpersonationBanner() {
  const { t } = useI18n();
  const toasts = useToasts();

  const state = useMemo(() => {
    const storage = typeof window !== 'undefined' ? window.sessionStorage : undefined;
    return readImpersonationState(storage);
  }, []);

  const [busy, setBusy] = useState(false);

  const closeM = useMutation({
    mutationFn: async () => {
      if (!state) return;
      // Best-effort: close the borrowed token session while we still have access.
      await closeUserSession(state.sessionId);
    },
  });

  if (!state) return null;

  const target = state.targetLogin ? `${state.targetLogin} (#${state.targetUserId})` : `#${state.targetUserId}`;
  const reason = String(state.reason ?? '').trim();

  const started = state.startedAt ? formatDateTime(new Date(state.startedAt).toISOString()) : '—';

  const returnPath = state.returnPath && state.returnPath.startsWith('/') ? state.returnPath : '/admin';

  const end = async () => {
    if (busy) return;
    setBusy(true);

    try {
      if (state.sessionId) {
        try {
          await closeM.mutateAsync();
        } catch {
          // Ignore: token could have expired or already been closed.
        }
      }

      const storage = typeof window !== 'undefined' ? window.sessionStorage : undefined;
      clearImpersonationState(storage);

      // Force full reload so runtime config re-selects the original auth method.
      window.location.assign(withRouterBasename(returnPath, getRuntimeConfig().routerBasename));
    } catch (e) {
      toasts.pushToast({
        variant: 'danger',
        title: t('impersonation.banner.return_failed.title'),
        body: formatErrorMessage(e),
      });
      setBusy(false);
    }
  };

  return (
    <div
      className="mb-3 rounded-md border border-warn-border bg-warn-bg px-3 py-2 text-fg"
      data-testid="impersonation.banner"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <div className="mt-0.5 shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold">{t('impersonation.banner.title')}</div>
              <Badge variant="warn">{target}</Badge>
              <div className="text-xs text-muted">{t('impersonation.banner.started', { started })}</div>
            </div>

            {reason ? (
              <div className="mt-1 text-xs text-muted" data-testid="impersonation.banner.reason">
                {t('impersonation.banner.reason', { reason })}
              </div>
            ) : (
              <div className="mt-1 text-xs text-muted" data-testid="impersonation.banner.reason">
                {t('impersonation.banner.no_reason')}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void end()}
            disabled={busy}
            loading={busy}
            testId="impersonation.banner.return"
          >
            {t('impersonation.banner.return')}
          </Button>
        </div>
      </div>

      {closeM.isError ? (
        <div className="mt-2 text-xs text-muted" data-testid="impersonation.banner.close_error">
          {t('impersonation.banner.close_error')}: {formatErrorMessage(closeM.error)}
        </div>
      ) : null}
    </div>
  );
}

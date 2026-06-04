import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Maximize2, Minimize2, RotateCw } from 'lucide-react';

import { useI18n } from '../../../app/i18n';
import { createConsoleToken, deleteConsoleToken } from '../../../lib/api/vps';
import { HaveApiError } from '../../../lib/api/haveapi';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Spinner } from '../../../components/ui/Spinner';
import { clsx } from '../../../components/ui/clsx';
import { useVps } from './VpsContext';

function normalizeServerUrl(url: string) {
  return url.replace(/\/+$/, '');
}

export function VpsConsolePage() {
  const { vps } = useVps();
  const { t } = useI18n();
  const qc = useQueryClient();

  const [newSessionConfirmOpen, setNewSessionConfirmOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const server = (vps.node as any)?.location?.remote_console_server as string | undefined;
  const canCreateSession = Boolean(server);

  const tokenQ = useQuery({
    queryKey: ['vps', vps.id, 'consoleToken'],
    queryFn: async () => (await createConsoleToken(vps.id)).data,
    enabled: canCreateSession,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const newSessionM = useMutation({
    mutationFn: async () => {
      // Creating a new token may require invalidating the existing one first.
      // The backend `Create` can return an existing valid token.
      try {
        await deleteConsoleToken(vps.id);
      } catch {
        // ignore (e.g. no prior token)
      }
      return (await createConsoleToken(vps.id)).data;
    },
    onSuccess: (data) => {
      qc.setQueryData(['vps', vps.id, 'consoleToken'], data);
    },
  });

  const consoleUrl = useMemo(() => {
    if (!server) return null;
    if (!tokenQ.data?.token) return null;

    const s = normalizeServerUrl(server);
    return `${s}/console/${vps.id}?session=${encodeURIComponent(tokenQ.data.token)}`;
  }, [server, tokenQ.data, vps.id]);

  useEffect(() => {
    setIframeLoaded(false);
  }, [consoleUrl]);

  const techError = tokenQ.error instanceof HaveApiError ? tokenQ.error : null;

  const disabledNewSession = !canCreateSession || tokenQ.isFetching || newSessionM.isPending;

  const expiresAt =
    tokenQ.data?.expiration && !Number.isNaN(Date.parse(tokenQ.data.expiration))
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(tokenQ.data.expiration)
        )
      : null;

  return (
    <div className="space-y-3" data-testid="vps.console.page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t('vps.console.title')}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>{t('vps.console.subtitle')}</span>
            {expiresAt ? <span>{t('vps.console.expires_at', { time: expiresAt })}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            testId="vps.console.new_session"
            onClick={() => {
              if (tokenQ.data?.token) {
                setNewSessionConfirmOpen(true);
              } else {
                newSessionM.mutate();
              }
            }}
            disabled={disabledNewSession}
            title={t('vps.console.new_session.title_hint')}
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            {t('vps.console.new_session.label')}
          </Button>
          {consoleUrl ? (
            <>
              <Button
                variant={focused ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setFocused((value) => !value)}
                testId={focused ? 'vps.console.exit_focus' : 'vps.console.focus'}
                title={focused ? t('vps.console.exit_focus.title_hint') : t('vps.console.focus.title_hint')}
                ariaLabel={focused ? t('vps.console.exit_focus.label') : t('vps.console.focus.label')}
              >
                {focused ? (
                  <Minimize2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                )}
                {focused ? t('vps.console.exit_focus.label') : t('vps.console.focus.label')}
              </Button>
              <CopyButton
                text={consoleUrl}
                variant="secondary"
                size="sm"
                label={t('vps.console.copy_url')}
                testId="vps.console.copy_url"
              />
              <Button
                variant="secondary"
                size="sm"
                as="a"
                href={consoleUrl}
                target="_blank"
                rel="noreferrer"
                testId="vps.console.open_new_tab"
                title={t('vps.console.open_new_tab.title_hint')}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t('vps.console.open_new_tab')}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {!server ? (
        <div data-testid="vps.console.server_missing">
          <Alert variant="warn" title={t('vps.console.server_missing.title')}>
            {t('vps.console.server_missing.body')}
          </Alert>
        </div>
      ) : null}

      {tokenQ.isLoading ? (
        <div
          className="flex min-h-48 items-center justify-center rounded-md border border-border bg-code text-sm text-muted"
          data-testid="vps.console.loading"
        >
          <div className="flex items-center gap-2">
            <Spinner /> {t('vps.console.creating')}
          </div>
        </div>
      ) : null}

      {tokenQ.isError ? (
        <div data-testid="vps.console.error">
          <Alert variant="danger" title={t('vps.console.error.title')}>
            <div className="space-y-2">
              <div>{t('vps.console.error.body')}</div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => tokenQ.refetch()}
                  disabled={tokenQ.isFetching}
                  testId="vps.console.retry"
                >
                  {t('common.retry')}
                </Button>
              </div>

              <details className="rounded-md border border-border bg-surface-2 p-3">
                <summary className="cursor-pointer text-sm font-medium">{t('vps.console.technical_details')}</summary>
                <div className="mt-2 space-y-1 text-xs text-muted">
                  {techError?.httpStatus ? (
                    <div>
                      <span className="font-medium">{t('vps.console.tech.http')}</span>: {techError.httpStatus}
                    </div>
                  ) : null}
                  <div>
                    <span className="font-medium">{t('vps.console.tech.message')}</span>:{' '}
                    {String((tokenQ.error as any)?.message ?? tokenQ.error)}
                  </div>
                  {server ? (
                    <div>
                      <span className="font-medium">{t('vps.console.tech.server')}</span>: {server}
                    </div>
                  ) : null}
                </div>
              </details>
            </div>
          </Alert>
        </div>
      ) : null}

      {consoleUrl ? (
        <div
          className={clsx(
            'overflow-hidden rounded-md border bg-code shadow-card transition-shadow',
            focused ? 'border-accent shadow-panel' : 'border-border'
          )}
          data-testid="vps.console.frame"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-black px-3 py-2 text-xs text-white">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ok" aria-hidden="true" />
              <span className="truncate font-mono">{vps.hostname ?? `vps-${vps.id}`}</span>
            </div>
            <div className="text-white/70" data-testid="vps.console.frame_status">
              {iframeLoaded ? t('vps.console.ready') : t('vps.console.loading_frame')}
            </div>
          </div>
          <div className="relative bg-black">
            {!iframeLoaded ? (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center bg-black text-sm text-white/75"
                data-testid="vps.console.iframe_loading"
              >
                <div className="flex items-center gap-2">
                  <Spinner /> {t('vps.console.loading_frame')}
                </div>
              </div>
            ) : null}
            <iframe
              title={t('vps.console.iframe_title', { id: vps.id })}
              src={consoleUrl}
              className={clsx('block w-full border-0 bg-black', focused ? 'h-console-focus' : 'h-console')}
              allow="clipboard-read; clipboard-write"
              data-testid="vps.console.iframe"
              onLoad={() => setIframeLoaded(true)}
            />
          </div>
          <div className="border-t border-border bg-black px-3 py-2 text-xs text-white/65">
            {t('vps.console.session_hint')}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={newSessionConfirmOpen}
        testId="vps.console.new_session_dialog"
        title={t('vps.console.new_session.confirm_title')}
        description={t('vps.console.new_session.confirm_body')}
        confirmLabel={t('vps.console.new_session.confirm')}
        confirmLoading={newSessionM.isPending}
        cancelDisabled={newSessionM.isPending}
        onCancel={() => {
          if (newSessionM.isPending) return;
          setNewSessionConfirmOpen(false);
        }}
        onConfirm={() => {
          newSessionM.mutate(undefined, {
            onSettled: () => setNewSessionConfirmOpen(false),
          });
        }}
      />
    </div>
  );
}

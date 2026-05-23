import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../../app/i18n';
import { createConsoleToken, deleteConsoleToken } from '../../../lib/api/vps';
import { HaveApiError } from '../../../lib/api/haveapi';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Spinner } from '../../../components/ui/Spinner';
import { useVps } from './VpsContext';

function normalizeServerUrl(url: string) {
  return url.replace(/\/+$/, '');
}

export function VpsConsolePage() {
  const { vps } = useVps();
  const { t } = useI18n();
  const qc = useQueryClient();

  const [newSessionConfirmOpen, setNewSessionConfirmOpen] = useState(false);

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

  const techError = tokenQ.error instanceof HaveApiError ? tokenQ.error : null;

  const disabledNewSession = !canCreateSession || tokenQ.isFetching || newSessionM.isPending;

  return (
    <div className="space-y-4" data-testid="vps.console.page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t('vps.console.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('vps.console.subtitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('vps.console.basic_hint')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
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
            {t('vps.console.new_session.label')}
          </Button>
          {consoleUrl ? (
            <>
              <CopyButton text={consoleUrl} variant="secondary" label={t('vps.console.copy_url')} />
              <Button
                variant="secondary"
                as="a"
                href={consoleUrl}
                target="_blank"
                rel="noreferrer"
                testId="vps.console.open_new_tab"
              >
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
        <div className="flex items-center gap-2 text-sm text-muted" data-testid="vps.console.loading">
          <Spinner /> {t('vps.console.creating')}
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
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <iframe
            title={t('vps.console.iframe_title', { id: vps.id })}
            src={consoleUrl}
            className="h-console w-full"
            allow="clipboard-read; clipboard-write"
            data-testid="vps.console.iframe"
          />
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

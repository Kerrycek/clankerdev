import React from 'react';

import { useI18n } from '../../app/i18n';
import { formatErrorMessage } from '../../lib/errors';

import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { useChrome } from './ChromeContext';
import { clsx } from '../ui/clsx';

/**
 * SyncStaleBanner
 *
 * Page-level banner that appears when the global background polling is unhealthy
 * (offline or errors).
 *
 */
export function SyncStaleBanner(props: {
  testId?: string;
  className?: string;
}) {
  const chrome = useChrome();
  const { t } = useI18n();

  if (chrome.syncStatus === 'ok') return null;

  const isOffline = chrome.syncStatus === 'offline';
  const title = isOffline ? t('sync.offline.title') : t('sync.error.title');
  const body = isOffline ? t('sync.offline.body') : t('sync.error.body');
  const variant = isOffline ? ('danger' as const) : ('warn' as const);

  return (
    <div data-testid={props.testId ?? 'sync.banner'} className={clsx(props.className)}>
      <Alert title={title} variant={variant}>
        <div className="space-y-2">
          <div>{body}</div>

          {chrome.syncStatus === 'error' && chrome.syncError ? (
            <div className="text-xs text-muted" data-testid="sync.banner.last-error">
              {t('sync.error.last_error', { message: formatErrorMessage(chrome.syncError) })}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button testId="sync.banner.retry" size="sm" variant="primary" onClick={() => chrome.retrySync()}>
              {t('common.retry')}
            </Button>
            <Button
              testId="sync.banner.reload"
              size="sm"
              variant="secondary"
              onClick={() => window.location.reload()}
            >
              {t('common.reload')}
            </Button>
          </div>
        </div>
      </Alert>
    </div>
  );
}

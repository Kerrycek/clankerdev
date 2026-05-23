import React from 'react';

import { useI18n } from '../../app/i18n';
import { formatErrorMessage } from '../../lib/errors';

import { Alert } from './Alert';
import { Button } from './Button';
import { clsx } from './clsx';

export function LockStateStaleAlert(props: {
  chainIds?: number[];
  error?: unknown;
  onRetry?: () => void;
  testId?: string;
  className?: string;
}) {
  const { t } = useI18n();

  const ids = (props.chainIds ?? [])
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && x > 0)
    .slice(0, 5);

  const errMsg = props.error ? formatErrorMessage(props.error) : '';

  return (
    <div data-testid={props.testId ?? 'stale.lock.alert'} className={clsx(props.className)}>
      <Alert title={t('stale.lock.title')} variant="warn">
        <div className="space-y-2">
          <div>{t('stale.lock.body')}</div>

          {ids.length > 0 ? (
            <div className="text-xs text-muted" data-testid="stale.lock.alert.last-known">
              {t('stale.lock.last_known', { ids: ids.map((id) => `#${id}`).join(', ') })}
            </div>
          ) : null}

          {errMsg ? (
            <div className="text-xs text-muted" data-testid="stale.lock.alert.last-error">
              {t('stale.lock.last_error', { message: errMsg })}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            {props.onRetry ? (
              <Button testId="stale.lock.alert.retry" size="sm" variant="primary" onClick={() => props.onRetry?.()}>
                {t('common.retry')}
              </Button>
            ) : null}
            <Button
              testId="stale.lock.alert.reload"
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

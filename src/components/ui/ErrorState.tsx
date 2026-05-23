import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useI18n } from '../../app/i18n';
import { buildErrorDetails, classifyError, errorI18nKeys, type ErrorKind } from '../../lib/errorMapping';
import { Card } from './Card';
import { Button } from './Button';
import { LinkButton } from './LinkButton';
import { CopyButton } from './CopyButton';
import type { ButtonVariant } from './buttonStyles';

type ErrorStateAction = {
  label: React.ReactNode;
  onClick?: () => void | Promise<unknown>;
  href?: string;
  to?: string;
  variant?: ButtonVariant;
};

export function ErrorState(props: {
  /**
   * The original error object (HaveAPI/fetch/etc).
   *
   * Used to:
   * - classify the error (network/401/403/404/5xx)
   * - render/copy technical details
   */
  error?: unknown;

  /** Override classification (useful for "not found" surfaces without an error object). */
  kindOverride?: ErrorKind;

  /** Optional custom title/body. If omitted, uses mapped i18n keys. */
  title?: React.ReactNode;
  body?: React.ReactNode;
  /** Backward-compatible alias used by older pages. */
  message?: React.ReactNode;

  /** Primary recovery action. Defaults to a full-page reload. */
  onRetry?: () => void;

  /**
   * Backward-compatible explicit actions used by a number of older pages.
   * When supplied, these replace the default retry/back/status actions.
   */
  actions?: {
    primary?: ErrorStateAction;
    secondary?: ErrorStateAction;
    tertiary?: ErrorStateAction;
  };

  /**
   * Secondary action.
   *
   * - If provided, renders a link-style button.
   * - Otherwise uses history back.
   */
  backTo?: string;

  /** Hide the back action (e.g. when it's not meaningful). */
  showBack?: boolean;

  /** Optional "Open status" action. */
  showStatusLink?: boolean;
  statusTo?: string;

  /** Optional details payload fields included in Copy details. */
  detailsExtra?: Record<string, unknown>;

  /** Hide the technical details section completely (rare). */
  showDetails?: boolean;

  testId?: string;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const info = useMemo(() => {
    const base = classifyError(props.error);
    const kind = props.kindOverride ?? base.kind;
    return { ...base, kind };
  }, [props.error, props.kindOverride]);

  const keys = errorI18nKeys(info.kind);
  const title = props.title ?? t(keys.titleKey);
  const body = props.body ?? props.message ?? t(keys.bodyKey);

  const details = useMemo(
    () => buildErrorDetails({ error: props.error, extra: props.detailsExtra }),
    [props.detailsExtra, props.error]
  );
  const showDetails = props.showDetails ?? (Boolean(props.error) || Boolean(props.detailsExtra));

  const showBack = props.showBack !== false;
  const showStatus =
    props.showStatusLink ??
    (info.kind === 'network' || info.kind === 'server' || info.kind === 'unexpected');

  const testId = props.testId;
  const retryTestId = testId ? `${testId}.retry` : undefined;
  const backTestId = testId ? `${testId}.back` : undefined;
  const statusTestId = testId ? `${testId}.status` : undefined;
  const copyTestId = testId ? `${testId}.copy_details` : undefined;
  const detailsTestId = testId ? `${testId}.details` : undefined;

  function renderCompatAction(action: ErrorStateAction | undefined, slot: 'primary' | 'secondary' | 'tertiary') {
    if (!action) return null;

    const variant: ButtonVariant =
      action.variant ?? (slot === 'primary' ? 'primary' : slot === 'secondary' ? 'secondary' : 'ghost');
    const actionTestId = testId ? `${testId}.${slot}` : undefined;

    if (action.to) {
      return (
        <LinkButton key={slot} testId={actionTestId} to={action.to} variant={variant}>
          {action.label}
        </LinkButton>
      );
    }

    if (action.href) {
      return (
        <Button key={slot} testId={actionTestId} href={action.href} variant={variant}>
          {action.label}
        </Button>
      );
    }

    return (
      <Button key={slot} testId={actionTestId} variant={variant} onClick={() => void action.onClick?.()}>
        {action.label}
      </Button>
    );
  }

  const compatActions = props.actions
    ? [
        renderCompatAction(props.actions.primary, 'primary'),
        renderCompatAction(props.actions.secondary, 'secondary'),
        renderCompatAction(props.actions.tertiary, 'tertiary'),
      ].filter(Boolean)
    : null;

  return (
    <Card testId={testId}>
      <div className="p-4">
        <div className="text-sm font-semibold text-fg">{title}</div>
        <div className="mt-1 text-sm text-muted">{body}</div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {compatActions ? (
            compatActions
          ) : (
            <>
              <Button testId={retryTestId} onClick={props.onRetry ?? (() => window.location.reload())}>
                {t('common.retry')}
              </Button>

              {showBack ? (
                props.backTo ? (
                  <LinkButton testId={backTestId} to={props.backTo} variant="secondary">
                    {t('common.back')}
                  </LinkButton>
                ) : (
                  <Button testId={backTestId} variant="secondary" onClick={() => navigate(-1)}>
                    {t('common.back')}
                  </Button>
                )
              ) : null}

              {showStatus ? (
                <LinkButton testId={statusTestId} to={props.statusTo ?? '/'} variant="ghost">
                  {t('nav.status')}
                </LinkButton>
              ) : null}
            </>
          )}

          {showDetails ? (
            <CopyButton
              testId={copyTestId}
              text={details.text}
              label={t('common.copy_details')}
              variant="ghost"
            />
          ) : null}
        </div>

        {showDetails ? (
          <details className="mt-4" data-testid={detailsTestId}>
            <summary className="cursor-pointer text-sm font-medium text-fg">
              {t('common.details')}
            </summary>

            <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-border bg-surface-2 p-3 text-xs text-fg">
              {details.text}
            </pre>
          </details>
        ) : null}
      </div>
    </Card>
  );
}

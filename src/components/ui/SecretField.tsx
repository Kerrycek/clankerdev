import React, { useMemo, useState } from 'react';

import { useI18n } from '../../app/i18n';

import { Button } from './Button';
import { CopyButton } from './CopyButton';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { clsx } from './clsx';

function maskValue(v: string, opts?: { showFragment?: boolean }): string {
  const trimmed = v.trim();
  if (!trimmed) return '';

  const showFragment = opts?.showFragment ?? false;
  if (!showFragment) return '••••••••••••';

  // Keep a tiny useful fragment for disambiguation without leaking the full secret.
  // Example: abcd…wxyz
  if (trimmed.length <= 10) return '••••••••••';

  const head = trimmed.slice(0, 4);
  const tail = trimmed.slice(-4);
  return `${head}…${tail}`;
}

export function SecretField(props: {
  value: string | null | undefined;
  label?: string;
  description?: string;
  /** When false, the secret is shown immediately (use sparingly). Default: false (hidden). */
  revealedByDefault?: boolean;
  /** Whether to show a short fragment when hidden. Default: false. */
  showFragment?: boolean;
  /** Use textarea for long/multi-line secrets. Default: false. */
  multiline?: boolean;
  rows?: number;
  /** Optional extra copy label (defaults to common.copy). */
  copyLabel?: string;
  /** Optional test id prefix. */
  testId?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const [revealed, setRevealed] = useState(Boolean(props.revealedByDefault));

  const value = props.value ?? '';
  const hasValue = value.trim() !== '';

  const display = useMemo(() => {
    if (!hasValue) return '';
    return revealed ? value : maskValue(value, { showFragment: props.showFragment });
  }, [hasValue, props.showFragment, revealed, value]);

  const prefix = props.testId;

  return (
    <div className={clsx('space-y-1', props.className)} data-testid={prefix}>
      {props.label ? (
        <div className="text-xs font-medium text-muted">{props.label}</div>
      ) : null}

      {props.description ? <div className="text-xs text-faint">{props.description}</div> : null}

      <div className={clsx('flex flex-col gap-2 sm:flex-row sm:items-center')}>
        <div className="min-w-0 flex-1">
          {props.multiline ? (
            <Textarea
              testId={prefix ? `${prefix}.field` : undefined}
              value={display}
              rows={props.rows ?? 3}
              disabled={!hasValue}
              className="font-mono text-xs tabular-nums"
            />
          ) : (
            <Input
              testId={prefix ? `${prefix}.field` : undefined}
              value={display}
              disabled={!hasValue}
              className="font-mono text-xs tabular-nums"
            />
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {hasValue ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRevealed((v) => !v)}
              testId={prefix ? `${prefix}.toggle` : undefined}
            >
              {revealed ? t('common.hide') : t('common.reveal')}
            </Button>
          ) : null}

          {hasValue ? (
            <CopyButton
              text={value}
              label={props.copyLabel}
              variant="secondary"
              size="sm"
              testId={prefix ? `${prefix}.copy` : undefined}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

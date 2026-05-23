import React from 'react';
import { X } from 'lucide-react';

import { useI18n } from '../../app/i18n';
import { clsx } from './clsx';
import { toneSurfaceClass, type ToneVariant } from './tone';

export function FilterChip(props: {
  label: string;
  tone?: ToneVariant;
  onRemove?: () => void;
  /** Optional test id for E2E / integration tests */
  testId?: string;
}) {
  const { t } = useI18n();

  const tone = props.tone ?? 'muted';
  const textClass =
    tone === 'ok'
      ? 'text-ok'
      : tone === 'warn'
        ? 'text-warn'
        : tone === 'danger'
          ? 'text-danger'
          : tone === 'info'
            ? 'text-info'
            : tone === 'neutral'
              ? 'text-fg'
              : 'text-muted';

  return (
    <span
      data-testid={props.testId}
      className={clsx(
        'inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        toneSurfaceClass(tone),
        textClass
      )}
    >
      <span className="min-w-0 truncate">{props.label}</span>
      {props.onRemove ? (
        <button
          type="button"
          className="inline-flex h-4 w-4 items-center justify-center rounded hover:bg-surface-2"
          onClick={props.onRemove}
          aria-label={t('common.remove')}
          title={t('common.remove')}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}

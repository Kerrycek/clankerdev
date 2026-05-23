import React from 'react';

import { usageSeverityFromRatio } from '../../lib/usage';
import { clsx } from './clsx';
import { StackedBar } from './StackedBar';

export type UsageBarLayout = 'block' | 'row';

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function UsageBar(props: {
  label?: React.ReactNode;
  used?: number | null;
  max?: number | null;
  /** Value formatter for the numbers (defaults to raw number string). */
  formatValue?: (n: number) => string;
  /** Backward-compatible simple unit suffix used by older call sites. */
  unit?: string;
  layout?: UsageBarLayout;
  /**
   * When layout="row", these control consistent column widths.
   * Defaults are chosen to match existing dense list usage.
   */
  rowLabelClassName?: string;
  rowValueClassName?: string;
  showValues?: boolean;
  ariaLabel?: string;
  className?: string;
  testId?: string;
  barTestId?: string;
}) {
  const layout: UsageBarLayout = props.layout ?? 'block';
  const format = props.formatValue ?? ((n: number) => (props.unit ? `${n} ${props.unit}` : String(n)));
  const showValues = props.showValues ?? true;

  const usedRaw = isFiniteNumber(props.used) ? props.used : undefined;
  const maxRaw = isFiniteNumber(props.max) ? props.max : undefined;

  const max = maxRaw !== undefined ? Math.max(0, maxRaw) : undefined;
  const used = usedRaw !== undefined ? Math.max(0, usedRaw) : 0;

  const valid = max !== undefined && max > 0;
  const ratio = valid ? used / max : 0;
  const free = valid ? Math.max(0, max - used) : 0;
  const variant = usageSeverityFromRatio(ratio);

  // Default aria label should not add English-only suffixes.
  // If the label is a string, it is usually descriptive enough for screen readers.
  const aria = props.ariaLabel ?? (typeof props.label === 'string' ? String(props.label) : 'usage');
  const label = props.label ?? null;

  if (layout === 'row') {
    return (
      <div data-testid={props.testId} className={clsx('flex items-center gap-2', props.className)}>
        <span className={clsx('w-12 text-faint', props.rowLabelClassName)}>{label}</span>

        <div className="flex-1">
          {valid ? (
            <StackedBar
              ariaLabel={aria}
              testId={props.barTestId}
              segments={[
                { value: used, variant },
                { value: free, variant: 'neutral' },
              ]}
            />
          ) : (
            <div className="h-2 w-full rounded-full bg-surface-2" />
          )}
        </div>

        {showValues ? (
          <span className={clsx('w-28 text-right text-faint', props.rowValueClassName)}>
            {valid ? (
              <>
                {usedRaw !== undefined ? format(usedRaw) : '—'} / {format(max as number)}
              </>
            ) : (
              '—'
            )}
          </span>
        ) : null}
      </div>
    );
  }

  // layout === 'block'
  return (
    <div data-testid={props.testId} className={clsx('space-y-1', props.className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate">{label}</span>
        {showValues ? (
          <span className="shrink-0 text-faint">
            {valid ? (
              <>
                {usedRaw !== undefined ? format(usedRaw) : '—'} / {format(max as number)}
              </>
            ) : (
              '—'
            )}
          </span>
        ) : null}
      </div>
      {valid ? (
        <StackedBar
          ariaLabel={aria}
          testId={props.barTestId}
          segments={[
            { value: used, variant },
            { value: free, variant: 'neutral' },
          ]}
        />
      ) : (
        <div className="h-2 w-full rounded-full bg-surface-2" />
      )}
    </div>
  );
}

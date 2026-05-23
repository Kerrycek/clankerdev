import React from 'react';

import { clsx } from './clsx';

export type StackedBarVariant = 'ok' | 'warn' | 'danger' | 'accent' | 'neutral';

export type StackedBarSegment = {
  value: number;
  variant: StackedBarVariant;
  title?: string;
};

function segmentClass(v: StackedBarVariant): string {
  switch (v) {
    case 'ok':
      return 'bg-ok';
    case 'warn':
      return 'bg-warn';
    case 'danger':
      return 'bg-danger';
    case 'accent':
      return 'bg-accent';
    default:
      return 'bg-border';
  }
}

export function StackedBar(props: {
  segments: StackedBarSegment[];
  className?: string;
  ariaLabel: string;
  testId?: string;
}) {
  const total = props.segments.reduce((acc, s) => acc + Math.max(0, s.value), 0);

  return (
    <div
      className={clsx('h-2 w-full overflow-hidden rounded-full bg-surface-2', props.className)}
      role="img"
      aria-label={props.ariaLabel}
      data-testid={props.testId}
    >
      <div className="flex h-full w-full">
        {total <= 0 ? (
          <div className="h-full w-full bg-border" />
        ) : (
          props.segments
            .filter((s) => s.value > 0)
            .map((s, i) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                className={clsx('h-full', segmentClass(s.variant))}
                style={{ width: `${(s.value / total) * 100}%` }}
                title={s.title}
              />
            ))
        )}
      </div>
    </div>
  );
}

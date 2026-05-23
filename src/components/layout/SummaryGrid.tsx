import React from 'react';

import { clsx } from '../ui/clsx';

export type SummaryGridVariant = 'default';

/**
 * SummaryGrid
 *
 * A 12-column responsive grid used for `StatCard`-style KPI summaries.
 *
 * See: docs/spec/PAGE_LAYOUT_PRIMITIVES.md
 */
export function SummaryGrid(props: {
  children: React.ReactNode;
  className?: string;
  testId?: string;
  variant?: SummaryGridVariant;
}) {
  const v = props.variant ?? 'default';

  return (
    <div
      data-testid={props.testId}
      className={clsx(
        'grid grid-cols-1 gap-4',
        v === 'default' ? 'md:grid-cols-12' : 'md:grid-cols-12',
        props.className
      )}
    >
      {props.children}
    </div>
  );
}

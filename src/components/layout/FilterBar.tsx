import React from 'react';

import { clsx } from '../ui/clsx';

/**
 * FilterBar
 *
 * A single-row (wrapping) container for list page filters.
 */
export function FilterBar(props: {
  /**
   * Prefer using `children`.
   *
   * `left`/`right` are supported for legacy two-column layouts.
   */
  children?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  testId?: string;
  className?: string;
}) {
  const content =
    props.children ??
    (props.left || props.right ? (
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">{props.left}</div>
        <div className="flex items-center gap-2">{props.right}</div>
      </div>
    ) : null);

  return (
    <div data-testid={props.testId} className={clsx('flex w-full flex-wrap items-end gap-2', props.className)}>
      {content}
    </div>
  );
}

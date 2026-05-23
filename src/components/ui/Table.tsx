import React from 'react';

import { clsx } from './clsx';

export type TableMinWidth = 'full' | 'sm' | 'md' | 'lg' | 'xl';

export type TableVariant = 'list' | 'plain';

function minWidthClass(v: TableMinWidth): string {
  if (v === 'sm') return 'min-w-table-sm';
  if (v === 'md') return 'min-w-table-md';
  if (v === 'lg') return 'min-w-table-lg';
  if (v === 'xl') return 'min-w-table-xl';
  return 'min-w-full';
}

/**
 * Table
 *
 * Minimal shared table primitive.
 *
 * Note: row/cell padding is still controlled by callers; this component
 * only enforces consistent base typography and min-width tokens.
 */
export function Table(props: {
  children: React.ReactNode;
  minWidth?: TableMinWidth;
  variant?: TableVariant;
  className?: string;
  testId?: string;
}) {
  const mw: TableMinWidth = props.minWidth ?? 'full';
  const v: TableVariant = props.variant ?? 'list';

  const variantClass = v === 'list' ? 'table-list' : undefined;

  return (
    <table
      data-testid={props.testId}
      className={clsx('w-full text-sm tabular-nums', minWidthClass(mw), variantClass, props.className)}
    >
      {props.children}
    </table>
  );
}

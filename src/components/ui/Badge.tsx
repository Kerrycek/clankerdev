import React from 'react';
import { clsx } from './clsx';

const variants = {
  neutral: 'bg-neutral-bg text-neutral border-neutral-border',
  ok: 'bg-ok-bg text-ok border-ok-border',
  warn: 'bg-warn-bg text-warn border-warn-border',
  danger: 'bg-danger-bg text-danger border-danger-border',
  info: 'bg-info-bg text-info border-info-border',

  /**
   * Inverted badge. In light theme this is “dark”, in dark theme it becomes “light”.
   * Prefer semantic variants above; use this sparingly for emphasis.
   */
  black: 'bg-fg text-bg border-fg',
} as const;

export function Badge(props: {
  variant?: keyof typeof variants;
  /** Backward-compatible alias. */
  tone?: keyof typeof variants;
  children: React.ReactNode;
  className?: string;
  title?: string;
  testId?: string;
}) {
  const v = props.variant ?? props.tone ?? 'neutral';

  return (
    <span
      title={props.title}
      data-testid={props.testId}
      className={clsx(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        variants[v],
        props.className
      )}
    >
      {props.children}
    </span>
  );
}

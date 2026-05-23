import React from 'react';

import { clsx } from './clsx';

export type StatusDotVariant = 'neutral' | 'ok' | 'warn' | 'danger' | 'info';

const dotVariants: Record<StatusDotVariant, string> = {
  neutral: 'bg-neutral',
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  info: 'bg-info',
};

export function StatusDot(props: {
  variant?: StatusDotVariant;
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
  testId?: string;
  ariaLabel?: string;
}) {
  const v = props.variant ?? 'neutral';
  const size = props.size ?? 'sm';

  const sizeClass = size === 'md' ? 'h-3 w-3' : 'h-2 w-2';

  return (
    <span
      role={props.ariaLabel ? 'img' : undefined}
      aria-label={props.ariaLabel}
      title={props.title}
      data-testid={props.testId}
      className={clsx(
        'inline-block rounded-full ring-1 ring-border',
        sizeClass,
        dotVariants[v],
        props.className
      )}
    />
  );
}

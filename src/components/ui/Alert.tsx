import React from 'react';

import { clsx } from './clsx';

export function Alert(props: {
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Backward-compatible body alias used by older pages. */
  description?: React.ReactNode;
  variant?: 'info' | 'neutral' | 'ok' | 'warn' | 'danger';
  /** Backward-compatible alias. */
  tone?: 'info' | 'neutral' | 'ok' | 'warn' | 'danger';
  className?: string;
  testId?: string;
}) {
  const variant = props.variant ?? props.tone ?? 'info';

  const styles =
    variant === 'danger'
      ? 'border-danger-border bg-danger-bg text-fg'
      : variant === 'warn'
        ? 'border-warn-border bg-warn-bg text-fg'
        : variant === 'ok'
          ? 'border-ok-border bg-ok-bg text-fg'
          : variant === 'neutral'
            ? 'border-neutral-border bg-neutral-bg text-fg'
            : // info (default)
              'border-info-border bg-info-bg text-fg';

  const hasBody = props.description !== undefined || props.children !== undefined;

  return (
    <div data-testid={props.testId} className={clsx('rounded-lg border p-3', styles, props.className)}>
      {props.title ? <div className="font-semibold">{props.title}</div> : null}
      {hasBody ? (
        <div className={props.title ? 'mt-1 text-sm text-muted' : 'text-sm text-muted'}>
          {props.description !== undefined ? <div>{props.description}</div> : null}
          {props.children !== undefined ? <div className={props.description !== undefined ? 'mt-2' : undefined}>{props.children}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

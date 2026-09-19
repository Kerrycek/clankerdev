import React from 'react';
import { clsx } from './clsx';

export function Card(props: { id?: string; testId?: string; className?: string; children: React.ReactNode }) {
  return (
    <div
      id={props.id}
      data-testid={props.testId}
      className={clsx('min-w-0 rounded-lg border border-border bg-surface shadow-card', props.className)}
    >
      {props.children}
    </div>
  );
}

export function CardHeader(props: {
  className?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  /** Backward-compatible alias. */
  right?: React.ReactNode;
}) {
  const actions = props.actions ?? props.right;

  return (
    <div className={clsx('flex flex-col items-start gap-3 border-b border-border p-4 sm:flex-row', props.className)}>
      <div className="w-full min-w-0 sm:w-auto sm:flex-1">
        <div className="font-semibold">{props.title}</div>
        {props.subtitle ? <div className="mt-0.5 text-sm text-muted">{props.subtitle}</div> : null}
      </div>

      {actions ? (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{actions}</div>
      ) : null}
    </div>
  );
}

export function CardBody(props: { className?: string; children: React.ReactNode }) {
  return <div className={clsx('p-4', props.className)}>{props.children}</div>;
}

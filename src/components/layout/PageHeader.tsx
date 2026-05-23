import React from 'react';

import { clsx } from '../ui/clsx';

/**
 * PageHeader
 *
 * Canonical header for list pages and non-tabbed pages.
 */
export function PageHeader(props: {
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  /** Backward-compatible alias. */
  right?: React.ReactNode;
  testId?: string;
  className?: string;
}) {
  const actions = props.actions ?? props.right;

  return (
    <div
      data-testid={props.testId}
      data-document-title-root
      data-document-title-kind="page"
      className={clsx('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', props.className)}
    >
      <div className="min-w-0">
        {/**
          Typography contract (see docs/spec/DESIGN_SYSTEM_FOUNDATIONS.md):
          - Mobile: text-lg
          - Desktop (md+): text-xl
        */}
        <h1 className="text-lg font-semibold text-fg md:text-xl" data-document-title-heading>{props.title}</h1>
        {props.description ? <p className="mt-1 text-sm text-muted">{props.description}</p> : null}
        {props.meta ? <div className="mt-1 text-xs text-faint">{props.meta}</div> : null}
      </div>

      {actions ? (
        <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto sm:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}

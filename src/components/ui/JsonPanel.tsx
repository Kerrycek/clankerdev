import React from 'react';

import { safeJson } from '../../lib/txFormat';

import { CopyButton } from './CopyButton';
import { clsx } from './clsx';

function pickMaxHeightClass(v: string | undefined): string {
  // Keep explicit so Tailwind sees all used classes.
  if (v === 'max-h-80') return 'max-h-80';
  if (v === 'max-h-96') return 'max-h-96';
  if (v === 'max-h-scroll-lg') return 'max-h-scroll-lg';
  return 'max-h-scroll-lg';
}

/**
 * JsonPanel
 *
 * Consistent JSON-ish value viewer for power users.
 * - Opaque surface
 * - Copy button
 * - Bounded height (no runaway pages)
 */
export function JsonPanel(props: {
  title: string;
  value: unknown;
  emptyLabel?: string;
  maxHeightClass?: 'max-h-80' | 'max-h-96' | 'max-h-scroll-lg';
  testId?: string;
}) {
  const hasValue = props.value !== null && props.value !== undefined && props.value !== '';
  const text = hasValue ? safeJson(props.value) : '';
  const maxH = pickMaxHeightClass(props.maxHeightClass);

  return (
    <div data-testid={props.testId}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted">{props.title}</div>
        {text ? <CopyButton text={text} /> : null}
      </div>
      {text ? (
        <pre className={clsx('mt-2 overflow-auto rounded-md border border-border bg-surface p-3 text-xs text-muted', maxH)}>
          {text}
        </pre>
      ) : (
        <div className="mt-2 text-xs text-muted">{props.emptyLabel ?? '—'}</div>
      )}
    </div>
  );
}

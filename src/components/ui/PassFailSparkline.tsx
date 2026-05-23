import React, { useMemo } from 'react';

import { clsx } from './clsx';

export type PassFailPoint = {
  /** Unix seconds (for tooltips / ordering) */
  ts: number;
  ok: boolean;
  title?: string;
};

function clampPoints(points: PassFailPoint[], maxPoints: number): PassFailPoint[] {
  const sorted = [...points]
    .filter((p) => Number.isFinite(p.ts))
    .sort((a, b) => a.ts - b.ts);
  return sorted.length > maxPoints ? sorted.slice(sorted.length - maxPoints) : sorted;
}

/**
 * Compact pass/fail timeline.
 *
 * Intended for quick “shape of the problem” scanning in operational views.
 * Uses solid colors (no transparency) and provides tooltips for each tick.
 */
export function PassFailSparkline(props: {
  points: PassFailPoint[];
  maxPoints?: number;
  className?: string;
  ariaLabel: string;
  statsLabels?: { ok: string; failed: string };
  testId?: string;
}) {
  const maxPoints = props.maxPoints ?? 60;

  const pts = useMemo(() => clampPoints(props.points, maxPoints), [maxPoints, props.points]);
  const okCount = pts.filter((p) => p.ok).length;
  const failCount = pts.length - okCount;
  const aria = props.statsLabels
    ? `${props.ariaLabel}: ${okCount} ${props.statsLabels.ok}, ${failCount} ${props.statsLabels.failed}`
    : props.ariaLabel;

  return (
    <div
      data-testid={props.testId}
      className={clsx('flex items-center gap-0.5', props.className)}
      role="img"
      aria-label={aria}
    >
      {pts.map((p, idx) => (
        <span
          key={`${p.ts}.${idx}`}
          title={p.title}
          aria-hidden
          className={clsx(
            'h-4 w-1 rounded-sm ring-1 ring-border',
            p.ok ? 'bg-ok' : 'bg-danger'
          )}
        />
      ))}
    </div>
  );
}

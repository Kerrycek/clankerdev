import React, { useMemo } from 'react';

import { seriesColorClass, type ChartSeriesVariant } from '../../lib/chartPalette';

import { clsx } from './clsx';

export type SparklineVariant = ChartSeriesVariant;

export function Sparkline(props: {
  points: number[];
  ariaLabel: string;
  className?: string;
  variant?: SparklineVariant;
}) {
  const variant: SparklineVariant = props.variant ?? 'muted';

  const d = useMemo(() => {
    const pts = props.points.filter((n) => Number.isFinite(n));
    if (pts.length < 2) return null;

    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const span = max - min || 1;

    const w = 100;
    const h = 24;
    const pad = 2;

    return pts
      .map((y, i) => {
        const x = pad + (i / (pts.length - 1)) * (w - pad * 2);
        const yy = h - pad - ((y - min) / span) * (h - pad * 2);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${yy.toFixed(2)}`;
      })
      .join(' ');
  }, [props.points]);

  return (
    <svg
      viewBox="0 0 100 24"
      className={clsx('h-6 w-20', props.className)}
      role="img"
      aria-label={props.ariaLabel}
    >
      {d ? (
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          className={seriesColorClass(variant)}
          strokeWidth={2}
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M2 12 L98 12"
          fill="none"
          stroke="currentColor"
          className="text-chart-axis"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.35}
        />
      )}
    </svg>
  );
}

import React from 'react';

import { clamp01, usageSeverityFromRatio } from '../../lib/usage';

import { clsx } from './clsx';

export type GaugeRingSize = 'sm' | 'md' | 'lg';
export type GaugeRingVariant = 'auto' | 'ok' | 'warn' | 'danger' | 'neutral';

function autoVariant(ratio: number): Exclude<GaugeRingVariant, 'auto'> {
  // Shared threshold semantics for usage (see docs/spec/DATA_VISUALIZATION.md)
  return usageSeverityFromRatio(ratio);
}

function variantClass(v: Exclude<GaugeRingVariant, 'auto'>): string {
  switch (v) {
    case 'ok':
      return 'text-ok';
    case 'warn':
      return 'text-warn';
    case 'danger':
      return 'text-danger';
    default:
      return 'text-muted';
  }
}

export function GaugeRing(props: {
  value?: number;
  max?: number;
  /** Backward-compatible ratio input in the 0..1 range. */
  ratio?: number;
  size?: GaugeRingSize;
  variant?: GaugeRingVariant;
  center?: React.ReactNode;
  /** Backward-compatible alias used by older demos. */
  label?: string;
  ariaLabel?: string;
  className?: string;
  testId?: string;
}) {
  const size: GaugeRingSize = props.size ?? 'md';
  const ratio = props.ratio ?? (props.max && props.max > 0 && typeof props.value === 'number' ? clamp01(props.value / props.max) : 0);
  const v: Exclude<GaugeRingVariant, 'auto'> =
    props.variant && props.variant !== 'auto' ? props.variant : autoVariant(ratio);

  const sizeClass =
    size === 'lg' ? 'h-20 w-20' : size === 'sm' ? 'h-10 w-10' : 'h-14 w-14';

  // SVG geometry (40x40 viewBox)
  const r = 16;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - ratio);
  const ariaLabel = props.ariaLabel ?? props.label ?? 'gauge';

  return (
    <div
      className={clsx('relative', sizeClass, props.className)}
      data-testid={props.testId}
    >
      <svg viewBox="0 0 40 40" className="h-full w-full" role="img" aria-label={ariaLabel}>
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-border"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={`${dashOffset}`}
          className={variantClass(v)}
          transform="rotate(-90 20 20)"
        />
      </svg>
      {props.center ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-medium">
          {props.center}
        </div>
      ) : null}
    </div>
  );
}

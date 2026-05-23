import React, { useCallback, useMemo, useRef, useState } from 'react';

import { seriesColorClass, thresholdColorClass, type ChartSeriesVariant, type ChartThresholdVariant } from '../../lib/chartPalette';

import { clsx } from './clsx';

export type TimeSeriesVariant = ChartSeriesVariant;

type RawPoint = { x: number | string; y: number };

type RenderPoint = {
  x: number; // unix seconds
  y: number;
  xPx: number;
  yPx: number;
};

export type TimeSeriesThreshold = {
  value: number;
  label?: string;
  variant?: ChartThresholdVariant;
};

function defaultFormatTime(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  // Include timezone abbreviation for operational correctness.
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZoneName: 'short',
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function pickNearestIndex(points: RenderPoint[], xPx: number): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (!point) continue;
    const d = Math.abs(point.xPx - xPx);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function TimeSeriesChart(props: {
  points: RawPoint[];
  className?: string;
  ariaLabel: string;
  variant?: TimeSeriesVariant;
  /** Force Y domain; used for percent charts */
  yMin?: number;
  yMax?: number;
  /** Tooltip value formatter */
  formatValue?: (n: number) => string;
  /** Tooltip time formatter */
  formatTime?: (unixSeconds: number) => string;
  /** Optional threshold lines */
  thresholds?: TimeSeriesThreshold[];
  testId?: string;
}) {
  const variant: TimeSeriesVariant = props.variant ?? 'muted';
  const formatValue = props.formatValue ?? ((n: number) => n.toFixed(1));
  const formatTime = props.formatTime ?? defaultFormatTime;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const computed = useMemo(() => {
    const raw: Array<{ x: number; y: number | null }> = props.points
      .map((p) => ({
        x: Number(p.x),
        y: Number.isFinite(p.y) ? Number(p.y) : null,
      }))
      .filter((p) => Number.isFinite(p.x))
      .sort((a, b) => a.x - b.x);

    const finite = raw.filter((p): p is { x: number; y: number } => typeof p.y === 'number');

    // We still want a stable axis even when there are gaps.
    const firstPoint = raw[0];
    const lastPoint = raw[raw.length - 1];
    const minX = firstPoint ? firstPoint.x : 0;
    const maxX = lastPoint ? lastPoint.x : 1;
    const spanX = maxX - minX || 1;

    const w = 100;
    const h = 48;
    const padding = 6;
    const plotX0 = padding;
    const plotX1 = w - padding;
    const plotY0 = padding;
    const plotY1 = h - padding;

    if (finite.length < 2) {
      return {
        pathD: null as string | null,
        points: [] as RenderPoint[],
        minX,
        maxX,
        w,
        h,
        padding,
        plotX0,
        plotX1,
        plotY0,
        plotY1,
        yMin: 0,
        yMax: 1,
        ySpan: 1,
        yScale: (_y: number) => plotY1,
      };
    }

    const yMinData = Math.min(...finite.map((p) => p.y));
    const yMaxData = Math.max(...finite.map((p) => p.y));

    const yMin = Number.isFinite(props.yMin) ? (props.yMin as number) : yMinData;
    const yMax = Number.isFinite(props.yMax) ? (props.yMax as number) : yMaxData;
    const ySpan = yMax - yMin || 1;

    const xScale = (x: number) => plotX0 + ((x - minX) / spanX) * (plotX1 - plotX0);
    const yScale = (y: number) => plotY1 - ((y - yMin) / ySpan) * (plotY1 - plotY0);

    // Path: multiple segments (M... L... M... L...) to show gaps when y is missing.
    let started = false;
    const cmds: string[] = [];
    for (const p of raw) {
      if (typeof p.y !== 'number') {
        started = false;
        continue;
      }

      const x = xScale(p.x);
      const y = yScale(p.y);
      cmds.push(`${started ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`);
      started = true;
    }

    const renderPoints: RenderPoint[] = finite.map((p) => {
      const xPx = xScale(p.x);
      const yPx = yScale(p.y);
      return { x: p.x, y: p.y, xPx, yPx };
    });

    return {
      pathD: cmds.join(' '),
      points: renderPoints,
      minX,
      maxX,
      w,
      h,
      padding,
      plotX0,
      plotX1,
      plotY0,
      plotY1,
      yMin,
      yMax,
      ySpan,
      yScale,
    };
  }, [props.points, props.yMin, props.yMax]);

  const onMoveAtClientX = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const ratio = rect.width > 0 ? x / rect.width : 0;
      const xPx = ratio * computed.w;

      if (!computed.points.length) return;

      const idx = pickNearestIndex(computed.points, xPx);
      setSelectedIdx(idx);
    },
    [computed.points, computed.w]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      onMoveAtClientX(e.clientX);
    },
    [onMoveAtClientX]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      onMoveAtClientX(t.clientX);
    },
    [onMoveAtClientX]
  );

  const onMouseLeave = useCallback(() => {
    setSelectedIdx(null);
  }, []);

  const onBlur = useCallback(() => {
    setSelectedIdx(null);
  }, []);

  const onFocus = useCallback(() => {
    if (!computed.points.length) return;
    setSelectedIdx(computed.points.length - 1);
  }, [computed.points]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!computed.points.length) return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedIdx((prev) => {
          const cur = prev ?? computed.points.length - 1;
          const next = e.key === 'ArrowLeft' ? cur - 1 : cur + 1;
          return Math.max(0, Math.min(computed.points.length - 1, next));
        });
      }

      if (e.key === 'Escape') {
        setSelectedIdx(null);
      }
    },
    [computed.points]
  );

  const selected = selectedIdx != null ? computed.points[selectedIdx] ?? null : null;

  const thresholds: TimeSeriesThreshold[] = props.thresholds ?? [];

  return (
    <div
      ref={containerRef}
      className={clsx('relative h-16 w-full rounded-md border border-border bg-surface p-2', props.className)}
      role="img"
      aria-label={props.ariaLabel}
      tabIndex={0}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchMove}
      onTouchMove={onTouchMove}
      onBlur={onBlur}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      data-testid={props.testId}
    >
      <svg viewBox={`0 0 ${computed.w} ${computed.h}`} className="h-full w-full">
        {/* Baseline (subtle) */}
        <path
          d={`M${computed.plotX0} ${computed.plotY1} L${computed.plotX1} ${computed.plotY1}`}
          fill="none"
          stroke="currentColor"
          className="text-chart-grid"
          opacity={0.35}
        />

        {/* Thresholds */}
        {computed.points.length
          ? thresholds.map((th, i) => {
              const y = computed.yScale(th.value);
              const cls = thresholdColorClass(th.variant);
              return (
                <g key={`${th.value}.${i}`} aria-hidden="true">
                  <line
                    x1={computed.plotX0}
                    x2={computed.plotX1}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    className={cls}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.75}
                  />
                  {th.label ? (
                    <text
                      x={computed.plotX1}
                      y={y - 1.5}
                      textAnchor="end"
                      fontSize={8}
                      fill="currentColor"
                      className={cls}
                      opacity={0.85}
                    >
                      {th.label}
                    </text>
                  ) : null}
                </g>
              );
            })
          : null}

        {/* Series */}
        {computed.pathD ? (
          <path
            d={computed.pathD}
            fill="none"
            stroke="currentColor"
            className={seriesColorClass(variant)}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ) : (
          <path
            d={`M${computed.plotX0} ${(computed.plotY0 + computed.plotY1) / 2} L${computed.plotX1} ${(computed.plotY0 + computed.plotY1) / 2}`}
            fill="none"
            stroke="currentColor"
            className="text-chart-axis"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.35}
          />
        )}

        {/* Crosshair + point */}
        {selected ? (
          <g aria-hidden="true">
            <line
              x1={selected.xPx}
              x2={selected.xPx}
              y1={computed.plotY0}
              y2={computed.plotY1}
              stroke="currentColor"
              className="text-chart-crosshair"
              strokeWidth={1}
              opacity={0.75}
            />
            <circle
              cx={selected.xPx}
              cy={selected.yPx}
              r={2.5}
              fill="currentColor"
              className={seriesColorClass(variant)}
            />
          </g>
        ) : null}
      </svg>

      {selected ? (
        <div
          className="absolute left-2 top-2 rounded-md border border-border bg-overlay-surface px-2 py-1 text-xs text-fg shadow-card"
          data-overlay="tooltip"
          data-overlay-surface="overlay"
        >
          <div className="font-medium tabular-nums">{formatValue(selected.y)}</div>
          <div className="mt-0.5 text-muted tabular-nums">{formatTime(selected.x)}</div>
        </div>
      ) : null}
    </div>
  );
}

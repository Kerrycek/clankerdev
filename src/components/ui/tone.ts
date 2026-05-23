export type ToneVariant = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'muted';

const surface: Record<ToneVariant, string> = {
  neutral: 'border-neutral-border bg-neutral-row',
  ok: 'border-ok-border bg-ok-row',
  warn: 'border-warn-border bg-warn-row',
  danger: 'border-danger-border bg-danger-row',
  info: 'border-info-border bg-info-row',
  muted: 'border-border bg-surface-2',
};

const progressFill: Record<ToneVariant, string> = {
  neutral: 'bg-neutral',
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  info: 'bg-info',
  muted: 'bg-border-strong',
};

/**
 * Tone surface helper for card-like rows.
 *
 * This is the non-table counterpart of the TableRowLink row-tone system.
 *
 * - Always sets an explicit border color + background color
 * - Never uses alpha hacks on semantic backgrounds
 */
export function toneSurfaceClass(variant?: ToneVariant): string {
  return variant ? surface[variant] : 'border-border bg-surface';
}

/**
 * Progress bar fill helper.
 *
 * Uses the strong semantic foreground color for quick visual association.
 */
export function toneProgressFillClass(variant?: ToneVariant): string {
  return variant ? progressFill[variant] : 'bg-fg/60';
}

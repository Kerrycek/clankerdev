import type { TableRowVariant } from '../components/ui/TableRowLink';
import type { StatusDotVariant } from '../components/ui/StatusDot';

/**
 * Shared mapping helpers for keeping semantic state → table row variant → dot variant
 * consistent across the app.
 *
 * Rationale:
 * - Badges have a "black" variant (inverted emphasis) which is not a semantic state.
 * - Tables use row variants (RowTone contract) which should be explicit for every row.
 * - Dots are a compact redundant cue (not color-only).
 */

export type BadgeVariant = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'black';

export function tableVariantFromBadgeVariant(v: BadgeVariant | undefined): TableRowVariant | undefined {
  if (!v) return undefined;
  // "black" is an inverted emphasis badge, not a semantic meaning.
  if (v === 'black') return 'neutral';
  // Badge and table share the same semantic keys.
  return v;
}

export function dotVariantFromBadgeVariant(v: BadgeVariant | undefined): StatusDotVariant | undefined {
  if (!v) return undefined;
  if (v === 'black' || v === 'neutral') return 'neutral';
  return v;
}

export function dotVariantFromRowVariant(v: TableRowVariant | undefined): StatusDotVariant | undefined {
  if (!v) return undefined;
  if (v === 'muted' || v === 'neutral') return 'neutral';
  return v;
}

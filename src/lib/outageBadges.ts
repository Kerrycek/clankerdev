import type { Outage, OutageUpdate } from './api/public';
import type { BadgeSpec, BadgeVariant } from './taskStatus';
import { outageImpactLabel, outageTypeLabel } from './apiValues';

export interface OutageBadgeSet {
  /** Primary visual variant for the outage row/card (RowTone Full in the design spec). */
  primaryVariant: BadgeVariant;
  /** Lifecycle badge (Draft/Planned/Active/Resolved/Cancelled). */
  lifecycle: BadgeSpec;
  /** Impact badge (Network/Unavailable/Restart/…). */
  impact?: BadgeSpec | null;
  /** Type badge (Maintenance/Outage). */
  type?: BadgeSpec | null;
  /** Severity variant derived from outage_type + impact_type. */
  severityVariant: BadgeVariant;
  /** True when begins_at is in the future (best-effort). */
  planned: boolean;
}

function norm(v: unknown): string {
  return String(v ?? '').trim();
}

function parseIsoDate(v: unknown): Date | null {
  const s = norm(v);
  if (!s) return null;
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}

function isPlanned(beginsAt: unknown, now: Date): boolean {
  const d = parseIsoDate(beginsAt);
  if (!d) return false;
  return d.getTime() > now.getTime();
}

export function outageImpactBadge(impact: unknown, t: (k: any) => string): BadgeSpec | null {
  const k = norm(impact);
  if (!k) return null;

  if (k === 'unavailability') return { variant: 'danger', label: outageImpactLabel(t, k) };
  if (k === 'network') return { variant: 'danger', label: outageImpactLabel(t, k) };
  if (k === 'system_reset') return { variant: 'danger', label: outageImpactLabel(t, k) };
  if (k === 'system_restart') return { variant: 'warn', label: outageImpactLabel(t, k) };
  if (k === 'performance') return { variant: 'warn', label: outageImpactLabel(t, k) };
  if (k === 'export') return { variant: 'warn', label: outageImpactLabel(t, k) };
  if (k === 'tbd') return { variant: 'info', label: outageImpactLabel(t, k) };

  return { variant: 'neutral', label: outageImpactLabel(t, k) };
}

export function outageTypeBadge(outageType: unknown, t: (k: any) => string): BadgeSpec | null {
  const k = norm(outageType);
  if (!k) return null;

  if (k === 'maintenance') return { variant: 'info', label: outageTypeLabel(t, k) };
  if (k === 'outage') return { variant: 'neutral', label: outageTypeLabel(t, k) };
  if (k === 'planned_outage') return { variant: 'info', label: outageTypeLabel(t, k) };
  if (k === 'unplanned_outage') return { variant: 'danger', label: outageTypeLabel(t, k) };

  return { variant: 'neutral', label: outageTypeLabel(t, k) };
}

/**
 * Severity axis: derived from outage_type + impact_type.
 *
 * Spec: UI_REDESIGN.md §3.2.3.8 + §3.2.9.5.
 */
export function outageSeverityVariant(outageType: unknown, impact: unknown): BadgeVariant {
  const ot = norm(outageType);
  const im = norm(impact);

  if (ot === 'maintenance') return 'info';

  if (im === 'unavailability') return 'danger';
  if (im === 'system_reset') return 'danger';
  if (im === 'network') return 'danger';

  if (im === 'system_restart') return 'warn';
  if (im === 'performance') return 'warn';
  if (im === 'export') return 'warn';

  if (im === 'tbd') return 'info';

  // Unknown impact: be explicit but calm.
  return 'info';
}

export function outageLifecycleBadge(
  state: unknown,
  beginsAt: unknown,
  severityVariant: BadgeVariant,
  t: (k: any) => string,
  now: Date
): BadgeSpec {
  const st = norm(state);

  if (st === 'staged') return { variant: 'neutral', label: t('state.draft') };
  if (st === 'resolved') return { variant: 'ok', label: t('state.resolved') };
  if (st === 'cancelled' || st === 'canceled') return { variant: 'neutral', label: t('state.canceled') };

  // Default to “announced” semantics.
  const planned = isPlanned(beginsAt, now);
  return {
    variant: severityVariant,
    label: planned ? t('state.planned') : t('state.active'),
  };
}

export function outagePrimaryVariant(state: unknown, severityVariant: BadgeVariant): BadgeVariant {
  const st = norm(state);

  if (st === 'staged') return 'neutral';
  if (st === 'cancelled' || st === 'canceled') return 'neutral';
  if (st === 'resolved') return 'ok';
  if (st === 'announced') return severityVariant;

  return 'neutral';
}

export function outageBadges(outage: Outage, t: (k: any) => string, now: Date = new Date()): OutageBadgeSet {
  const planned = isPlanned(outage.begins_at, now);
  const severityVariant = outageSeverityVariant(outage.type, outage.impact);
  const primaryVariant = outagePrimaryVariant(outage.state, severityVariant);

  return {
    planned,
    severityVariant,
    primaryVariant,
    lifecycle: outageLifecycleBadge(outage.state, outage.begins_at, severityVariant, t, now),
    impact: outageImpactBadge(outage.impact, t),
    type: outageTypeBadge(outage.type, t),
  };
}

export function outageUpdateBadges(update: OutageUpdate, t: (k: any) => string, now: Date = new Date()): OutageBadgeSet {
  const planned = isPlanned(update.begins_at ?? update.outage?.begins_at, now);
  const severityVariant = outageSeverityVariant(update.type, update.impact);
  const primaryVariant = outagePrimaryVariant(update.state, severityVariant);

  return {
    planned,
    severityVariant,
    primaryVariant,
    lifecycle: outageLifecycleBadge(update.state, update.begins_at ?? update.outage?.begins_at, severityVariant, t, now),
    impact: outageImpactBadge(update.impact, t),
    type: outageTypeBadge(update.type, t),
  };
}

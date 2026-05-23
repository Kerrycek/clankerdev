import React, { useMemo } from 'react';

import { Badge } from './Badge';

export type LockBadgeKind = 'transaction' | 'local' | 'maintenance';

/**
 * Canonical badge for lock state (busy/working/maintenance).
 *
 * - transaction: "Busy" (blocks actions because of an active transaction chain)
 * - local: "Working…" (local optimistic lock, e.g. action started but backend state not yet reflected)
 * - maintenance: "Maintenance" (explicit maintenance lock)
 */
export function LockBadge(props: {
  kind: LockBadgeKind;
  t: (key: any) => string;

  /** Optional chain ids that block the object (shown only when showDetails=true). */
  chainIds?: number[];

  /** When true, include diagnostic details like chain ids in the tooltip/title. */
  showDetails?: boolean;

  /** Maintenance reason from API (if available). */
  maintenanceReason?: string;

  testId?: string;
  className?: string;
}) {
  const viewChainIds = useMemo(() => {
    const ids = (props.chainIds ?? [])
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x) && x > 0);

    const uniq: number[] = [];
    const seen = new Set<number>();
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      uniq.push(id);
    }

    return uniq;
  }, [props.chainIds]);

  const cfg = useMemo(() => {
    if (props.kind === 'transaction') {
      const base = props.t('gate.busy.transaction.body');
      const title =
        props.showDetails && viewChainIds.length > 0
          ? `${base} (#${viewChainIds.join(', #')})`
          : base;

      return {
        variant: 'warn' as const,
        label: props.t('state.busy'),
        title,
      };
    }

    if (props.kind === 'maintenance') {
      const reason = typeof props.maintenanceReason === 'string' ? props.maintenanceReason.trim() : '';
      return {
        variant: 'warn' as const,
        label: props.t('state.maintenance'),
        title: reason || props.t('gate.blocked.maintenance.body'),
      };
    }

    // local
    return {
      variant: 'warn' as const,
      label: props.t('gate.busy.local.title'),
      title: props.t('gate.busy.local.body'),
    };
  }, [props.kind, props.maintenanceReason, props.showDetails, props.t, viewChainIds]);

  return (
    <Badge variant={cfg.variant} title={cfg.title} className={props.className} testId={props.testId}>
      {cfg.label}
    </Badge>
  );
}

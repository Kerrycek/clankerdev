import React from 'react';
import { Link } from 'react-router-dom';
import { Pin, PinOff } from 'lucide-react';

import { useI18n } from '../../app/i18n';
import type { ActionState } from '../../lib/api/actionStates';
import { formatDateTime } from '../../lib/format';
import {
  classifyActionState,
  operationBadgeVariant,
  operationCategoryLabel,
  operationLabel,
  operationSeverityLabel,
  operationVisibilityLabel,
} from '../../lib/operationTaxonomy';
import { extractRelatedTransactionChainIdFromActionState } from '../../lib/taskLinks';
import {
  actionStateBadge,
  actionStateProgressLabel,
  actionStateProgressPercent,
  isFinishedActionState,
} from '../../lib/taskStatus';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { StatusDot } from '../../components/ui/StatusDot';
import { clsx } from '../../components/ui/clsx';
import { toneProgressFillClass, toneSurfaceClass, type ToneVariant } from '../../components/ui/tone';

export interface ActionStateRowItem {
  s: ActionState;
  tracked: boolean;
  pinned: boolean;
}

export function ActionStateListRow(props: {
  item: ActionStateRowItem;
  basePath: string;
  highlighted: boolean;
  cancelPending: boolean;
  onTogglePinned: (id: number) => void;
  onTrack: (id: number) => void;
  onDismiss: (id: number) => void;
  onCancel: (state: ActionState) => void;
}) {
  const { t } = useI18n();
  const { s, tracked, pinned } = props.item;
  const id = Number(s.id);
  const rawLabel = s.label ? String(s.label) : `#${id}`;
  const op = classifyActionState(s);
  const label = op.key.endsWith('.unknown') ? rawLabel : operationLabel(op, t);
  const badge = actionStateBadge(s);
  const toneVariant: ToneVariant | undefined = (() => {
    const v = badge.variant;
    if (v === 'ok' || v === 'warn' || v === 'danger' || v === 'info' || v === 'neutral') return v;
    return undefined;
  })();
  const dotVariant = toneVariant ?? 'neutral';
  const pct = actionStateProgressPercent(s);
  const pLabel = actionStateProgressLabel(s);
  const opBadgeVariant = operationBadgeVariant(op);
  const rawDiffers = op.rawLabel && op.rawLabel !== label;

  const relatedChainId = extractRelatedTransactionChainIdFromActionState(s);

  const createdAt = s.created_at ? formatDateTime(String(s.created_at)) : null;
  const updatedAt = s.updated_at ? formatDateTime(String(s.updated_at)) : null;

  const meta: React.ReactNode[] = [];
  meta.push(<span key="id">#{id}</span>);
  if (createdAt) meta.push(<span key="created">{t('tasks.meta.created', { time: createdAt })}</span>);
  if (updatedAt) meta.push(<span key="updated">{t('tasks.meta.updated', { time: updatedAt })}</span>);

  const pinLabel = pinned ? t('tasks.action.unpin') : t('tasks.action.pin');

  return (
    <div
      className={clsx('rounded-md border p-3', toneSurfaceClass(toneVariant), props.highlighted ? 'ring-1 ring-warn-border' : null)}
      data-testid={`action_states.row.${id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <StatusDot variant={dotVariant} title={badge.label} />
            <Link className="text-fg underline" to={`${props.basePath}/action-states/${id}`}>
              {label}
            </Link>
          </div>

          <div className="mt-1 text-xs text-faint">
            {meta.map((p, i) => (
              <React.Fragment key={i}>
                {i > 0 ? ' · ' : null}
                {p}
              </React.Fragment>
            ))}

            {relatedChainId ? (
              <>
                {meta.length > 0 ? ' · ' : null}
                <Link className="underline" to={`${props.basePath}/transactions/${relatedChainId}`}>
                  {t('tasks.meta.chain', { id: relatedChainId })}
                </Link>
              </>
            ) : null}
          </div>

          {pLabel ? <div className="mt-1 text-xs text-faint">{t('tasks.meta.progress', { progress: pLabel })}</div> : null}
          {rawDiffers ? <div className="mt-1 text-xs text-faint">{t('operation.raw_name', { name: op.rawLabel })}</div> : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            <Badge variant="neutral">{operationCategoryLabel(op, t)}</Badge>
            <Badge variant={opBadgeVariant}>{operationSeverityLabel(op, t)}</Badge>
            <Badge variant="neutral">{operationVisibilityLabel(op, t)}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="px-2"
              onClick={() => props.onTogglePinned(id)}
              title={pinLabel}
              ariaLabel={pinLabel}
            >
              {pinned ? <PinOff size={16} /> : <Pin size={16} />}
            </Button>

            {Boolean(s.can_cancel) && !isFinishedActionState(s) ? (
              <Button
                size="sm"
                variant="danger"
                onClick={() => props.onCancel(s)}
                disabled={props.cancelPending}
              >
                {t('tasks.action.cancel')}
              </Button>
            ) : null}

            {tracked ? (
              <Button size="sm" variant="secondary" onClick={() => props.onDismiss(id)}>
                {t('tasks.action.dismiss')}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => props.onTrack(id)}>
                {t('tasks.action.track')}
              </Button>
            )}
          </div>

          {pct !== null ? <div className="text-xs text-faint">{pct}%</div> : null}
        </div>
      </div>

      {pct !== null ? (
        <div className="mt-3 h-2 rounded-full bg-surface-2">
          <div className={clsx('h-2 rounded-full', toneProgressFillClass(toneVariant))} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

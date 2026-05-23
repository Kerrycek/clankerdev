import React from 'react';

import { Card, CardBody } from './Card';
import { clsx } from './clsx';

export type StatCardVariant = 'standard' | 'featured' | 'compact';
export type StatCardSize = 'sm' | 'md' | 'lg';

export function StatCard(props: {
  title?: React.ReactNode;
  /** Backward-compatible alias. */
  label?: React.ReactNode;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Backward-compatible alias used by older pages. */
  description?: React.ReactNode;
  footer?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  visual?: React.ReactNode;
  variant?: StatCardVariant;
  /** Backward-compatible size alias used by older pages. */
  size?: StatCardSize;
  className?: string;
  testId?: string;
}) {
  const variant: StatCardVariant =
    props.variant ?? (props.size === 'lg' ? 'featured' : props.size === 'sm' ? 'compact' : 'standard');
  const title = props.title ?? props.label;
  const subtitle = props.subtitle ?? props.description;

  const valueClass =
    variant === 'featured'
      ? 'text-3xl'
      : variant === 'compact'
        ? 'text-xl'
        : 'text-2xl';

  return (
    <div data-testid={props.testId} className={clsx('h-full', props.className)}>
      <Card className="h-full">
        <CardBody>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {props.icon ? <div className="shrink-0 text-muted">{props.icon}</div> : null}
                {title ? <div className="font-medium">{title}</div> : null}
              </div>
              {subtitle ? <div className="mt-1 text-xs text-muted">{subtitle}</div> : null}
            </div>

            {props.actions ? <div className="shrink-0">{props.actions}</div> : null}
          </div>

          <div className="mt-3 flex items-end justify-between gap-4">
            <div className={clsx('leading-none font-semibold tracking-tight tabular-nums', valueClass)}>
              {props.value}
            </div>
            {props.visual ? <div className="shrink-0">{props.visual}</div> : null}
          </div>

          {props.footer ? <div className="mt-3 text-xs text-muted">{props.footer}</div> : null}
        </CardBody>
      </Card>
    </div>
  );
}

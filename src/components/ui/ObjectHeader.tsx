import React from 'react';
import { Link } from 'react-router-dom';

import { Card } from './Card';
import { clsx } from './clsx';

type HeaderKicker = React.ReactNode | { label: React.ReactNode; href?: string; to?: string };

function renderKicker(kicker: HeaderKicker | undefined) {
  if (!kicker) return null;
  if (typeof kicker !== 'object' || React.isValidElement(kicker) || !('label' in kicker)) return kicker;

  const target = kicker.to ?? kicker.href;
  if (!target) return kicker.label;
  if (target.startsWith('/')) {
    return (
      <Link to={target} className="hover:underline">
        {kicker.label}
      </Link>
    );
  }

  return (
    <a href={target} className="hover:underline">
      {kicker.label}
    </a>
  );
}

/**
 * ObjectHeader
 *
 * Canonical header layout for object detail pages.
 *
 * Slots:
 * - kicker: breadcrumb-ish small line (usually list link + #id)
 * - title: object name/title
 * - badges: state + lock + other key tags
 * - meta: one short line of key facts
 * - extra: tier-1 actionable info (copyable commands, tracking hint, etc.)
 * - right: non-button right column (stats)
 * - actions: primary action buttons
 * - tabs: navigation tabs for the detail page
 */
export function ObjectHeader(props: {
  boxed?: boolean;
  testId?: string;
  className?: string;
  /** Keep dense headers stacked until the content has enough horizontal room. */
  horizontalAt?: 'sm' | 'xl';
  /** Let metadata and extra content use the full width below the title/actions row. */
  fullWidthDetails?: boolean;

  kicker?: HeaderKicker;
  title: React.ReactNode;
  titleAfter?: React.ReactNode;

  badges?: React.ReactNode;
  meta?: React.ReactNode;
  extra?: React.ReactNode;

  right?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
}) {
  const boxed = props.boxed ?? true;
  const kicker = renderKicker(props.kicker);
  const horizontalAt = props.horizontalAt ?? 'sm';

  const details = (
    <>
      {props.meta ? <div className="mt-1 text-sm text-muted">{props.meta}</div> : null}

      {props.extra ? <div className="mt-2">{props.extra}</div> : null}
    </>
  );

  const content = (
    <div
      className={clsx(boxed ? 'p-4' : undefined, props.className)}
      data-document-title-root
      data-document-title-kind="object"
    >
      <div
        className={clsx(
          'flex min-w-0 flex-col gap-3',
          horizontalAt === 'xl'
            ? 'xl:flex-row xl:items-start xl:justify-between'
            : 'sm:flex-row sm:items-start sm:justify-between'
        )}
      >
        <div className={clsx('min-w-0', horizontalAt === 'xl' ? 'xl:flex-1' : 'sm:flex-1')}>
          {kicker ? <div className="text-xs text-muted">{kicker}</div> : null}

          <div className={clsx(kicker ? 'mt-1' : undefined, 'flex flex-wrap items-center gap-2')}>
            <h1 className="min-w-0 break-words text-xl font-semibold [overflow-wrap:anywhere]" data-document-title-heading>{props.title}</h1>
            {props.titleAfter ? <div className="min-w-0 max-w-full">{props.titleAfter}</div> : null}
          </div>

          {props.badges ? <div className="mt-2 flex flex-wrap items-center gap-2">{props.badges}</div> : null}

          {!props.fullWidthDetails ? details : null}
        </div>

        {props.right || props.actions ? (
          <div
            className={clsx(
              'flex min-w-0 w-full flex-col gap-2',
              horizontalAt === 'xl'
                ? 'xl:w-auto xl:shrink-0 xl:items-end'
                : 'sm:w-auto sm:shrink-0 sm:items-end'
            )}
          >
            {props.right ? <div>{props.right}</div> : null}
            {props.actions ? (
              <div
                className={clsx(
                  'flex min-w-0 w-full flex-wrap items-center gap-2',
                  horizontalAt === 'xl' ? 'xl:w-auto xl:justify-end' : 'sm:w-auto sm:justify-end'
                )}
              >
                {props.actions}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {props.fullWidthDetails ? <div className="mt-3">{details}</div> : null}

      {props.tabs ? (
        <div className={clsx('mt-4', boxed ? 'border-t border-border pt-3' : undefined)}>{props.tabs}</div>
      ) : null}
    </div>
  );

  if (boxed) {
    return <Card testId={props.testId}>{content}</Card>;
  }

  return <div data-testid={props.testId}>{content}</div>;
}

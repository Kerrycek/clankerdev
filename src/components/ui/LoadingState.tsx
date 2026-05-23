import React from 'react';

import { useI18n } from '../../app/i18n';
import { Spinner } from './Spinner';

/**
 * LoadingState
 *
 * Canonical loading UI for pages/sections.
 *
 * Use:
 * - kind="page" for list/detail primary query loading
 * - kind="inline" for small inline areas (e.g. command palette results)
 */
export function LoadingState(props: {
  testId?: string;
  label?: string;
  /** Backward-compatible alias. */
  title?: string;
  kind?: 'page' | 'inline';
}) {
  const { t } = useI18n();
  const label = props.label ?? props.title ?? t('common.loading');
  const kind = props.kind ?? 'page';

  if (kind === 'inline') {
    return (
      <div className="text-sm text-muted" data-testid={props.testId}>
        <Spinner label={label} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-10" data-testid={props.testId}>
      <Spinner label={label} />
    </div>
  );
}

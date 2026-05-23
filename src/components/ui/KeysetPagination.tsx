import React, { useMemo } from 'react';

import { useI18n } from '../../app/i18n';

import { Button } from './Button';
import { Select } from './Select';
import { clsx } from './clsx';

type PageItem = number | 'ellipsis';

function pageItems(current: number, total: number): PageItem[] {
  if (total <= 1) return [1];

  // Show everything when small.
  if (total <= 9) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const items: PageItem[] = [];
  const push = (v: PageItem) => {
    if (items.length === 0 || items[items.length - 1] !== v) items.push(v);
  };

  push(1);

  const windowStart = Math.max(2, current - 1);
  const windowEnd = Math.min(total - 1, current + 1);

  if (windowStart > 2) push('ellipsis');
  for (let p = windowStart; p <= windowEnd; p++) push(p);
  if (windowEnd < total - 1) push('ellipsis');

  push(total);
  return items;
}

export function KeysetPagination(props: {
  page?: number;
  pageCount?: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoToPage?: (pageNumber: number) => void;
  limit?: number;
  allowedLimits?: readonly number[];
  onLimitChange?: (limit: number) => void;
  /** Backward-compatible visual variant alias. */
  variant?: string;
  className?: string;
  testId?: string;
}) {
  const { t } = useI18n();
  const page = props.page ?? 1;
  const pageCount = props.pageCount ?? Math.max(page, props.canNext ? page + 1 : page);
  const allowedLimits = props.allowedLimits ?? [25, 50, 100];
  const limit = props.limit ?? allowedLimits[0] ?? 25;
  const items = useMemo(() => pageItems(page, pageCount), [page, pageCount]);
  const prefix = props.testId ?? 'pagination';

  return (
    <div
      className={clsx(
        'flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        props.className
      )}
      data-testid={prefix}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!props.canPrev}
          onClick={props.onPrev}
          testId={`${prefix}.prev`}
        >
          {t('pagination.prev')}
        </Button>

        <div className="flex flex-wrap items-center gap-1" aria-label={t('pagination.pages_label')}>
          {items.map((it, idx) =>
            it === 'ellipsis' ? (
              <span key={`e-${idx}`} className="px-2 text-xs text-muted">
                …
              </span>
            ) : (
              <Button
                key={it}
                variant="secondary"
                size="sm"
                className={clsx(
                  'min-w-8 px-2',
                  it === page ? 'border-accent/60 bg-surface-2' : undefined
                )}
                ariaLabel={
                  it === page
                    ? t('pagination.page_current', { page: it })
                    : t('pagination.go_to_page', { page: it })
                }
                onClick={() => props.onGoToPage?.(it)}
                disabled={!props.onGoToPage}
                testId={`${prefix}.page.${it}`}
              >
                {it}
              </Button>
            )
          )}
        </div>

        <Button
          variant="secondary"
          size="sm"
          disabled={!props.canNext}
          onClick={props.onNext}
          testId={`${prefix}.next`}
        >
          {t('pagination.next')}
        </Button>

        <span className="ml-1 text-xs text-muted">{t('pagination.page', { page })}</span>
      </div>

      {props.onLimitChange ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{t('pagination.rows')}</span>
          <div className="w-24">
            <Select
              testId={`${prefix}.limit`}
              value={String(limit)}
              onChange={(e) => props.onLimitChange?.(Number(e.target.value))}
              options={allowedLimits.map((l) => ({ value: String(l), label: String(l) }))}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

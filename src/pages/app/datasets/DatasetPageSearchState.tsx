import React from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import type { useKeysetPagination } from '../../../lib/hooks/useKeysetPagination';

type DatasetPaging = ReturnType<typeof useKeysetPagination>;

export function DatasetPageSearchNotice() {
  const { t } = useI18n();
  return (
    <Alert variant="info" title={t('datasets.search.page_limited.title')} testId="datasets.search.page_limited">
      {t('datasets.search.page_limited.body')}
    </Alert>
  );
}

export function DatasetPageSearchEmpty(props: {
  pagination: DatasetPaging;
  pageCursor: number | null;
  hasMore: boolean;
  hasSourceRows: boolean;
  onClear: () => void;
  onNext: () => void;
}) {
  const { t } = useI18n();
  const { pagination } = props;

  return (
    <>
      <EmptyState
        testId="datasets.list.empty"
        title={t('datasets.search.no_matches_page.title')}
        body={t('datasets.search.no_matches_page.body')}
        actionLabel={t('common.clear_filters')}
        onAction={props.onClear}
      />
      {props.hasSourceRows || pagination.canPrev ? (
        <Card>
          <KeysetPagination
            page={pagination.page}
            pageCount={pagination.stack.length}
            canPrev={pagination.canPrev}
            canNext={props.hasMore && props.pageCursor !== null}
            onPrev={pagination.goPrev}
            onNext={props.onNext}
            onGoToPage={pagination.goToPage}
            limit={pagination.limit}
            allowedLimits={pagination.allowedLimits}
            onLimitChange={pagination.setLimit}
            testId="datasets.pagination.filtered"
          />
        </Card>
      ) : null}
    </>
  );
}

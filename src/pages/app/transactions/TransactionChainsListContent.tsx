import React from 'react';

import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { LoadingState } from '../../../components/ui/LoadingState';
import { formatErrorMessage } from '../../../lib/errors';
import type { KeysetPaginationState } from '../../../lib/hooks/useKeysetPagination';
import { TransactionChainsTable } from './TransactionChainsTable';
import type { ChainState, TransactionChainRow, TransactionChainsTranslator } from './transactionChainSemantics';
import { TransactionChainsSystemActivity } from './TransactionChainsSystemActivity';

interface TransactionChainsListContentProps {
  t: TransactionChainsTranslator;
  basePath: string;
  pinnedMissing: number[];
  onUnpin: (id: number) => void;
  refreshWarning: boolean;
  anyLoading: boolean;
  anyError: boolean;
  rows: TransactionChainRow[];
  visibleRows: TransactionChainRow[];
  systemRows: TransactionChainRow[];
  filtersActive: boolean;
  clearFilters: () => void;
  queryId?: number;
  queryTrim: string;
  errorsOnly: boolean;
  state: ChainState | '';
  userId: string;
  userSessionId: string;
  pagination: KeysetPaginationState;
  hasMore: boolean;
  pageCursor: number | null;
  idError?: unknown;
  listError?: unknown;
  onRetry: () => void;
  systemActivityOpen: boolean;
  onToggleSystemActivity: () => void;
  onTogglePinned: (id: number) => void;
}

export function TransactionChainsListContent({
  t,
  basePath,
  pinnedMissing,
  onUnpin,
  refreshWarning,
  anyLoading,
  anyError,
  rows,
  visibleRows,
  systemRows,
  filtersActive,
  clearFilters,
  queryId,
  queryTrim,
  errorsOnly,
  state,
  userId,
  userSessionId,
  pagination,
  hasMore,
  pageCursor,
  idError,
  listError,
  onRetry,
  systemActivityOpen,
  onToggleSystemActivity,
  onTogglePinned,
}: TransactionChainsListContentProps) {
  const canNext = pagination.hasForward || (hasMore && pageCursor !== null);
  const tableProps = { basePath, t, queryId, queryTrim, errorsOnly, state, userId, userSessionId, pagination, onTogglePinned };

  return (
    <>
      {pinnedMissing.length > 0 ? (
        <Alert variant="warn" title={t('transactions.chains.pinned_missing.title')}>
          <div className="mt-2 space-y-2">
            {pinnedMissing.map((id) => (
              <div key={id} className="flex items-center justify-between gap-3">
                <span>#{id}</span>
                <Button size="sm" variant="secondary" onClick={() => onUnpin(id)} title={t('tasks.action.unpin')}>
                  {t('tasks.action.unpin')}
                </Button>
              </div>
            ))}
          </div>
        </Alert>
      ) : null}

      {refreshWarning ? (
        <Alert variant="warn" title={t('transactions.chains.refresh_error.title')}>
          {t('transactions.chains.refresh_error.body')}
        </Alert>
      ) : null}

      {anyLoading && rows.length === 0 ? <LoadingState testId="transactions.list.loading" /> : null}

      {anyError && rows.length === 0 ? (
        <>
          <ErrorState
            testId="transactions.list.error"
            title={t('transactions.chains.load_error.title')}
            body={
              queryId && idError
                ? t('transactions.chains.load_error.chain_prefix', { id: queryId, error: formatErrorMessage(idError) })
                : undefined
            }
            error={queryId ? idError : listError}
            onRetry={onRetry}
            showBack={false}
            detailsExtra={{ page: 'transactions.chains.list', scope: basePath }}
          />

          {!queryId ? (
            <Card className="mt-4">
              <KeysetPagination
                page={pagination.page}
                pageCount={pagination.stack.length}
                canPrev={pagination.canPrev}
                canNext={canNext}
                onPrev={() => pagination.goPrev()}
                onNext={() => pagination.goNext(pageCursor)}
                onGoToPage={(p) => pagination.goToPage(p)}
                limit={pagination.limit}
                allowedLimits={pagination.allowedLimits}
                onLimitChange={(lim) => pagination.setLimit(lim)}
                testId="transactions.pagination"
              />
            </Card>
          ) : null}
        </>
      ) : null}

      {!anyLoading && !anyError && visibleRows.length === 0 && systemRows.length === 0 ? (
        <EmptyState
          testId="transactions.list.empty"
          title={t('transactions.chains.empty.title')}
          body={t('transactions.chains.empty.body')}
          actionLabel={filtersActive ? t('common.clear_filters') : undefined}
          onAction={filtersActive ? clearFilters : undefined}
        />
      ) : null}

      {visibleRows.length > 0 ? <TransactionChainsTable {...tableProps} rows={visibleRows} canNext={canNext} pageCursor={pageCursor} /> : null}

      <TransactionChainsSystemActivity
        rows={systemRows}
        open={systemActivityOpen}
        onToggleOpen={onToggleSystemActivity}
        tableProps={tableProps}
      />
    </>
  );
}

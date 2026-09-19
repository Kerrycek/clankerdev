import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { fetchTransactions } from '../../lib/api/transactions';
import { useAppMode } from '../../app/appMode';
import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';
import { ListShell } from '../../components/layout/ListShell';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { LinkButton } from '../../components/ui/LinkButton';
import { KeysetPagination } from '../../components/ui/KeysetPagination';
import { useKeysetPagination } from '../../lib/hooks/useKeysetPagination';
import { cursorFromDescendingPage } from '../../lib/lockIndex';
import { parsePositiveInt } from '../../lib/parse';
import { useTierAIntervalMs } from '../../lib/refreshTiers';
import { parseNumericToken, splitKeyValueToken, tokenizeSmartInput, unquoteSmartValue } from '../../lib/smartFilter';

import { TransactionItemsFilters } from './transactions/TransactionItemsFilters';
import { TransactionItemsTable } from './transactions/TransactionItemsTable';
import {
  buildTransactionItemRow,
  canonicalTransactionItemKey,
  inferDoneToken,
  inferSuccessToken,
  parseDone,
  parseSuccess,
  type DoneValue,
} from './transactions/transactionItemSemantics';
import { buildTransactionItemFilterChips, buildTransactionItemSmartSuggestions } from './transactions/transactionItemSmartFilter';
import { TransactionItemsRouteGuard } from './transactions/TransactionItemsRouteGuard';

export function TransactionsListPage() {
  return (
    <TransactionItemsRouteGuard>
      <TransactionsListContent />
    </TransactionItemsRouteGuard>
  );
}

function TransactionsListContent() {
  const { basePath } = useAppMode();
  const mode = basePath === '/admin' ? 'admin' : 'app';
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const navigate = useNavigate();
  const tierARefetchMs = useTierAIntervalMs();
  const [searchParams, setSearchParams] = useSearchParams();

  const [smart, setSmart] = useState('');
  const [smartErrors, setSmartErrors] = useState<string[]>([]);
  const smartNeedle = smart.trim();
  const smartInputRef = useRef<HTMLInputElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const chainIdNum = useMemo(() => parsePositiveInt(searchParams.get('transaction_chain')), [searchParams]);
  const nodeIdNum = useMemo(() => parsePositiveInt(searchParams.get('node')), [searchParams]);
  const typeNum = useMemo(() => parsePositiveInt(searchParams.get('type')), [searchParams]);
  const done = useMemo(() => parseDone(searchParams.get('done')), [searchParams]);
  const success = useMemo(() => parseSuccess(searchParams.get('success')), [searchParams]);

  const pagination = useKeysetPagination({
    id: 'transactions.items.list',
    filterKey: JSON.stringify({
      transaction_chain: chainIdNum,
      node: nodeIdNum,
      type: typeNum,
      done,
      success,
      scope: basePath,
    }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100, 200, 500],
  });
  const apiPageLimit = pagination.limit + 1;

  const txQuery = useQuery({
    queryKey: [
      'transactions',
      'list',
      {
        chainId: chainIdNum,
        nodeId: nodeIdNum,
        type: typeNum,
        done,
        success,
        limit: apiPageLimit,
        fromId: pagination.fromId,
      },
    ],
    queryFn: async () =>
      (
        await fetchTransactions({
          limit: apiPageLimit,
          fromId: pagination.fromId,
          transactionChainId: chainIdNum,
          nodeId: nodeIdNum,
          type: typeNum,
          done: done || undefined,
          success: success === '' ? undefined : success,
        })
      ).data,
    refetchInterval: done === 'done' ? false : tierARefetchMs,
  });

  const pageData = useMemo(() => (txQuery.data ?? []).slice(0, pagination.limit), [txQuery.data, pagination.limit]);
  const pageCursor = useMemo(() => cursorFromDescendingPage(pageData), [pageData]);
  const hasMore = (txQuery.data?.length ?? 0) > pagination.limit;
  const canNext = pagination.hasForward || (hasMore && pageCursor !== null);
  const filtersActive = Boolean(chainIdNum || nodeIdNum || typeNum || done || success !== '');

  const rows = useMemo(() => pageData.map((tx) => buildTransactionItemRow(tx, t)), [pageData, t]);
  const primaryLoading = txQuery.isLoading;
  const primaryError = txQuery.isError;
  const primaryErrorObj = txQuery.error;
  const emptyTitle = t('transactions.items.empty.title');
  const emptyBody = filtersActive ? t('transactions.items.empty.body') : t('empty.list.none.body');

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      const v = value.trim();
      if (v) p.set(key, v);
      else p.delete(key);
      return p;
    });
  };

  const removeParam = (key: string) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete(key);
      return p;
    });
  };

  const setDoneValue = (value: DoneValue | '') => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (value) p.set('done', value);
      else p.delete('done');
      return p;
    });
  };

  const setSuccessValue = (value: '' | 0 | 1) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (value === '') p.delete('success');
      else p.set('success', String(value));
      return p;
    });
  };

  const setNumericParam = (key: 'transaction_chain' | 'node' | 'type', value: number) => setParam(key, String(value));

  const clearFilters = () => {
    setSmart('');
    setSmartErrors([]);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('transaction_chain');
      p.delete('node');
      p.delete('type');
      p.delete('done');
      p.delete('success');
      return p;
    });
  };

  const activeFilterChips = useMemo(
    () =>
      buildTransactionItemFilterChips({
        chainIdNum,
        nodeIdNum,
        typeNum,
        done,
        success,
        smartErrors,
        onRemoveChain: () => removeParam('transaction_chain'),
        onRemoveNode: () => removeParam('node'),
        onRemoveType: () => removeParam('type'),
        onRemoveDone: () => removeParam('done'),
        onRemoveSuccess: () => removeParam('success'),
        onClearSmartErrors: () => setSmartErrors([]),
      }),
    [chainIdNum, nodeIdNum, typeNum, done, success, smartErrors]
  );

  function applySmartText(raw: string) {
    const input = raw.trim();
    if (!input) return;

    if (input === '?') {
      setHelpOpen(true);
      return;
    }

    const tokens = tokenizeSmartInput(input).map((token) => token.trim()).filter(Boolean);
    const firstToken = tokens[0];
    const numericOnly = tokens.length === 1 && firstToken ? parseNumericToken(firstToken) : null;
    if (numericOnly !== null) {
      setSmart('');
      setSmartErrors([]);
      navigate(`${basePath}/transactions/items/${numericOnly}`);
      return;
    }

    let nextChain = chainIdNum ? String(chainIdNum) : '';
    let nextNode = nodeIdNum ? String(nodeIdNum) : '';
    let nextType = typeNum ? String(typeNum) : '';
    let nextDone: DoneValue | '' = done;
    let nextSuccess: '' | 0 | 1 = success;

    const errs: string[] = [];

    for (const token of tokens) {
      const kv = splitKeyValueToken(token);
      if (kv) {
        const rawKey = kv.rawKey;
        const rawValue = kv.rawValue;
        const key = canonicalTransactionItemKey(rawKey);
        const value = unquoteSmartValue(rawValue);

        if (!key) {
          errs.push(t('filters.smart.error.unknown_key', { key: rawKey }));
          continue;
        }
        if (!value.trim()) {
          errs.push(t('filters.smart.error.missing_value', { key: rawKey }));
          continue;
        }

        if (key === 'id') {
          const n = parseNumericToken(value);
          if (n === null) errs.push(t('transactions.items.smart.error.id_numeric_only', { value }));
          else {
            setSmart('');
            setSmartErrors([]);
            navigate(`${basePath}/transactions/items/${n}`);
            return;
          }
          continue;
        }
        if (key === 'transaction_chain') {
          const n = parseNumericToken(value);
          if (n === null) errs.push(t('transactions.items.smart.error.chain_numeric_only', { value }));
          else nextChain = String(n);
          continue;
        }
        if (key === 'node') {
          const n = parseNumericToken(value);
          if (n === null) errs.push(t('transactions.items.smart.error.node_numeric_only', { value }));
          else nextNode = String(n);
          continue;
        }
        if (key === 'type') {
          const n = parseNumericToken(value);
          if (n === null) errs.push(t('transactions.items.smart.error.type_numeric_only', { value }));
          else nextType = String(n);
          continue;
        }
        if (key === 'done') {
          const parsedDone = inferDoneToken(value);
          if (!parsedDone) errs.push(t('transactions.items.smart.error.invalid_done', { value }));
          else nextDone = parsedDone;
          continue;
        }
        if (key === 'success') {
          const parsedSuccess = inferSuccessToken(value);
          if (parsedSuccess === null) errs.push(t('transactions.items.smart.error.invalid_success', { value }));
          else nextSuccess = parsedSuccess;
          continue;
        }
        continue;
      }

      const plain = unquoteSmartValue(token);
      const low = plain.trim().toLowerCase();
      const parsedDone = inferDoneToken(low);
      if (parsedDone) {
        nextDone = parsedDone;
        continue;
      }
      const parsedSuccess = inferSuccessToken(low);
      if (parsedSuccess !== null && ['ok', 'success', 'fail', 'failed', 'error'].includes(low)) {
        nextSuccess = parsedSuccess;
        continue;
      }
      errs.push(t('transactions.items.smart.error.explicit_filter_required', { value: plain }));
    }

    if (errs.length > 0) {
      setSmartErrors(errs);
      pushToast({ variant: 'danger', title: errs[0] ?? t('common.unknown_error') });
      return;
    }

    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (nextChain.trim()) p.set('transaction_chain', nextChain.trim());
      else p.delete('transaction_chain');
      if (nextNode.trim()) p.set('node', nextNode.trim());
      else p.delete('node');
      if (nextType.trim()) p.set('type', nextType.trim());
      else p.delete('type');
      if (nextDone) p.set('done', nextDone);
      else p.delete('done');
      if (nextSuccess !== '') p.set('success', String(nextSuccess));
      else p.delete('success');
      p.delete('q');
      p.delete('vps');
      p.delete('user');
      return p;
    });

    setSmart('');
    setSmartErrors([]);
  }

  const smartSuggestions = buildTransactionItemSmartSuggestions({
    needle: smartNeedle,
    basePath,
    navigate,
    t,
    onOpenHelp: () => setHelpOpen(true),
    onApply: () => applySmartText(smart),
    onSetDone: setDoneValue,
    onSetSuccess: setSuccessValue,
    onSetChainId: (value) => setNumericParam('transaction_chain', value),
    onSetNodeId: (value) => setNumericParam('node', value),
    onResetSmart: () => {
      setSmart('');
      setSmartErrors([]);
    },
  });

  const filterHrefArgs = useMemo(
    () => ({
      basePath,
      chainIdNum,
      nodeIdNum,
      typeNum,
      done,
      success,
      limit: pagination.limit,
    }),
    [basePath, chainIdNum, nodeIdNum, typeNum, done, success, pagination.limit]
  );

  return (
    <ListShell
      testId="transactions.items.list"
      header={
        <PageHeader
          title={t('transactions.items.title')}
          description={t('transactions.items.description')}
          testId="transactions.items.list.header"
          actions={
            <LinkButton to={`${basePath}/transactions`} variant="secondary" size="sm">
              {t('transactions.chains.title')}
            </LinkButton>
          }
        />
      }
      filters={
        <TransactionItemsFilters
          t={t}
          smartInputRef={smartInputRef}
          smart={smart}
          smartNeedle={smartNeedle}
          smartErrorsCount={smartErrors.length}
          onSmartChange={(value) => {
            setSmart(value);
            if (smartErrors.length) setSmartErrors([]);
          }}
          onSmartSubmit={() => applySmartText(smart)}
          smartSuggestions={smartSuggestions}
          activeFilterChips={activeFilterChips}
          filtersActive={filtersActive}
          helpOpen={helpOpen}
          onHelpOpen={() => setHelpOpen(true)}
          onHelpClose={() => setHelpOpen(false)}
          advancedOpen={advancedOpen}
          onAdvancedOpen={() => setAdvancedOpen(true)}
          onAdvancedClose={() => setAdvancedOpen(false)}
          clearFilters={clearFilters}
          chainIdText={chainIdNum ? String(chainIdNum) : ''}
          setChainIdText={(value) => setParam('transaction_chain', value)}
          nodeIdText={nodeIdNum ? String(nodeIdNum) : ''}
          setNodeIdText={(value) => setParam('node', value)}
          typeText={typeNum ? String(typeNum) : ''}
          setTypeText={(value) => setParam('type', value)}
          done={done}
          setDoneValue={setDoneValue}
          success={success}
          setSuccessValue={setSuccessValue}
        />
      }
    >
      {primaryLoading ? (
        <LoadingState testId="transactions.items.loading" title={t('transactions.items.loading')} />
      ) : primaryError ? (
        <ErrorState
          testId="transactions.items.error"
          title={t('transactions.items.load_error.title')}
          error={primaryErrorObj}
          onRetry={() => {
            void txQuery.refetch();
          }}
          showBack={false}
          detailsExtra={{ page: 'transactions.items.list', scope: basePath }}
        />
      ) : rows.length === 0 ? (
        <>
          <EmptyState
            testId="transactions.items.empty"
            title={emptyTitle}
            body={emptyBody}
            actionLabel={filtersActive ? t('common.clear_filters') : undefined}
            onAction={filtersActive ? clearFilters : undefined}
          />

          <Card className="mt-4">
            <KeysetPagination
              page={pagination.page}
              pageCount={pagination.stack.length}
              canPrev={pagination.canPrev}
              canNext={canNext}
              onPrev={pagination.goPrev}
              onNext={() => pagination.goNext(pageCursor)}
              onGoToPage={pagination.goToPage}
              limit={pagination.limit}
              allowedLimits={pagination.allowedLimits}
              onLimitChange={pagination.setLimit}
              testId="transactions.items.pagination"
            />
          </Card>
        </>
      ) : (
        <TransactionItemsTable
          rows={rows}
          basePath={basePath}
          t={t}
          mode={mode}
          pagination={pagination}
          canNext={canNext}
          pageCursor={pageCursor}
          filterHrefArgs={filterHrefArgs}
        />
      )}
    </ListShell>
  );
}

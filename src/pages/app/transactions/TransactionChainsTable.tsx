import React from 'react';
import { Link } from 'react-router-dom';
import { Pin, PinOff } from 'lucide-react';

import { formatDateTime } from '../../../lib/format';
import { extractConcernRefs } from '../../../lib/concerns';
import { directConcernLink, txItemsFilterForConcern } from '../../../lib/concernLinks';
import { chainBadgeFromState, chainProgressLabel, chainProgressPercent } from '../../../lib/taskStatus';
import { extractRelatedActionStateIdFromTransactionChain } from '../../../lib/taskLinks';
import {
  classifyTransactionChain,
  operationBadgeVariant,
  operationCategoryLabel,
  operationLabel,
  operationSeverityLabel,
  operationVisibilityLabel,
} from '../../../lib/operationTaxonomy';
import type { KeysetPaginationState } from '../../../lib/hooks/useKeysetPagination';

import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ChipLink, MiniLink } from '../../../components/ui/ChipLink';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { StatusDot } from '../../../components/ui/StatusDot';
import { TableCard } from '../../../components/ui/TableCard';
import { TableRowLink } from '../../../components/ui/TableRowLink';

import {
  type ChainState,
  type TransactionChainRow,
  type TransactionChainsTranslator,
  chainDotVariantFromState,
  chainRowVariantFromState,
  getChainCreatedAt,
  getChainId,
  getChainLabel,
  getChainState,
} from './transactionChainSemantics';

interface TransactionChainsTableProps {
  rows: TransactionChainRow[];
  basePath: string;
  t: TransactionChainsTranslator;
  queryId?: number;
  queryTrim: string;
  errorsOnly: boolean;
  state: ChainState | '';
  userId: string;
  userSessionId: string;
  pagination: KeysetPaginationState;
  canNext: boolean;
  pageCursor: number | null;
  onTogglePinned: (id: number) => void;
  showPagination?: boolean;
}

export function TransactionChainsTable({
  rows,
  basePath,
  t,
  queryId,
  queryTrim,
  errorsOnly,
  state,
  userId,
  userSessionId,
  pagination,
  canNext,
  pageCursor,
  onTogglePinned,
  showPagination = true,
}: TransactionChainsTableProps) {
  return (
    <TableCard
      testId="transactions.table"
      minWidth="lg"
      footer={
        showPagination && !queryId ? (
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
            testId="transactions.pagination"
          />
        ) : null
      }
    >
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted">
          <th className="w-10 px-2 py-2">
            <span className="sr-only">{t('common.state')}</span>
          </th>
          <th className="w-10 px-2 py-2" title={t('transactions.chains.table.pin_title')}>
            {' '}
          </th>
          <th className="px-4 py-2">{t('common.id')}</th>
          <th className="px-4 py-2">{t('common.label')}</th>
          <th className="px-4 py-2">{t('common.state')}</th>
          <th className="px-4 py-2">{t('common.progress')}</th>
          <th className="px-4 py-2">{t('common.created')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const chain = row.c;
          const id = getChainId(chain);
          const stateValue = getChainState(chain);
          const badge = chainBadgeFromState(stateValue);
          const rowVariant = chainRowVariantFromState(stateValue);
          const dotVariant = chainDotVariantFromState(stateValue);
          const label = getChainLabel(chain) ?? `#${id}`;
          const operation = classifyTransactionChain(chain);
          const operationName = operationLabel(operation, t);
          const concerns = extractConcernRefs(chain.concerns, { maxDepth: 3 });
          const shownConcerns = concerns.slice(0, 3);
          const actionStateId = extractRelatedActionStateIdFromTransactionChain(chain);
          const createdAt = getChainCreatedAt(chain);

          return (
            <TableRowLink
              key={id}
              testId={`transactions.row.${id}`}
              to={`${basePath}/transactions/${id}`}
              variant={rowVariant}
              className="border-b border-border/60 last:border-b-0"
            >
              <td className="px-2 py-2">
                <StatusDot variant={dotVariant} title={badge.label} testId={`transactions.row.${id}.dot`} />
              </td>
              <td className="px-2 py-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="px-2"
                  onClick={() => onTogglePinned(id)}
                  title={row.pinned ? t('tasks.action.unpin') : t('tasks.action.pin')}
                  ariaLabel={row.pinned ? t('transactions.chains.unpin.aria') : t('transactions.chains.pin.aria')}
                >
                  {row.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                </Button>
              </td>
              <td className="px-4 py-2 text-xs text-muted">{id}</td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link className="font-medium underline" to={`${basePath}/transactions/${id}`}>
                    {operationName}
                  </Link>
                  <ChipLink to={`${basePath}/transactions/items?transaction_chain=${id}`} title={t('transactions.chains.row.open_items_title', { id })}>
                    {t('transactions.items.short')}
                  </ChipLink>
                </div>
                {label !== operationName ? <div className="mt-1 text-xs text-faint">{t('operation.raw_name', { name: label })}</div> : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant={operationBadgeVariant(operation)}>{operationCategoryLabel(operation, t)}</Badge>
                  {operation.severity !== 'normal' ? <Badge variant={operationBadgeVariant(operation)}>{operationSeverityLabel(operation, t)}</Badge> : null}
                  {operation.visibility !== 'user' ? <Badge variant="info">{operationVisibilityLabel(operation, t)}</Badge> : null}
                </div>
                {shownConcerns.length > 0 ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    {shownConcerns.map((ref) => {
                      const directHref = directConcernLink(basePath, ref.class_name, ref.row_id);
                      const txHref = (() => {
                        const params = new URLSearchParams();
                        if (!queryId && queryTrim) params.set('q', queryTrim);
                        if (errorsOnly) {
                          params.set('errors', '1');
                        } else if (state) {
                          params.set('state', state);
                        }
                        if (userId.trim()) params.set('user', userId.trim());
                        if (userSessionId.trim()) params.set('user_session', userSessionId.trim());

                        params.set('class_name', ref.class_name);
                        params.set('row_id', String(ref.row_id));
                        return `${basePath}/transactions?${params.toString()}`;
                      })();
                      const itemsHref = (() => {
                        const filter = txItemsFilterForConcern(ref.class_name, ref.row_id);
                        if (!filter) return null;
                        const params = new URLSearchParams();
                        if (!queryId && queryTrim) params.set('q', queryTrim);
                        params.set(filter.key, filter.value);
                        return `${basePath}/transactions/items?${params.toString()}`;
                      })();
                      const text = `${ref.class_name} #${ref.row_id}`;
                      return (
                        <span key={`${ref.class_name}:${ref.row_id}`} className="inline-flex items-center gap-1">
                          <ChipLink
                            to={txHref}
                            title={
                              ref.label
                                ? t('transactions.filter.title_with_label', { text, label: ref.label })
                                : t('transactions.filter.title', { text })
                            }
                          >
                            {text}
                          </ChipLink>
                          {directHref ? (
                            <MiniLink
                              to={directHref}
                              title={
                                ref.label
                                  ? t('transactions.link.open_object_title_with_label', { text, label: ref.label })
                                  : t('transactions.link.open_object_title', { text })
                              }
                            >
                              {t('common.open')}
                            </MiniLink>
                          ) : null}
                          {itemsHref ? (
                            <MiniLink
                              to={itemsHref}
                              title={
                                ref.label
                                  ? t('transactions.link.show_items_title_with_label', { text, label: ref.label })
                                  : t('transactions.link.show_items_title', { text })
                              }
                            >
                              {t('transactions.mini.items')}
                            </MiniLink>
                          ) : null}
                        </span>
                      );
                    })}
                    {concerns.length > shownConcerns.length ? (
                      <span className="text-faint">{t('common.more_n', { count: concerns.length - shownConcerns.length })}</span>
                    ) : null}
                  </div>
                ) : null}
                {actionStateId ? (
                  <div className="mt-1 text-xs text-muted">
                    {t('transactions.chains.row.action_state_prefix')}{' '}
                    <Link className="text-accent underline" to={`${basePath}/action-states/${actionStateId}`}>
                      #{actionStateId}
                    </Link>
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-2">
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </td>
              <td className="px-4 py-2 text-xs text-muted">
                {(() => {
                  const pct = chainProgressPercent(chain);
                  const lbl = chainProgressLabel(chain);
                  return pct !== null ? (lbl ? `${lbl} · ${pct}%` : `${pct}%`) : t('common.na');
                })()}
              </td>
              <td className="px-4 py-2 text-xs text-muted">{formatDateTime(createdAt)}</td>
            </TableRowLink>
          );
        })}
      </tbody>
    </TableCard>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import { Pin, PinOff } from 'lucide-react';

import { formatDateTime } from '../../../lib/format';
import { extractConcernRefs } from '../../../lib/concerns';
import { directConcernLink, txItemsFilterForConcern } from '../../../lib/concernLinks';
import {
  chainBadgeFromState,
  chainProgressLabel,
  chainProgressPercent,
  isFailedChainState,
  isFinishedChainState,
} from '../../../lib/taskStatus';
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
import type { TableRowVariant } from '../../../components/ui/TableRowLink';
import { clsx } from '../../../components/ui/clsx';

import {
  type ChainState,
  type TransactionChainRow,
  type TransactionChainsTranslator,
  chainDotVariantFromState,
  getChainCreatedAt,
  getChainId,
  getChainLabel,
  getChainState,
} from './transactionChainSemantics';

function listRowVariant(state: unknown): TableRowVariant | undefined {
  if (isFailedChainState(state)) return 'danger';
  if (!isFinishedChainState(state)) return 'warn';
  return undefined;
}

function progressBarClass(state: unknown): string {
  if (isFailedChainState(state)) return 'bg-danger';
  if (isFinishedChainState(state)) return 'bg-ok';
  return 'bg-warn';
}

function shortClassName(value: string): string {
  return value.split('::').filter(Boolean).slice(-1)[0] ?? value;
}

function rawLabelKey(value: string | undefined): string {
  return String(value ?? '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[._:/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function translatedOrFallback(t: TransactionChainsTranslator, key: string, fallback: string, params?: Record<string, unknown>): string {
  const translated = t(key, params);
  return translated && translated !== key ? translated : fallback;
}

function concernKindLabel(t: TransactionChainsTranslator, className: string): string {
  const short = shortClassName(className);
  const key = `operation.concern.${short.toLowerCase()}`;
  return translatedOrFallback(t, key, short);
}

function concernDisplay(t: TransactionChainsTranslator, ref: ReturnType<typeof extractConcernRefs>[number]): string {
  const kind = concernKindLabel(t, ref.class_name);
  const suffix = ref.label ? `${ref.label} (#${ref.row_id})` : `#${ref.row_id}`;
  return `${kind} ${suffix}`;
}

function chainActionLabel(
  t: TransactionChainsTranslator,
  rawLabel: string | undefined,
  operationName: string,
  primaryConcern?: ReturnType<typeof extractConcernRefs>[number]
): string {
  const raw = rawLabelKey(rawLabel);
  const cls = primaryConcern ? shortClassName(primaryConcern.class_name).toLowerCase() : '';

  if (raw === 'state change' || raw === 'state') return t('operation.chain.action.state_change');
  if (raw === 'resolve' && cls === 'registrationrequest') return t('operation.chain.action.resolve_registration');
  if (raw === 'resolve') return t('operation.chain.action.resolve');
  if (raw === 'create' || raw === 'new') return t('operation.chain.action.create');
  if (raw === 'modify' || raw === 'update' || raw === 'change') return t('operation.chain.action.modify');
  if (raw === 'delete' || raw === 'destroy' || raw === 'remove') return t('operation.chain.action.delete');

  return operationName;
}

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
      minWidth="full"
      tableClassName="table-fixed"
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
          <th className="px-4 py-3">{t('transactions.chains.table.operation')}</th>
          <th className="w-32 px-3 py-3 sm:w-40 sm:px-4">{t('transactions.chains.table.state_progress')}</th>
          <th className="hidden w-44 px-4 py-3 md:table-cell">{t('common.created')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const chain = row.c;
          const id = getChainId(chain);
          const stateValue = getChainState(chain);
          const badge = chainBadgeFromState(stateValue);
          const rowVariant = listRowVariant(stateValue);
          const dotVariant = chainDotVariantFromState(stateValue);
          const label = getChainLabel(chain) ?? `#${id}`;
          const operation = classifyTransactionChain(chain);
          const operationName = operationLabel(operation, t);
          const concerns = extractConcernRefs(chain.concerns, { maxDepth: 3 });
          const primaryConcern = concerns[0];
          const shownConcerns = concerns.slice(0, 3);
          const actionTitle = chainActionLabel(t, label, operationName, primaryConcern);
          const actionStateId = extractRelatedActionStateIdFromTransactionChain(chain);
          const createdAt = getChainCreatedAt(chain);
          const progressPercent = chainProgressPercent(chain);
          const progressLabel = chainProgressLabel(chain);
          const finished = isFinishedChainState(stateValue);
          const compactProgress = progressPercent !== null
            ? (finished && progressPercent === 100
              ? progressLabel
              : [progressLabel, `${progressPercent}%`].filter(Boolean).join(' · '))
            : null;

          return (
            <TableRowLink
              key={id}
              testId={`transactions.row.${id}`}
              to={`${basePath}/transactions/${id}`}
              variant={rowVariant}
              className="border-b border-border/60 last:border-b-0"
            >
              <td className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <StatusDot
                    variant={dotVariant}
                    className="mt-1.5 shrink-0"
                    title={badge.label}
                    testId={`transactions.row.${id}.dot`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link className="font-semibold text-accent hover:underline" to={`${basePath}/transactions/${id}`}>
                        {actionTitle}
                      </Link>
                      <Badge variant={operationBadgeVariant(operation)}>{operationCategoryLabel(operation, t)}</Badge>
                      {operation.severity !== 'normal' ? <Badge variant={operationBadgeVariant(operation)}>{operationSeverityLabel(operation, t)}</Badge> : null}
                      {operation.visibility !== 'user' ? <Badge variant="info">{operationVisibilityLabel(operation, t)}</Badge> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
                      <span>{t('operation.chain.id_meta', { id })}</span>
                      {label !== actionTitle ? <span>{t('operation.raw_name', { name: label })}</span> : null}
                      <ChipLink to={`${basePath}/transactions/items?transaction_chain=${id}`} title={t('transactions.chains.row.open_items_title', { id })}>
                        {t('transactions.items.short')}
                      </ChipLink>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="px-2"
                        onClick={() => onTogglePinned(id)}
                        title={row.pinned ? t('tasks.action.unpin') : t('tasks.action.pin')}
                        ariaLabel={row.pinned ? t('transactions.chains.unpin.aria') : t('transactions.chains.pin.aria')}
                      >
                        {row.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </Button>
                    </div>
                    {shownConcerns.length > 0 ? (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="font-medium text-faint">{t('transactions.chains.row.targets')}:</span>
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
                            params.set(filter.key, filter.value);
                            return `${basePath}/transactions/items?${params.toString()}`;
                          })();
                          const text = concernDisplay(t, ref);
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
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 align-top sm:px-4">
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <div className="mt-2 text-xs text-muted" data-testid={`transactions.row.${id}.progress`}>
                  {compactProgress ?? t('common.na')}
                </div>
                {progressPercent !== null && (!finished || isFailedChainState(stateValue)) ? (
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
                    role="progressbar"
                    aria-label={t('transactions.chains.row.progress_aria', { id })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressPercent}
                  >
                    <div
                      className={clsx('h-full rounded-full', progressBarClass(stateValue))}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                ) : null}
              </td>
              <td className="hidden px-4 py-3 align-top text-xs text-muted md:table-cell">{formatDateTime(createdAt)}</td>
            </TableRowLink>
          );
        })}
      </tbody>
    </TableCard>
  );
}

import type { ToneVariant } from '../../../components/ui/tone';
import type { StatusDotVariant } from '../../../components/ui/StatusDot';
import type { TableRowVariant } from '../../../components/ui/TableRowLink';
import { transactionBadge, type BadgeVariant } from '../../../lib/taskStatus';
import { resourceId, refLabel } from '../../../lib/resources';
import type { Transaction } from '../../../lib/api/transactions';
import { classifyTransaction, operationLabel, type OperationTaxonomy } from '../../../lib/operationTaxonomy';
import { parsePositiveInt } from '../../../lib/parse';

export const DONE_VALUES = ['waiting', 'staged', 'done'] as const;

export type DoneValue = (typeof DONE_VALUES)[number];
export type TransactionItemsTranslator = (key: string, params?: Record<string, unknown>) => string;
export type TransactionItemsSmartKey = 'transaction_chain' | 'node' | 'type' | 'done' | 'success' | 'id';

export interface TransactionItemsFilterOverride {
  transaction_chain?: number;
  node?: number;
  type?: number;
  done?: DoneValue | '';
  success?: '' | 0 | 1;
  limit?: number;
}

export interface TransactionItemFilterHrefArgs {
  basePath: string;
  chainIdNum?: number;
  nodeIdNum?: number;
  typeNum?: number;
  done: DoneValue | '';
  success: '' | 0 | 1;
  limit: number;
  overrides: TransactionItemsFilterOverride;
}

export type TransactionItemsFilterHrefArgs = TransactionItemFilterHrefArgs;

export interface NormalizeLegacyTransactionItemsUrlArgs {
  basePath: string;
  searchParams: URLSearchParams;
}

export interface NormalizedLegacyTransactionItemsUrl {
  href: string;
  changed: boolean;
  removedQuery: boolean;
  destination: 'items' | 'chains';
}

export interface TransactionItemRow {
  tx: Transaction;
  id?: number;
  name: string;
  displayName: string;
  operation: OperationTaxonomy;
  type?: number;
  rowVariant: TableRowVariant;
  dotVariant: StatusDotVariant;
  badgeVariant: BadgeVariant;
  badgeLabel: string;
  userId?: number;
  userLabel?: string;
  nodeId?: number;
  nodeLabel?: string;
  vpsId?: number;
  chainId?: number;
  createdAt: string;
  startedAt: string;
  finishedAt: string;
}

function variantToSemantic(variant: BadgeVariant): Exclude<ToneVariant, 'muted'> {
  if (variant === 'ok' || variant === 'warn' || variant === 'danger' || variant === 'info' || variant === 'neutral') {
    return variant;
  }
  return 'neutral';
}

export function parseDone(value: string | null): DoneValue | '' {
  if (!value) return '';
  return (DONE_VALUES as readonly string[]).includes(value) ? (value as DoneValue) : '';
}

export function parseSuccess(value: string | null): '' | 0 | 1 {
  if (!value) return '';
  const v = value.trim();
  if (v === '0') return 0;
  if (v === '1') return 1;
  return '';
}

function hrefWithSearch(path: string, searchParams: URLSearchParams): string {
  const search = searchParams.toString();
  return search ? `${path}?${search}` : path;
}

/**
 * Normalize URLs created while the item list advertised filters which the
 * HaveAPI transaction index silently ignores.
 *
 * A valid chain is the most specific item-list scope, so it wins over stale
 * VPS/user context. Without one, those contexts belong to the chain list.
 * Pagination is reset only when a legacy parameter is actually present.
 */
export function normalizeLegacyTransactionItemsUrl({
  basePath,
  searchParams,
}: NormalizeLegacyTransactionItemsUrlArgs): NormalizedLegacyTransactionItemsUrl {
  const itemPath = `${basePath}/transactions/items`;
  const legacyPresent = searchParams.has('q') || searchParams.has('vps') || searchParams.has('user');

  if (!legacyPresent) {
    return {
      href: hrefWithSearch(itemPath, searchParams),
      changed: false,
      removedQuery: false,
      destination: 'items',
    };
  }

  const removedQuery = searchParams.has('q');
  const chainId = parsePositiveInt(searchParams.get('transaction_chain'));
  const vpsId = parsePositiveInt(searchParams.get('vps'));
  const userId = parsePositiveInt(searchParams.get('user'));
  const normalized = new URLSearchParams(searchParams);

  normalized.delete('q');
  normalized.delete('vps');
  normalized.delete('user');
  normalized.delete('from_id');
  normalized.delete('page');

  if (chainId !== undefined) {
    return {
      href: hrefWithSearch(itemPath, normalized),
      changed: true,
      removedQuery,
      destination: 'items',
    };
  }

  if (vpsId !== undefined) {
    const context = new URLSearchParams({ class_name: 'Vps', row_id: String(vpsId) });
    if (basePath === '/admin' && userId !== undefined) context.set('user', String(userId));
    return {
      href: hrefWithSearch(`${basePath}/transactions`, context),
      changed: true,
      removedQuery,
      destination: 'chains',
    };
  }

  if (basePath === '/admin' && userId !== undefined) {
    const context = new URLSearchParams({ user: String(userId) });
    return {
      href: hrefWithSearch(`${basePath}/transactions`, context),
      changed: true,
      removedQuery,
      destination: 'chains',
    };
  }

  return {
    href: hrefWithSearch(itemPath, normalized),
    changed: true,
    removedQuery,
    destination: 'items',
  };
}

export function canonicalTransactionItemKey(raw: string): TransactionItemsSmartKey | null {
  const k = raw.trim().toLowerCase();
  if (!k) return null;

  if (['chain', 'txc', 'transaction_chain', 'transaction-chain'].includes(k)) return 'transaction_chain';
  if (['node', 'n'].includes(k)) return 'node';
  if (['type', 't'].includes(k)) return 'type';
  if (['done', 'state'].includes(k)) return 'done';
  if (['success', 'status', 'ok'].includes(k)) return 'success';
  if (['id', 'tx', 'transaction', '#'].includes(k)) return 'id';

  return null;
}

export function inferDoneToken(value: string): DoneValue | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v === 'waiting' || v === 'wait' || v === 'w') return 'waiting';
  if (v === 'staged' || v === 'stage' || v === 's') return 'staged';
  if (v === 'done' || v === 'finished' || v === 'd') return 'done';
  return null;
}

export function inferSuccessToken(value: string): 0 | 1 | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v === '1' || v === 'true' || v === 'yes' || v === 'y' || v === 'ok' || v === 'success') return 1;
  if (v === '0' || v === 'false' || v === 'no' || v === 'n' || v === 'fail' || v === 'failed' || v === 'error') return 0;
  return null;
}

export function transactionItemsFilterToneFromSuccess(success: '' | 0 | 1): Exclude<ToneVariant, 'muted'> {
  if (success === 1) return 'ok';
  if (success === 0) return 'danger';
  return 'neutral';
}

export function buildTransactionItemsFilterHref({
  basePath,
  chainIdNum,
  nodeIdNum,
  typeNum,
  done,
  success,
  limit,
  overrides,
}: TransactionItemFilterHrefArgs): string {
  const p = new URLSearchParams();

  const chainV = overrides.transaction_chain !== undefined ? overrides.transaction_chain : chainIdNum;
  if (chainV) p.set('transaction_chain', String(chainV));

  const nodeV = overrides.node !== undefined ? overrides.node : nodeIdNum;
  if (nodeV) p.set('node', String(nodeV));

  const typeV = overrides.type !== undefined ? overrides.type : typeNum;
  if (typeV) p.set('type', String(typeV));

  const doneV = overrides.done !== undefined ? overrides.done : done;
  if (doneV) p.set('done', doneV);

  const successV = overrides.success !== undefined ? overrides.success : success;
  if (successV !== '') p.set('success', String(successV));

  const limitV = overrides.limit !== undefined ? overrides.limit : limit;
  if (limitV) p.set('limit', String(limitV));

  const qs = p.toString();
  return qs ? `${basePath}/transactions/items?${qs}` : `${basePath}/transactions/items`;
}

export function buildTransactionItemRow(tx: Transaction, t: TransactionItemsTranslator): TransactionItemRow {
  const badge = transactionBadge(tx);
  const rowVariant = variantToSemantic(badge.variant);
  const operation = classifyTransaction(tx);
  const name = tx.name ? String(tx.name) : t('transactions.items.row.fallback_name');
  return {
    tx,
    id: typeof tx.id === 'number' ? tx.id : undefined,
    name,
    displayName: operationLabel(operation, t),
    operation,
    type: typeof tx.type === 'number' ? tx.type : undefined,
    rowVariant,
    dotVariant: rowVariant,
    badgeVariant: badge.variant,
    badgeLabel: badge.label,
    userId: resourceId(tx.user),
    userLabel: refLabel(tx.user) ?? undefined,
    nodeId: resourceId(tx.node),
    nodeLabel: refLabel(tx.node) ?? undefined,
    vpsId: resourceId(tx.vps),
    chainId: resourceId(tx.transaction_chain),
    createdAt: typeof tx.created_at === 'string' ? tx.created_at : '',
    startedAt: typeof tx.started_at === 'string' ? tx.started_at : '',
    finishedAt: typeof tx.finished_at === 'string' ? tx.finished_at : '',
  };
}

export function buildTransactionItemFilterHref(args: TransactionItemFilterHrefArgs): string {
  return buildTransactionItemsFilterHref(args);
}

import type { ToneVariant } from '../../../components/ui/tone';
import type { StatusDotVariant } from '../../../components/ui/StatusDot';
import type { TableRowVariant } from '../../../components/ui/TableRowLink';
import { transactionBadge, type BadgeVariant } from '../../../lib/taskStatus';
import { resourceId, refLabel } from '../../../lib/resources';
import type { Transaction } from '../../../lib/api/transactions';

export const DONE_VALUES = ['waiting', 'staged', 'done'] as const;

export type DoneValue = (typeof DONE_VALUES)[number];
export type TransactionItemsTranslator = (key: string, params?: Record<string, unknown>) => string;
export type TransactionItemsSmartKey = 'q' | 'transaction_chain' | 'node' | 'vps' | 'type' | 'done' | 'success' | 'user' | 'id';

export interface TransactionItemsFilterOverride {
  transaction_chain?: number;
  node?: number;
  vps?: number;
  type?: number;
  user?: number;
  done?: DoneValue | '';
  success?: '' | 0 | 1;
  limit?: number;
  q?: string;
}

export interface TransactionItemFilterHrefArgs {
  basePath: string;
  qTrim: string;
  chainIdNum?: number;
  nodeIdNum?: number;
  vpsIdNum?: number;
  typeNum?: number;
  done: DoneValue | '';
  success: '' | 0 | 1;
  userIdNum?: number;
  limit: number;
  overrides: TransactionItemsFilterOverride;
}

export type TransactionItemsFilterHrefArgs = TransactionItemFilterHrefArgs;

export interface TransactionItemRow {
  tx: Transaction;
  id?: number;
  name: string;
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

export function canonicalTransactionItemKey(raw: string): TransactionItemsSmartKey | null {
  const k = raw.trim().toLowerCase();
  if (!k) return null;

  if (['q', 'search', 'name'].includes(k)) return 'q';
  if (['chain', 'txc', 'transaction_chain', 'transaction-chain'].includes(k)) return 'transaction_chain';
  if (['node', 'n'].includes(k)) return 'node';
  if (['vps', 'v'].includes(k)) return 'vps';
  if (['type', 't'].includes(k)) return 'type';
  if (['done', 'state'].includes(k)) return 'done';
  if (['success', 'status', 'ok'].includes(k)) return 'success';
  if (['user', 'u', 'owner'].includes(k)) return 'user';
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
  qTrim,
  chainIdNum,
  nodeIdNum,
  vpsIdNum,
  typeNum,
  done,
  success,
  userIdNum,
  limit,
  overrides,
}: TransactionItemFilterHrefArgs): string {
  const p = new URLSearchParams();

  const qVal = overrides.q !== undefined ? overrides.q : qTrim;
  if (qVal.trim()) p.set('q', qVal.trim());

  const chainV = overrides.transaction_chain !== undefined ? overrides.transaction_chain : chainIdNum;
  if (chainV) p.set('transaction_chain', String(chainV));

  const nodeV = overrides.node !== undefined ? overrides.node : nodeIdNum;
  if (nodeV) p.set('node', String(nodeV));

  const vpsV = overrides.vps !== undefined ? overrides.vps : vpsIdNum;
  if (vpsV) p.set('vps', String(vpsV));

  const typeV = overrides.type !== undefined ? overrides.type : typeNum;
  if (typeV) p.set('type', String(typeV));

  const userV = overrides.user !== undefined ? overrides.user : userIdNum;
  if (userV && basePath === '/admin') p.set('user', String(userV));

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
  return {
    tx,
    id: typeof tx.id === 'number' ? tx.id : undefined,
    name: tx.name ? String(tx.name) : t('transactions.items.row.fallback_name'),
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

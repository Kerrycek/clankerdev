import { describe, expect, test } from 'vitest';

import {
  buildTransactionItemsFilterHref,
  canonicalTransactionItemKey,
  normalizeLegacyTransactionItemsUrl,
} from './transactionItemSemantics';

describe('transaction item filter semantics', () => {
  test('recognizes only filters supported by the transaction index', () => {
    expect(canonicalTransactionItemKey('chain')).toBe('transaction_chain');
    expect(canonicalTransactionItemKey('transaction-chain')).toBe('transaction_chain');
    expect(canonicalTransactionItemKey('n')).toBe('node');
    expect(canonicalTransactionItemKey('t')).toBe('type');
    expect(canonicalTransactionItemKey('state')).toBe('done');
    expect(canonicalTransactionItemKey('ok')).toBe('success');
    expect(canonicalTransactionItemKey('#')).toBe('id');

    for (const unsupported of ['q', 'search', 'name', 'vps', 'v', 'user', 'u', 'owner']) {
      expect(canonicalTransactionItemKey(unsupported)).toBeNull();
    }
  });

  test('builds item-list hrefs from supported filters only', () => {
    const href = buildTransactionItemsFilterHref({
      basePath: '/admin',
      chainIdNum: 42,
      nodeIdNum: 3,
      typeNum: 12,
      done: 'done',
      success: 0,
      limit: 50,
      overrides: { node: 4, done: 'waiting' },
    });

    expect(href).toBe(
      '/admin/transactions/items?transaction_chain=42&node=4&type=12&done=waiting&success=0&limit=50'
    );
    const params = new URL(href, 'https://example.test').searchParams;
    expect(params.has('q')).toBe(false);
    expect(params.has('vps')).toBe(false);
    expect(params.has('user')).toBe(false);
  });
});

describe('legacy transaction item URL normalization', () => {
  test('leaves ordinary item pagination untouched', () => {
    const result = normalizeLegacyTransactionItemsUrl({
      basePath: '/app',
      searchParams: new URLSearchParams('node=3&from_id=600&page=2&limit=50'),
    });

    expect(result).toEqual({
      href: '/app/transactions/items?node=3&from_id=600&page=2&limit=50',
      changed: false,
      removedQuery: false,
      destination: 'items',
    });
  });

  test('removes legacy query text and resets pagination while preserving valid item filters', () => {
    const result = normalizeLegacyTransactionItemsUrl({
      basePath: '/admin',
      searchParams: new URLSearchParams('q=mount&node=3&type=12&from_id=600&page=2&limit=50'),
    });

    expect(result).toEqual({
      href: '/admin/transactions/items?node=3&type=12&limit=50',
      changed: true,
      removedQuery: true,
      destination: 'items',
    });
  });

  test('keeps a valid chain as the most specific item scope', () => {
    const result = normalizeLegacyTransactionItemsUrl({
      basePath: '/admin',
      searchParams: new URLSearchParams(
        'transaction_chain=42&vps=123&user=7&q=mount&node=3&from_id=600&page=2&limit=50'
      ),
    });

    expect(result).toEqual({
      href: '/admin/transactions/items?transaction_chain=42&node=3&limit=50',
      changed: true,
      removedQuery: true,
      destination: 'items',
    });
  });

  test('moves VPS context without a valid chain to the chain list', () => {
    const result = normalizeLegacyTransactionItemsUrl({
      basePath: '/app',
      searchParams: new URLSearchParams('transaction_chain=invalid&vps=123&user=7&q=mount&node=3'),
    });

    expect(result).toEqual({
      href: '/app/transactions?class_name=Vps&row_id=123',
      changed: true,
      removedQuery: true,
      destination: 'chains',
    });
  });

  test('keeps a valid admin user together with redirected VPS context', () => {
    const result = normalizeLegacyTransactionItemsUrl({
      basePath: '/admin',
      searchParams: new URLSearchParams('vps=123&user=7&q=mount'),
    });

    expect(result).toEqual({
      href: '/admin/transactions?class_name=Vps&row_id=123&user=7',
      changed: true,
      removedQuery: true,
      destination: 'chains',
    });
  });

  test('moves admin user context without a valid chain or VPS to the chain list', () => {
    const result = normalizeLegacyTransactionItemsUrl({
      basePath: '/admin',
      searchParams: new URLSearchParams('user=7&from_id=600&page=2'),
    });

    expect(result).toEqual({
      href: '/admin/transactions?user=7',
      changed: true,
      removedQuery: false,
      destination: 'chains',
    });
  });

  test('drops app-only user context and resets item pagination', () => {
    const result = normalizeLegacyTransactionItemsUrl({
      basePath: '/app',
      searchParams: new URLSearchParams('user=7&node=3&from_id=600&page=2&limit=50'),
    });

    expect(result).toEqual({
      href: '/app/transactions/items?node=3&limit=50',
      changed: true,
      removedQuery: false,
      destination: 'items',
    });
  });
});

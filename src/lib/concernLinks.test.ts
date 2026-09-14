import { describe, expect, it } from 'vitest';

import {
  directConcernLink,
  shortConcernClassName,
  txConcernFilterLink,
  txItemsConcernFilterLink,
  txItemsFilterForConcern,
} from './concernLinks';

describe('concernLinks', () => {
  it.each([
    ['Node', 21, { key: 'node', value: '21' }],
    ['VpsAdmin::TransactionChain', 22, { key: 'transaction_chain', value: '22' }],
    ['Vps', 23, null],
    ['Dataset', 24, null],
  ] as const)('maps %s concerns only to supported transaction item filters', (className, rowId, expected) => {
    expect(txItemsFilterForConcern(className, rowId)).toEqual(expected);
  });

  it.each([
    ['/admin', 'Node', 21, '/admin/transactions/items?node=21'],
    ['/app', 'TransactionChain', 22, '/app/transactions/items?transaction_chain=22'],
    ['/admin', 'Vps', 23, null],
  ] as const)('builds only supported item-filter links for %s %s', (basePath, className, rowId, expected) => {
    expect(txItemsConcernFilterLink(basePath, className, rowId)).toBe(expected);
  });

  it('builds a transaction-chain concern link for a VPS', () => {
    expect(txConcernFilterLink('/admin', 'Vps', 23)).toBe('/admin/transactions?class_name=Vps&row_id=23');
  });

  it.each([
    ['/app', 'VpsAdmin::Vps', 7, '/app/vps/7'],
    ['/app', 'Dataset', 8, '/app/datasets/8'],
    ['/app', 'DnsZone', 9, '/app/dns/zones/9'],
    ['/admin', 'Node', 10, '/admin/nodes/10'],
    ['/app', 'Node', 10, null],
    ['/admin', 'MigrationPlan', 11, '/admin/migration-plans/11'],
    ['/app', 'MigrationPlan', 11, null],
  ] as const)('maps direct concern link for %s %s', (basePath, className, rowId, expected) => {
    expect(directConcernLink(basePath, className, rowId)).toBe(expected);
  });

  it('strips namespaces from concern class names', () => {
    expect(shortConcernClassName('VpsAdmin::Vps')).toBe('Vps');
  });
});

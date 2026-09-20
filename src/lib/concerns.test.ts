import { describe, expect, test } from 'vitest';

import { extractConcernRefs, normalizeTransactionChainConcerns } from './concerns';

describe('transaction-chain concern normalization', () => {
  test('normalizes the active f94 envelope and preserves class labels', () => {
    const concerns = {
      type: 'affect',
      objects: [
        ['Vps', 13861],
        ['Dataset', 10402],
        ['DnsZone', 77],
      ],
      labels: {
        Vps: 'VPS',
        Dataset: 'Dataset',
        DnsZone: 'DNS zone',
      },
    };

    expect(normalizeTransactionChainConcerns(concerns)).toEqual([
      {
        class_name: 'Vps',
        row_id: 13861,
        class_label: 'VPS',
        label: undefined,
        raw: ['Vps', 13861],
      },
      {
        class_name: 'Dataset',
        row_id: 10402,
        class_label: 'Dataset',
        label: undefined,
        raw: ['Dataset', 10402],
      },
      {
        class_name: 'DnsZone',
        row_id: 77,
        class_label: 'DNS zone',
        label: undefined,
        raw: ['DnsZone', 77],
      },
    ]);

    expect(extractConcernRefs(concerns)).toEqual(normalizeTransactionChainConcerns(concerns));
  });

  test('keeps supported legacy top-level tuples and direct objects', () => {
    expect(
      normalizeTransactionChainConcerns([
        ['Vps', 11, 'web-11'],
        { class_name: 'Dataset', row_id: 12, label: 'root dataset' },
        { className: 'DnsZone', rowId: 13, name: 'example.test' },
        { class: 'Node', id: 14, hostname: 'node14.example.test' },
        { class_name: 'Vps', id: 15, hostname: 'web-15' },
      ])
    ).toMatchObject([
      { class_name: 'Vps', row_id: 11, label: 'web-11' },
      { class_name: 'Dataset', row_id: 12, label: 'root dataset' },
      { class_name: 'DnsZone', row_id: 13, label: 'example.test' },
      { class_name: 'Node', row_id: 14, label: 'node14.example.test' },
      { class_name: 'Vps', row_id: 15, label: 'web-15' },
    ]);
  });

  test('fails closed for malformed envelopes, nested lookalikes and invalid references', () => {
    expect(normalizeTransactionChainConcerns({ objects: 'Vps:1', labels: { Vps: 'VPS' } })).toEqual([]);
    expect(normalizeTransactionChainConcerns({ payload: { class_name: 'Vps', row_id: 999 } })).toEqual([]);
    expect(
      normalizeTransactionChainConcerns({
        type: 'affect',
        objects: [
          ['Vps', '1'],
          ['Vps', 0],
          ['Vps', -1],
          ['Vps', 1.5],
          ['', 2],
          ['Vps<script>', 3],
          ['Vps', 4, 'unexpected-third-item'],
          { class_name: 'Vps', row_id: 5 },
          ['UnknownConcern', 6],
          ['UnknownConcern', 6],
        ],
        labels: { UnknownConcern: 'Unknown object', Vps: 123 },
      })
    ).toEqual([
      {
        class_name: 'UnknownConcern',
        row_id: 6,
        class_label: 'Unknown object',
        label: undefined,
        raw: ['UnknownConcern', 6],
      },
    ]);
  });
});

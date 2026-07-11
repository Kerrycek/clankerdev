import { describe, expect, test } from 'vitest';

import { summarizeNodes } from './DashboardOperationalCards';

describe('summarizeNodes', () => {
  test('keeps Brno directly below Praha in the cluster overview', () => {
    const nodes: any[] = [
      { hostname: 'brq1', location: { label: 'Brno' } },
      { hostname: 'pg1', location: { label: 'Playground' } },
      { hostname: 'prg1', location: { label: 'Praha' } },
      { hostname: 'stg1', location: { label: 'Staging' } },
    ];

    expect(summarizeNodes(nodes, 'Neznámá lokalita').byLocation.map(([location]) => location)).toEqual([
      'Praha',
      'Brno',
      'Playground',
      'Staging',
    ]);
  });
});

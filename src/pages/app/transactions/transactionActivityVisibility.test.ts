import { describe, expect, it } from 'vitest';

import type { TransactionChainRow } from './transactionChainSemantics';
import { splitTransactionActivityRows } from './transactionActivityVisibility';

function row(id: number, state: string, pinned = false): TransactionChainRow {
  return {
    c: { id, label: 'Scheduled backup retention cleanup', state },
    pinned,
  };
}

describe('splitTransactionActivityRows', () => {
  it('only collapses unpinned successful routine backup activity', () => {
    const completed = row(1, 'done');
    const active = row(2, 'queued');
    const failed = row(3, 'failed');
    const fatal = row(4, 'fatal');
    const pinned = row(5, 'done', true);

    const result = splitTransactionActivityRows([completed, active, failed, fatal, pinned], true);

    expect(result.systemRows).toEqual([completed]);
    expect(result.visibleRows).toEqual([active, failed, fatal, pinned]);
  });
});

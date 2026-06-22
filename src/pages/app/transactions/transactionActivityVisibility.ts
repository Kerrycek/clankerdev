import { classifyTransactionChain, shouldCollapseSystemOperation } from '../../../lib/operationTaxonomy';
import { getChainState, type TransactionChainRow } from './transactionChainSemantics';

export interface TransactionActivityRows {
  visibleRows: TransactionChainRow[];
  systemRows: TransactionChainRow[];
}

export function splitTransactionActivityRows(rows: TransactionChainRow[], collapseSystemActivity: boolean): TransactionActivityRows {
  if (!collapseSystemActivity) return { visibleRows: rows, systemRows: [] };

  const visibleRows: TransactionChainRow[] = [];
  const systemRows: TransactionChainRow[] = [];

  for (const row of rows) {
    const operation = classifyTransactionChain(row.c);
    if (!row.pinned && shouldCollapseSystemOperation(operation, getChainState(row.c))) systemRows.push(row);
    else visibleRows.push(row);
  }

  return { visibleRows, systemRows };
}

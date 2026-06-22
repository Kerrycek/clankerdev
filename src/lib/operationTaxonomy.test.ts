import { describe, expect, it } from 'vitest';

import type { ActionState } from './api/actionStates';
import type { Transaction, TransactionChain } from './api/transactions';
import {
  classifyActionState,
  classifyTransaction,
  classifyTransactionChain,
  operationBadgeVariant,
  operationLabel,
  shouldCollapseSystemOperation,
} from './operationTaxonomy';

const labels: Record<string, string> = {
  'action.vps.create.label': 'Create VPS',
  'action.vps.delete.label': 'Delete VPS',
  'action.vps.stop.label': 'Stop',
  'operation.system.storage_maintenance.label': 'Storage maintenance',
};

function t(key: string, params?: Record<string, unknown>): string {
  if (key === 'operation.raw_name') return `Raw: ${String(params?.['name'] ?? '')}`;
  return labels[key] ?? key;
}

describe('operation taxonomy', () => {
  it('classifies VPS lifecycle transactions with shared labels', () => {
    const createTx: Transaction = { id: 1, name: 'CreateVps', vps: { id: 16, label: 'web-16' } };
    const deleteTx: Transaction = { id: 2, name: 'DestroyVps', vps: { id: 16, label: 'web-16' } };

    const create = classifyTransaction(createTx);
    const destroy = classifyTransaction(deleteTx);

    expect(create.key).toBe('vps.create');
    expect(create.category).toBe('vps');
    expect(create.visibility).toBe('user');
    expect(operationLabel(create, t)).toBe('Create VPS');

    expect(destroy.key).toBe('vps.delete');
    expect(destroy.severity).toBe('destructive');
    expect(operationBadgeVariant(destroy)).toBe('danger');
  });

  it('collapses completed system maintenance chains but keeps active ones visible', () => {
    const doneChain: TransactionChain = {
      id: 10,
      label: 'Automatic backup snapshot retention cleanup',
      state: 'done',
    };
    const activeChain: TransactionChain = {
      id: 11,
      label: 'Automatic backup snapshot retention cleanup',
      state: 'queued',
    };

    const doneOp = classifyTransactionChain(doneChain);
    const activeOp = classifyTransactionChain(activeChain);

    expect(doneOp.key).toBe('system.storage_maintenance');
    expect(doneOp.systemNoise).toBe(true);
    expect(shouldCollapseSystemOperation(doneOp, doneChain.state)).toBe(true);
    expect(shouldCollapseSystemOperation(activeOp, activeChain.state)).toBe(false);
  });

  it('uses action-state labels for toast/task operation names', () => {
    const state: ActionState = { id: 21, label: 'Stop VPS #16', status: true };
    const op = classifyActionState(state);

    expect(op.key).toBe('vps.stop');
    expect(op.severity).toBe('risky');
    expect(operationLabel(op, t)).toBe('Stop');
  });
});

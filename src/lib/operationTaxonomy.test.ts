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
  'action.vps.restart.label': 'Restart',
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

  it.each(['failed', 'fatal'] as const)('keeps %s scheduled backup failures visible', (state) => {
    const chain: TransactionChain = {
      id: state === 'failed' ? 12 : 13,
      label: 'Scheduled backup retention cleanup',
      state,
    };
    const op = classifyTransactionChain(chain);

    expect(op.systemNoise).toBe(true);
    expect(shouldCollapseSystemOperation(op, chain.state)).toBe(false);
  });

  it.each([
    'Automatic backup',
    'Scheduled backup',
    'Backup retention',
    'Backup prune',
    'Snapshot sync',
    'Backup cleanup',
  ])('classifies completed routine backup activity as system noise: %s', (label) => {
    const chain: TransactionChain = { id: 14, label, state: 'done' };
    const op = classifyTransactionChain(chain);

    expect(op.systemNoise).toBe(true);
    expect(shouldCollapseSystemOperation(op, chain.state)).toBe(true);
  });

  it.each(['Create backup', 'Restore backup', 'Delete backup', 'Snapshot rotate'])('keeps explicit backup work visible: %s', (label) => {
    const chain: TransactionChain = { id: 15, label, state: 'done' };
    const op = classifyTransactionChain(chain);

    expect(op.systemNoise).toBe(false);
    expect(shouldCollapseSystemOperation(op, chain.state)).toBe(false);
  });

  it('uses action-state labels for toast/task operation names', () => {
    const state: ActionState = { id: 21, label: 'Stop VPS #16', status: true };
    const op = classifyActionState(state);

    expect(op.key).toBe('vps.stop');
    expect(op.severity).toBe('risky');
    expect(operationLabel(op, t)).toBe('Stop');
  });

  it('does not classify Restart as Start through a substring match', () => {
    const chain: TransactionChain = {
      id: 22,
      label: 'Restart',
      state: 'done',
      concerns: [{ class_name: 'Vps', id: 33 }],
    };

    const op = classifyTransactionChain(chain);

    expect(op.key).toBe('vps.restart');
    expect(op.severity).toBe('risky');
    expect(operationLabel(op, t)).toBe('Restart');
  });

  it('does not treat unrelated compound words as lifecycle actions', () => {
    const chain: TransactionChain = {
      id: 23,
      label: 'Autostart',
      state: 'done',
      concerns: [{ class_name: 'Vps', id: 33 }],
    };

    expect(classifyTransactionChain(chain).key).toBe('vps.unknown');
  });

  it('keeps matching intentional multi-word operation hints', () => {
    const state: ActionState = {
      id: 24,
      label: 'Deploy public key',
      status: true,
      concerns: [{ class_name: 'Vps', id: 33 }],
    };

    expect(classifyActionState(state).key).toBe('vps.ssh_key');
  });
});

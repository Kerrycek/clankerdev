import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import type { Vps } from '../../../lib/api/vps';
import type { GateDecision } from '../../../lib/gates/types';
import { VpsDeleteCard } from './VpsDeleteCard';
import { VpsDeleteConfirmDialog } from './VpsDeleteConfirmation';
import { defaultDeleteForm, type DeleteForm } from './VpsDeleteModel';

vi.mock('../../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params?.['target']) return `${key}:${String(params['target'])}`;
      if (params?.['id']) return `${key}:${String(params['id'])}`;
      return key;
    },
  }),
}));

const allowedGate: GateDecision = { allowed: true };
const vps: Vps = {
  id: 123,
  hostname: 'vps123.example',
  object_state: 'active',
};

function renderDeleteCard(onSubmit = vi.fn()) {
  function Harness() {
    const [form, setForm] = useState<DeleteForm>(() => defaultDeleteForm());
    return (
      <VpsDeleteCard
        vps={vps}
        isAdminMode
        form={form}
        onChange={setForm}
        gate={allowedGate}
        pending={false}
        onSubmit={onSubmit}
      />
    );
  }

  render(<Harness />);
  return { onSubmit };
}

function renderDeleteDialog(onConfirm = vi.fn()) {
  function Harness() {
    const [form, setForm] = useState<DeleteForm>(() => defaultDeleteForm());
    return (
      <VpsDeleteConfirmDialog
        open
        vps={vps}
        vpsId={vps.id}
        isAdminMode
        form={form}
        onChange={setForm}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
  }

  render(<Harness />);
  return { onConfirm };
}

describe('VpsDeleteCard', () => {
  it('keeps lifecycle delete disabled until the exact target is typed', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDeleteCard();
    const submit = screen.getByTestId('vps.lifecycle.delete.submit');

    expect(submit).toBeDisabled();

    await user.type(screen.getByTestId('vps.lifecycle.delete.confirm'), 'wrong-host');
    expect(submit).toBeDisabled();
    expect(screen.getByText('vps.lifecycle.delete.confirm.mismatch_title')).toBeInTheDocument();

    await user.clear(screen.getByTestId('vps.lifecycle.delete.confirm'));
    await user.type(screen.getByTestId('vps.lifecycle.delete.confirm'), 'vps123.example');

    expect(submit).not.toBeDisabled();
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('uses the same typed confirmation in the VPS list delete dialog', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDeleteDialog();
    const submit = screen.getByTestId('vps.list.delete_confirm.confirm');

    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByTestId('vps.list.delete_confirm.confirm_text'), {
      target: { value: 'vps123.example' },
    });
    await waitFor(() => expect(submit).not.toBeDisabled());

    await user.click(submit);
    expect(onConfirm).toHaveBeenCalledWith({
      vpsId: 123,
      lazy: true,
      objectLabel: 'vps123.example',
    });
  });
});

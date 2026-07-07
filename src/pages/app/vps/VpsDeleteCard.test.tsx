import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
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
  it('submits lifecycle delete without typed hostname confirmation', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDeleteCard();
    const submit = screen.getByTestId('vps.lifecycle.delete.submit');

    expect(submit).not.toBeDisabled();
    expect(screen.queryByTestId('vps.lifecycle.delete.confirm')).not.toBeInTheDocument();

    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('confirms VPS list delete without typed hostname confirmation', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDeleteDialog();
    const submit = screen.getByTestId('vps.list.delete_confirm.confirm');

    expect(submit).not.toBeDisabled();
    expect(screen.queryByTestId('vps.list.delete_confirm.confirm_text')).not.toBeInTheDocument();

    await user.click(submit);
    expect(onConfirm).toHaveBeenCalledWith({
      vpsId: 123,
      lazy: true,
      objectLabel: 'vps123.example',
    });
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import type { GateDecision } from '../../../lib/gates/types';
import { VpsPowerActionCard, type PowerActionKind } from './VpsPowerActionCard';

vi.mock('../../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const allowedGate: GateDecision = { allowed: true };

function renderCard(overrides: Partial<React.ComponentProps<typeof VpsPowerActionCard>> = {}) {
  const props: React.ComponentProps<typeof VpsPowerActionCard> = {
    kind: 'start',
    gate: allowedGate,
    currentStateLabel: 'stopped',
    objectStateLabel: 'active',
    taskQueueLabel: 'ready',
    confirm: false,
    onConfirmChange: vi.fn(),
    pending: false,
    onSubmit: vi.fn(),
    onOpenTasks: vi.fn(),
    ...overrides,
  };

  render(<VpsPowerActionCard {...props} />);
  return props;
}

function blockedGate(): GateDecision {
  return {
    allowed: false,
    reason: {
      titleKey: 'gate.blocked.title',
      descriptionKey: 'gate.blocked.body',
    },
  };
}

describe('VpsPowerActionCard', () => {
  it('keeps submit disabled until the power action is confirmed', async () => {
    const user = userEvent.setup();
    const onConfirmChange = vi.fn();
    const onSubmit = vi.fn();

    renderCard({ onConfirmChange, onSubmit });

    expect(screen.getByTestId('vps.lifecycle.start.submit')).toBeDisabled();

    await user.click(screen.getByTestId('vps.lifecycle.start.confirm'));
    expect(onConfirmChange).toHaveBeenCalledWith(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each<PowerActionKind>(['start', 'stop', 'restart'])('uses normalized gate copy for blocked %s actions', (kind) => {
    renderCard({
      kind,
      gate: blockedGate(),
      confirm: true,
    });

    expect(screen.getByText('gate.blocked.title')).toBeInTheDocument();
    expect(screen.getByText('gate.blocked.body')).toBeInTheDocument();
    expect(screen.getByTestId(`vps.lifecycle.${kind}.submit`)).toHaveAttribute('aria-disabled', 'true');
  });

  it('passes force restart changes through the shared checklist', async () => {
    const user = userEvent.setup();
    const onForceChange = vi.fn();

    renderCard({
      kind: 'restart',
      confirm: true,
      force: false,
      onForceChange,
    });

    await user.click(screen.getByTestId('vps.lifecycle.restart.force'));
    expect(onForceChange).toHaveBeenCalledWith(true);
  });
});

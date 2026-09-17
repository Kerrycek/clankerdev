import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { VpsConfigMobileActionBar } from './VpsConfigurationPrimitives';

vi.mock('../../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => params?.['n'] === undefined
      ? key
      : `${key}:${String(params['n'])}`,
  }),
}));

describe('VpsConfigMobileActionBar', () => {
  it('stays absent until the form contains a change', () => {
    render(
      <VpsConfigMobileActionBar
        changeCount={0}
        pending={false}
        saveDisabled
        onReset={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('vps.config.mobile_actions')).not.toBeInTheDocument();
  });

  it('keeps reset and save available from the sticky mobile action bar', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    const onSave = vi.fn();

    render(
      <VpsConfigMobileActionBar
        changeCount={2}
        pending={false}
        saveDisabled={false}
        onReset={onReset}
        onSave={onSave}
      />,
    );

    const bar = screen.getByTestId('vps.config.mobile_actions');
    expect(bar).toHaveClass('sticky', 'top-16', 'lg:hidden');
    expect(screen.getByText('vps.config.unsaved:2')).toBeVisible();

    await user.click(screen.getByTestId('vps.config.mobile_actions.reset'));
    await user.click(screen.getByTestId('vps.config.mobile_actions.save'));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('preserves the shared disabled-reason behavior', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <VpsConfigMobileActionBar
        changeCount={1}
        pending={false}
        saveDisabled
        disabledReason={{ titleKey: 'gate.blocked.title', descriptionKey: 'gate.blocked.body' }}
        onReset={vi.fn()}
        onSave={onSave}
      />,
    );

    const save = screen.getByTestId('vps.config.mobile_actions.save');
    expect(save).toHaveAttribute('aria-disabled', 'true');
    await user.click(save);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('gate.blocked.title')).toBeVisible();
  });
});

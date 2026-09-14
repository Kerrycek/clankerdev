import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { SmartFilterInput } from './SmartFilterInput';

describe('SmartFilterInput', () => {
  test('submits the current DOM value instead of the controlled prop snapshot', () => {
    const onSubmit = vi.fn();

    render(
      <SmartFilterInput
        value=""
        onChange={vi.fn()}
        onSubmit={onSubmit}
        ariaLabel="Smart filter"
      />
    );

    const input = screen.getByRole('textbox', { name: 'Smart filter' });
    fireEvent.keyDown(input, {
      key: 'Enter',
      target: { value: 'addr:10.0.0.1' },
    });

    expect(input).toHaveValue('addr:10.0.0.1');
    expect(onSubmit).toHaveBeenCalledWith('addr:10.0.0.1');
  });

  test('keeps Enter suggestion selection separate from free-text submission', () => {
    const onPick = vi.fn();
    const onSubmit = vi.fn();

    render(
      <SmartFilterInput
        value="123"
        onChange={vi.fn()}
        onSubmit={onSubmit}
        ariaLabel="Smart filter"
        suggestions={[{ id: 'open', primary: 'Open #123', onPick }]}
      />
    );

    const input = screen.getByRole('textbox', { name: 'Smart filter' });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

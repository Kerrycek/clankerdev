import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { SmartFilterInput } from './SmartFilterInput';

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => (key === 'filters.smart.no_suggestions' ? 'No filter suggestions.' : key),
    tc: (_key: string, count: number) => `${count} suggestion${count === 1 ? '' : 's'} available.`,
  }),
}));

const scrollIntoView = vi.fn();
Object.defineProperty(Element.prototype, 'scrollIntoView', {
  configurable: true,
  value: scrollIntoView,
});

function focus(element: HTMLElement) {
  act(() => element.focus());
}

function ControlledInput(props: {
  onPick?: (id: string) => void;
  onSubmit?: (value: string) => void;
  initialValue?: string;
}) {
  const [value, setValue] = useState(props.initialValue ?? 'alpha');
  return (
    <SmartFilterInput
      value={value}
      onChange={setValue}
      onSubmit={props.onSubmit}
      ariaLabel="Smart filter"
      suggestions={[
        { id: 'first', primary: 'First choice', onPick: () => props.onPick?.('first') },
        { id: 'second', primary: 'Second choice', onPick: () => props.onPick?.('second') },
        { id: 'third', primary: 'Third choice', onPick: () => props.onPick?.('third') },
      ]}
    />
  );
}

describe('SmartFilterInput', () => {
  beforeEach(() => {
    scrollIntoView.mockClear();
  });

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

    const input = screen.getByRole('combobox', { name: 'Smart filter' });
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

    const input = screen.getByRole('combobox', { name: 'Smart filter' });
    focus(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('exposes a complete combobox contract with unique per-instance ID references', () => {
    render(
      <>
        <SmartFilterInput
          value="one"
          onChange={vi.fn()}
          ariaLabel="First filter"
          suggestions={[{ id: 'same', primary: 'First option', onPick: vi.fn() }]}
        />
        <SmartFilterInput
          value="two"
          onChange={vi.fn()}
          ariaLabel="Second filter"
          suggestions={[{ id: 'same', primary: 'Second option', onPick: vi.fn() }]}
        />
      </>
    );

    const first = screen.getByRole('combobox', { name: 'First filter' });
    const second = screen.getByRole('combobox', { name: 'Second filter' });
    const firstControls = first.getAttribute('aria-controls');
    const secondControls = second.getAttribute('aria-controls');

    expect(firstControls).toBeTruthy();
    expect(secondControls).toBeTruthy();
    expect(firstControls).not.toBe(secondControls);
    expect(first).toHaveAttribute('aria-autocomplete', 'list');
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(first).toHaveClass('h-11', 'min-h-11');

    focus(first);

    const listbox = screen.getByRole('listbox', { name: 'First filter' });
    const option = screen.getByRole('option', { name: 'First option' });
    expect(listbox).toHaveAttribute('id', firstControls);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveAttribute('aria-activedescendant', option.id);
    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(option).toHaveAttribute('tabindex', '-1');
    expect(option).toHaveClass('min-h-11');
  });

  test('wraps arrow navigation, reopens in either direction, and keeps Enter deterministic', () => {
    const onPick = vi.fn();
    const onSubmit = vi.fn();
    render(<ControlledInput onPick={onPick} onSubmit={onSubmit} />);

    const input = screen.getByRole('combobox', { name: 'Smart filter' });
    focus(input);
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'First choice' }).id);

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Third choice' }).id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'First choice' }).id);

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-activedescendant');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Third choice' }).id);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith('third');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(input, { key: 'Enter', target: { value: 'free text' } });
    expect(onSubmit).toHaveBeenCalledWith('free text');
  });

  test('lets the first Escape close only the popup and the second Escape reach an enclosing overlay', () => {
    const parentEscape = vi.fn();
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') parentEscape();
    };
    window.addEventListener('keydown', onWindowKeyDown);

    try {
      render(<ControlledInput />);
      const input = screen.getByRole('combobox', { name: 'Smart filter' });
      focus(input);
      expect(input).toHaveAttribute('aria-expanded', 'true');

      expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(false);
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(parentEscape).not.toHaveBeenCalled();

      expect(fireEvent.keyDown(input, { key: 'Escape' })).toBe(true);
      expect(parentEscape).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('keydown', onWindowKeyDown);
    }
  });

  test('preserves text-editing, modified, and composition keystrokes', () => {
    const onPick = vi.fn();
    const onSubmit = vi.fn();
    render(<ControlledInput onPick={onPick} onSubmit={onSubmit} />);

    const input = screen.getByRole('combobox', { name: 'Smart filter' });
    focus(input);
    const first = screen.getByRole('option', { name: 'First choice' });

    expect(fireEvent.keyDown(input, { key: 'Home' })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'End' })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'ArrowDown', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true })).toBe(true);
    expect(fireEvent.keyDown(input, { key: 'Enter', isComposing: true })).toBe(true);

    expect(input).toHaveAttribute('aria-activedescendant', first.id);
    expect(onPick).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('resets the active row when the value or same-length suggestion identity changes and scrolls it into view', () => {
    const { rerender } = render(
      <SmartFilterInput
        value="alpha"
        onChange={vi.fn()}
        ariaLabel="Smart filter"
        suggestions={[
          { id: 'a', primary: 'A', onPick: vi.fn() },
          { id: 'b', primary: 'B', onPick: vi.fn() },
        ]}
      />
    );

    const input = screen.getByRole('combobox', { name: 'Smart filter' });
    focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'B' }).id);

    rerender(
      <SmartFilterInput
        value="beta"
        onChange={vi.fn()}
        ariaLabel="Smart filter"
        suggestions={[
          { id: 'a', primary: 'A', onPick: vi.fn() },
          { id: 'b', primary: 'B', onPick: vi.fn() },
        ]}
      />
    );
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'A' }).id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    rerender(
      <SmartFilterInput
        value="beta"
        onChange={vi.fn()}
        ariaLabel="Smart filter"
        suggestions={[
          { id: 'c', primary: 'C', onPick: vi.fn() },
          { id: 'd', primary: 'D', onPick: vi.fn() },
        ]}
      />
    );
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'C' }).id);
    expect(scrollIntoView).toHaveBeenCalled();
  });

  test('prevents pointer-down blur but activates a suggestion only on click', () => {
    const onPick = vi.fn();
    render(<ControlledInput onPick={onPick} />);

    const input = screen.getByRole('combobox', { name: 'Smart filter' });
    focus(input);
    const option = screen.getByRole('option', { name: 'Second choice' });

    expect(fireEvent.mouseDown(option)).toBe(false);
    expect(onPick).not.toHaveBeenCalled();
    expect(input).toHaveFocus();

    fireEvent.click(option);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('second');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  test('announces suggestion counts and connects validation errors to the combobox', () => {
    render(
      <SmartFilterInput
        value="broken"
        onChange={vi.fn()}
        ariaLabel="Smart filter"
        errors={['Unknown key.', 'Missing value.']}
        suggestions={[
          { id: 'a', primary: 'A', onPick: vi.fn() },
          { id: 'b', primary: 'B', onPick: vi.fn() },
        ]}
      />
    );

    const input = screen.getByRole('combobox', { name: 'Smart filter' });
    focus(input);

    expect(screen.getByRole('status')).toHaveTextContent('2 suggestions available.');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Unknown key. Missing value.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
  });

  test('announces that the current filter text has no suggestions', () => {
    render(
      <SmartFilterInput
        value="unmatched"
        onChange={vi.fn()}
        ariaLabel="Smart filter"
        suggestions={[]}
      />
    );

    focus(screen.getByRole('combobox', { name: 'Smart filter' }));

    expect(screen.getByRole('status')).toHaveTextContent('No filter suggestions.');
  });
});

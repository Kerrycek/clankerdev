import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { fetchVpsList, type Vps } from '../../lib/api/vps';
import { VpsLookupInput } from './VpsLookupInput';

vi.mock('../../lib/api/vps', () => ({
  fetchVpsList: vi.fn(),
}));

vi.mock('../../app/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => ({
      'common.error': 'Search failed',
      'common.loading': 'Searching…',
      'common.no_results': 'No VPS found',
      'vps.list.col.vps': 'VPS',
    })[key] ?? key,
  }),
}));

function reply(data: Vps[]) {
  return { data, envelope: { status: true, response: {} } };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderLookup(props: Partial<React.ComponentProps<typeof VpsLookupInput>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const onChange = vi.fn();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <VpsLookupInput
        value={null}
        onChange={onChange}
        ariaLabel="Target VPS"
        testId="vps-lookup"
        {...props}
      />
    </QueryClientProvider>
  );

  return { ...view, onChange, queryClient };
}

describe('VpsLookupInput', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('exposes a complete combobox contract and supports wrapping keyboard selection', async () => {
    vi.mocked(fetchVpsList).mockResolvedValue(
      reply([
        { id: 11, hostname: 'alpha.example' },
        { id: 12, hostname: 'bravo.example' },
        { id: 13, hostname: 'charlie.example' },
      ])
    );
    const { onChange } = renderLookup();
    const input = screen.getByRole('combobox', { name: 'Target VPS' });

    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).not.toHaveAttribute('aria-controls');
    expect(input).not.toHaveAttribute('aria-activedescendant');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'example' } });

    const listbox = await screen.findByRole('listbox', { name: 'Target VPS' });
    const options = screen.getAllByRole('option');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-describedby', screen.getByRole('status').id);
    expect(screen.getByRole('status')).toHaveTextContent('Target VPS: 3');
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id));
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveClass('min-h-11');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-activedescendant', options[2]?.id);

    fireEvent.keyDown(input, { key: 'Home' });
    expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);

    fireEvent.keyDown(input, { key: 'End' });
    expect(input).toHaveAttribute('aria-activedescendant', options[2]?.id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', options[1]?.id);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenLastCalledWith(12);
    expect(input).toHaveValue('#12');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-controls');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  test('keeps duplicate API rows addressable through unique, stable option ids', async () => {
    vi.mocked(fetchVpsList).mockResolvedValue(
      reply([
        { id: 7, hostname: 'first.example' },
        { id: 7, hostname: 'duplicate.example' },
      ])
    );
    const { onChange } = renderLookup();
    const input = screen.getByRole('combobox', { name: 'Target VPS' });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'example' } });

    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]?.id).not.toBe(options[1]?.id);
    expect(new Set(options.map((option) => option.id)).size).toBe(2);

    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', options[1]?.id);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenLastCalledWith(7);
    expect(input).toHaveValue('#7');
  });

  test('uses the first Escape for suggestions and lets the next Escape reach a parent drawer', async () => {
    vi.mocked(fetchVpsList).mockResolvedValue(reply([{ id: 21, hostname: 'mail.example' }]));
    renderLookup();
    const input = screen.getByRole('combobox', { name: 'Target VPS' });
    const parentEscape = vi.fn();
    const parentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') parentEscape();
    };
    window.addEventListener('keydown', parentKeyDown);

    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'mail' } });
    await screen.findByRole('listbox');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(parentEscape).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveFocus();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(parentEscape).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(parentEscape).toHaveBeenCalledTimes(1);

    window.removeEventListener('keydown', parentKeyDown);
  });

  test('keeps loading and empty popup Escape inside the combobox', async () => {
    const pendingRequest = deferred<ReturnType<typeof reply>>();
    vi.mocked(fetchVpsList)
      .mockReturnValueOnce(pendingRequest.promise)
      .mockResolvedValueOnce(reply([]));
    renderLookup();
    const input = screen.getByRole('combobox', { name: 'Target VPS' });
    const parentEscape = vi.fn();
    const parentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') parentEscape();
    };
    window.addEventListener('keydown', parentKeyDown);

    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'slow' } });
    expect(screen.getByRole('status')).toHaveTextContent('Searching…');
    expect(input).not.toHaveAttribute('aria-controls');
    await waitFor(() => expect(fetchVpsList).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(parentEscape).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    pendingRequest.resolve(reply([{ id: 22, hostname: 'late.example' }]));
    fireEvent.change(input, { target: { value: 'empty' } });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No VPS found'));
    expect(input).not.toHaveAttribute('aria-controls');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(parentEscape).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(parentEscape).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', parentKeyDown);
  });

  test('announces a failed current request without leaving stale options actionable', async () => {
    vi.mocked(fetchVpsList).mockRejectedValue(new Error('network down'));
    const { onChange } = renderLookup();
    const input = screen.getByRole('combobox', { name: 'Target VPS' });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'broken' } });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Search failed'));
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-controls');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(fireEvent.keyDown(input, { key: 'Enter' })).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('does not expose or select results from an obsolete request', async () => {
    const oldRequest = deferred<ReturnType<typeof reply>>();
    const newRequest = deferred<ReturnType<typeof reply>>();
    vi.mocked(fetchVpsList).mockImplementation((options) => {
      return options?.hostnameAny === 'old' ? oldRequest.promise : newRequest.promise;
    });
    const { onChange } = renderLookup();
    const input = screen.getByRole('combobox', { name: 'Target VPS' });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'old' } });
    await waitFor(() => expect(fetchVpsList).toHaveBeenCalledTimes(1));

    fireEvent.change(input, { target: { value: 'new' } });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    oldRequest.resolve(reply([{ id: 31, hostname: 'obsolete.example' }]));
    expect(screen.queryByText('obsolete.example')).not.toBeInTheDocument();

    await waitFor(() => expect(fetchVpsList).toHaveBeenCalledTimes(2));
    expect(vi.mocked(fetchVpsList).mock.calls[0]?.[0]?.signal).toBeInstanceOf(AbortSignal);
    newRequest.resolve(reply([{ id: 32, hostname: 'current.example' }]));

    await screen.findByText('current.example');
    expect(screen.queryByText('obsolete.example')).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(32);
  });

  test('preserves touch selection across blur ordering and accepts an AT-synthesized click', async () => {
    vi.mocked(fetchVpsList).mockResolvedValue(reply([{ id: 41, hostname: 'touch.example' }]));
    const { onChange } = renderLookup();
    const input = screen.getByRole('combobox', { name: 'Target VPS' });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'touch' } });
    const option = await screen.findByRole('option', { name: /touch\.example/ });

    fireEvent.pointerDown(option, { pointerType: 'touch', button: 0 });
    act(() => option.focus());
    fireEvent.blur(input);
    fireEvent.click(option);

    expect(onChange).toHaveBeenLastCalledWith(41);
    expect(input).toHaveValue('#41');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: 'touch' } });
    const reopenedOption = await screen.findByRole('option', { name: /touch\.example/ });
    act(() => reopenedOption.focus());
    fireEvent.click(reopenedOption);
    expect(onChange).toHaveBeenLastCalledWith(41);
    expect(input).toHaveValue('#41');
    expect(input).toHaveFocus();
  });

  test('honors external reset while preserving multi-digit controlled typing', () => {
    function Harness() {
      const [value, setValue] = useState<number | null>(null);
      return (
        <>
          <VpsLookupInput
            value={value}
            onChange={setValue}
            placeholder="Find a VPS"
            testId="vps-lookup"
          />
          <output data-testid="value">{value ?? 'none'}</output>
          <button type="button" onClick={() => setValue(null)}>
            Reset
          </button>
          <button type="button" onClick={() => setValue(88)}>
            Replace externally
          </button>
        </>
      );
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>
    );
    const input = screen.getByRole('combobox', { name: 'Find a VPS' });

    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.change(input, { target: { value: '12' } });
    expect(input).toHaveValue('12');
    expect(screen.getByTestId('value')).toHaveTextContent('12');

    fireEvent.click(screen.getByRole('button', { name: 'Replace externally' }));
    expect(input).toHaveValue('#88');
    expect(screen.getByTestId('value')).toHaveTextContent('88');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(input).toHaveValue('');
    expect(screen.getByTestId('value')).toHaveTextContent('none');
    expect(input).toHaveClass('h-11');
  });

  test('does not steal modified navigation or IME Enter keystrokes', async () => {
    vi.mocked(fetchVpsList).mockResolvedValue(
      reply([
        { id: 51, hostname: 'alpha.example' },
        { id: 52, hostname: 'beta.example' },
      ])
    );
    const { onChange } = renderLookup();
    const input = screen.getByRole('combobox', { name: 'Target VPS' });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'example' } });
    const options = await screen.findAllByRole('option');
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id));

    fireEvent.keyDown(input, { key: 'End', ctrlKey: true });
    expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);
    fireEvent.keyDown(input, { key: 'ArrowDown', metaKey: true });
    expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    expect(onChange).not.toHaveBeenCalledWith(51);
    expect(onChange).not.toHaveBeenCalledWith(52);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  test('clears deferred blur timers when unmounted', () => {
    vi.useFakeTimers();
    const { unmount } = renderLookup();
    const input = screen.getByRole('combobox', { name: 'Target VPS' });

    act(() => vi.runOnlyPendingTimers());
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

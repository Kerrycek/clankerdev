import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MainContent } from './MainContentAccessibility';
import { RouteFocusManager } from './RouteFocusManager';

function AppPage() {
  return (
    <MainContent data-testid="app-main">
      <label>
        Filter
        <input aria-label="Filter" />
      </label>
    </MainContent>
  );
}

function PublicPage() {
  return (
    <MainContent data-testid="public-main">
      <h1>Outages</h1>
      <section id="details">Details</section>
    </MainContent>
  );
}

function Root() {
  return (
    <>
      <RouteFocusManager />
      <Outlet />
    </>
  );
}

function createRouter(initialEntries = ['/app'], initialIndex = initialEntries.length - 1) {
  return createMemoryRouter(
    [
      {
        element: <Root />,
        children: [
          { path: '/app', element: <AppPage /> },
          { path: '/outages', element: <PublicPage /> },
        ],
      },
    ],
    { initialEntries, initialIndex },
  );
}

function installAnimationFrameQueue() {
  let nextHandle = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const handle = nextHandle;
    nextHandle += 1;
    callbacks.set(handle, callback);
    return handle;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
    callbacks.delete(handle);
  });

  return {
    pending: () => callbacks.size,
    flush: () => {
      const pending = Array.from(callbacks.values());
      callbacks.clear();
      pending.forEach((callback) => callback(0));
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RouteFocusManager', () => {
  it('does not move focus or scroll on the initial render', () => {
    const frames = installAnimationFrameQueue();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    render(
      <React.StrictMode>
        <RouterProvider router={createRouter()} />
      </React.StrictMode>,
    );

    expect(screen.getByTestId('app-main')).not.toHaveFocus();
    expect(frames.pending()).toBe(0);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('focuses the new layout and resets scroll after PUSH navigation', async () => {
    const frames = installAnimationFrameQueue();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const router = createRouter();
    render(
      <React.StrictMode>
        <RouterProvider router={router} />
      </React.StrictMode>,
    );

    await act(() => router.navigate('/outages'));

    const main = screen.getByTestId('public-main');
    const focus = vi.spyOn(main, 'focus');
    expect(frames.pending()).toBe(1);
    expect(main).not.toHaveFocus();
    expect(scrollTo).toHaveBeenCalledOnce();
    act(() => frames.flush());
    expect(main).toHaveFocus();
    expect(focus).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'auto' });
  });

  it('also resets focus and scroll after REPLACE navigation', async () => {
    const frames = installAnimationFrameQueue();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const router = createRouter();
    render(<RouterProvider router={router} />);

    await act(() => router.navigate('/outages', { replace: true }));

    expect(frames.pending()).toBe(1);
    act(() => frames.flush());
    expect(screen.getByTestId('public-main')).toHaveFocus();
    expect(scrollTo).toHaveBeenCalledOnce();
  });

  it('focuses the previous layout without overriding scroll restoration on POP navigation', async () => {
    const frames = installAnimationFrameQueue();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const router = createRouter(['/app', '/outages']);
    render(<RouterProvider router={router} />);

    await act(() => router.navigate(-1));

    const main = screen.getByTestId('app-main');
    const focus = vi.spyOn(main, 'focus');
    expect(frames.pending()).toBe(1);
    act(() => frames.flush());
    expect(main).toHaveFocus();
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('keeps in-page focus for search and fragment-only navigation', async () => {
    const frames = installAnimationFrameQueue();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const router = createRouter();
    render(<RouterProvider router={router} />);
    const input = screen.getByRole('textbox', { name: 'Filter' });
    input.focus();

    await act(() => router.navigate('/app?q=alpha'));
    expect(input).toHaveFocus();
    expect(frames.pending()).toBe(0);

    await act(() => router.navigate('/app#results'));
    expect(input).toHaveFocus();
    expect(frames.pending()).toBe(0);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does not override destination fragment navigation', async () => {
    const frames = installAnimationFrameQueue();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const router = createRouter();
    render(<RouterProvider router={router} />);

    await act(() => router.navigate('/outages#details'));

    expect(screen.getByTestId('public-main')).not.toHaveFocus();
    expect(frames.pending()).toBe(0);
    expect(scrollTo).not.toHaveBeenCalled();

    await act(() => router.navigate('/outages'));
    expect(screen.getByTestId('public-main')).not.toHaveFocus();
    expect(frames.pending()).toBe(0);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('cancels stale focus work when navigation is superseded', async () => {
    const frames = installAnimationFrameQueue();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const router = createRouter();
    render(<RouterProvider router={router} />);

    await act(() => router.navigate('/outages'));
    const abandonedMain = screen.getByTestId('public-main');
    const abandonedFocus = vi.spyOn(abandonedMain, 'focus');
    expect(frames.pending()).toBe(1);

    await act(() => router.navigate('/app'));
    const currentMain = screen.getByTestId('app-main');
    const currentFocus = vi.spyOn(currentMain, 'focus');
    expect(frames.pending()).toBe(1);

    act(() => frames.flush());
    expect(abandonedFocus).not.toHaveBeenCalled();
    expect(currentFocus).toHaveBeenCalledOnce();
    expect(currentMain).toHaveFocus();
  });

  it('keeps pending focus through same-path query normalization', async () => {
    const frames = installAnimationFrameQueue();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const router = createRouter();
    render(<RouterProvider router={router} />);

    await act(() => router.navigate('/outages'));
    expect(frames.pending()).toBe(1);

    await act(() => router.navigate('/outages?limit=50&page=1', { replace: true }));
    const main = screen.getByTestId('public-main');
    const focus = vi.spyOn(main, 'focus');
    expect(frames.pending()).toBe(1);

    act(() => frames.flush());
    expect(focus).toHaveBeenCalledOnce();
    expect(main).toHaveFocus();
    expect(scrollTo).toHaveBeenCalledOnce();
  });
});

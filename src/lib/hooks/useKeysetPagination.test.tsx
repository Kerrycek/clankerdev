import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { useKeysetPagination } from './useKeysetPagination';

beforeEach(() => sessionStorage.clear());

test('URL-restoring lists expose the history cursor on the first render, before layout effects', () => {
  const renders: Array<number | undefined> = [];
  const setSearchParams = vi.fn();
  const { result, rerender } = renderHook(({ search }) => {
    const page = useKeysetPagination({
      id: 'history-test', filterKey: 'same-filter', searchParams: new URLSearchParams(search),
      setSearchParams, defaultLimit: 25, restoreUrlCursorOnSignatureChange: true,
    });
    renders.push(page.fromId);
    return page;
  }, { initialProps: { search: 'limit=25&page=2&from_id=375' } });

  act(() => result.current.goPrev());
  // A requested navigation is not authoritative before the router commits it.
  expect(result.current.fromId).toBe(375);
  rerender({ search: 'limit=25&page=1' });
  expect(result.current.fromId).toBeUndefined();
  renders.length = 0;
  rerender({ search: 'limit=25&page=2&from_id=375' });
  expect(renders.length).toBeGreaterThan(0);
  expect(renders.every((cursor) => cursor === 375)).toBe(true);
  expect(result.current.page).toBe(2);
});

test('restores a new filter and direct-link cursor without exposing the previous page', () => {
  const renders: Array<number | undefined> = [];
  const { result, rerender } = renderHook(({ filter, search }) => {
    const page = useKeysetPagination({
      id: 'filter-history-test', filterKey: filter, searchParams: new URLSearchParams(search),
      setSearchParams: vi.fn(), defaultLimit: 25, restoreUrlCursorOnSignatureChange: true,
    });
    renders.push(page.fromId);
    return page;
  }, { initialProps: { filter: 'one', search: 'limit=25&page=1' } });

  renders.length = 0;
  rerender({ filter: 'two', search: 'limit=25&page=2&from_id=83' });
  expect(renders.every((cursor) => cursor === 83)).toBe(true);
  expect(result.current.canPrev).toBe(true);
});

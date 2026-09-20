import { describe, expect, it } from 'vitest';

import { currentSuggestionRows } from './currentSuggestionRows';

describe('currentSuggestionRows', () => {
  it('returns rows only for the exact current debounced input', () => {
    const rows = [{ id: 1, login: 'alice' }];

    expect(currentSuggestionRows('alice', 'alice', rows)).toBe(rows);
    expect(currentSuggestionRows('bob', 'alice', rows)).toEqual([]);
  });

  it('normalizes missing current-query data to an empty array', () => {
    expect(currentSuggestionRows('alice', 'alice', undefined)).toEqual([]);
  });
});

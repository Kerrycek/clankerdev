import { describe, expect, it } from 'vitest';

import { assertDictionariesHaveSameKeys } from './index';

describe('i18n dictionaries', () => {
  it('have the same keys in en and cs', () => {
    expect(() => assertDictionariesHaveSameKeys()).not.toThrow();
  });
});

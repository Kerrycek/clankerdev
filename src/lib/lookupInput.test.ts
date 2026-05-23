import { describe, expect, it } from 'vitest';

import { formatLookupId, parseLookupIdLike } from './lookupInput';

describe('lookupInput helpers', () => {
  it('parses plain and hash-prefixed positive integers', () => {
    expect(parseLookupIdLike('123')).toBe(123);
    expect(parseLookupIdLike('#123')).toBe(123);
    expect(parseLookupIdLike('  #42  ')).toBe(42);
  });

  it('rejects empty, zero, negative and mixed inputs', () => {
    expect(parseLookupIdLike('')).toBeNull();
    expect(parseLookupIdLike('0')).toBeNull();
    expect(parseLookupIdLike('-1')).toBeNull();
    expect(parseLookupIdLike('12a')).toBeNull();
    expect(parseLookupIdLike('abc')).toBeNull();
  });

  it('formats lookup ids consistently', () => {
    expect(formatLookupId(7)).toBe('#7');
    expect(formatLookupId(42.9)).toBe('#42');
  });
});

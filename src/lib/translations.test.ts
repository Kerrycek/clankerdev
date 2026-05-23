import { describe, expect, it } from 'vitest';

import { pickTranslation } from './translations';

describe('pickTranslation', () => {
  it('prefers preferred languages', () => {
    const obj: any = { cs_summary: 'Ahoj', en_summary: 'Hello' };
    expect(pickTranslation(obj, 'summary', ['en'])).toBe('Hello');
    expect(pickTranslation(obj, 'summary', ['cs'])).toBe('Ahoj');
  });

  it('falls back to any translation field', () => {
    const obj: any = { de_summary: 'Hallo' };
    expect(pickTranslation(obj, 'summary', ['en', 'cs'])).toBe('Hallo');
  });
});

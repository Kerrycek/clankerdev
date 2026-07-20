import { describe, expect, it } from 'vitest';

import { pickLocalizedFieldFrom, pickTranslation } from './translations';

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

  it('can pick localized backend text from multiple field names', () => {
    const obj: any = {
      message: 'Raw fallback',
      cs_body: 'České tělo',
      en_body: 'English body',
      cs_text: 'Český text',
    };

    expect(pickLocalizedFieldFrom(obj, ['message', 'body', 'text'], ['cs', 'en'])).toBe('České tělo');
    expect(pickLocalizedFieldFrom(obj, ['message', 'body', 'text'], ['en', 'cs'])).toBe('English body');
  });

  it('falls back to the raw field when no localized field exists', () => {
    const obj: any = { message: 'Raw fallback' };

    expect(pickLocalizedFieldFrom(obj, ['message', 'body', 'text'], ['cs', 'en'])).toBe('Raw fallback');
  });
});

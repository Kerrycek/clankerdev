import { cs } from './cs';
import { en } from './en';

export const dictionaries = { en, cs } as const;
export type UiLanguage = keyof typeof dictionaries;

// Convenience types for future typed `t()` implementation.
export type TranslationKey = keyof typeof en;

// Runtime assertion: keep dictionaries in sync.
export function assertDictionariesHaveSameKeys(): void {
  const enKeys = Object.keys(en).sort();
  const csKeys = Object.keys(cs).sort();

  if (enKeys.length !== csKeys.length) {
    throw new Error(`i18n: key count mismatch (en=${enKeys.length}, cs=${csKeys.length})`);
  }

  for (let i = 0; i < enKeys.length; i++) {
    const a = enKeys[i];
    const b = csKeys[i];
    if (a !== b) {
      throw new Error(`i18n: key mismatch at ${i}: en=${a}, cs=${b}`);
    }
  }
}

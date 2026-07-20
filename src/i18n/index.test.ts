import { describe, expect, it } from 'vitest';

import { assertDictionariesHaveSameKeys, dictionaries } from './index';

describe('i18n dictionaries', () => {
  it('have the same keys in en and cs', () => {
    expect(() => assertDictionariesHaveSameKeys()).not.toThrow();
  });

  it('keeps Czech terminology aligned with the legacy WebUI guide', () => {
    const bannedPatterns: Array<[RegExp, string]> = [
      [/\b[Kk]lastr/u, 'Používej „Cluster“, ne „klastr“.'],
      [/\b[Uu]zel\b|\b[Uu]zly\b|\buzl[ůuey]\b/u, 'Používej „Node“/„Nody“, ne „uzel“.'],
      [/\bpřihlašovací jméno\b/iu, 'Pole loginu je „Přezdívka“.'],
      [/\bsecurity advisories\b|\bsecurity advisory\b/iu, 'Používej „Bezpečnostní upozornění“.'],
    ];

    const failures: string[] = [];

    for (const [key, value] of Object.entries(dictionaries.cs)) {
      for (const [pattern, reason] of bannedPatterns) {
        if (pattern.test(value)) failures.push(`${key}: ${value} (${reason})`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('uses outage terminology for planned outage counters', () => {
    expect(dictionaries.cs['public.overview.outages.subtitle']).toContain('odstávky');
    expect(dictionaries.cs['dashboard.section.outages.subtitle']).toContain('odstávky');
    expect(dictionaries.cs['dashboard.widget.outages.collapsed_summary']).toContain('odstávky');
  });
});

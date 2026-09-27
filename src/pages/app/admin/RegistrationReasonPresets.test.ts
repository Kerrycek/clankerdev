import { describe, expect, it } from 'vitest';
import { applicantMessageLanguage, registrationReasonPresets, registrationReasonText } from './RegistrationReasonPresets';

describe('approved registration reason presets', () => {
  it('offers exactly the four rejection and three correction reasons', () => {
    expect(registrationReasonPresets('deny')).toEqual(['address_nonexistent', 'application_incorrect', 'duplicate_application', 'existing_membership']);
    expect(registrationReasonPresets('request_correction')).toEqual(['address_incomplete', 'address_unverified', 'name_incomplete']);
    expect(registrationReasonText('deny', 'address_incomplete', 'cs')).toBeNull();
    expect(registrationReasonText('deny', '__proto__', 'en')).toBeNull();
  });

  for (const action of ['deny', 'request_correction'] as const) {
    for (const key of registrationReasonPresets(action)) {
      it(`supplies editable cs/en text within the existing reason limit for ${key}`, () => {
        const cs = registrationReasonText(action, key, 'cs');
        const en = registrationReasonText(action, key, 'en');
        expect(cs).toBeTruthy();
        expect(en).toBeTruthy();
        expect(cs).not.toEqual(en);
        expect(cs!.length).toBeLessThanOrEqual(500);
        expect(en!.length).toBeLessThanOrEqual(500);
        expect(cs).not.toMatch(/\{.*\}/);
        expect(en).not.toMatch(/\{.*\}/);
      });
    }
  }

  it('includes a marked-house map link request in both verification messages', () => {
    expect(registrationReasonText('request_correction', 'address_unverified', 'cs')).toContain('odkaz na mapu, na které bude označen tvůj dům');
    expect(registrationReasonText('request_correction', 'address_unverified', 'en')).toContain('link to a map with your house marked');
  });

  it.each([
    [{ code: 'cs', label: 'English' }, 'cs'],
    [{ code: 'en-GB' }, 'en'],
    [{ code: 'cs_CZ' }, 'cs'],
    [{ label: 'Čeština' }, 'cs'],
    ['en', 'en'],
    [{ id: 2 }, null],
    [undefined, null],
    [{ code: 'de', label: 'Deutsch' }, null],
  ])('uses explicit application language %j without guessing from an ID', (input, expected) => {
    expect(applicantMessageLanguage(input)).toBe(expected);
  });

  it('resolves resource-only language IDs from the API catalog without assuming ID assignments', () => {
    expect(applicantMessageLanguage({ id: 57 }, [{ id: 57, code: 'cs' }])).toBe('cs');
    expect(applicantMessageLanguage(57, [{ id: 57, code: 'en' }])).toBe('en');
  });
});

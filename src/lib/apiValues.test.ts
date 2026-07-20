import { describe, expect, it } from 'vitest';

import {
  humanizeApiValue,
  outageImpactLabel,
  outageTypeLabel,
  securityAdvisoryStateLabel,
  translatedApiValue,
} from './apiValues';
import { cs } from '../i18n/cs';
import { en } from '../i18n/en';

function tCs(key: string): string {
  return (cs as Record<string, string>)[key] ?? key;
}

function tEn(key: string): string {
  return (en as Record<string, string>)[key] ?? key;
}

describe('API value labels', () => {
  it('localizes outage values from the API', () => {
    expect(outageTypeLabel(tCs, 'planned_outage')).toBe('Odstávka');
    expect(outageTypeLabel(tCs, 'unplanned_outage')).toBe('Výpadek');
    expect(outageTypeLabel(tEn, 'planned_outage')).toBe('Planned outage');
  });

  it('localizes security advisory states from the API', () => {
    expect(securityAdvisoryStateLabel(tCs, 'publish')).toBe('Zveřejnit');
    expect(securityAdvisoryStateLabel(tCs, 'published')).toBe('Zveřejněno');
    expect(securityAdvisoryStateLabel(tCs, 'mitigated')).toBe('Ošetřeno');
  });

  it('localizes outage impacts and hides raw snake_case', () => {
    expect(outageImpactLabel(tCs, 'system_restart')).toBe('Restart');
    expect(outageImpactLabel(tEn, 'system_restart')).toBe('Restart');
  });

  it('humanizes unknown values instead of showing raw backend values', () => {
    expect(humanizeApiValue('some_new_state')).toBe('Some new state');
    expect(translatedApiValue(tCs, 'unknown.namespace', 'future_value')).toBe('Future value');
  });
});

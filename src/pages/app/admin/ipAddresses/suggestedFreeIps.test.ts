import { describe, expect, it } from 'vitest';

import type { IpAddress } from '../../../../lib/api/ipAddresses';
import type { Location as InfraLocation } from '../../../../lib/api/infra';

import { sampleSuggestedIps, selectSuggestedIpLocations } from './suggestedFreeIps';

function ip(id: number, addr: string, extra: Partial<IpAddress> = {}): IpAddress {
  return { id, addr, ...extra };
}

function location(id: number, label: string, environment: string): InfraLocation {
  const environmentIds: Record<string, number> = {
    Production: 1,
    Playground: 2,
    Staging: 3,
  };

  return { id, label, environment: { id: environmentIds[environment] ?? id * 10, label: environment } };
}

describe('suggested free IP helpers', () => {
  it('keeps a small balanced sample from every address type', () => {
    const items: IpAddress[] = [
      ...[1, 2, 3, 4].map((id) => ip(id, `37.205.10.${id}`)),
      ...[11, 12, 13, 14].map((id) => ip(id, `10.0.0.${id}`)),
      ...[21, 22, 23, 24].map((id) => ip(id, `2a03:3b40:fe:a1::${id}`)),
      ...[31, 32, 33, 34].map((id) => ip(id, `fd00::${id}`)),
      ip(99, '198.51.100.99', { user: { id: 1 } }),
    ];

    expect(sampleSuggestedIps(items).map((item) => item.id)).toEqual([
      1, 2, 3,
      11, 12, 13,
      21, 22, 23,
      31, 32, 33,
    ]);
  });

  it('prioritizes production Prague while keeping one location per environment', () => {
    const locations = [
      location(1, 'Brno', 'Production'),
      location(2, 'Playground lab', 'Playground'),
      location(3, 'Praha 2', 'Production'),
      location(4, 'Staging', 'Staging'),
    ];

    expect(selectSuggestedIpLocations(locations).map((item) => item.id)).toEqual([3, 2, 4, 1]);
  });
});

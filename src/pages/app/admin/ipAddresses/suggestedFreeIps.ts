import type { IpAddress } from '../../../../lib/api/ipAddresses';
import type { Location as InfraLocation } from '../../../../lib/api/infra';

import {
  ipAddressText,
  isDefaultHiddenLegacyNetwork,
  isPrivateIp,
  isUnallocatedIp,
} from './ipAddressListSemantics';

export const SUGGESTED_IPS_PER_TYPE = 3;
export const SUGGESTED_IP_QUERY_LIMIT = 150;
export const SUGGESTED_LOCATION_LIMIT = 12;

type SuggestedIpBucket = 'public4' | 'private4' | 'public6' | 'private6';

function normalizedLocationText(location: InfraLocation): string {
  return `${location.label ?? ''} ${location.environment?.label ?? ''}`.toLocaleLowerCase('cs');
}

function isPrahaLocation(location: InfraLocation): boolean {
  const text = normalizedLocationText(location);
  return text.includes('praha') || text.includes('prague');
}

function isProductionLocation(location: InfraLocation): boolean {
  const text = normalizedLocationText(location);
  return text.includes('production') || text.includes('prod');
}

function environmentKey(location: InfraLocation): string {
  const environment = location.environment;
  if (environment?.id !== undefined) return String(environment.id);
  if (environment?.label) return environment.label;
  return 'unknown';
}

export function suggestedLocationOrder(a: InfraLocation, b: InfraLocation): number {
  const priority = (location: InfraLocation) => {
    const label = normalizedLocationText(location);
    const isPraha = isPrahaLocation(location);
    const isProduction = isProductionLocation(location);

    if (isPraha && isProduction) return 0;
    if (isPraha) return 1;
    if (isProduction) return 2;
    if (label.includes('brno')) return 3;
    if (label.includes('playground')) return 4;
    if (label.includes('staging')) return 5;
    return 6;
  };

  return priority(a) - priority(b) || String(a.label ?? '').localeCompare(String(b.label ?? ''), 'cs');
}

export function selectSuggestedIpLocations(locations: InfraLocation[]): InfraLocation[] {
  const ordered = [...locations].sort(suggestedLocationOrder);
  const selected: InfraLocation[] = [];
  const selectedIds = new Set<number>();

  const add = (location: InfraLocation | undefined) => {
    if (!location || selectedIds.has(location.id)) return;
    selected.push(location);
    selectedIds.add(location.id);
  };

  add(ordered.find((location) => isPrahaLocation(location) && isProductionLocation(location)));

  const coveredEnvironments = new Set(selected.map(environmentKey));
  for (const location of ordered) {
    const key = environmentKey(location);
    if (coveredEnvironments.has(key)) continue;
    add(location);
    coveredEnvironments.add(key);
  }

  for (const location of ordered) add(location);

  return selected.slice(0, SUGGESTED_LOCATION_LIMIT);
}

function suggestedIpBucket(ip: IpAddress): SuggestedIpBucket {
  const isV6 = (ipAddressText(ip) ?? '').includes(':');
  const isPrivate = isPrivateIp(ip);

  if (isV6) return isPrivate ? 'private6' : 'public6';
  return isPrivate ? 'private4' : 'public4';
}

export function sampleSuggestedIps(items: IpAddress[]): IpAddress[] {
  const buckets: Record<SuggestedIpBucket, IpAddress[]> = {
    public4: [],
    private4: [],
    public6: [],
    private6: [],
  };

  items
    .filter((ip) => !isDefaultHiddenLegacyNetwork(ip))
    .filter(isUnallocatedIp)
    .forEach((ip) => {
      buckets[suggestedIpBucket(ip)].push(ip);
    });

  return (['public4', 'private4', 'public6', 'private6'] as const)
    .flatMap((bucket) => buckets[bucket].slice(0, SUGGESTED_IPS_PER_TYPE));
}

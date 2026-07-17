import type { ResourceRef } from '../../../lib/api/appTypes';
import type { IpAddress } from '../../../lib/api/ipAddresses';
import type { Vps } from '../../../lib/api/vps';

export type AssignableIpKind = 'ipv4_public' | 'ipv4_private' | 'ipv6';

type IdLike = number | string | ResourceRef | null | undefined;

export function resourceId(value: IdLike): number | null {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  if (!value || typeof value !== 'object') return null;
  return resourceId(value.id as number | string | undefined);
}

export function vpsLocationId(vps: Vps | null | undefined): number | null {
  return resourceId(vps?.node?.location?.id);
}

export function ipLocationId(ip: IpAddress | null | undefined): number | null {
  return resourceId(ip?.network?.primary_location?.id);
}

export function vpsEnvironmentId(vps: Vps | null | undefined): number | null {
  return resourceId((vps?.node?.location as { environment?: ResourceRef | number | string | null } | null | undefined)?.environment);
}

export function ipEnvironmentId(ip: IpAddress | null | undefined): number | null {
  return resourceId(ip?.network?.primary_location?.environment as ResourceRef | number | string | null | undefined);
}

export function canAssignIpToVps(ip: IpAddress | null | undefined, vps: Vps | null | undefined): boolean {
  if (!ip || !vps) return false;

  const ipLocation = ipLocationId(ip);
  const vpsLocation = vpsLocationId(vps);
  if (ipLocation && vpsLocation && ipLocation !== vpsLocation) return false;

  const ipEnvironment = ipEnvironmentId(ip);
  const vpsEnvironment = vpsEnvironmentId(vps);
  if (ipEnvironment && vpsEnvironment && ipEnvironment !== vpsEnvironment) return false;

  return true;
}

export function assignableIpKindQuery(kind: AssignableIpKind): {
  version: 4 | 6;
  role?: 'public_access' | 'private_access';
} {
  if (kind === 'ipv4_private') return { version: 4, role: 'private_access' };
  if (kind === 'ipv4_public') return { version: 4, role: 'public_access' };
  return { version: 6 };
}

export function ipVersion(ip: IpAddress): 4 | 6 | null {
  const rawVersion = Number(ip.network?.ip_version);
  if (rawVersion === 4 || rawVersion === 6) return rawVersion;

  const address = String(ip.addr ?? '').trim();
  if (address.includes(':')) return 6;
  if (address.includes('.')) return 4;
  return null;
}

export function assignableIpKind(ip: IpAddress): AssignableIpKind {
  if (ipVersion(ip) === 6) return 'ipv6';
  return String(ip.network?.role ?? '') === 'private_access' ? 'ipv4_private' : 'ipv4_public';
}

export function matchesAssignableIpKind(ip: IpAddress, kind: AssignableIpKind): boolean {
  const query = assignableIpKindQuery(kind);
  if (ipVersion(ip) !== query.version) return false;
  if (!query.role) return true;
  return String(ip.network?.role ?? '') === query.role;
}

export function isAssignedIp(ip: IpAddress): boolean {
  return resourceId(ip.network_interface as ResourceRef | number | string | null | undefined) !== null;
}

export function isOwnedByUser(ip: IpAddress, userId: number | null | undefined): boolean {
  if (!userId) return false;
  return resourceId(ip.user as ResourceRef | number | string | null | undefined) === userId;
}

export function isVisibleUserIp(ip: IpAddress, userId: number | null | undefined): boolean {
  return isAssignedIp(ip) || isOwnedByUser(ip, userId);
}

export function uniqueIpAddresses(items: IpAddress[]): IpAddress[] {
  const seen = new Set<number>();
  return items.filter((ip) => {
    if (seen.has(ip.id)) return false;
    seen.add(ip.id);
    return true;
  });
}

export function ipAddressLabel(ip: IpAddress): string {
  const address = String(ip.addr ?? '').trim();
  if (!address) return `#${ip.id}`;
  return typeof ip.prefix === 'number' ? `${address}/${ip.prefix}` : address;
}

export function vpsLabel(vps: Vps): string {
  const hostname = String(vps.hostname ?? '').trim();
  return hostname ? `${hostname} (#${vps.id})` : `#${vps.id}`;
}

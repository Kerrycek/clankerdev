import type { ResourceRef } from '../../../../lib/api/appTypes';
import type { IpAddress, Network } from '../../../../lib/api/ipAddresses';
import type { NetworkInterface } from '../../../../lib/api/networkInterfaces';
import type { User } from '../../../../lib/api/users';
import type { Vps } from '../../../../lib/api/vps';

export type IpSmartKey =
  | 'id'
  | 'q'
  | 'addr'
  | 'prefix'
  | 'vps'
  | 'user'
  | 'network'
  | 'version'
  | 'iface'
  | 'assigned'
  | 'location'
  | 'order';

export type IpListOrder = 'asc' | 'desc' | 'interface';

type IdLike = number | string | ResourceRef | null | undefined;
type UserLike = User | ResourceRef | string | number | null | undefined;
type VpsLike = Vps | ResourceRef | string | number | null | undefined;
type NetworkLike = Network | {
  id?: number | string | null;
  address?: string | null;
  prefix?: number | null;
  primary_location?: {
    label?: string | null;
    environment?: { label?: string | null } | null;
  } | null;
} | string | null | undefined;
type InterfaceLike = NetworkInterface | ResourceRef | { id?: number | string | null; name?: string | null } | string | number | null | undefined;

export type IpAddressListRecord = IpAddress & {
  addr?: string | null;
  prefix?: number | null;
  network?: NetworkLike;
  network_interface?: InterfaceLike;
  user?: UserLike;
  vps?: VpsLike;
  created_at?: string | null;
  routed?: boolean | null;
};

function ipRow(ip: IpAddress): IpAddressListRecord {
  return ip as IpAddressListRecord;
}

export function idFromResourceRef(value: IdLike): number | null {
  if (!value) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === 'object') {
    const id = 'id' in value ? value.id : undefined;
    if (typeof id === 'number') return Number.isFinite(id) ? id : null;
    if (typeof id === 'string') {
      const parsed = Number(id);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }

  return null;
}

export function ipId(ip: IpAddress): number {
  return ipRow(ip).id;
}

export function ipAddressText(ip: IpAddress): string | undefined {
  const value = ipRow(ip).addr;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function ipPrefix(ip: IpAddress): number | undefined {
  const value = ipRow(ip).prefix;
  return typeof value === 'number' ? value : undefined;
}

export function ipLabel(ip: IpAddress): string {
  const addr = ipAddressText(ip);
  const prefix = ipPrefix(ip);
  if (addr) return prefix ? `${addr}/${prefix}` : addr;
  return `#${ipId(ip)}`;
}

export function networkLabel(ip: IpAddress, na: string): string {
  const network = ipRow(ip).network;
  if (!network) return na;

  if (typeof network === 'string') {
    const text = network.trim();
    return text || na;
  }

  const address = typeof network.address === 'string' ? network.address.trim() : '';
  const prefix = typeof network.prefix === 'number' ? network.prefix : undefined;
  if (address) return prefix ? `${address}/${prefix}` : address;

  const id = idFromResourceRef(network as ResourceRef);
  return id ? `#${id}` : na;
}

export function environmentLabel(ip: IpAddress, na: string): string {
  const network = ipRow(ip).network;
  if (!network || typeof network === 'string') return na;

  const location = network.primary_location;
  const locationLabel = typeof location?.label === 'string' ? location.label.trim() : '';
  const environmentLabel = typeof location?.environment?.label === 'string'
    ? location.environment.label.trim()
    : '';

  if (locationLabel && environmentLabel) return `${locationLabel} · ${environmentLabel}`;
  return locationLabel || environmentLabel || na;
}

export type IpLocationFallback = {
  label?: string | null;
  environment?: { label?: string | null } | null;
};

export function locationMark(ip: IpAddress, fallback?: IpLocationFallback | null): { code: string; label: string } | null {
  const network = ipRow(ip).network;
  const location = network && typeof network !== 'string' ? network.primary_location : undefined;
  const source = location?.label ? location : fallback;
  const label = typeof source?.label === 'string' ? source.label.trim() : '';
  const environment = typeof source?.environment?.label === 'string' ? source.environment.label.trim() : '';

  if (!label && !environment) return null;

  return {
    code: (label || environment).slice(0, 1).toUpperCase(),
    label: label && environment ? `${label} · ${environment}` : label || environment,
  };
}

export function isDefaultHiddenLegacyNetwork(ip: IpAddress): boolean {
  const address = ipAddressText(ip)?.toLowerCase() ?? '';
  const network = networkLabel(ip, '').toLowerCase();

  return (
    address.startsWith('83.167.228.') ||
    network.startsWith('83.167.228.') ||
    address.startsWith('2a01:430:17:') ||
    network.startsWith('2a01:430:17:')
  );
}

export function userLabel(ip: IpAddress, na: string): string {
  const user = ipRow(ip).user;
  if (!user) return na;

  if (typeof user === 'string') {
    const text = user.trim();
    return text || na;
  }

  if (typeof user === 'number') return `#${user}`;

  const login = typeof user.login === 'string' && user.login ? user.login : undefined;
  const id = idFromResourceRef(user as ResourceRef);
  if (login && id) return `${login} (#${id})`;
  if (login) return login;
  if (id) return `#${id}`;
  return na;
}

export function vpsLabel(ip: IpAddress, na: string): string {
  const vps = ipRow(ip).vps;
  if (!vps) return na;

  if (typeof vps === 'string') {
    const text = vps.trim();
    return text || na;
  }

  if (typeof vps === 'number') return `#${vps}`;

  const hostname = typeof vps.hostname === 'string' && vps.hostname ? vps.hostname : undefined;
  const id = idFromResourceRef(vps as ResourceRef);
  if (hostname && id) return `${hostname} (#${id})`;
  if (hostname) return hostname;
  if (id) return `#${id}`;
  return na;
}

export function ifaceLabel(ip: IpAddress, na: string): string {
  const iface = ipRow(ip).network_interface;
  if (!iface) return na;

  if (typeof iface === 'string') {
    const text = iface.trim();
    return text || na;
  }

  if (typeof iface === 'number') return `#${iface}`;

  const name = typeof iface.name === 'string' && iface.name ? iface.name : undefined;
  const id = idFromResourceRef(iface as ResourceRef);
  if (name && id) return `${name} (#${id})`;
  if (name) return name;
  if (id) return `#${id}`;
  return na;
}

export function ipVpsId(ip: IpAddress): number | null {
  return idFromResourceRef(ipRow(ip).vps as ResourceRef | null | undefined);
}

export function ipUserId(ip: IpAddress): number | null {
  return idFromResourceRef(ipRow(ip).user as ResourceRef | null | undefined);
}

export function isAssignedToInterface(ip: IpAddress): boolean {
  return Boolean(ipRow(ip).network_interface);
}

export function ipRowVariant(ip: IpAddress): 'warn' | undefined {
  return isAssignedToInterface(ip) ? undefined : 'warn';
}

export function ipDotVariant(ip: IpAddress): 'ok' | 'warn' {
  return isAssignedToInterface(ip) ? 'ok' : 'warn';
}

export function ipCreatedAt(ip: IpAddress): string | undefined {
  const createdAt = ipRow(ip).created_at;
  return typeof createdAt === 'string' && createdAt ? createdAt : undefined;
}

export function isRoutedIp(ip: IpAddress): boolean {
  return Boolean(ipRow(ip).routed);
}

export function parseBoolToken(value: string): boolean | null | undefined {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return undefined;

  if (['1', 'true', 'yes', 'y', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'disabled'].includes(normalized)) return false;
  if (['any', '*', 'all'].includes(normalized)) return undefined;

  return null;
}

export function looksLikeIpish(raw: string): boolean {
  const value = String(raw ?? '').trim();
  if (!value || /\s/.test(value)) return false;
  if (/^(\d{1,3}\.){1,3}\d{1,3}(\/\d{1,3})?$/.test(value)) return true;
  return value.includes(':') && /^[0-9a-fA-F:]+(\/\d{1,3})?$/.test(value);
}

export function canonicalKey(raw: string): IpSmartKey | null {
  const key = String(raw ?? '').trim().toLowerCase();
  if (!key) return null;

  if (key === 'id' || key === '#') return 'id';
  if (['q', 'search', 's', 'text', 'query'].includes(key)) return 'q';
  if (['addr', 'ip', 'address'].includes(key)) return 'addr';
  if (['prefix', 'pfx'].includes(key)) return 'prefix';
  if (['vps', 'vm', 'host'].includes(key)) return 'vps';
  if (['user', 'u', 'owner'].includes(key)) return 'user';
  if (['network', 'net', 'n'].includes(key)) return 'network';
  if (['version', 'ver', 'ipv'].includes(key)) return 'version';
  if (['iface', 'if', 'interface', 'netif'].includes(key)) return 'iface';
  if (['assigned', 'assigned_to_interface'].includes(key)) return 'assigned';
  if (['location', 'loc'].includes(key)) return 'location';
  if (['order', 'sort'].includes(key)) return 'order';

  return null;
}

export function resolveVersionValue(raw: string): 4 | 6 | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return null;
  if (value === '4' || value === 'ipv4') return 4;
  if (value === '6' || value === 'ipv6') return 6;
  return null;
}

export function resolveOrderValue(raw: string): IpListOrder | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return null;
  if (['asc', 'old', 'oldest', 'id_asc'].includes(value)) return 'asc';
  if (['desc', 'new', 'newest', 'id_desc'].includes(value)) return 'desc';
  if (['interface', 'if'].includes(value)) return 'interface';
  return null;
}

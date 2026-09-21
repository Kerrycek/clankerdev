import { useAuth } from './auth';
import { getRuntimeConfig } from './config';
import { isValidTimeZone, SAFE_TIME_ZONE } from '../lib/timeZones';

function validTimeZone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  return isValidTimeZone(candidate) ? candidate : null;
}

/**
 * Resolve the time zone used for account-facing dates and times.
 *
 * An explicit preference on the signed-in account wins. Accounts without a
 * preference inherit the server zone; invalid runtime data fails closed to a
 * stable IANA zone instead of silently adopting the browser zone.
 */
export function resolveAccountTimeZone(
  accountTimeZone: unknown,
  serverTimeZone: unknown
): string {
  return validTimeZone(accountTimeZone) ?? resolveServerTimeZone(serverTimeZone);
}

export function resolveServerTimeZone(serverTimeZone: unknown): string {
  return validTimeZone(serverTimeZone) ?? SAFE_TIME_ZONE;
}

export function useAccountTimeZone(): string {
  const auth = useAuth();
  return resolveAccountTimeZone(auth.user?.time_zone, getRuntimeConfig().serverTimeZone);
}

export function useServerTimeZone(): string {
  return resolveServerTimeZone(getRuntimeConfig().serverTimeZone);
}

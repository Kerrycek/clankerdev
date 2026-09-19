const FALLBACK_TIME_ZONES = [
  'Europe/Prague',
  'Europe/Bratislava',
  'Europe/Berlin',
  'Europe/London',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
];
export const SAFE_TIME_ZONE = 'UTC';
let cachedSupportedTimeZones: string[] | null = null;

export function browserTimeZone(): string | null {
  if (typeof Intl === 'undefined') return null;

  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(zone) ? zone : null;
  } catch {
    return null;
  }
}

function supportedTimeZones(): string[] {
  if (typeof Intl === 'undefined') return FALLBACK_TIME_ZONES;
  if (cachedSupportedTimeZones) return cachedSupportedTimeZones;

  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: 'timeZone') => string[];
  };

  try {
    const zones = typeof intl.supportedValuesOf === 'function'
      ? intl.supportedValuesOf('timeZone')
      : FALLBACK_TIME_ZONES;
    cachedSupportedTimeZones = zones.filter(isValidTimeZone);
    return cachedSupportedTimeZones;
  } catch {
    return FALLBACK_TIME_ZONES;
  }
}

/**
 * Build shared time-zone picker choices. Contextual values stay at
 * the top while every emitted value is a valid IANA identifier.
 */
export function timeZoneOptions(
  current?: string | null,
  server?: string | null,
  browser?: string | null
): Array<{ value: string; label: string }> {
  const pinned = ['Europe/Prague', server, browser, current, 'UTC']
    .filter((zone): zone is string => isValidTimeZone(zone));
  const seen = new Set<string>();

  return [...pinned, ...supportedTimeZones()]
    .filter((zone) => {
      if (seen.has(zone)) return false;
      seen.add(zone);
      return true;
    })
    .map((zone) => ({ value: zone, label: zone }));
}

export function isValidTimeZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || zone.trim() === '') return false;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function offsetMinutes(zone: string, at: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(at);

    const values = new Map(parts.map((part) => [part.type, part.value]));
    const year = Number(values.get('year'));
    const month = Number(values.get('month'));
    const day = Number(values.get('day'));
    const hour = Number(values.get('hour'));
    const minute = Number(values.get('minute'));
    const second = Number(values.get('second'));

    if (![year, month, day, hour, minute, second].every(Number.isFinite)) return null;

    const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    return Math.round((asUtc - at.getTime()) / 60_000);
  } catch {
    return null;
  }
}

export function areEquivalentTimeZones(a: string, b: string): boolean {
  if (a === b) return true;
  if (!isValidTimeZone(a) || !isValidTimeZone(b)) return false;

  const year = new Date().getUTCFullYear();
  const samples = [0, 3, 6, 9].map((month) => new Date(Date.UTC(year, month, 15, 12, 0, 0)));

  return samples.every((sample) => {
    const left = offsetMinutes(a, sample);
    const right = offsetMinutes(b, sample);
    return left !== null && right !== null && left === right;
  });
}

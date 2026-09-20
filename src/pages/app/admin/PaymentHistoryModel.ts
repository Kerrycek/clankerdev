const AVERAGE_MONTH_MS = 2_629_800_000;
const UTC_TIME_ZONE = 'UTC';

interface CalendarDateParts {
  year: number;
  month: number;
  day: number;
}

function utcTimestamp(parts: CalendarDateParts): number {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function nextCalendarDate(parts: CalendarDateParts): CalendarDateParts {
  const date = new Date(utcTimestamp(parts));
  date.setUTCDate(date.getUTCDate() + 1);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function zonedParts(timestamp: number, timeZone: string): CalendarDateParts & {
  hour: number;
  minute: number;
  second: number;
} | undefined {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(timestamp));
    const values = new Map(parts.map((part) => [part.type, part.value]));
    const result = {
      year: Number(values.get('year')),
      month: Number(values.get('month')),
      day: Number(values.get('day')),
      hour: Number(values.get('hour')),
      minute: Number(values.get('minute')),
      second: Number(values.get('second')),
    };
    return Object.values(result).every(Number.isFinite) ? result : undefined;
  } catch {
    return undefined;
  }
}

function zonedStartOfDay(parts: CalendarDateParts, timeZone: string): number | undefined {
  const target = utcTimestamp(parts);
  let candidate = target;

  // IANA offsets can change around the target. Re-evaluate the wall-clock
  // difference until the candidate represents local midnight exactly.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = zonedParts(candidate, timeZone);
    if (!current) return undefined;
    const represented = utcTimestamp(current)
      + current.hour * 3_600_000
      + current.minute * 60_000
      + current.second * 1_000;
    const delta = target - represented;
    candidate += delta;
    if (delta === 0) break;
  }

  const verified = zonedParts(candidate, timeZone);
  if (!verified
    || verified.year !== parts.year
    || verified.month !== parts.month
    || verified.day !== parts.day
    || verified.hour !== 0
    || verified.minute !== 0
    || verified.second !== 0) return undefined;
  return candidate;
}

export function parsePaymentHistoryId(value: string | null | undefined): number | undefined {
  const normalized = String(value ?? '').trim().replace(/^#/, '');
  if (!/^\d+$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

export function paymentHistoryMonths(fromDate: unknown, toDate: unknown): number | undefined {
  if (typeof fromDate !== 'string' || typeof toDate !== 'string') return undefined;
  const from = Date.parse(fromDate);
  const to = Date.parse(toDate);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return undefined;
  return Math.round((to - from) / AVERAGE_MONTH_MS);
}

export function paymentHistoryDateBoundary(
  value: string,
  endOfDay = false,
  timeZone = UTC_TIME_ZONE,
): string | undefined {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  const [yearRaw, monthRaw, dayRaw] = normalized.split('-');
  const dateParts = {
    year: Number(yearRaw),
    month: Number(monthRaw),
    day: Number(dayRaw),
  };
  const parsed = new Date(utcTimestamp(dateParts));
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) return undefined;

  const boundaryParts = endOfDay ? nextCalendarDate(dateParts) : dateParts;
  const boundary = zonedStartOfDay(boundaryParts, timeZone);
  if (boundary === undefined) return undefined;
  return new Date(endOfDay ? boundary - 1 : boundary).toISOString();
}

import { browserTimeZone, isValidTimeZone, SAFE_TIME_ZONE } from '../../../lib/timeZones';

export function formatNodeHistoryTime(value: string | null | undefined, language: string, timeZone?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === 'cs' ? 'cs-CZ' : 'en-GB', {
    timeZone: timeZone && isValidTimeZone(timeZone) ? timeZone : browserTimeZone() ?? SAFE_TIME_ZONE,
  });
}

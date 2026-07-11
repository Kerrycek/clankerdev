/**
 * Utilities for <input type="datetime-local">.
 *
 * The browser control uses the *local* timezone and expects the value format:
 *   YYYY-MM-DDTHH:mm
 *
 * The API uses ISO-8601 timestamps (typically UTC, e.g. "2026-02-17T12:00:00.000Z").
 */

export function isoToLocalInput(iso: unknown): string {
  if (!iso) return '';
  if (typeof iso !== 'string') return '';

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const pad = (n: number): string => String(n).padStart(2, '0');

  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());

  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function localInputToIso(local: unknown): { valid: boolean; iso: string | null; error?: string } {
  const s = typeof local === 'string' ? local.trim() : '';

  // Blank value is valid and means "clear".
  if (!s) return { valid: true, iso: null };

  // The "datetime-local" control returns something like "2026-02-17T14:30".
  // `new Date(local)` parses it as local time.
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return { valid: false, iso: null, error: 'Invalid datetime-local value' };

  return { valid: true, iso: d.toISOString() };
}

export function isoToAdminDateTimeInput(iso: unknown): string {
  const local = isoToLocalInput(iso);
  if (!local) return '';
  return `${local.replace('T', ' ')}:00`;
}

export function dateToAdminDateTimeInput(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';

  const pad = (n: number): string => String(n).padStart(2, '0');

  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const sec = pad(date.getSeconds());

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
}

export function adminDateTimeInputToIso(value: unknown): { valid: boolean; iso: string | null; error?: string } {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return { valid: true, iso: null };

  const normalized = raw
    .replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2})-(\d{2})-(\d{2})$/, '$1T$2:$3:$4')
    .replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?::(\d{2}))?$/, (_m, date, hm, sec) => {
      return `${date}T${hm}:${sec ?? '00'}`;
    });

  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return { valid: false, iso: null, error: 'Invalid admin datetime value' };

  return { valid: true, iso: d.toISOString() };
}

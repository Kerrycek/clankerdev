export function formatMiB(mib: number | undefined | null): string {
  if (mib === undefined || mib === null) return '—';

  // The API commonly uses MiB for memory/swap/diskspace. Format in a human-friendly way.
  if (mib < 1024) return `${mib} MiB`;

  const gib = mib / 1024;
  if (gib < 1024) {
    const fixed = gib >= 10 ? gib.toFixed(0) : gib.toFixed(1);
    return `${fixed} GiB`;
  }

  const tib = gib / 1024;
  return `${tib.toFixed(1)} TiB`;
}

export function formatDateTime(value: string | undefined | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export function formatUptimeSeconds(seconds: number | undefined | null): string {
  if (seconds === undefined || seconds === null) return '—';
  const s = Math.max(0, Math.floor(seconds));

  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${s}s`;
}

/**
 * Backwards-compatible alias.
 *
 * Some pages use `formatDurationSeconds`.
 */
export const formatDurationSeconds = formatUptimeSeconds;

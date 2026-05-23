export function formatBytesIec(bytes: number | undefined | null, opts?: { fallback?: string }): string {
  const fallback = opts?.fallback ?? '—';
  if (bytes === undefined || bytes === null) return fallback;

  const b = Number(bytes);
  if (!Number.isFinite(b)) return fallback;

  const abs = Math.max(0, b);
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];

  let v = abs;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }

  // Dynamic precision: keep readability without noisy decimals.
  const decimals = i === 0 ? 0 : v >= 100 ? 0 : v >= 10 ? 1 : 2;

  return `${v.toFixed(decimals)} ${units[i]}`;
}

/**
 * The legacy API commonly exposes memory values in KiB.
 */
export function formatKib(kib: number | undefined | null, opts?: { fallback?: string }): string {
  if (kib === undefined || kib === null) return opts?.fallback ?? '—';
  const n = Number(kib);
  if (!Number.isFinite(n)) return opts?.fallback ?? '—';
  return formatBytesIec(n * 1024, opts);
}

/**
 * OOM report tasks expose several fields in 4 KiB pages (Linux kernel convention).
 */
export function formatPages4k(pages: number | undefined | null, opts?: { fallback?: string }): string {
  if (pages === undefined || pages === null) return opts?.fallback ?? '—';
  const n = Number(pages);
  if (!Number.isFinite(n)) return opts?.fallback ?? '—';
  return formatBytesIec(n * 4096, opts);
}

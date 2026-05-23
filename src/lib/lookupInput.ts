export function parseLookupIdLike(input: string): number | null {
  const t = String(input ?? '').trim();
  if (!t) return null;
  const m = t.match(/^#?(\d+)$/);
  if (!m || !m[1]) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export function formatLookupId(id: number): string {
  return `#${Math.floor(id)}`;
}

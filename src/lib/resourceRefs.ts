export function refId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);

  if (typeof value === 'string') {
    const n = Number(value.trim());
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
    return undefined;
  }

  if (!value || typeof value !== 'object' || !('id' in value)) return undefined;

  const raw = (value as { id?: unknown }).id;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  if (typeof raw === 'string') {
    const n = Number(raw.trim());
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }

  return undefined;
}

export function matchesRefId(value: unknown, id: number | undefined): boolean {
  if (id === undefined) return true;
  return refId(value) === id;
}

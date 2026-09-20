export const DNS_TTL_MIN = 60;
export const DNS_TTL_MAX = 7 * 24 * 60 * 60;
export const DNS_ZONE_DEFAULT_TTL = 3600;

export type DnsTtlValidationError = 'required' | 'integer' | 'range';

export function validateDnsTtl(
  value: string,
  opts: { required?: boolean } = {}
): DnsTtlValidationError | null {
  const trimmed = value.trim();

  if (!trimmed) return opts.required ? 'required' : null;
  if (!/^\d+$/.test(trimmed)) return 'integer';

  const ttl = Number(trimmed);
  if (!Number.isInteger(ttl) || ttl < DNS_TTL_MIN || ttl > DNS_TTL_MAX) return 'range';

  return null;
}

export function parseOptionalDnsTtl(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : undefined;
}

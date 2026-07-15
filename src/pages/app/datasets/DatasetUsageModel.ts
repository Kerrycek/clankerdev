export interface DatasetUsageBreakdown {
  used: number;
  free: number;
  ratio: number;
}

function nonNegativeNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, value);
}

function positiveNumber(value: unknown): number | undefined {
  const number = nonNegativeNumber(value);
  return number !== undefined && number > 0 ? number : undefined;
}

export function datasetUsageBreakdown(values: {
  used?: number;
  refquota?: number;
  avail?: number;
}): DatasetUsageBreakdown | null {
  const used = nonNegativeNumber(values.used);
  if (used === undefined) return null;

  const refquota = positiveNumber(values.refquota);
  if (refquota !== undefined) {
    return {
      used,
      free: Math.max(0, refquota - used),
      ratio: used / refquota,
    };
  }

  const avail = nonNegativeNumber(values.avail);
  if (avail === undefined) return null;

  const total = used + avail;
  if (total <= 0) return null;

  return {
    used,
    free: avail,
    ratio: used / total,
  };
}

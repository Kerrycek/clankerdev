export function listTranslationKeys(obj: Record<string, unknown>, field: 'summary' | 'description'): string[] {
  const suffix = `_${field}`;
  return Object.keys(obj).filter((k) => k.endsWith(suffix));
}

function listLocalizedFieldKeys(obj: Record<string, unknown>, field: string): string[] {
  const suffix = `_${field}`;
  return Object.keys(obj).filter((k) => k.endsWith(suffix));
}

export function pickLocalizedField(
  obj: Record<string, unknown>,
  field: string,
  preferredLanguageCodes: string[]
): string | undefined {
  const normalizedField = field.trim();
  if (!normalizedField) return undefined;

  for (const code of preferredLanguageCodes) {
    const k = `${code}_${normalizedField}`;
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v;
  }

  // Fallback: first non-empty localized field.
  for (const k of listLocalizedFieldKeys(obj, normalizedField)) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v;
  }

  return undefined;
}

export function pickLocalizedFieldFrom(
  obj: Record<string, unknown>,
  fields: string[],
  preferredLanguageCodes: string[]
): string | undefined {
  for (const field of fields) {
    const value = pickLocalizedField(obj, field, preferredLanguageCodes);
    if (value) return value;
  }

  for (const field of fields) {
    const value = obj[field];
    if (typeof value === 'string' && value.trim()) return value;
  }

  return undefined;
}

export function pickTranslation(
  obj: Record<string, unknown>,
  field: 'summary' | 'description',
  preferredLanguageCodes: string[]
): string | undefined {
  return pickLocalizedField(obj, field, preferredLanguageCodes);
}

export function inferPreferredLanguageCodes(): string[] {
  // Policy: only English and Czech are supported in the UI.
  // English is default unless the browser is natively Czech.

  if (typeof navigator === 'undefined') return ['en', 'cs'];

  const raw = navigator.languages ?? [navigator.language];
  const hasCs = raw
    .filter(Boolean)
    .map((l) => String(l).toLowerCase())
    .some((l) => l === 'cs' || l.startsWith('cs-'));

  return hasCs ? ['cs', 'en'] : ['en', 'cs'];
}

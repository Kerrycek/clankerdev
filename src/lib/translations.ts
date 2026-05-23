export function listTranslationKeys(obj: Record<string, unknown>, field: 'summary' | 'description'): string[] {
  const suffix = `_${field}`;
  return Object.keys(obj).filter((k) => k.endsWith(suffix));
}

export function pickTranslation(
  obj: Record<string, unknown>,
  field: 'summary' | 'description',
  preferredLanguageCodes: string[]
): string | undefined {
  for (const code of preferredLanguageCodes) {
    const k = `${code}_${field}`;
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v;
  }

  // Fallback: first non-empty translation field.
  for (const k of listTranslationKeys(obj, field)) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v;
  }

  return undefined;
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

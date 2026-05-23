export function normalizeDocumentTitleText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function pushUniqueDocumentTitlePart(parts: string[], value: string | null | undefined) {
  const normalized = normalizeDocumentTitleText(value);
  if (!normalized) return;

  const key = normalized.toLocaleLowerCase();
  const exists = parts.some((part) => part.toLocaleLowerCase() === key);
  if (exists) return;

  parts.push(normalized);
}

export function formatDocumentTitle(parts: string[], appName: string, scopeLabel?: string | null): string {
  const cleaned: string[] = [];
  for (const part of parts) {
    pushUniqueDocumentTitlePart(cleaned, part);
  }

  const suffix = scopeLabel ? `${appName} · ${scopeLabel}` : appName;
  return cleaned.length > 0 ? `${cleaned.join(' · ')} · ${suffix}` : suffix;
}

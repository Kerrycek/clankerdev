type Translator = (key: string, vars?: Record<string, unknown>) => string;

function normalizeApiValue(value: unknown): string {
  return String(value ?? '').trim();
}

export function humanizeApiValue(value: unknown): string {
  const raw = normalizeApiValue(value);
  if (!raw) return '';

  const words = raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!words) return raw;

  return words.charAt(0).toLocaleUpperCase() + words.slice(1);
}

export function translatedApiValue(
  t: Translator,
  namespace: string,
  value: unknown,
  opts?: { fallbackKey?: string }
): string {
  const raw = normalizeApiValue(value);
  if (!raw) return opts?.fallbackKey ? t(opts.fallbackKey) : '';

  const key = `api.${namespace}.${raw}`;
  const translated = t(key);
  if (translated !== key) return translated;

  return humanizeApiValue(raw);
}

export function outageTypeLabel(t: Translator, value: unknown): string {
  return translatedApiValue(t, 'outage.type', value, { fallbackKey: 'state.unknown' });
}

export function outageImpactLabel(t: Translator, value: unknown): string {
  return translatedApiValue(t, 'outage.impact', value, { fallbackKey: 'state.unknown' });
}

export function securityAdvisoryStateLabel(t: Translator, value: unknown): string {
  return translatedApiValue(t, 'security_advisory.state', value, { fallbackKey: 'state.unknown' });
}

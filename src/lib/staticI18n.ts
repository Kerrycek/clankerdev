import { dictionaries, type UiLanguage } from '../i18n';

type Vars = Record<string, unknown>;

function normalizePrimaryLangCode(code: string | null | undefined): UiLanguage | null {
  const primary = String(code ?? '')
    .trim()
    .toLowerCase()
    .split('-')[0];

  if (primary === 'cs') return 'cs';
  if (primary === 'en') return 'en';
  return null;
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) return match;
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function detectStaticUiLanguage(doc?: Document | null): UiLanguage {
  const docLang = normalizePrimaryLangCode(doc?.documentElement?.lang);
  if (docLang) return docLang;

  const nav = doc?.defaultView?.navigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);
  const languages = nav ? nav.languages ?? [nav.language] : [];

  const hasCzech = languages
    .filter(Boolean)
    .map((lang) => normalizePrimaryLangCode(String(lang)))
    .includes('cs');

  return hasCzech ? 'cs' : 'en';
}

export function staticT(key: string, vars?: Vars, lang?: UiLanguage): string {
  const resolvedLang = lang ?? detectStaticUiLanguage();
  const dict = dictionaries[resolvedLang] as Record<string, string>;
  const fallback = dictionaries.en as Record<string, string>;
  const raw = dict[key] ?? fallback[key] ?? key;
  return interpolate(raw, vars);
}

export function staticTForDocument(doc: Document | null | undefined, key: string, vars?: Vars): string {
  return staticT(key, vars, detectStaticUiLanguage(doc));
}

export function makeStaticTranslator(lang?: UiLanguage) {
  return (key: string, vars?: Vars) => staticT(String(key), vars, lang);
}

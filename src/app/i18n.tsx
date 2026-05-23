import React, { createContext, useContext, useEffect, useMemo } from 'react';

import { dictionaries, type TranslationKey, type UiLanguage } from '../i18n';
export type { TranslationKey, UiLanguage } from '../i18n';
import { useUiSettings, type UiLanguagePreference } from './uiSettings';

export interface I18nContextValue {
  lang: UiLanguage;
  preference: UiLanguagePreference;
  /**
   * Preferred language codes for backend-provided translations (outages/news).
   *
   * Policy:
   * - English is default.
   * - If system language includes Czech, prefer Czech.
   */
  preferredLanguageCodes: string[];

  t: (key: TranslationKey | string, vars?: Record<string, unknown>) => string;
  /**
   * Pluralization helper.
   *
   * Usage: tc('key.base', 3) will resolve:
   * - key.base.one / few / other depending on locale rules
   */
  tc: (baseKey: string, count: number, vars?: Record<string, unknown>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function normalizeToPrimaryLangCode(code: string): string {
  const lower = code.toLowerCase();
  const primary = lower.split('-')[0];
  return primary || lower;
}

function hasCzechLocale(languages: readonly string[] | undefined): boolean {
  const list = languages && languages.length > 0 ? languages : undefined;
  const raw = list ?? (typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : []);
  return raw.some((l) => normalizeToPrimaryLangCode(String(l || '')) === 'cs');
}

function resolveUiLanguage(pref: UiLanguagePreference): UiLanguage {
  if (pref === 'en' || pref === 'cs') return pref;
  return hasCzechLocale(undefined) ? 'cs' : 'en';
}

function interpolate(template: string, vars?: Record<string, unknown>): string {
  if (!vars) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, k) => {
    if (Object.prototype.hasOwnProperty.call(vars, k)) {
      const v = vars[k];
      return v === undefined || v === null ? '' : String(v);
    }
    return m;
  });
}

export function I18nProvider(props: { children: React.ReactNode }) {
  const ui = useUiSettings();
  const pref = ui.settings.language;
  const lang = resolveUiLanguage(pref);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
  }, [lang]);

  const dict = dictionaries[lang] as Record<string, string>;
  const fallbackDict = dictionaries.en as Record<string, string>;

  const value: I18nContextValue = useMemo(() => {
    const preferredLanguageCodes = lang === 'cs' ? ['cs', 'en'] : ['en', 'cs'];

    const t = (key: TranslationKey | string, vars?: Record<string, unknown>) => {
      const lookupKey = String(key);
      const raw = dict[lookupKey] ?? fallbackDict[lookupKey] ?? lookupKey;
      return interpolate(raw, vars);
    };

    const tc = (baseKey: string, count: number, vars?: Record<string, unknown>) => {
      // We intentionally use Intl rules here, but fall back safely to `other`.
      const rules = new Intl.PluralRules(lang);
      const category = rules.select(count);

      const k1 = `${baseKey}.${category}` as TranslationKey;
      const k2 = `${baseKey}.other` as TranslationKey;

      const chosen = (dict as any)[k1] ?? (dict as any)[k2] ?? (dict as any)[baseKey] ?? (dictionaries.en as any)[k2] ?? (dictionaries.en as any)[baseKey];
      const raw = typeof chosen === 'string' ? chosen : String(baseKey);
      return interpolate(raw, { count, ...(vars ?? {}) });
    };

    return {
      lang,
      preference: pref,
      preferredLanguageCodes,
      t,
      tc,
    };
  }, [dict, lang, pref]);

  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

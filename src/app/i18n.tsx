import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { en } from '../i18n/en';
import { useUiSettings, type UiLanguagePreference } from './uiSettings';

export type UiLanguage = 'en' | 'cs';
export type TranslationKey = keyof typeof en;

type TranslationDictionary = Record<string, string>;

const englishDictionary = en as TranslationDictionary;
let czechDictionaryPromise: Promise<TranslationDictionary> | null = null;

function loadCzechDictionary(): Promise<TranslationDictionary> {
  czechDictionaryPromise ??= import('../i18n/cs').then((mod) => mod.cs as TranslationDictionary);
  return czechDictionaryPromise;
}

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

function lookup(dict: TranslationDictionary, key: string): string | undefined {
  const value = dict[key];
  return typeof value === 'string' ? value : undefined;
}

export function I18nProvider(props: { children: React.ReactNode }) {
  const ui = useUiSettings();
  const pref = ui.settings.language;
  const lang = resolveUiLanguage(pref);
  const [czechDictionary, setCzechDictionary] = useState<TranslationDictionary | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (lang !== 'cs' || czechDictionary) return;

    let cancelled = false;
    loadCzechDictionary()
      .then((dictionary) => {
        if (!cancelled) setCzechDictionary(dictionary);
      })
      .catch(() => {
        if (!cancelled) setCzechDictionary(englishDictionary);
      });

    return () => {
      cancelled = true;
    };
  }, [czechDictionary, lang]);

  const dict = lang === 'cs' ? (czechDictionary ?? englishDictionary) : englishDictionary;
  const fallbackDict = englishDictionary;

  const value: I18nContextValue = useMemo(() => {
    const preferredLanguageCodes = lang === 'cs' ? ['cs', 'en'] : ['en', 'cs'];

    const t = (key: TranslationKey | string, vars?: Record<string, unknown>) => {
      const lookupKey = String(key);
      const raw = lookup(dict, lookupKey) ?? lookup(fallbackDict, lookupKey) ?? lookupKey;
      return interpolate(raw, vars);
    };

    const tc = (baseKey: string, count: number, vars?: Record<string, unknown>) => {
      // We intentionally use Intl rules here, but fall back safely to `other`.
      const rules = new Intl.PluralRules(lang);
      const category = rules.select(count);

      const k1 = `${baseKey}.${category}`;
      const k2 = `${baseKey}.other`;

      const raw =
        lookup(dict, k1) ??
        lookup(dict, k2) ??
        lookup(dict, baseKey) ??
        lookup(fallbackDict, k2) ??
        lookup(fallbackDict, baseKey) ??
        String(baseKey);

      return interpolate(raw, { count, ...(vars ?? {}) });
    };

    return {
      lang,
      preference: pref,
      preferredLanguageCodes,
      t,
      tc,
    };
  }, [dict, fallbackDict, lang, pref]);

  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

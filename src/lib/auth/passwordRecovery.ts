import type { UiLanguage } from '../../app/i18n';

/**
 * Add the selected UI locale without trusting runtime config to provide a safe
 * browser navigation scheme. Relative same-origin and absolute HTTP(S) URLs are
 * supported because production recovery can live on the OAuth provider origin.
 */
export function buildPasswordRecoveryUrl(
  configuredUrl: string | undefined,
  language: UiLanguage,
  browserOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
): string | undefined {
  if (!configuredUrl) return undefined;

  try {
    const url = new URL(configuredUrl, browserOrigin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;

    url.searchParams.set('ui_locales', language);

    if (configuredUrl.startsWith('/')) {
      return `${url.pathname}${url.search}${url.hash}`;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

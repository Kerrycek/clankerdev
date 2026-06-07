import type { Page } from '@playwright/test';
export { expect, test } from '@playwright/test';

import { defaultHaveApiDescription } from './haveapi';

export interface BootstrapVpsAdminOpts {
  apiUrl?: string;
  apiVersion?: string;
  sessionToken?: string;
  /**
   * Provide HaveAPI description on window to avoid description fetch.
   *
   * This should match what `src/lib/api/haveapi.ts` expects.
   */
  description?: unknown;
  /** Optional webuiNext config overrides (e.g. enableDesignSandbox) */
  webuiNext?: Record<string, unknown>;
}

/**
 * Boots the minimal `window.vpsAdmin` runtime config required by the SPA.
 *
 * NOTE: Config uses the integrated-webui shape:
 *   window.vpsAdmin.api.url
 *   window.vpsAdmin.api.version
 */
export async function bootstrapVpsAdminWindow(page: Page, opts?: BootstrapVpsAdminOpts) {
  const apiUrl = opts?.apiUrl ?? '/api';
  const apiVersion = opts?.apiVersion ?? '7.0';
  const sessionToken = opts?.sessionToken ?? 'TEST_SESSION';
  const description = opts?.description ?? defaultHaveApiDescription();
  const webuiNext = opts?.webuiNext ?? {};

  await page.addInitScript(
    ({ apiUrl, apiVersion, sessionToken, description, webuiNext }) => {
      const withPreservedAuth = (nextConfig: Record<string, any>, previousConfig?: Record<string, any>) => {
        let preservedApi = previousConfig?.api ?? nextConfig.api ?? { url: apiUrl, version: apiVersion };
        let preservedSessionToken =
          nextConfig.sessionToken !== undefined ? nextConfig.sessionToken : previousConfig?.sessionToken;
        let preservedAccessToken =
          nextConfig.accessToken !== undefined ? nextConfig.accessToken : previousConfig?.accessToken;

        const mergedConfig = {
          ...nextConfig,
          description: nextConfig.description ?? previousConfig?.description ?? description,
          webuiNext: {
            ...(previousConfig?.webuiNext ?? {}),
            ...(nextConfig.webuiNext ?? webuiNext),
          },
        };

        Object.defineProperty(mergedConfig, 'api', {
          configurable: true,
          enumerable: true,
          get() {
            return preservedApi;
          },
          set(value) {
            if (!preservedApi && value !== undefined) preservedApi = value;
          },
        });

        Object.defineProperty(mergedConfig, 'sessionToken', {
          configurable: true,
          enumerable: true,
          get() {
            return preservedSessionToken;
          },
          set(value) {
            if (value !== undefined) preservedSessionToken = value;
          },
        });

        Object.defineProperty(mergedConfig, 'accessToken', {
          configurable: true,
          enumerable: true,
          get() {
            return preservedAccessToken;
          },
          set(value) {
            if (value !== undefined) preservedAccessToken = value;
          },
        });

        return mergedConfig;
      };

      let currentConfig = withPreservedAuth({
        api: { url: apiUrl, version: apiVersion },
        sessionToken,
        description,
        webuiNext,
      });

      Object.defineProperty(window, 'vpsAdmin', {
        configurable: true,
        enumerable: true,
        get() {
          return currentConfig;
        },
        set(nextConfig) {
          const next = nextConfig && typeof nextConfig === 'object' ? nextConfig : {};
          currentConfig = withPreservedAuth(next, currentConfig);
        },
      });
    },
    { apiUrl, apiVersion, sessionToken, description, webuiNext }
  );
}

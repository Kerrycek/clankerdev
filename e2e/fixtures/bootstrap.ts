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
      (window as any).vpsAdmin = {
        api: { url: apiUrl, version: apiVersion },
        sessionToken,
        description,
        webuiNext,
      };
    },
    { apiUrl, apiVersion, sessionToken, description, webuiNext }
  );
}

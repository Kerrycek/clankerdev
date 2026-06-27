/**
 * Design Sandbox feature flag.
 *
 * The sandbox is an internal component gallery + visual regression surface.
 * It must be disabled by default in production builds.
 */

export function isDesignSandboxEnabled(): boolean {
  // Dev builds always enable the sandbox.
  // (Vite inlines import.meta.env.DEV)
  if (import.meta.env.DEV) return true;

  const envValue = String((import.meta.env as LegacyAny).VITE_ENABLE_DESIGN_SANDBOX ?? '').trim();
  if (envValue === '1' || envValue.toLowerCase() === 'true') return true;

  // Runtime override (useful on staging or in e2e):
  //   window.vpsAdmin.webuiNext.enableDesignSandbox = true
  if (typeof window !== 'undefined') {
    const w = window as LegacyAny;
    const runtime = w?.vpsAdmin?.webuiNext?.enableDesignSandbox;
    if (runtime === true) return true;
  }

  return false;
}

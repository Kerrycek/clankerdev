/**
 * Helper for resolving paths when Playwright's baseURL is configured.
 *
 * `page.goto('/admin/monitoring')` already works with `baseURL`, but having this
 * helper makes the intent explicit and keeps specs consistent.
 */
export function withAppUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (!path.startsWith('/')) return `/${path}`;
  return path;
}

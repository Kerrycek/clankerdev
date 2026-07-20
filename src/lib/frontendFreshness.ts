const MODULE_SCRIPT_RE = /<script\b[^>]*\btype\s*=\s*["']module["'][^>]*>/gi;
const SCRIPT_SRC_RE = /\bsrc\s*=\s*["']([^"']+)["']/i;

export function moduleScriptUrlFromHtml(html: string, baseUrl: string): string | null {
  for (const tag of html.match(MODULE_SCRIPT_RE) ?? []) {
    const src = tag.match(SCRIPT_SRC_RE)?.[1];
    if (!src) continue;

    try {
      return new URL(src, baseUrl).href;
    } catch {
      return null;
    }
  }

  return null;
}

export function currentModuleScriptUrl(doc: Document): string | null {
  const script = Array.from(doc.scripts).find((candidate) => candidate.type === 'module' && candidate.src);
  return script?.src ?? null;
}

export async function frontendBundleChanged(options: {
  currentScriptUrl: string | null;
  indexUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  if (!options.currentScriptUrl) return false;

  const fetchImpl = options.fetchImpl ?? fetch;
  const url = new URL(options.indexUrl);
  url.searchParams.set('__frontend_version', String(Date.now()));

  const response = await fetchImpl(url, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!response.ok) return false;

  const nextScriptUrl = moduleScriptUrlFromHtml(await response.text(), url.href);
  return nextScriptUrl !== null && nextScriptUrl !== options.currentScriptUrl;
}

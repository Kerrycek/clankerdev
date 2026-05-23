export type ParsedQuery = Record<string, unknown>;

/**
 * Parse URLSearchParams into a nested object.
 *
 * Supports bracket notation used by HaveAPI, e.g.:
 * - monitored_event[limit]=50
 * - registration[from_id]=123
 * - foo[bar][baz]=qux
 */
export function parseQueryString(params: URLSearchParams): ParsedQuery {
  const out: Record<string, unknown> = {};

  for (const [rawKey, value] of params.entries()) {
    const parts: string[] = [];

    // Split `a[b][c]` into ['a', 'b', 'c']
    const baseMatch = rawKey.match(/^([^\[]+)(.*)$/);
    if (!baseMatch) continue;

    const base = baseMatch[1];
    if (!base) continue;
    parts.push(base);

    const rest = baseMatch[2] ?? '';
    if (rest) {
      const bracketRe = /\[([^\]]*)\]/g;
      let m: RegExpExecArray | null;
      while ((m = bracketRe.exec(rest)) !== null) {
        const part = m[1];
        if (part) parts.push(part);
      }
    }

    if (parts.length === 0) continue;

    let cur: Record<string, unknown> = out;
    for (let i = 0; i < parts.length; i++) {
      const k = parts[i];
      if (!k) continue;
      const last = i === parts.length - 1;

      if (last) {
        cur[k] = value;
      } else {
        const nextValue = cur[k];
        if (!nextValue || typeof nextValue !== 'object' || Array.isArray(nextValue)) {
          cur[k] = {};
        }
        cur = cur[k] as Record<string, unknown>;
      }
    }
  }

  return out;
}

/**
 * Shared parsing helpers for Smart Filter Input (SFI).
 *
 * Design goals:
 * - Be forgiving: users can type free text, quoted phrases, or key:value pairs.
 * - Keep implementation deterministic and consistent across pages.
 * - Avoid turning quoted tokens into key:value filters.
 */

export interface KeyValueToken {
  rawKey: string;
  rawValue: string;
  /** Backward-compatible aliases used by older pages. */
  key: string;
  value: string;
}

/**
 * Split a raw smart input string into tokens.
 *
 * - Splits on whitespace.
 * - Respects single and double quotes.
 * - Keeps quotes in the output (so the caller can decide how to unquote).
 */
export function tokenizeSmartInput(input: string): string[] {
  const s = String(input ?? '');
  const out: string[] = [];

  let buf = '';
  let quote: '"' | "'" | null = null;

  const push = () => {
    const t = buf.trim();
    if (t) out.push(t);
    buf = '';
  };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i] ?? '';

    if (quote) {
      buf += ch;
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch as '"' | "'";
      buf += ch;
      continue;
    }

    if (/\s/.test(ch)) {
      push();
      continue;
    }

    buf += ch;
  }

  push();
  return out;
}

/**
 * Split a token into `key:value`.
 *
 * Returns null when:
 * - token has no ':'
 * - token starts with a quote (treat as free text)
 * - token starts with ':' (no key)
 */
export function splitKeyValueToken(token: string): KeyValueToken | null {
  const t = String(token ?? '').trim();
  if (!t) return null;

  const first = t[0];
  if (first === '"' || first === "'") return null;

  const idx = t.indexOf(':');
  if (idx <= 0) return null;

  const rawKey = t.slice(0, idx);
  const rawValue = t.slice(idx + 1);

  return { rawKey, rawValue, key: rawKey, value: rawValue };
}

/**
 * Remove wrapping quotes and unescape a couple of common sequences.
 *
 * Keeps the function intentionally conservative – we only handle the
 * minimum needed for UI use (not a full shell parser).
 */
export function unquoteSmartValue(value: string): string {
  const t = String(value ?? '').trim();
  if (!t) return '';

  const first = t[0];
  const last = t[t.length - 1];

  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    const inner = t.slice(1, -1);
    // Minimal unescaping.
    return inner.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  }

  return t;
}

/**
 * Parse a token that should represent an ID.
 *
 * Accepts:
 * - "123"
 * - "#123"
 *
 * Returns null when the token is not a positive integer.
 */
export function parseNumericToken(token: string): number | null {
  const t = String(token ?? '').trim();
  if (!t) return null;

  const m = t.match(/^#?\s*(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

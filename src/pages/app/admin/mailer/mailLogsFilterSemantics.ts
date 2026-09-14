const LEGACY_UNSUPPORTED_FILTER_KEYS = [
  'q',
  'user',
  'template',
  'mail_template',
  'after',
  'before',
  'created_after',
  'created_before',
] as const;

export interface NormalizedLegacyMailLogsUrl {
  changed: boolean;
  href: string;
}

function hrefWithSearch(path: string, searchParams: URLSearchParams): string {
  const search = searchParams.toString();
  return search ? `${path}?${search}` : path;
}

/**
 * Remove filters once advertised by WebUI even though MailLog::Index accepts
 * only limit/from_id. Reset the cursor at the same time so a legacy link cannot
 * present an unrelated page as a filtered result.
 */
export function normalizeLegacyMailLogsUrl(input: {
  basePath: string;
  searchParams: URLSearchParams;
}): NormalizedLegacyMailLogsUrl {
  const path = `${input.basePath}/mailer/log`;
  const changed = LEGACY_UNSUPPORTED_FILTER_KEYS.some((key) => input.searchParams.has(key));

  if (!changed) {
    return {
      changed: false,
      href: hrefWithSearch(path, input.searchParams),
    };
  }

  const normalized = new URLSearchParams(input.searchParams);
  for (const key of LEGACY_UNSUPPORTED_FILTER_KEYS) normalized.delete(key);
  normalized.delete('from_id');
  normalized.delete('page');

  return {
    changed: true,
    href: hrefWithSearch(path, normalized),
  };
}

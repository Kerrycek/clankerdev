import type { UserSession } from '../../lib/api/userDossier';

export type UserSessionStateFilter = 'open' | 'all' | 'closed';

export function isUserSessionStateFilter(value: string | null | undefined): value is UserSessionStateFilter {
  return value === 'open' || value === 'all' || value === 'closed';
}

export function isOpenUserSession(session: UserSession): boolean {
  return !session.closed_at;
}


export function userSessionDisplayLabel(session: UserSession): string {
  const label = String(session.label ?? '').trim();
  return label || `#${session.id}`;
}

export function formatUserSessionPrimaryIp(session: UserSession): string {
  return String(session.api_ip_addr ?? session.client_ip_addr ?? '—');
}

export function looksLikeSessionIpSearch(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!trimmed.includes('.') && !trimmed.includes(':')) return false;
  return /^[0-9a-fA-F:.]+$/.test(trimmed);
}

export function sessionSearchHaystack(session: UserSession): string {
  const parts = [
    String(session.id ?? ''),
    String(session.label ?? ''),
    String(session.auth_type ?? ''),
    String(session.api_ip_addr ?? ''),
    String(session.api_ip_ptr ?? ''),
    String(session.client_ip_addr ?? ''),
    String(session.client_ip_ptr ?? ''),
    String(session.user_agent ?? ''),
    String(session.client_version ?? ''),
    String(session.scope ?? ''),
    String(session.token_fragment ?? ''),
    String(session.token_lifetime ?? ''),
    String(session.token_interval ?? ''),
    String(session.user?.login ?? ''),
    String(session.admin?.login ?? ''),
  ];

  return parts.join(' ').toLowerCase();
}

export function filterUserSessions(
  sessions: readonly UserSession[] | undefined,
  state: UserSessionStateFilter,
  search: string
): UserSession[] {
  const raw = sessions ?? [];
  const byState =
    state === 'open'
      ? raw.filter((session) => isOpenUserSession(session))
      : state === 'closed'
        ? raw.filter((session) => !isOpenUserSession(session))
        : [...raw];

  const needle = search.trim().toLowerCase();
  if (!needle) return byState;
  return byState.filter((session) => sessionSearchHaystack(session).includes(needle));
}

export interface UserSessionSummary {
  total: number;
  open: number;
  closed: number;
  current: number;
  token: number;
  oauth2: number;
  basic: number;
}

export function buildUserSessionSummary(sessions: readonly UserSession[] | undefined): UserSessionSummary {
  const rows = sessions ?? [];
  let open = 0;
  let current = 0;
  let token = 0;
  let oauth2 = 0;
  let basic = 0;

  for (const session of rows) {
    if (isOpenUserSession(session)) open += 1;
    if (session.current) current += 1;

    if (session.auth_type === 'token') token += 1;
    else if (session.auth_type === 'oauth2') oauth2 += 1;
    else if (session.auth_type === 'basic') basic += 1;
  }

  return {
    total: rows.length,
    open,
    closed: rows.length - open,
    current,
    token,
    oauth2,
    basic,
  };
}

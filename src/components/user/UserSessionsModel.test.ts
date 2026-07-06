import { describe, expect, it } from 'vitest';

import type { UserSession } from '../../lib/api/userDossier';

import {
  buildUserSessionSummary,
  formatUserSessionPrimaryIp,
  filterUserSessions,
  isOpenUserSession,
  isUserSessionStateFilter,
  looksLikeSessionIpSearch,
  sessionSearchHaystack,
  userSessionDisplayLabel,
} from './UserSessionsModel';

const sessions: UserSession[] = [
  {
    id: 1,
    label: 'Laptop Firefox',
    auth_type: 'oauth2',
    current: true,
    api_ip_addr: '203.0.113.10',
    user: { id: 1, login: 'alice' },
  },
  {
    id: 2,
    label: 'Deploy token',
    auth_type: 'token',
    token_fragment: 'abc…',
    closed_at: '2026-07-01T10:00:00Z',
    admin: { id: 9, login: 'root' },
  },
  {
    id: 3,
    label: 'Password login',
    auth_type: 'basic',
    client_ip_addr: '198.51.100.20',
  },
];

describe('UserSessionsModel', () => {
  it('normalizes state and IP search inputs', () => {
    expect(isUserSessionStateFilter('open')).toBe(true);
    expect(isUserSessionStateFilter('other')).toBe(false);
    expect(looksLikeSessionIpSearch('203.0.113.10')).toBe(true);
    expect(looksLikeSessionIpSearch('alice')).toBe(false);
  });

  it('filters sessions by state and local haystack', () => {
    expect(isOpenUserSession(sessions[0]!)).toBe(true);
    expect(isOpenUserSession(sessions[1]!)).toBe(false);
    expect(sessionSearchHaystack(sessions[1]!).includes('root')).toBe(true);

    expect(filterUserSessions(sessions, 'open', '').map((s) => s.id)).toEqual([1, 3]);
    expect(filterUserSessions(sessions, 'closed', '').map((s) => s.id)).toEqual([2]);
    expect(filterUserSessions(sessions, 'all', 'deploy').map((s) => s.id)).toEqual([2]);
    expect(userSessionDisplayLabel(sessions[0]!)).toBe('Laptop Firefox');
    expect(userSessionDisplayLabel({ id: 99 })).toBe('#99');
    expect(formatUserSessionPrimaryIp(sessions[0]!)).toBe('203.0.113.10');
    expect(formatUserSessionPrimaryIp({ id: 100 })).toBe('—');
  });

  it('builds session visibility summaries', () => {
    expect(buildUserSessionSummary(sessions)).toEqual({
      total: 3,
      open: 2,
      closed: 1,
      current: 1,
      token: 1,
      oauth2: 1,
      basic: 1,
    });
  });
});

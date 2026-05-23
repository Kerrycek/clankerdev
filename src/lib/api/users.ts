import { roleFromLevel } from '../roles';

import { expectArray, haveApiCall, type HaveApiEnvelope } from './haveapi';

export interface User {
  id: number;
  login: string;
  full_name?: string;
  email?: string;
  address?: string;
  level: number;
  last_activity_at?: string;
  created_at?: string;

  // Payments (plugin)
  monthly_payment?: number;
  paid_until?: string | null;

  // Lifetimes
  object_state?: string;
  expiration_date?: string | null;
  remind_after_date?: string | null;

  // Mailer / localization
  mailer_enabled?: boolean;
  language?: { id: number; code?: string; label?: string } | null;

  [k: string]: unknown;
}

export async function fetchCurrentUser() {
  return haveApiCall<User>({
    method: 'GET',
    path: '/users/current',
  });
}

export interface FetchUsersOpts {
  limit?: number;
  fromId?: number;

  /**
   * Legacy admin list search from the redesign snapshot.
   *
   * Current upstream no longer exposes `q` on `GET /users`, so we emulate it
   * client-side by scanning keyset pages and filtering locally.
   */
  q?: string;

  /**
   * Role filter from the redesign snapshot.
   *
   * Current upstream only exposes `admin=true`; `support`/`user` are derived
   * client-side from `level`.
   */
  role?: 'user' | 'support' | 'admin';

  /** Explicit level filter (admin only). */
  level?: number;

  /** Additional admin filters. */
  mailerEnabled?: boolean;
  lockout?: boolean;
  passwordReset?: boolean;
  enableMfa?: boolean;
  enableOAuth2?: boolean;
  enableTokenAuth?: boolean;
  enableBasicAuth?: boolean;
  enableSingleSignOn?: boolean;
  enableNewLoginNotification?: boolean;
}

interface RawFetchUsersOpts {
  limit?: number;
  fromId?: number;
  level?: number;
  mailerEnabled?: boolean;
  adminOnly?: boolean;
  login?: string;
  fullName?: string;
  email?: string;
  address?: string;
  info?: string;
}

interface UserListResult {
  data: User[];
  meta?: Record<string, unknown>;
  envelope: HaveApiEnvelope;
}

const DEFAULT_LIST_LIMIT = 50;
const COMPAT_SCAN_MAX_ROWS = 1_200;
const COMPAT_SCAN_MAX_BATCHES = 12;

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.floor(limit);
}

function normalizeQueryNeedle(raw: string | undefined): string {
  return String(raw ?? '').trim();
}

function buildCompatScanLimit(limit: number): number {
  return Math.min(Math.max(limit * 4, 100), 250);
}

function getUserFlag(user: User, key: string): boolean | undefined {
  const value = user[key];
  if (typeof value === 'boolean') return value;
  return undefined;
}

function matchesBooleanFilter(value: boolean | undefined, expected: boolean | undefined): boolean {
  if (expected === undefined) return true;
  return value === expected;
}

function matchesRoleFilter(user: User, role: FetchUsersOpts['role']): boolean {
  if (!role) return true;
  return roleFromLevel(user.level) === role;
}

function matchesSearchQuery(user: User, rawNeedle: string): boolean {
  const needle = normalizeQueryNeedle(rawNeedle).toLowerCase();
  if (!needle) return true;

  const exactIdNeedle = needle.startsWith('#') ? needle.slice(1) : needle;
  if (/^\d+$/.test(exactIdNeedle) && user.id === Number(exactIdNeedle)) {
    return true;
  }

  const haystack = [
    user.login,
    user.full_name,
    user.email,
    user.address,
    String(user['info'] ?? ''),
  ]
    .filter((v) => typeof v === 'string' && v.trim())
    .join('\n')
    .toLowerCase();

  return haystack.includes(needle);
}

function matchesCompatFilters(user: User, opts: FetchUsersOpts): boolean {
  return (
    matchesSearchQuery(user, opts.q ?? '') &&
    matchesRoleFilter(user, opts.role) &&
    matchesBooleanFilter(getUserFlag(user, 'lockout'), opts.lockout) &&
    matchesBooleanFilter(getUserFlag(user, 'password_reset'), opts.passwordReset) &&
    matchesBooleanFilter(getUserFlag(user, 'enable_multi_factor_auth'), opts.enableMfa) &&
    matchesBooleanFilter(getUserFlag(user, 'enable_oauth2_auth'), opts.enableOAuth2) &&
    matchesBooleanFilter(getUserFlag(user, 'enable_token_auth'), opts.enableTokenAuth) &&
    matchesBooleanFilter(getUserFlag(user, 'enable_basic_auth'), opts.enableBasicAuth) &&
    matchesBooleanFilter(getUserFlag(user, 'enable_single_sign_on'), opts.enableSingleSignOn) &&
    matchesBooleanFilter(getUserFlag(user, 'enable_new_login_notification'), opts.enableNewLoginNotification)
  );
}

function needsCompatScan(opts: FetchUsersOpts): boolean {
  const q = normalizeQueryNeedle(opts.q);
  const roleNeedsCompat = opts.role === 'support' || opts.role === 'user';

  return Boolean(
    q ||
      roleNeedsCompat ||
      opts.lockout !== undefined ||
      opts.passwordReset !== undefined ||
      opts.enableMfa !== undefined ||
      opts.enableOAuth2 !== undefined ||
      opts.enableTokenAuth !== undefined ||
      opts.enableBasicAuth !== undefined ||
      opts.enableSingleSignOn !== undefined ||
      opts.enableNewLoginNotification !== undefined
  );
}

async function rawFetchUsers(opts?: RawFetchUsersOpts): Promise<UserListResult> {
  const params: Record<string, string | number | boolean> = {};

  if (opts?.limit !== undefined) params['limit'] = opts.limit;
  if (opts?.fromId !== undefined) params['from_id'] = opts.fromId;
  if (opts?.level !== undefined) params['level'] = opts.level;
  if (opts?.mailerEnabled !== undefined) params['mailer_enabled'] = opts.mailerEnabled;
  if (opts?.adminOnly) params['admin'] = true;

  // Supported upstream text filters. These are AND-combined server-side.
  if (opts?.login) params['login'] = opts.login;
  if (opts?.fullName) params['full_name'] = opts.fullName;
  if (opts?.email) params['email'] = opts.email;
  if (opts?.address) params['address'] = opts.address;
  if (opts?.info) params['info'] = opts.info;

  const res = await haveApiCall<User[]>({
    method: 'GET',
    path: '/users',
    namespace: 'user',
    params,
  });

  return { ...res, data: expectArray<User>(res.data, 'users') };
}

export async function fetchUsers(opts?: FetchUsersOpts): Promise<UserListResult> {
  const limit = normalizeLimit(opts?.limit);
  const safeOpts: FetchUsersOpts = {
    limit,
    fromId: opts?.fromId,
    q: normalizeQueryNeedle(opts?.q),
    role: opts?.role,
    level: opts?.level,
    mailerEnabled: opts?.mailerEnabled,
    lockout: opts?.lockout,
    passwordReset: opts?.passwordReset,
    enableMfa: opts?.enableMfa,
    enableOAuth2: opts?.enableOAuth2,
    enableTokenAuth: opts?.enableTokenAuth,
    enableBasicAuth: opts?.enableBasicAuth,
    enableSingleSignOn: opts?.enableSingleSignOn,
    enableNewLoginNotification: opts?.enableNewLoginNotification,
  };

  if (!needsCompatScan(safeOpts)) {
    return rawFetchUsers({
      limit,
      fromId: safeOpts.fromId,
      level: safeOpts.level,
      mailerEnabled: safeOpts.mailerEnabled,
      adminOnly: safeOpts.role === 'admin',
    });
  }

  const data: User[] = [];
  const seen = new Set<number>();

  let cursor = safeOpts.fromId;
  let scanned = 0;
  let batches = 0;
  let lastResult: UserListResult | null = null;

  while (data.length < limit && scanned < COMPAT_SCAN_MAX_ROWS && batches < COMPAT_SCAN_MAX_BATCHES) {
    const remainingScanBudget = COMPAT_SCAN_MAX_ROWS - scanned;
    const batchLimit = Math.max(1, Math.min(buildCompatScanLimit(limit), remainingScanBudget));

    const batch = await rawFetchUsers({
      limit: batchLimit,
      fromId: cursor,
      level: safeOpts.level,
      mailerEnabled: safeOpts.mailerEnabled,
      adminOnly: safeOpts.role === 'admin',
    });

    lastResult = batch;
    batches += 1;

    if (batch.data.length === 0) break;

    scanned += batch.data.length;

    for (const user of batch.data) {
      if (seen.has(user.id)) continue;
      seen.add(user.id);

      if (!matchesCompatFilters(user, safeOpts)) continue;

      data.push(user);
      if (data.length >= limit) break;
    }

    const lastRow = batch.data[batch.data.length - 1];
    if (!lastRow) break;

    cursor = lastRow.id;

    if (batch.data.length < batchLimit) {
      break;
    }
  }

  if (lastResult) {
    return { ...lastResult, data: data.slice(0, limit) };
  }

  return {
    data: [],
    meta: undefined,
    envelope: { status: true, response: { users: [] } },
  };
}

export async function fetchUser(userId: number) {
  return haveApiCall<User>({
    method: 'GET',
    path: `/users/${userId}`,
  });
}

export async function updateUser(userId: number, payload: Record<string, unknown>) {
  return haveApiCall<User>({
    method: 'PUT',
    path: `/users/${userId}`,
    namespace: 'user',
    params: payload,
  });
}

/**
 * Search users by login/full name/email.
 *
 * The backend uses SQL `LIKE`, so this helper automatically wraps the query in
 * `%…%` to support partial matches.
 */
export async function searchUsers(opts: { q: string; limit?: number }) {
  const q = String(opts.q ?? '').trim();
  const limit = typeof opts.limit === 'number' && opts.limit > 0 ? opts.limit : 20;

  if (!q) {
    return { data: [] as User[] };
  }

  const like = `%${q}%`;
  const params: Record<string, string | number | boolean> = { limit };

  // NOTE: the backend combines filters with AND, not OR.
  // We pick the most likely field to keep search intuitive.
  if (q.includes('@')) {
    params['email'] = like;
  } else if (q.includes(' ')) {
    params['full_name'] = like;
  } else {
    params['login'] = like;
  }

  const res = await haveApiCall<User[]>({
    method: 'GET',
    path: '/users',
    namespace: 'user',
    params,
  });

  return { ...res, data: expectArray<User>(res.data, 'users#search') };
}

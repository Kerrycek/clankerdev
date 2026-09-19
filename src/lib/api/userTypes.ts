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
  preferred_session_length?: number | string | null;

  // Mailer / localization
  mailer_enabled?: boolean;
  language?: { id: number; code?: string; label?: string } | null;
  time_zone?: string | null;

  [k: string]: unknown;
}

export interface FetchUsersOpts {
  limit?: number;
  fromId?: number;
  signal?: AbortSignal;
  /** Explicit lifecycle scope; omitted requests default to active users. */
  objectState?: string;
  /** Request an exact total for filters supported directly by HaveAPI. */
  count?: boolean;

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

export interface UserCompatPagination {
  /** Cursor after the last raw user inspected in this bounded scan chunk. */
  nextFromId?: number;
  /** True only when this scan reached the end of the server-side result set. */
  complete: boolean;
  scannedRows: number;
}

export interface CreateUserPayload extends Record<string, unknown> {
  login: string;
  password: string;
  full_name?: string;
  email?: string;
  address?: string;
  level: number;
  info?: string;
  monthly_payment?: number;
  mailer_enabled?: boolean;
}

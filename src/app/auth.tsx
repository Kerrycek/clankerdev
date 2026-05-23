import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getRuntimeConfig } from './config';
import { fetchCurrentUser, type User } from '../lib/api/users';
import { canUseAdminUi, roleFromLevel, type UserRole } from '../lib/roles';
import { HaveApiError } from '../lib/api/haveapi';

export type AuthStatus = 'anonymous' | 'loading' | 'authenticated' | 'forbidden' | 'error';

export interface AuthContextValue {
  status: AuthStatus;
  user?: User;
  role: UserRole;
  canUseAdminUi: boolean;
  error?: unknown;
  loginUrl: string;
  logoutUrl: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function buildLoginUrl(base: string | undefined, nextPath: string): string {
  const root = base ?? '';
  const normalized = root.endsWith('/') ? root.slice(0, -1) : root;
  return `${normalized}/?page=login&next=${encodeURIComponent(nextPath)}`;
}

function buildLogoutUrl(base: string | undefined, nextPath: string): string {
  const root = base ?? '';
  const normalized = root.endsWith('/') ? root.slice(0, -1) : root;
  return `${normalized}/?page=logout&next=${encodeURIComponent(nextPath)}`;
}

function buildEndpointUrl(
  explicitUrl: string | undefined,
  fallbackUrl: string,
  nextPath: string
): string {
  if (!explicitUrl) return fallbackUrl;

  // If the explicit URL is same-origin, we can safely append `next=` so the backend can
  // redirect the user back after login/logout. For cross-origin URLs (e.g. direct auth server
  // authorize endpoint), we do not mutate the query string.
  try {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const u = new URL(explicitUrl, baseOrigin);

    if (u.origin === baseOrigin && !u.searchParams.has('next')) {
      u.searchParams.set('next', nextPath);
    }

    return u.toString();
  } catch {
    return explicitUrl;
  }
}

export function AuthProvider(props: { children: React.ReactNode; nextPath: string }) {
  const cfg = getRuntimeConfig();

  const enabled = cfg.auth.kind !== 'none';

  const q = useQuery({
    queryKey: ['user', 'current'],
    queryFn: async () => (await fetchCurrentUser()).data,
    enabled,
    retry: false,
    staleTime: 60_000,
  });

  const baseUrl = cfg.webuiUrl ?? (typeof window !== 'undefined' ? window.location.origin : undefined);

  const loginUrl = buildEndpointUrl(
    cfg.loginUrl,
    buildLoginUrl(baseUrl, props.nextPath),
    props.nextPath
  );
  const logoutUrl = buildEndpointUrl(
    cfg.logoutUrl,
    buildLogoutUrl(baseUrl, props.nextPath),
    props.nextPath
  );

  const value: AuthContextValue = useMemo(() => {
    if (!enabled) {
      return {
        status: 'anonymous',
        user: undefined,
        role: 'unknown',
        canUseAdminUi: false,
        loginUrl,
        logoutUrl,
      };
    }

    if (q.isLoading) {
      return {
        status: 'loading',
        user: undefined,
        role: 'unknown',
        canUseAdminUi: false,
        loginUrl,
        logoutUrl,
      };
    }

    if (q.isError || !q.data) {
      const err = q.error;

      // Most common case: not signed in (or token expired) → treat as anonymous.
      // We rely on HTTP status which is surfaced on HaveApiError.
      if (err instanceof HaveApiError) {
        if (err.httpStatus === 401) {
          return {
            status: 'anonymous',
            user: undefined,
            role: 'unknown',
            canUseAdminUi: false,
            error: undefined,
            loginUrl,
            logoutUrl,
          };
        }

        if (err.httpStatus === 403) {
          return {
            status: 'forbidden',
            user: undefined,
            role: 'unknown',
            canUseAdminUi: false,
            error: err,
            loginUrl,
            logoutUrl,
          };
        }
      }

      return {
        status: 'error',
        user: undefined,
        role: 'unknown',
        canUseAdminUi: false,
        error: err,
        loginUrl,
        logoutUrl,
      };
    }

    const role = roleFromLevel(q.data.level);

    return {
      status: 'authenticated',
      user: q.data,
      role,
      canUseAdminUi: canUseAdminUi(role),
      loginUrl,
      logoutUrl,
    };
  }, [enabled, q.isLoading, q.isError, q.data, q.error, loginUrl, logoutUrl]);

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

import React, { useEffect, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

import { LoadingState } from '../../../components/ui/LoadingState';
import { parseNumericToken } from '../../../lib/smartFilter';

export function parseTransactionChainSessionId(value: string | null | undefined): number | undefined {
  const parsed = parseNumericToken(value ?? '');
  return parsed !== null && Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function normalizeTransactionChainSessionParams(params: URLSearchParams): URLSearchParams | null {
  const values = params.getAll('user_session');
  if (values.length === 0) return null;

  const sessionId = values.length === 1 ? parseTransactionChainSessionId(values[0]) : undefined;
  const canonical = sessionId === undefined ? null : String(sessionId);
  if (canonical !== null && values[0] === canonical) return null;

  const next = new URLSearchParams(params);
  next.delete('user_session');
  if (canonical !== null) next.set('user_session', canonical);
  next.delete('from_id');
  next.delete('page');
  return next;
}

export function TransactionChainSessionFilterGuard({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const normalized = useMemo(() => normalizeTransactionChainSessionParams(searchParams), [searchParams]);

  useEffect(() => {
    if (normalized) setSearchParams(normalized, { replace: true });
  }, [normalized, setSearchParams]);

  if (normalized) return <LoadingState testId="transactions.chains.normalizing" />;
  return <>{children}</>;
}

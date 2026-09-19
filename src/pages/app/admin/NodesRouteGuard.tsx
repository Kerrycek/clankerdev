import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAppMode } from '../../../app/appMode';
import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';
import { LoadingState } from '../../../components/ui/LoadingState';
import { normalizeLegacyNodesUrl } from './NodesModel';

export function NodesRouteGuard({ children }: { children: ReactNode }) {
  const { basePath } = useAppMode();
  const auth = useAuth();
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const handledSourceRef = useRef<string | null>(null);
  const normalized = useMemo(
    () =>
      normalizeLegacyNodesUrl({
        basePath,
        searchParams: new URLSearchParams(search),
        allowState: auth.role === 'admin',
      }),
    [auth.role, basePath, search]
  );

  useEffect(() => {
    if (!normalized.changed) {
      handledSourceRef.current = null;
      return;
    }

    const source = `${search} -> ${normalized.href}`;
    if (handledSourceRef.current === source) return;
    handledSourceRef.current = source;

    pushToast({
      variant: 'warn',
      title: t('admin.nodes.filters_removed.title'),
      body: t('admin.nodes.filters_removed.body'),
    });
    navigate(normalized.href, { replace: true });
  }, [navigate, normalized, pushToast, search, t]);

  // Keep the list unmounted until the URL reflects the effective API
  // permissions. No request can then look filtered while the server ignores it.
  if (normalized.changed) {
    return <LoadingState testId="admin.nodes.normalizing" />;
  }

  return <>{children}</>;
}

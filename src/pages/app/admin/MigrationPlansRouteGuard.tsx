import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useToasts } from '../../../app/toasts';
import { LoadingState } from '../../../components/ui/LoadingState';
import { normalizeLegacyMigrationPlansUrl } from './migrationPlansFilterSemantics';

export function MigrationPlansRouteGuard({ children }: { children: ReactNode }) {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const handledSourceRef = useRef<string | null>(null);
  const normalized = useMemo(
    () => normalizeLegacyMigrationPlansUrl({ basePath, searchParams: new URLSearchParams(search) }),
    [basePath, search]
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
      title: t('admin.migration_plans.legacy_query_removed.title'),
      body: t('admin.migration_plans.legacy_query_removed.body'),
    });
    navigate(normalized.href, { replace: true });
  }, [navigate, normalized, pushToast, search, t]);

  // Do not mount the query while an unsupported legacy filter is still in the
  // address bar. This prevents an unfiltered request from looking filtered.
  if (normalized.changed) {
    return <LoadingState testId="admin.migration_plans.normalizing" />;
  }

  return <>{children}</>;
}

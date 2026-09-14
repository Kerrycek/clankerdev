import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAppMode } from '../../../../app/appMode';
import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { normalizeLegacyMailLogsUrl } from './mailLogsFilterSemantics';

export function MailLogsRouteGuard({ children }: { children: ReactNode }) {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const handledSourceRef = useRef<string | null>(null);
  const normalized = useMemo(
    () => normalizeLegacyMailLogsUrl({ basePath, searchParams: new URLSearchParams(search) }),
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
      title: t('mailer.log.legacy_filters_removed.title'),
      body: t('mailer.log.legacy_filters_removed.body'),
    });
    navigate(normalized.href, { replace: true });
  }, [navigate, normalized, pushToast, search, t]);

  // Keep the list query unmounted until the address bar reflects the real API
  // contract, otherwise an unfiltered response can look filtered for one frame.
  if (normalized.changed) {
    return <LoadingState testId="admin.mailer.log.normalizing" />;
  }

  return <>{children}</>;
}

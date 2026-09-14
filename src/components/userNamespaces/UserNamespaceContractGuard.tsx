import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';
import type { UserRole } from '../../lib/roles';
import { LoadingState } from '../ui/LoadingState';
import {
  normalizeUserNamespaceUrl,
  type UserNamespaceIndexKind,
} from './userNamespaceFilterSemantics';

export function UserNamespaceContractGuard(props: {
  children: ReactNode;
  fixedOwnerId?: number;
  kind: UserNamespaceIndexKind;
  showAdminFields?: boolean;
  testIdPrefix: string;
  viewerRole: UserRole;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { pushToast } = useToasts();
  const { t } = useI18n();
  const search = searchParams.toString();
  const handledSourceRef = useRef<string | null>(null);
  const normalized = useMemo(
    () =>
      normalizeUserNamespaceUrl({
        kind: props.kind,
        pathname,
        searchParams: new URLSearchParams(search),
        viewerRole: props.viewerRole,
        showAdminFields: props.showAdminFields,
        fixedOwnerId: props.fixedOwnerId,
      }),
    [pathname, props.fixedOwnerId, props.kind, props.showAdminFields, props.viewerRole, search]
  );

  useEffect(() => {
    if (!normalized.changed) {
      handledSourceRef.current = null;
      return;
    }

    const source = `${pathname}?${search} -> ${normalized.href}`;
    if (handledSourceRef.current === source) return;
    handledSourceRef.current = source;

    pushToast({
      variant: 'warn',
      title: t('userns.filters.unsupported_removed.title'),
      body: t('userns.filters.unsupported_removed.body'),
    });
    navigate(normalized.href, { replace: true });
  }, [navigate, normalized, pathname, pushToast, search, t]);

  // Never mount a query against a legacy or unauthorized filter set. The first
  // index request must already match the canonical URL and the viewer's role.
  if (normalized.changed) {
    return <LoadingState testId={`${props.testIdPrefix}.normalizing`} />;
  }

  return <>{props.children}</>;
}

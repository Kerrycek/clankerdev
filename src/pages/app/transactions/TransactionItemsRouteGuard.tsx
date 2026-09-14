import React, { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAppMode } from '../../../app/appMode';
import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import { useObjectScope } from '../../../app/objectScope';
import { useToasts } from '../../../app/toasts';
import { LoadingState } from '../../../components/ui/LoadingState';
import { parsePositiveInt } from '../../../lib/parse';
import { normalizeLegacyTransactionItemsUrl } from './transactionItemSemantics';

export function TransactionItemsRouteGuard({ children }: { children: ReactNode }) {
  const { basePath } = useAppMode();
  const auth = useAuth();
  const scope = useObjectScope();
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handledNavigationRef = useRef<string | null>(null);
  const legacyUrl = useMemo(
    () => normalizeLegacyTransactionItemsUrl({ basePath, searchParams }),
    [basePath, searchParams]
  );

  const chainId = parsePositiveInt(searchParams.get('transaction_chain'));
  const needsMineScopeFallback =
    basePath === '/app' && auth.role === 'admin' && scope.scope === 'mine' && chainId === undefined;
  const redirectMineScope = needsMineScopeFallback && legacyUrl.destination === 'items';
  const navigationHref = redirectMineScope ? `${basePath}/transactions` : legacyUrl.changed ? legacyUrl.href : null;

  useEffect(() => {
    if (!navigationHref) {
      handledNavigationRef.current = null;
      return;
    }

    const source = `${searchParams.toString()} -> ${navigationHref}`;
    if (handledNavigationRef.current === source) return;
    handledNavigationRef.current = source;

    if (legacyUrl.removedQuery) {
      pushToast({
        variant: 'warn',
        title: t('transactions.items.legacy_query_removed.title'),
        body: t('transactions.items.legacy_query_removed.body'),
      });
    }
    if (redirectMineScope) {
      pushToast({
        variant: 'warn',
        title: t('transactions.items.mine_scope_redirect.title'),
        body: t('transactions.items.mine_scope_redirect.body'),
      });
    }
    navigate(navigationHref, { replace: true });
  }, [legacyUrl, navigate, navigationHref, pushToast, redirectMineScope, searchParams, t]);

  // Keep the item list unmounted until unsupported filters or an unsafe admin
  // My-view scope have been redirected, so no unscoped GET can race the guard.
  if (navigationHref) {
    return <LoadingState testId="transactions.items.normalizing" title={t('transactions.items.loading')} />;
  }

  return <>{children}</>;
}

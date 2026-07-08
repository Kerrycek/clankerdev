import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useI18n } from '../../app/i18n';

import { getRuntimeConfig } from '../../app/config';
import { clearStoredOAuthToken } from '../../lib/auth/tokenStore';
import { clearImpersonationState } from '../../lib/auth/impersonation';
import { sanitizeLocalPath, withRouterBasename } from '../../lib/routerPaths';
import { hardReplace } from '../../lib/browserNavigation';
import { Button } from '../../components/ui/Button';
import { CardBody, CardHeader } from '../../components/ui/Card';
import { LinkButton } from '../../components/ui/LinkButton';
import { Spinner } from '../../components/ui/Spinner';
import { DocumentTitleOverride } from '../../components/layout/DocumentTitleOverride';
import { OAuthShell } from './OAuthShell';

export function OAuthLogoutPage() {
  const { t } = useI18n();

  const cfg = useMemo(() => getRuntimeConfig(), []);
  const [params] = useSearchParams();

  const fallbackNext = withRouterBasename('/', cfg.routerBasename);
  const next = sanitizeLocalPath(params.get('next'), fallbackNext);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      clearStoredOAuthToken(cfg.oauth2.storage);

      const storage = typeof window !== 'undefined' ? window.sessionStorage : undefined;
      clearImpersonationState(storage);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }

    // Prefer a hard navigation so any cached app state is reset.
    hardReplace(next);
  }, [cfg.oauth2.storage, next]);

  return (
    <OAuthShell testId="oauth.logout.page" variant={error ? 'error' : 'progress'}>
      <DocumentTitleOverride title={error ? t('oauth.logout.error.title') : t('oauth.logout.progress.signing_out')} />
      {error ? (
        <>
          <CardHeader title={t('oauth.logout.error.title')} />
          <CardBody className="space-y-4">
            <p className="text-sm text-muted">
              {t('oauth.logout.error.body')}
            </p>
            <p className="text-sm text-danger">{error}</p>

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => window.location.reload()}>
                {t('common.retry')}
              </Button>
              <LinkButton to="/" variant="secondary">
                {t('nav.status')}
              </LinkButton>
            </div>
          </CardBody>
        </>
      ) : (
        <CardBody>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner />
            <span>{t('oauth.logout.progress.signing_out')}</span>
          </div>
        </CardBody>
      )}
    </OAuthShell>
  );
}

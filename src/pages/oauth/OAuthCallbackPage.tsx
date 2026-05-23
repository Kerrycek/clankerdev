import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useI18n } from '../../app/i18n';

import { getRuntimeConfig } from '../../app/config';
import { sanitizeLocalPath, withRouterBasename } from '../../lib/routerPaths';
import { hardReplace } from '../../lib/browserNavigation';
import { completeOAuth2Login } from '../../lib/auth/oauth2Client';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { CopyButton } from '../../components/ui/CopyButton';
import { LinkButton } from '../../components/ui/LinkButton';
import { Spinner } from '../../components/ui/Spinner';
import { DocumentTitleOverride } from '../../components/layout/DocumentTitleOverride';

export function OAuthCallbackPage() {
  const { t } = useI18n();

  const cfg = useMemo(() => getRuntimeConfig(), []);
  const [, setSearchParams] = useSearchParams();
  const appPath = withRouterBasename('/app', cfg.routerBasename);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    completeOAuth2Login(cfg, window.location.href)
      .then(({ nextPath }) => {
        if (cancelled) return;

        // Remove OAuth params from URL to avoid leaking `code` or `state` into history.
        setSearchParams({}, { replace: true });

        // Redirect to the next path.
        hardReplace(sanitizeLocalPath(nextPath, appPath));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true;
    };
  }, [appPath, cfg, setSearchParams]);

  const loginHref = `${withRouterBasename('/oauth/login', cfg.routerBasename)}?next=${encodeURIComponent(appPath)}`;
  const copyText = error ? `OAuth callback failed\n\n${error}` : '';

  return (
    <div className="mx-auto max-w-content-sm p-6" data-testid="oauth.callback.page">
      <DocumentTitleOverride title={error ? t('oauth.callback.error.title') : t('oauth.callback.progress.finishing')} />
      <Card>
        {error ? (
          <>
            <CardHeader
              title={t('oauth.callback.error.title')}
              subtitle={t('common.safe_to_share')}
              actions={<CopyButton text={copyText} label={t('common.copy_details')} />}
            />
            <CardBody className="space-y-4">
              <p className="text-sm text-muted">
                {t('oauth.callback.error.body')}
              </p>
              <p className="text-sm text-danger">{error}</p>

              <div className="flex flex-wrap gap-2">
                <Button as="a" href={loginHref} variant="primary">
                  {t('oauth.callback.action.sign_in_again')}
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
              <span>{t('oauth.callback.progress.finishing')}</span>
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
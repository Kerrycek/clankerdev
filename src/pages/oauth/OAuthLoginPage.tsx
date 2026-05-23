import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useI18n } from '../../app/i18n';

import { getRuntimeConfig } from '../../app/config';
import { sanitizeLocalPath, withRouterBasename } from '../../lib/routerPaths';
import { startOAuth2Login } from '../../lib/auth/oauth2Client';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { CopyButton } from '../../components/ui/CopyButton';
import { LinkButton } from '../../components/ui/LinkButton';
import { Spinner } from '../../components/ui/Spinner';
import { DocumentTitleOverride } from '../../components/layout/DocumentTitleOverride';

export function OAuthLoginPage() {
  const { t } = useI18n();

  const cfg = useMemo(() => getRuntimeConfig(), []);
  const [params] = useSearchParams();
  const fallbackNext = withRouterBasename('/app', cfg.routerBasename);
  const next = sanitizeLocalPath(params.get('next'), fallbackNext);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    startOAuth2Login(cfg, next).catch((e) => {
      if (cancelled) return;
      setError(e instanceof Error ? e.message : String(e));
    });

    return () => {
      cancelled = true;
    };
  }, [cfg, next]);

  const copyText = error ? `OAuth login failed\n\nNext: ${next}\n\n${error}` : '';

  return (
    <div className="mx-auto max-w-content-sm p-6" data-testid="oauth.login.page">
      <DocumentTitleOverride title={error ? t('oauth.login.error.title') : t('oauth.login.progress.redirecting')} />
      <Card>
        {error ? (
          <>
            <CardHeader
              title={t('oauth.login.error.title')}
              subtitle={t('common.safe_to_share')}
              actions={<CopyButton text={copyText} label={t('common.copy_details')} />}
            />
            <CardBody className="space-y-4">
              <p className="text-sm text-muted">
                {t('oauth.login.error.body')}
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
              <span>{t('oauth.login.progress.redirecting')}</span>
            </div>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
import React from 'react';
import { useLocation } from 'react-router-dom';

import { useI18n } from '../app/i18n';
import { Card, CardBody } from '../components/ui/Card';
import { LinkButton } from '../components/ui/LinkButton';

export function NotFoundPage(props: { appBasePath?: string }) {
  const { t } = useI18n();
  const loc = useLocation();
  const path = `${loc.pathname}${loc.search}${loc.hash}`;

  const appTo = props.appBasePath ?? '/app';

  return (
    <div className="mx-auto max-w-content-lg p-6" data-testid="notfound.page">
      <Card>
        <CardBody className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold">{t('not_found.title')}</h1>
            <p className="mt-2 text-sm text-muted">
              {t('not_found.body', { path })} <span className="font-mono">{path}</span>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <LinkButton to="/" variant="secondary">
              {t('nav.status')}
            </LinkButton>

            <LinkButton to={appTo} variant="primary">
              {t('not_found.open_app')}
            </LinkButton>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

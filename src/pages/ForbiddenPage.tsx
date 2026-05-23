import React from 'react';
import { useLocation } from 'react-router-dom';

import { useI18n } from '../app/i18n';
import { Card, CardBody } from '../components/ui/Card';
import { LinkButton } from '../components/ui/LinkButton';

export function ForbiddenPage(props: { appBasePath?: string; title?: string; message?: string }) {
  const loc = useLocation();
  const { t } = useI18n();
  const path = `${loc.pathname}${loc.search}${loc.hash}`;

  const title = props.title ?? t('auth.forbidden.title');
  const message = props.message ?? t('error.forbidden.body');

  return (
    <div className="mx-auto max-w-content-lg p-6" data-testid="forbidden.page">
      <Card>
        <CardBody className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="mt-2 text-sm text-muted">{message}</p>
            <p className="mt-2 text-xs text-faint">
              {t('common.requested_path')}: <span className="font-mono">{path}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <LinkButton to="/" variant="secondary">
              {t('auth.action.go_to_status')}
            </LinkButton>
            {props.appBasePath ? (
              <LinkButton to={props.appBasePath} variant="primary">
                {t('auth.action.go_to_app')}
              </LinkButton>
            ) : (
              <LinkButton to="/app" variant="primary">
                {t('not_found.open_app')}
              </LinkButton>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

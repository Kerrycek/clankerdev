import React from 'react';
import { isRouteErrorResponse, useLocation, useRouteError } from 'react-router-dom';

import { useI18n } from '../app/i18n';
import { formatErrorMessage } from '../lib/errors';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { LinkButton } from '../components/ui/LinkButton';

function buildTitle(error: unknown, t: (key: string, vars?: Record<string, unknown>) => string): string {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) return t('not_found.title');
    if (error.status === 403) return t('error.forbidden.title');
    return t('root_error.title.application', { status: error.status });
  }

  return t('root_error.title.unexpected');
}

function buildBody(error: unknown, t: (key: string) => string): string {
  if (isRouteErrorResponse(error)) {
    if (typeof error.statusText === 'string' && error.statusText.trim()) {
      return error.statusText.trim();
    }

    if (typeof error.data === 'string' && error.data.trim()) {
      return error.data.trim();
    }
  }

  return t('root_error.body.default');
}

export function RootErrorPage() {
  const { t } = useI18n();
  const error = useRouteError();
  const location = useLocation();
  const path = `${location.pathname}${location.search}${location.hash}`;
  const details = formatErrorMessage(error);

  return (
    <div className="mx-auto max-w-content-lg p-6" data-testid="root.error.page">
      <Card>
        <CardBody className="space-y-4">
          <div>
            <h1 className="text-xl font-semibold">{buildTitle(error, t)}</h1>
            <p className="mt-2 text-sm text-muted">{buildBody(error, t)}</p>
            <p className="mt-2 text-xs text-faint">
              {t('common.requested_path')}: <span className="font-mono">{path}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => window.location.reload()}>
              {t('common.reload')}
            </Button>
            <LinkButton to="/" variant="secondary">
              {t('auth.action.go_to_status')}
            </LinkButton>
            <LinkButton to="/app" variant="ghost">
              {t('not_found.open_app')}
            </LinkButton>
          </div>

          <details>
            <summary className="cursor-pointer text-sm font-medium text-fg">{t('common.technical_details')}</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-border bg-surface-2 p-3 text-xs text-fg">
              {details}
            </pre>
          </details>
        </CardBody>
      </Card>
    </div>
  );
}

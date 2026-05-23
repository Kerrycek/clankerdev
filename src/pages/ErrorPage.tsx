import React from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

import { useI18n } from '../app/i18n';
import { ErrorState } from '../components/ui/ErrorState';
import { DocumentTitleOverride } from '../components/layout/DocumentTitleOverride';
import { ForbiddenPage } from './ForbiddenPage';
import { NotFoundPage } from './NotFoundPage';

export function ErrorPage() {
  const error = useRouteError();
  const { t } = useI18n();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) return <NotFoundPage />;
    if (error.status === 403) return <ForbiddenPage />;
  }

  return (
    <div className="mx-auto max-w-content-lg p-6" data-testid="error.page">
      <DocumentTitleOverride title={t('common.error')} />
      <ErrorState error={error} testId="error.state" showBack={false} />
    </div>
  );
}

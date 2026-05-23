import React from 'react';
import { useI18n } from '../../app/i18n';
import { Card, CardBody } from '../ui/Card';
import { LinkButton } from '../ui/LinkButton';

export function ScopeMismatchCard(props: {
  /** Human label shown to the user, e.g. "VPS" / "Dataset" / "DNS zone" */
  objectKind: string;
  /** Optional object label, e.g. hostname */
  objectLabel?: string;
  /** Optional owner id to show as a hint */
  ownerUserId?: number;
  /** Link to open the same object in admin view */
  adminHref: string;
  /** Where to send the user back (usually list) */
  backHref: string;
  testId?: string;
}) {
  const { t } = useI18n();

  return (
    <Card testId={props.testId ?? 'scope.mismatch'}>
      <CardBody className="space-y-3">
        <div>
          <div className="text-sm font-semibold">{t('scope.mismatch.title')}</div>
          <p className="mt-1 text-sm text-muted">
            {t('scope.mismatch.body', {
              object: props.objectKind,
              label: props.objectLabel ? `“${props.objectLabel}”` : '',
            })}
          </p>

          {props.ownerUserId !== undefined ? (
            <p className="mt-2 text-xs text-faint">
              {t('scope.mismatch.owner_hint', { id: props.ownerUserId })}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <LinkButton to={props.adminHref} variant="primary" testId="scope.mismatch.open-admin">
            {t('scope.mismatch.open_admin')}
          </LinkButton>
          <LinkButton to={props.backHref} variant="secondary" testId="scope.mismatch.back">
            {t('common.back')}
          </LinkButton>
        </div>
      </CardBody>
    </Card>
  );
}

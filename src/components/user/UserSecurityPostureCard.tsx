import React from 'react';

import { useI18n } from '../../app/i18n';
import type { User } from '../../lib/api/users';

import { Badge } from '../ui/Badge';
import { Card, CardBody, CardHeader } from '../ui/Card';

import { buildUserSecurityPosture, type SecurityPostureTone, type UserSecurityVariant } from './UserSecurityModel';

function itemToneClasses(tone: SecurityPostureTone): string {
  switch (tone) {
    case 'danger':
      return 'border-danger-border bg-danger-row';
    case 'warn':
      return 'border-warn-border bg-warn-row';
    case 'ok':
      return 'border-ok-border bg-ok-bg';
    default:
      return 'border-border bg-surface-2';
  }
}

export function UserSecurityPostureCard(props: {
  user?: User;
  variant: UserSecurityVariant;
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const posture = buildUserSecurityPosture(props.user, props.variant);
  const prefix = props.testIdPrefix;

  return (
    <Card testId={`${prefix}.posture.card`}>
      <CardHeader
        title={t('security.posture.title')}
        subtitle={t('security.posture.subtitle')}
        actions={<Badge variant={posture.badgeTone}>{t(posture.badgeKey)}</Badge>}
      />
      <CardBody>
        <div className="space-y-4">
          <div className="text-sm text-muted" data-testid={`${prefix}.posture.summary`}>
            {t(posture.summaryKey, posture.summaryVars)}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {posture.items.map((item) => (
              <div
                key={item.key}
                data-testid={`${prefix}.posture.item.${item.key}`}
                className={`rounded-md border p-3 ${itemToneClasses(item.tone)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-fg">{t(item.labelKey)}</div>
                    <div className="mt-1 text-xs leading-5 text-muted">{t(item.descriptionKey)}</div>
                  </div>

                  <Badge variant={item.tone} className="shrink-0">
                    {t(item.valueKey, item.valueVars)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

import React from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  advisoryCveLabels,
  fetchSecurityAdvisoriesWithCves,
  type SecurityAdvisory,
} from '../../lib/api/securityAdvisories';
import { useI18n } from '../../app/i18n';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { formatDateTime } from '../../lib/time';
import { pickTranslation } from '../../lib/translations';

const PUBLIC_SECURITY_ADVISORIES_LIMIT = 100;

function countLabel(value: unknown) {
  return typeof value === 'number' ? String(value) : '—';
}

function SecurityAdvisoryRow(props: { advisory: SecurityAdvisory }) {
  const i18n = useI18n();
  const advisory = props.advisory;
  const cves = advisoryCveLabels(advisory);
  const summary = pickTranslation(advisory, 'summary', i18n.preferredLanguageCodes);
  const description = pickTranslation(advisory, 'description', i18n.preferredLanguageCodes);
  const title = advisory.name || i18n.t('public.security_advisories.fallback_title', { id: advisory.id });

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={`${i18n.t('public.security_advisories.published')}: ${formatDateTime(advisory.published_at)}`}
        actions={<Badge variant={advisory.state === 'published' ? 'ok' : 'neutral'}>{advisory.state ?? '—'}</Badge>}
      />
      <CardBody>
        <div className="space-y-3">
          {cves.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {cves.map((cve) => (
                <Badge key={cve} variant="info">
                  {cve}
                </Badge>
              ))}
            </div>
          ) : null}

          {summary ? <p className="text-sm text-fg">{summary}</p> : null}
          {description && description !== summary ? <p className="text-sm text-muted">{description}</p> : null}

          <dl className="grid gap-2 text-xs text-muted sm:grid-cols-3">
            <div>
              <dt className="font-medium text-fg">{i18n.t('public.security_advisories.affected_users')}</dt>
              <dd>{countLabel(advisory.affected_user_count)}</dd>
            </div>
            <div>
              <dt className="font-medium text-fg">{i18n.t('public.security_advisories.affected_vps')}</dt>
              <dd>{countLabel(advisory.affected_vps_count)}</dd>
            </div>
            <div>
              <dt className="font-medium text-fg">{i18n.t('public.security_advisories.affected_nodes')}</dt>
              <dd>{countLabel(advisory.affected_node_count)}</dd>
            </div>
          </dl>
        </div>
      </CardBody>
    </Card>
  );
}

export function SecurityAdvisoriesPage() {
  const i18n = useI18n();
  const advisoriesQ = useQuery({
    queryKey: ['public', 'security_advisories', { limit: PUBLIC_SECURITY_ADVISORIES_LIMIT }],
    queryFn: async () =>
      (
        await fetchSecurityAdvisoriesWithCves({
          limit: PUBLIC_SECURITY_ADVISORIES_LIMIT,
          state: 'published',
          order: 'newest',
        })
      ).data,
  });

  return (
    <div className="space-y-6" data-testid="public.security_advisories.page">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{i18n.t('public.security_advisories.title')}</h1>
        <p className="text-sm text-muted">{i18n.t('public.security_advisories.subtitle')}</p>
      </div>

      {advisoriesQ.isLoading ? (
        <Spinner label={i18n.t('public.security_advisories.loading')} />
      ) : advisoriesQ.isError ? (
        <Alert title={i18n.t('public.security_advisories.error')} variant="danger" />
      ) : (advisoriesQ.data?.length ?? 0) === 0 ? (
        <Alert title={i18n.t('public.security_advisories.empty.title')} variant="info">
          {i18n.t('public.security_advisories.empty.body')}
        </Alert>
      ) : (
        <div className="space-y-4">
          {advisoriesQ.data?.map((advisory) => (
            <SecurityAdvisoryRow key={advisory.id} advisory={advisory} />
          ))}
        </div>
      )}
    </div>
  );
}

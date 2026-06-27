import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import {
  advisoryCveLabels,
  fetchSecurityAdvisoriesWithCves,
  type SecurityAdvisory,
} from '../../lib/api/securityAdvisories';
import { formatDateTime } from '../../lib/time';
import { pickTranslation } from '../../lib/translations';

function advisoryState(advisory: SecurityAdvisory, t: ReturnType<typeof useI18n>['t']) {
  const state = String(advisory.state ?? '').trim();
  if (state === 'published') return { variant: 'ok' as const, label: t('public.security.state.published') };
  if (state === 'retracted') return { variant: 'warn' as const, label: t('public.security.state.retracted') };
  return { variant: 'neutral' as const, label: state || t('state.unknown') };
}

function pickAdvisoryResponse(advisory: SecurityAdvisory, preferredLanguageCodes: string[]) {
  for (const lang of preferredLanguageCodes) {
    const value = (advisory as Record<string, unknown>)[`${lang}_response`];
    if (typeof value === 'string' && value.trim()) return value;
  }

  const fallback = (advisory as Record<string, unknown>)['en_response'] ?? (advisory as Record<string, unknown>)['cs_response'];
  return typeof fallback === 'string' && fallback.trim() ? fallback : undefined;
}

export function SecurityAdvisoryRow(props: { advisory: SecurityAdvisory; compact?: boolean }) {
  const i18n = useI18n();
  const advisory = props.advisory;
  const summary = pickTranslation(advisory, 'summary', i18n.preferredLanguageCodes);
  const description = pickTranslation(advisory, 'description', i18n.preferredLanguageCodes);
  const response = pickAdvisoryResponse(advisory, i18n.preferredLanguageCodes);
  const cves = advisoryCveLabels(advisory);
  const state = advisoryState(advisory, i18n.t);
  const title = advisory.name || i18n.t('public.security.fallback_title', { id: advisory.id });

  return (
    <article className="rounded-lg border border-border bg-surface-2 p-4" data-testid="public.security.item">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <Badge variant={state.variant}>{state.label}</Badge>
        {advisory.affected === false ? <Badge variant="neutral">{i18n.t('public.security.not_currently_affected')}</Badge> : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>{i18n.t('public.security.published')}: {formatDateTime(advisory.published_at ?? advisory.created_at)}</span>
        {typeof advisory.affected_node_count === 'number' ? (
          <span>· {i18n.t('public.security.affected_nodes', { count: advisory.affected_node_count })}</span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {cves.length > 0 ? (
          cves.slice(0, props.compact ? 4 : 12).map((cve) => (
            <a
              key={cve}
              href={`https://www.cve.org/CVERecord?id=${encodeURIComponent(cve)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex"
            >
              <Badge variant="info">{cve}</Badge>
            </a>
          ))
        ) : (
          <Badge variant="neutral">{i18n.t('public.security.no_cves')}</Badge>
        )}
        {props.compact && cves.length > 4 ? <span className="text-xs text-muted">{i18n.t('common.more_n', { count: cves.length - 4 })}</span> : null}
      </div>

      {summary ? <p className="mt-3 text-sm text-fg">{summary}</p> : null}
      {!props.compact && description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
      {!props.compact && response ? (
        <p className="mt-2 text-sm text-muted">
          <span className="font-medium text-fg">{i18n.t('public.security.response')}:</span> {response}
        </p>
      ) : null}
    </article>
  );
}

export function SecurityAdvisoriesPage() {
  const i18n = useI18n();
  const advisoriesQ = useQuery({
    queryKey: ['security_advisories', 'public', 'published'],
    queryFn: async () => (
      await fetchSecurityAdvisoriesWithCves({
        limit: 50,
        state: 'published',
        order: 'newest',
      })
    ).data,
  });

  return (
    <div className="space-y-6" data-testid="public.security.page">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{i18n.t('public.security.title')}</h1>
        <p className="mt-1 text-sm text-muted">{i18n.t('public.security.subtitle')}</p>
      </div>

      <Card>
        <CardHeader title={i18n.t('public.security.list_title')} subtitle={i18n.t('public.security.list_subtitle')} />
        <CardBody>
          {advisoriesQ.isLoading ? (
            <Spinner label={i18n.t('public.security.loading')} />
          ) : advisoriesQ.isError ? (
            <Alert title={i18n.t('public.security.error')} variant="danger" />
          ) : (advisoriesQ.data?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted">{i18n.t('public.security.empty')}</div>
          ) : (
            <div className="space-y-3">
              {advisoriesQ.data?.map((advisory) => <SecurityAdvisoryRow key={advisory.id} advisory={advisory} />)}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default SecurityAdvisoriesPage;

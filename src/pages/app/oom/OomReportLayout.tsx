import React, { useMemo } from 'react';
import { Outlet, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { PageContainer } from '../../../components/layout/PageContainer';
import { fetchOomReport, type OomReport } from '../../../lib/api/oom';
import { formatDateTime } from '../../../lib/format';

import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ChipLink } from '../../../components/ui/ChipLink';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ObjectHeader } from '../../../components/ui/ObjectHeader';
import { TabsNav } from '../../../components/ui/TabsNav';

export type OomReportOutletContext = {
  report: OomReport;
};

function ruleVariant(action?: string): 'neutral' | 'warn' {
  if (action === 'ignore') return 'neutral';
  return 'warn';
}

function ruleLabelKey(action?: string): string {
  if (action === 'ignore') return 'oom.rule.ignore';
  if (action === 'notify') return 'oom.rule.notify';
  return 'oom.rule.implicit';
}

export function OomReportLayout() {
  const { oomReportId } = useParams();
  const id = Number(oomReportId);

  const { basePath, mode } = useAppMode();
  const { t } = useI18n();
  const loc = useLocation();

  const includes = mode === 'admin' ? 'vps__node,vps__user,oom_report_rule' : 'vps__node,oom_report_rule';

  const q = useQuery({
    queryKey: ['oom_reports', 'show', id, { scope: basePath }],
    queryFn: async () => (await fetchOomReport(id, { includes })).data,
    enabled: Number.isFinite(id) && id > 0,
  });

  const r = q.data;

  const meta = useMemo(() => {
    if (!r) return null;

    const createdAt = r.created_at ? formatDateTime(r.created_at) : t('common.na');

    const vpsIdRow = (r.vps as LegacyAny)?.id ? Number((r.vps as LegacyAny).id) : undefined;
    const vpsHost = (r.vps as LegacyAny)?.hostname ? String((r.vps as LegacyAny).hostname) : undefined;

    const nodeName = (r.vps as LegacyAny)?.node?.domain_name ? String((r.vps as LegacyAny).node.domain_name) : undefined;

    const killed = r.killed_name ? `${r.killed_name}${r.killed_pid ? ` (${r.killed_pid})` : ''}` : '—';
    const invoked = r.invoked_by_name ? `${r.invoked_by_name}${r.invoked_by_pid ? ` (${r.invoked_by_pid})` : ''}` : '—';

    const count = typeof r.count === 'number' ? r.count : undefined;

    return (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted">{t('oom.field.created_at')}:</span>
        <span>{createdAt}</span>

        {vpsIdRow ? (
          <ChipLink to={`${basePath}/vps/${vpsIdRow}`}>{vpsHost || `#${vpsIdRow}`}</ChipLink>
        ) : null}

        {nodeName ? <span className="text-faint">· {nodeName}</span> : null}

        {r.cgroup ? <span className="font-mono text-xs">{String(r.cgroup)}</span> : null}

        <span className="text-faint">
          {t('oom.field.killed')}: <span className="font-medium text-text">{killed}</span>
        </span>

        <span className="text-faint">
          {t('oom.field.invoked_by')}: <span className="font-medium text-text">{invoked}</span>
        </span>

        {count !== undefined ? (
          <span className="text-faint">
            {t('oom.field.count')}: <span className="font-mono text-xs">{count}</span>
          </span>
        ) : null}
      </div>
    );
  }, [basePath, r, t]);

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <PageContainer testId="oom.detail.invalid">
        <ErrorState title={t('oom.detail.invalid_id')} body={t('error.not_found.body')} showBack />
      </PageContainer>
    );
  }

  if (q.isLoading) {
    return (
      <PageContainer testId="oom.detail.loading">
        <LoadingState />
      </PageContainer>
    );
  }

  if (q.isError || !r) {
    return (
      <PageContainer testId="oom.detail.error">
        <ErrorState title={t('oom.detail.load_error')} error={q.error} onRetry={() => void q.refetch()} showBack />
      </PageContainer>
    );
  }

  const action = (r.oom_report_rule as LegacyAny)?.action ? String((r.oom_report_rule as LegacyAny).action) : undefined;

  const vpsIdRow = (r.vps as LegacyAny)?.id ? Number((r.vps as LegacyAny).id) : undefined;

  const tabs = [
    { label: t('oom.detail.tab.overview'), to: `${basePath}/oom-reports/${id}` },
    { label: t('oom.detail.tab.stats'), to: `${basePath}/oom-reports/${id}/stats` },
    { label: t('oom.detail.tab.tasks'), to: `${basePath}/oom-reports/${id}/tasks` },
  ];

  const titleAfter = <Badge variant={ruleVariant(action)}>{t(ruleLabelKey(action))}</Badge>;

  return (
    <PageContainer testId="oom.detail">
      <ObjectHeader
        kicker={{ label: t('oom.list.title'), href: `${basePath}/oom-reports` }}
        title={t('oom.detail.title', { id })}
        titleAfter={titleAfter}
        meta={meta}
        actions={
          vpsIdRow ? (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" to={`${basePath}/vps/${vpsIdRow}`} testId="oom.detail.open_vps">
                {t('common.open_vps')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                to={`${basePath}/oom-reports/rules/${vpsIdRow}`}
                testId="oom.detail.rules"
              >
                {t('oom.detail.configure_rules')}
              </Button>
            </div>
          ) : null
        }
        testId="oom.detail.header"
      />

      <div className="mt-3">
        <TabsNav
          tabs={tabs.map((tab) => ({
            label: tab.label,
            to: tab.to,
            active: loc.pathname === tab.to,
          }))}
          testId="oom.detail.tabs"
        />
      </div>

      <div className="mt-4">
        <Outlet context={{ report: r } as OomReportOutletContext} />
      </div>
    </PageContainer>
  );
}

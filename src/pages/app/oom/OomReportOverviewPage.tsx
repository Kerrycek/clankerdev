import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { fetchOomReportUsages, type OomReportUsage } from '../../../lib/api/oom';
import type { OomReportOutletContext } from './OomReportLayout';
import { formatDateTime } from '../../../lib/format';
import { formatKib } from '../../../lib/bytes';

import { Badge } from '../../../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';

function ruleVariant(action?: string): 'neutral' | 'warn' {
  if (action === 'ignore') return 'neutral';
  return 'warn';
}

function ruleLabelKey(action?: string): string {
  if (action === 'ignore') return 'oom.rule.ignore';
  if (action === 'notify') return 'oom.rule.notify';
  return 'oom.rule.implicit';
}

export function OomReportOverviewPage() {
  const { report } = useOutletContext<OomReportOutletContext>();
  const { basePath } = useAppMode();
  const { t } = useI18n();

  const usagesQ = useQuery({
    queryKey: ['oom_reports', report.id, 'usages', { scope: basePath }],
    queryFn: async () => (await fetchOomReportUsages(report.id, { limit: 50 })).data,
  });

  const action = (report.oom_report_rule as LegacyAny)?.action ? String((report.oom_report_rule as LegacyAny).action) : undefined;

  const ruleMeta = useMemo(() => {
    const rule = report.oom_report_rule as LegacyAny;
    if (!rule) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant={ruleVariant(undefined)}>{t(ruleLabelKey(undefined))}</Badge>
          <span className="text-xs text-faint">{t('oom.rule.implicit_hint')}</span>
        </div>
      );
    }

    const ruleId = rule.id ? Number(rule.id) : undefined;
    const pat = rule.cgroup_pattern ? String(rule.cgroup_pattern) : undefined;

    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={ruleVariant(action)}>{t(ruleLabelKey(action))}</Badge>
        {ruleId ? <span className="font-mono text-xs">#{ruleId}</span> : null}
        {pat ? <span className="font-mono text-xs">{pat}</span> : null}
      </div>
    );
  }, [action, report.oom_report_rule, t]);

  return (
    <div className="grid grid-cols-1 gap-4">
      <Card testId="oom.detail.overview.summary">
        <CardHeader title={t('oom.detail.overview.summary_title')} />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="text-xs text-muted">{t('oom.field.cgroup')}</div>
              <div className="mt-0.5 font-mono text-xs">{report.cgroup ? String(report.cgroup) : '—'}</div>
            </div>

            <div>
              <div className="text-xs text-muted">{t('oom.field.rule_action')}</div>
              <div className="mt-0.5">{ruleMeta}</div>
            </div>

            <div>
              <div className="text-xs text-muted">{t('oom.field.killed')}</div>
              <div className="mt-0.5 text-sm">
                {report.killed_name ? String(report.killed_name) : '—'}
                {report.killed_pid ? <span className="ml-1 font-mono text-xs">({report.killed_pid})</span> : null}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted">{t('oom.field.invoked_by')}</div>
              <div className="mt-0.5 text-sm">
                {report.invoked_by_name ? String(report.invoked_by_name) : '—'}
                {report.invoked_by_pid ? <span className="ml-1 font-mono text-xs">({report.invoked_by_pid})</span> : null}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted">{t('oom.field.count')}</div>
              <div className="mt-0.5 font-mono text-xs">{typeof report.count === 'number' ? report.count : '—'}</div>
            </div>

            <div>
              <div className="text-xs text-muted">{t('oom.field.reported_at')}</div>
              <div className="mt-0.5 text-sm">{report.reported_at ? formatDateTime(report.reported_at) : t('common.na')}</div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card testId="oom.detail.overview.usages">
        <CardHeader title={t('oom.detail.overview.usages_title')} subtitle={t('oom.detail.overview.usages_subtitle')} />
        <CardBody>
          {usagesQ.isLoading ? (
            <LoadingState />
          ) : usagesQ.isError ? (
            <ErrorState title={t('oom.detail.overview.usages_error')} error={usagesQ.error} onRetry={() => void usagesQ.refetch()} />
          ) : (usagesQ.data ?? []).length === 0 ? (
            <div className="text-sm text-muted">{t('oom.detail.overview.usages_empty')}</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="min-w-full text-sm" data-testid="oom.detail.overview.usages.table">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-4 py-2">{t('oom.usage.memtype')}</th>
                    <th className="px-4 py-2">{t('oom.usage.usage')}</th>
                    <th className="px-4 py-2">{t('oom.usage.limit')}</th>
                    <th className="px-4 py-2">{t('oom.usage.failcnt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(usagesQ.data ?? []).map((u: OomReportUsage) => (
                    <tr key={u.id} className="border-b border-border/50 last:border-b-0">
                      <td className="px-4 py-2 font-mono text-xs">{u.memtype ? String(u.memtype) : '—'}</td>
                      <td className="px-4 py-2 font-mono text-xs">{formatKib(u.usage)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{formatKib(u.limit)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{typeof u.failcnt === 'number' ? u.failcnt : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

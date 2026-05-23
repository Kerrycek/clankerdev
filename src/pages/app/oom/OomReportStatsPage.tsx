import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { fetchOomReportStats, type OomReportStat } from '../../../lib/api/oom';
import type { OomReportOutletContext } from './OomReportLayout';

import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';

export function OomReportStatsPage() {
  const { report } = useOutletContext<OomReportOutletContext>();
  const { basePath } = useAppMode();
  const { t } = useI18n();

  const statsQ = useQuery({
    queryKey: ['oom_reports', report.id, 'stats', { scope: basePath }],
    queryFn: async () => (await fetchOomReportStats(report.id, { limit: 1000 })).data,
  });

  return (
    <Card testId="oom.detail.stats">
      <CardHeader title={t('oom.detail.stats.title')} subtitle={t('oom.detail.stats.subtitle')} />
      <CardBody>
        {statsQ.isLoading ? (
          <LoadingState />
        ) : statsQ.isError ? (
          <ErrorState title={t('oom.detail.stats.error')} error={statsQ.error} onRetry={() => void statsQ.refetch()} />
        ) : (statsQ.data ?? []).length === 0 ? (
          <div className="text-sm text-muted">{t('oom.detail.stats.empty')}</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="min-w-full text-sm" data-testid="oom.detail.stats.table">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-2">{t('oom.stat.parameter')}</th>
                  <th className="px-4 py-2">{t('oom.stat.value')}</th>
                </tr>
              </thead>
              <tbody>
                {(statsQ.data ?? []).map((s: OomReportStat) => (
                  <tr key={s.id} className="border-b border-border/50 last:border-b-0">
                    <td className="px-4 py-2 font-mono text-xs">{s.parameter ? String(s.parameter) : '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{typeof s.value === 'number' ? s.value : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

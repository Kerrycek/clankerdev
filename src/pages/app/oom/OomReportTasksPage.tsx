import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { fetchOomReportTasks, type OomReportTask } from '../../../lib/api/oom';
import type { OomReportOutletContext } from './OomReportLayout';
import { formatBytesIec, formatPages4k } from '../../../lib/bytes';

import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';

export function OomReportTasksPage() {
  const { report } = useOutletContext<OomReportOutletContext>();
  const { basePath } = useAppMode();
  const { t } = useI18n();

  const tasksQ = useQuery({
    queryKey: ['oom_reports', report.id, 'tasks', { scope: basePath }],
    queryFn: async () => (await fetchOomReportTasks(report.id, { limit: 2000 })).data,
  });

  return (
    <Card testId="oom.detail.tasks">
      <CardHeader title={t('oom.detail.tasks.title')} subtitle={t('oom.detail.tasks.subtitle')} />
      <CardBody>
        {tasksQ.isLoading ? (
          <LoadingState />
        ) : tasksQ.isError ? (
          <ErrorState title={t('oom.detail.tasks.error')} error={tasksQ.error} onRetry={() => void tasksQ.refetch()} />
        ) : (tasksQ.data ?? []).length === 0 ? (
          <div className="text-sm text-muted">{t('oom.detail.tasks.empty')}</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="min-w-full text-sm" data-testid="oom.detail.tasks.table">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-2">{t('oom.task.name')}</th>
                  <th className="px-4 py-2">{t('oom.task.host_pid')}</th>
                  <th className="px-4 py-2">{t('oom.task.vps_pid')}</th>
                  <th className="px-4 py-2">{t('oom.task.vps_uid')}</th>
                  <th className="px-4 py-2">{t('oom.task.tgid')}</th>
                  <th className="px-4 py-2">{t('oom.task.total_vm')}</th>
                  <th className="px-4 py-2">{t('oom.task.rss')}</th>
                  <th className="px-4 py-2">{t('oom.task.pgtables_bytes')}</th>
                  <th className="px-4 py-2">{t('oom.task.swap')}</th>
                  <th className="px-4 py-2">{t('oom.task.oom_score_adj')}</th>
                </tr>
              </thead>
              <tbody>
                {(tasksQ.data ?? []).map((p: OomReportTask) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-b-0">
                    <td className="px-4 py-2 font-mono text-xs">{p.name ? String(p.name) : '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{typeof p.host_pid === 'number' ? p.host_pid : '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{typeof p.vps_pid === 'number' ? p.vps_pid : '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{typeof p.vps_uid === 'number' ? p.vps_uid : '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{typeof p.tgid === 'number' ? p.tgid : '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs">{formatPages4k(p.total_vm)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{formatPages4k(p.rss)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{formatBytesIec(p.pgtables_bytes)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{formatPages4k(p.swapents)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{typeof p.oom_score_adj === 'number' ? p.oom_score_adj : '—'}</td>
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

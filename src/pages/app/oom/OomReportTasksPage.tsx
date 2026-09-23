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

function MobileCellLabel(props: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium text-faint @4xl:hidden" data-oom-task-label>
      {props.children}
    </span>
  );
}

export function OomReportTasksPage() {
  const { report } = useOutletContext<OomReportOutletContext>();
  const { basePath } = useAppMode();
  const { t } = useI18n();

  const tasksQ = useQuery({
    queryKey: ['oom_reports', report.id, 'tasks', { scope: basePath }],
    queryFn: async () => (await fetchOomReportTasks(report.id, { limit: 2000 })).data,
  });

  return (
    <Card className="@container" testId="oom.detail.tasks">
      <CardHeader title={t('oom.detail.tasks.title')} subtitle={t('oom.detail.tasks.subtitle')} />
      <CardBody>
        {tasksQ.isLoading ? (
          <LoadingState />
        ) : tasksQ.isError ? (
          <ErrorState title={t('oom.detail.tasks.error')} error={tasksQ.error} onRetry={() => void tasksQ.refetch()} />
        ) : (tasksQ.data ?? []).length === 0 ? (
          <div className="text-sm text-muted">{t('oom.detail.tasks.empty')}</div>
        ) : (
          <div
            className="overflow-x-auto rounded-lg border border-border bg-surface"
            data-testid="oom.detail.tasks.table.scroller"
          >
            <table className="block w-full text-sm @4xl:table @4xl:min-w-full" data-testid="oom.detail.tasks.table">
              <thead className="hidden @4xl:table-header-group">
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
              <tbody className="block @4xl:table-row-group">
                {(tasksQ.data ?? []).map((p: OomReportTask) => (
                  <tr
                    key={p.id}
                    className="block border-b border-border/50 last:border-b-0 @4xl:table-row"
                    data-testid={`oom.detail.tasks.row.${p.id}`}
                  >
                    <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @4xl:table-cell @4xl:px-4">
                      <MobileCellLabel>{t('oom.task.name')}</MobileCellLabel>
                      <span className="min-w-0 break-all font-mono text-xs" data-oom-task-value>
                        {p.name ? String(p.name) : '—'}
                      </span>
                    </td>
                    <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @4xl:table-cell @4xl:px-4">
                      <MobileCellLabel>{t('oom.task.host_pid')}</MobileCellLabel>
                      <span className="min-w-0 break-all font-mono text-xs" data-oom-task-value>
                        {typeof p.host_pid === 'number' ? p.host_pid : '—'}
                      </span>
                    </td>
                    <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @4xl:table-cell @4xl:px-4">
                      <MobileCellLabel>{t('oom.task.vps_pid')}</MobileCellLabel>
                      <span className="min-w-0 break-all font-mono text-xs" data-oom-task-value>
                        {typeof p.vps_pid === 'number' ? p.vps_pid : '—'}
                      </span>
                    </td>
                    <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @4xl:table-cell @4xl:px-4">
                      <MobileCellLabel>{t('oom.task.vps_uid')}</MobileCellLabel>
                      <span className="min-w-0 break-all font-mono text-xs" data-oom-task-value>
                        {typeof p.vps_uid === 'number' ? p.vps_uid : '—'}
                      </span>
                    </td>
                    <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @4xl:table-cell @4xl:px-4">
                      <MobileCellLabel>{t('oom.task.tgid')}</MobileCellLabel>
                      <span className="min-w-0 break-all font-mono text-xs" data-oom-task-value>
                        {typeof p.tgid === 'number' ? p.tgid : '—'}
                      </span>
                    </td>
                    <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @4xl:table-cell @4xl:px-4">
                      <MobileCellLabel>{t('oom.task.total_vm')}</MobileCellLabel>
                      <span className="min-w-0 break-all font-mono text-xs" data-oom-task-value>
                        {formatPages4k(p.total_vm)}
                      </span>
                    </td>
                    <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @4xl:table-cell @4xl:px-4">
                      <MobileCellLabel>{t('oom.task.rss')}</MobileCellLabel>
                      <span className="min-w-0 break-all font-mono text-xs" data-oom-task-value>
                        {formatPages4k(p.rss)}
                      </span>
                    </td>
                    <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @4xl:table-cell @4xl:px-4">
                      <MobileCellLabel>{t('oom.task.pgtables_bytes')}</MobileCellLabel>
                      <span className="min-w-0 break-all font-mono text-xs" data-oom-task-value>
                        {formatBytesIec(p.pgtables_bytes)}
                      </span>
                    </td>
                    <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @4xl:table-cell @4xl:px-4">
                      <MobileCellLabel>{t('oom.task.swap')}</MobileCellLabel>
                      <span className="min-w-0 break-all font-mono text-xs" data-oom-task-value>
                        {formatPages4k(p.swapents)}
                      </span>
                    </td>
                    <td className="grid min-w-0 grid-cols-[minmax(6rem,0.38fr)_minmax(0,1fr)] items-start gap-3 px-3 py-2 @4xl:table-cell @4xl:px-4">
                      <MobileCellLabel>{t('oom.task.oom_score_adj')}</MobileCellLabel>
                      <span className="min-w-0 break-all font-mono text-xs" data-oom-task-value>
                        {typeof p.oom_score_adj === 'number' ? p.oom_score_adj : '—'}
                      </span>
                    </td>
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

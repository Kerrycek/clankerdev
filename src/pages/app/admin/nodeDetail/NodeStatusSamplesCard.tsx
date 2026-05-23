import React from 'react';
import type { NodeStatus } from '../../../../lib/api/nodes';
import { formatDateTime, formatMiB } from '../../../../lib/format';
import { Alert } from '../../../../components/ui/Alert';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { Spinner } from '../../../../components/ui/Spinner';
import { formatErrorMessage } from '../../../../lib/errors';
import { fmtLoad, fmtPercent } from './nodeDetailSemantics';

export function NodeStatusSamplesCard(props: {
  t: (key: any, params?: Record<string, unknown>) => string;
  nodeId: number;
  statusRows: NodeStatus[];
  loading: boolean;
  error: unknown;
  fetching: boolean;
  onRefresh: () => void;
  page: number;
  pageCount: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoToPage: (page: number) => void;
  limit: number;
  allowedLimits: readonly number[];
  onLimitChange: (limit: number) => void;
}) {
  const {
    t,
    nodeId,
    statusRows,
    loading,
    error,
    fetching,
    onRefresh,
    page,
    pageCount,
    canPrev,
    canNext,
    onPrev,
    onNext,
    onGoToPage,
    limit,
    allowedLimits,
    onLimitChange,
  } = props;

  return (
    <Card testId="admin.node.statuses.list">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{t('admin.node.status_samples.title')}</div>
            <div className="mt-1 text-sm text-muted">
              {t('admin.node.status_samples.subtitle_prefix', { limit })} <code>{`nodes/${nodeId}/statuses`}</code>.
            </div>
          </div>
          <Button testId="admin.node.statuses.refresh" variant="secondary" size="sm" onClick={onRefresh} disabled={fetching}>
            {t('common.refresh')}
          </Button>
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Spinner /> {t('common.loading')}
          </div>
        ) : error ? (
          <Alert title={t('common.failed')} variant="danger">
            {formatErrorMessage(error)}
          </Alert>
        ) : statusRows.length === 0 ? (
          <div className="mt-4 text-sm text-muted">{t('admin.node.status_samples.empty')}</div>
        ) : (
          <>
            <div className="mt-4 space-y-3 md:hidden">
              {statusRows.map((s) => (
                <div key={s.id} className="rounded-md border border-border bg-surface-2 p-3" data-testid={`admin.node.statuses.card.${s.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium">{formatDateTime(s.created_at)}</div>
                    <div className="text-xs text-faint">#{s.id}</div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted">{t('admin.node.status_samples.field.load1')}</div>
                      <div>{fmtLoad(s.loadavg1)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">{t('admin.node.status_samples.field.cpu_idle')}</div>
                      <div>{fmtPercent(s.cpu_idle)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">{t('admin.node.status_samples.field.used_mem')}</div>
                      <div>{formatMiB(s.used_memory)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">{t('admin.node.status_samples.field.arc_hit')}</div>
                      <div>{fmtPercent(s.arc_hitpercent)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 hidden overflow-x-auto md:block" data-testid="admin.node.statuses.table">
              <table className="min-w-full text-sm table-list">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-3 py-2">{t('common.time')}</th>
                    <th className="px-3 py-2">{t('admin.node.status_samples.field.load1')}</th>
                    <th className="px-3 py-2">{t('admin.node.status_samples.field.cpu_idle')}</th>
                    <th className="px-3 py-2">{t('admin.node.status_samples.field.used_mem')}</th>
                    <th className="px-3 py-2">{t('admin.node.status_samples.field.arc_hit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {statusRows.map((s) => (
                    <tr key={s.id} className="border-b border-border/60 last:border-b-0" data-testid={`admin.node.statuses.row.${s.id}`}>
                      <td className="px-3 py-2 text-xs text-muted">{formatDateTime(s.created_at)}</td>
                      <td className="px-3 py-2 text-xs text-muted">{fmtLoad(s.loadavg1)}</td>
                      <td className="px-3 py-2 text-xs text-muted">{fmtPercent(s.cpu_idle)}</td>
                      <td className="px-3 py-2 text-xs text-muted">{formatMiB(s.used_memory)}</td>
                      <td className="px-3 py-2 text-xs text-muted">{fmtPercent(s.arc_hitpercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {!loading && !error ? (
        <KeysetPagination
          page={page}
          pageCount={pageCount}
          canPrev={canPrev}
          canNext={canNext}
          onPrev={onPrev}
          onNext={onNext}
          onGoToPage={onGoToPage}
          limit={limit}
          allowedLimits={allowedLimits}
          onLimitChange={onLimitChange}
          testId="admin.node.statuses.pagination"
        />
      ) : null}
    </Card>
  );
}

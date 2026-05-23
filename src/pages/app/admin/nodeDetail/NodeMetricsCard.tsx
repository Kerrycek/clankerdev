import React from 'react';
import type { Node, NodeStatus } from '../../../../lib/api/nodes';
import { formatMiB } from '../../../../lib/format';
import { Alert } from '../../../../components/ui/Alert';
import { Button } from '../../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../../components/ui/Card';
import { Spinner } from '../../../../components/ui/Spinner';
import { TimeSeriesChart } from '../../../../components/ui/TimeSeriesChart';
import { formatErrorMessage } from '../../../../lib/errors';
import type { MetricsWindow } from './nodeDetailSemantics';
import { safePercent } from './nodeDetailSemantics';

export function NodeMetricsCard(props: {
  t: (key: any, params?: Record<string, unknown>) => string;
  metricsWindow: MetricsWindow;
  setMetricsWindow: (w: MetricsWindow) => void;
  metricsRows: NodeStatus[];
  metricsLast?: NodeStatus;
  node: Node;
  metricsLoading: boolean;
  metricsError: unknown;
  load1Points: Array<{ x: string; y: number }>;
  cpuIdlePoints: Array<{ x: string; y: number }>;
  memUsedPercentPoints: Array<{ x: string; y: number }>;
}) {
  const {
    t,
    metricsWindow,
    setMetricsWindow,
    metricsRows,
    metricsLast,
    node,
    metricsLoading,
    metricsError,
    load1Points,
    cpuIdlePoints,
    memUsedPercentPoints,
  } = props;

  return (
    <Card testId="admin.node.metrics.card">
      <CardHeader
        title={t('admin.node.metrics.title')}
        subtitle={t('admin.node.metrics.subtitle', { window: metricsWindow, samples: metricsRows.length })}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              {(['6h', '24h', '7d'] as const).map((w) => (
                <Button
                  key={w}
                  testId={`admin.node.metrics.window.${w}`}
                  size="sm"
                  variant={metricsWindow === w ? 'primary' : 'secondary'}
                  onClick={() => setMetricsWindow(w)}
                >
                  {w}
                </Button>
              ))}
            </div>
          </div>
        }
      />

      <CardBody>
        {metricsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> {t('common.loading')}
          </div>
        ) : metricsError ? (
          <Alert title={t('admin.node.metrics.load_error.title')} variant="danger">
            {formatErrorMessage(metricsError)}
          </Alert>
        ) : metricsRows.length === 0 ? (
          <div className="text-sm text-muted">{t('admin.node.metrics.empty')}</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" data-testid="admin.node.metrics.grid">
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-sm font-medium">{t('admin.node.metrics.chart.load1.title')}</div>
                <div className="text-xs text-muted">{typeof metricsLast?.loadavg1 === 'number' ? metricsLast.loadavg1.toFixed(2) : '—'}</div>
              </div>
              <TimeSeriesChart
                testId="admin.node.metrics.chart.load1"
                ariaLabel={t('admin.node.metrics.chart.load1.aria', { window: metricsWindow })}
                points={load1Points}
                variant="cpu"
                formatValue={(n) => n.toFixed(2)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-sm font-medium">{t('admin.node.metrics.chart.cpu_idle.title')}</div>
                <div className="text-xs text-muted">
                  {typeof metricsLast?.cpu_idle === 'number' && Number.isFinite(metricsLast.cpu_idle)
                    ? `${metricsLast.cpu_idle}%`
                    : '—'}
                </div>
              </div>
              <TimeSeriesChart
                testId="admin.node.metrics.chart.cpu_idle"
                ariaLabel={t('admin.node.metrics.chart.cpu_idle.aria', { window: metricsWindow })}
                points={cpuIdlePoints}
                variant="cpu"
                yMin={0}
                yMax={100}
                formatValue={(n) => `${n.toFixed(1)}%`}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-sm font-medium">{t('admin.node.metrics.chart.mem_used.title')}</div>
                <div className="text-xs text-muted">
                  {(() => {
                    const used = metricsLast?.used_memory;
                    const total = metricsLast?.total_memory ?? node.total_memory;
                    const totalOk = typeof total === 'number' && Number.isFinite(total);
                    const p = safePercent(used, total);

                    return (
                      <>
                        {formatMiB(used)}
                        {totalOk ? (
                          <>
                            {' '}/ {formatMiB(total)}
                          </>
                        ) : null}
                        {p != null ? ` (${p.toFixed(1)}%)` : ''}
                      </>
                    );
                  })()}
                </div>
              </div>
              <TimeSeriesChart
                testId="admin.node.metrics.chart.mem_used"
                ariaLabel={t('admin.node.metrics.chart.mem_used.aria', { window: metricsWindow })}
                points={memUsedPercentPoints}
                variant="memory"
                yMin={0}
                yMax={100}
                thresholds={[
                  { value: 90, label: '90%', variant: 'warn' },
                  { value: 98, label: '98%', variant: 'danger' },
                ]}
                formatValue={(n) => `${n.toFixed(1)}%`}
              />
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

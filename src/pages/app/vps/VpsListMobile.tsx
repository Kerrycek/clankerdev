import React from 'react';
import { Link } from 'react-router-dom';
import { Play, RotateCw, Square } from 'lucide-react';

import type { KeysetPaginationState } from '../../../lib/hooks/useKeysetPagination';
import { formatMiB, formatUptimeSeconds } from '../../../lib/format';

import { ActionButton } from '../../../components/ui/ActionButton';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { LockBadge } from '../../../components/ui/LockBadge';
import { StatusDot } from '../../../components/ui/StatusDot';
import { toneSurfaceClass } from '../../../components/ui/tone';
import { UsageBar } from '../../../components/ui/UsageBar';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';

import type { VpsListRecord, VpsListTranslator } from './vpsListSemantics';

interface VpsListMobileProps {
  rows: VpsListRecord[];
  basePath: string;
  t: VpsListTranslator;
  pagination: KeysetPaginationState;
  canPaginate: boolean;
  hasMore: boolean;
  pageCursor: number | null;
  onStart: (row: VpsListRecord) => void;
  onRequestStop: (row: VpsListRecord) => void;
  onRequestRestart: (row: VpsListRecord) => void;
}

export function VpsListMobile({
  rows,
  basePath,
  t,
  pagination,
  canPaginate,
  hasMore,
  pageCursor,
  onStart,
  onRequestStop,
  onRequestRestart,
}: VpsListMobileProps) {
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => {
          const { vps } = row;
          return (
            <Card key={vps.id} testId={`vps.card.${vps.id}`} className={toneSurfaceClass(row.rowVariant)}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusDot variant={row.dotVariant} testId={`vps.card.${vps.id}.dot`} ariaLabel={row.runtimeBadge.label} />
                      <Link to={`${basePath}/vps/${vps.id}`} className="text-base font-semibold text-fg underline">
                        {vps.hostname}
                      </Link>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      {t('common.id')} {vps.id}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={row.runtimeBadge.variant}>{row.runtimeBadge.label}</Badge>
                    <Badge variant={row.objectBadge.variant}>{row.objectBadge.label}</Badge>
                    {row.memoryRisk ? <Badge variant={row.memoryRisk}>{t('vps.list.state.ram_high')}</Badge> : null}
                    {row.diskRisk ? <Badge variant={row.diskRisk}>{t('vps.list.state.disk_high')}</Badge> : null}
                    {row.busyTx ? (
                      <LockBadge kind="transaction" t={t} chainIds={row.busyChains} showDetails />
                    ) : row.busyLocalLock ? (
                      <LockBadge kind="local" t={t} />
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted">{t('common.node')}</div>
                    <div className="truncate">{row.nodeLabel}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">{t('vps.overview.config.memory')}</div>
                    <div>{formatMiB(vps.memory)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">{t('vps.overview.config.diskspace')}</div>
                    <div>{formatMiB(vps.diskspace)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">{t('vps.overview.usage.uptime')}</div>
                    <div>{formatUptimeSeconds(vps.uptime)}</div>
                  </div>
                </div>

                {(row.memUsed !== undefined && row.memMax !== undefined && row.memMax > 0) ||
                (row.diskUsed !== undefined && row.diskMax !== undefined && row.diskMax > 0) ? (
                  <div className="mt-3 space-y-2 text-xs text-muted">
                    {row.memUsed !== undefined && row.memMax !== undefined && row.memMax > 0 ? (
                      <UsageBar label={t('vps.list.usage.ram')} used={row.memUsed} max={row.memMax} formatValue={formatMiB} />
                    ) : null}

                    {row.diskUsed !== undefined && row.diskMax !== undefined && row.diskMax > 0 ? (
                      <UsageBar label={t('vps.list.usage.disk')} used={row.diskUsed} max={row.diskMax} formatValue={formatMiB} />
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 flex items-center gap-2">
                  <Link to={`${basePath}/vps/${vps.id}/console`} className="text-sm font-medium text-fg underline">
                    {t('vps.tabs.console')}
                  </Link>
                  <span className="text-faint">·</span>
                  <ActionButton
                    variant="ok"
                    size="sm"
                    disabled={!row.startGate.allowed}
                    disabledReason={!row.startGate.allowed ? row.startGate.reason : undefined}
                    loading={row.inFlightKind === 'start'}
                    ariaLabel={t('vps.power.aria.start')}
                    title={t('action.vps.start.label')}
                    onClick={() => onStart(row)}
                  >
                    <Play className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton
                    variant="warn"
                    size="sm"
                    disabled={!row.restartGate.allowed}
                    disabledReason={!row.restartGate.allowed ? row.restartGate.reason : undefined}
                    loading={row.inFlightKind === 'restart'}
                    ariaLabel={t('vps.power.aria.restart')}
                    title={t('action.vps.restart.label')}
                    onClick={() => onRequestRestart(row)}
                  >
                    <RotateCw className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton
                    variant="danger"
                    size="sm"
                    disabled={!row.stopGate.allowed}
                    disabledReason={!row.stopGate.allowed ? row.stopGate.reason : undefined}
                    loading={row.inFlightKind === 'stop'}
                    ariaLabel={t('vps.power.aria.stop')}
                    title={t('action.vps.stop.label')}
                    onClick={() => onRequestStop(row)}
                  >
                    <Square className="h-4 w-4" />
                  </ActionButton>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {canPaginate ? (
        <div className="md:hidden">
          <KeysetPagination
            page={pagination.page}
            pageCount={pagination.stack.length}
            canPrev={pagination.canPrev}
            canNext={hasMore}
            onPrev={pagination.goPrev}
            onNext={() => pagination.goNext(pageCursor)}
            onGoToPage={pagination.goToPage}
            limit={pagination.limit}
            allowedLimits={pagination.allowedLimits}
            onLimitChange={pagination.setLimit}
            testId="vps.pagination.mobile"
          />
        </div>
      ) : null}
    </>
  );
}

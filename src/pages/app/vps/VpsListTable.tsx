import React from 'react';
import { Link } from 'react-router-dom';
import { Play, RotateCw, Square, Trash2 } from 'lucide-react';

import type { KeysetPaginationState } from '../../../lib/hooks/useKeysetPagination';
import { formatMiB, formatUptimeSeconds } from '../../../lib/format';

import { ActionButton } from '../../../components/ui/ActionButton';
import { Badge } from '../../../components/ui/Badge';
import { KeysetPagination } from '../../../components/ui/KeysetPagination';
import { LockBadge } from '../../../components/ui/LockBadge';
import { StatusDot } from '../../../components/ui/StatusDot';
import { TableCard } from '../../../components/ui/TableCard';
import { TableRowLink } from '../../../components/ui/TableRowLink';
import { UsageBar } from '../../../components/ui/UsageBar';

import type { VpsListRecord, VpsListTranslator } from './vpsListSemantics';

interface VpsListTableProps {
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
  onRequestDelete: (row: VpsListRecord) => void;
}

export function VpsListTable({
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
  onRequestDelete,
}: VpsListTableProps) {
  return (
    <TableCard
      className="hidden md:block"
      minWidth="xl"
      tableTestId="vps.table"
      footer={
        canPaginate ? (
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
            testId="vps.pagination.desktop"
          />
        ) : null
      }
    >
      <thead>
        <tr className="border-b border-border text-left text-xs text-muted">
          <th className="w-8 px-4 py-2"><span className="sr-only">{t('common.state')}</span></th>
          <th className="px-4 py-2">{t('common.id')}</th>
          <th className="px-4 py-2">{t('common.hostname')}</th>
          <th className="px-4 py-2">{t('common.state')}</th>
          <th className="px-4 py-2">{t('common.node')}</th>
          <th className="px-4 py-2">{t('vps.overview.resources.title')}</th>
          <th className="px-4 py-2">{t('vps.overview.usage.uptime')}</th>
          <th className="px-4 py-2">{t('common.actions')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const { vps } = row;
          return (
            <TableRowLink
              key={vps.id}
              testId={`vps.row.${vps.id}`}
              to={`${basePath}/vps/${vps.id}`}
              variant={row.rowVariant}
              className="border-b border-border/60 last:border-b-0"
            >
              <td className="px-4 py-2 align-top">
                <StatusDot variant={row.dotVariant} testId={`vps.row.${vps.id}.dot`} ariaLabel={row.runtimeBadge.label} />
              </td>
              <td className="px-4 py-2 align-top text-xs text-muted">{vps.id}</td>
              <td className="px-4 py-2 align-top">
                <Link to={`${basePath}/vps/${vps.id}`} className="font-medium text-fg underline">
                  {vps.hostname}
                </Link>
              </td>
              <td className="px-4 py-2 align-top">
                <div className="flex flex-wrap items-center gap-2" data-testid={`vps.row.${vps.id}.state`}>
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
              </td>
              <td className="px-4 py-2 align-top">{row.nodeLabel}</td>
              <td className="px-4 py-2 align-top text-xs text-muted">
                <div className="flex flex-col gap-1">
                  <div className="text-faint">
                    {vps.cpu ? t('vps.list.resources.cpu', { count: vps.cpu }) : t('common.na')} ·{' '}
                    {t('vps.list.resources.load', { value: row.loadLabel })}
                  </div>
                  {row.memUsed !== undefined && row.memMax !== undefined && row.memMax > 0 ? (
                    <UsageBar layout="row" label={t('vps.list.usage.ram')} used={row.memUsed} max={row.memMax} formatValue={formatMiB} />
                  ) : null}

                  {row.diskUsed !== undefined && row.diskMax !== undefined && row.diskMax > 0 ? (
                    <UsageBar layout="row" label={t('vps.list.usage.disk')} used={row.diskUsed} max={row.diskMax} formatValue={formatMiB} />
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-2 align-top text-xs text-muted">{formatUptimeSeconds(vps.uptime)}</td>
              <td className="px-4 py-2 align-top">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`${basePath}/vps/${vps.id}/console`} className="text-sm font-medium text-fg underline">
                    {t('vps.tabs.console')}
                  </Link>
                  <span className="text-faint">·</span>
                  <ActionButton
                    variant="ok"
                    size="sm"
                    testId={`vps.row.${vps.id}.action.start`}
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
                    testId={`vps.row.${vps.id}.action.restart`}
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
                    testId={`vps.row.${vps.id}.action.stop`}
                    disabled={!row.stopGate.allowed}
                    disabledReason={!row.stopGate.allowed ? row.stopGate.reason : undefined}
                    loading={row.inFlightKind === 'stop'}
                    ariaLabel={t('vps.power.aria.stop')}
                    title={t('action.vps.stop.label')}
                    onClick={() => onRequestStop(row)}
                  >
                    <Square className="h-4 w-4" />
                  </ActionButton>
                  <ActionButton
                    variant="danger"
                    size="sm"
                    testId={`vps.row.${vps.id}.action.delete`}
                    disabled={!row.deleteGate.allowed}
                    disabledReason={!row.deleteGate.allowed ? row.deleteGate.reason : undefined}
                    loading={row.inFlightKind === 'delete'}
                    ariaLabel={t('vps.list.aria.delete')}
                    title={t('action.vps.delete.label')}
                    onClick={() => onRequestDelete(row)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </ActionButton>
                </div>
              </td>
            </TableRowLink>
          );
        })}
      </tbody>
    </TableCard>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import type { GateDecision } from '../../../../lib/gates/types';
import type { NodeEvacuateResult } from '../../../../lib/api/nodes';
import { Alert } from '../../../../components/ui/Alert';
import { ActionButton } from '../../../../components/ui/ActionButton';
import { Card } from '../../../../components/ui/Card';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { formatErrorMessage } from '../../../../lib/errors';

export type NodeEvacuationDestination = {
  id: number;
  label: string;
  location?: string;
};

export function NodeEvacuationCard(props: {
  t: (key: any, params?: Record<string, unknown>) => string;
  basePath: string;
  nodesLoading: boolean;
  nodesError: boolean;
  destOptions: NodeEvacuationDestination[];
  evDst: string;
  onEvDstChange: (value: string) => void;
  evConcurrency: string;
  onEvConcurrencyChange: (value: string) => void;
  evReason: string;
  onEvReasonChange: (value: string) => void;
  evStopOnError: boolean;
  onEvStopOnErrorChange: (value: boolean) => void;
  evMaintenanceWindow: boolean;
  onEvMaintenanceWindowChange: (value: boolean) => void;
  evCleanupData: boolean;
  onEvCleanupDataChange: (value: boolean) => void;
  evSendMail: boolean;
  onEvSendMailChange: (value: boolean) => void;
  evResult: NodeEvacuateResult | null;
  evacuateError: unknown;
  canEvacuate: boolean;
  evacuateGate: GateDecision;
  onRequestEvacuate: () => void;
}) {
  const {
    t,
    basePath,
    nodesLoading,
    nodesError,
    destOptions,
    evDst,
    onEvDstChange,
    evConcurrency,
    onEvConcurrencyChange,
    evReason,
    onEvReasonChange,
    evStopOnError,
    onEvStopOnErrorChange,
    evMaintenanceWindow,
    onEvMaintenanceWindowChange,
    evCleanupData,
    onEvCleanupDataChange,
    evSendMail,
    onEvSendMailChange,
    evResult,
    evacuateError,
    canEvacuate,
    evacuateGate,
    onRequestEvacuate,
  } = props;

  return (
    <Card>
      <div className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold">{t('admin.node.evacuation.title')}</div>
            <div className="mt-1 text-sm text-muted">{t('admin.node.evacuation.description')}</div>
          </div>

          <div className="flex items-center gap-2">
            <ActionButton
              variant="danger"
              testId="admin.node.evacuation.start"
              onClick={onRequestEvacuate}
              disabled={!canEvacuate || !evacuateGate.allowed}
              disabledReason={!canEvacuate ? undefined : !evacuateGate.allowed ? evacuateGate.reason : undefined}
            >
              {t('admin.node.evacuation.start')}
            </ActionButton>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div>
            <div className="text-xs text-muted">{t('admin.node.evacuation.destination_node')}</div>
            <Select value={evDst} onChange={(e) => onEvDstChange(e.target.value)} disabled={nodesLoading || nodesError}>
              <option value="">{t('common.select')}</option>
              {destOptions.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.label}
                  {o.location ? ` (${o.location})` : ''}
                </option>
              ))}
            </Select>
            {nodesError ? <div className="mt-1 text-xs text-danger">{t('admin.node.evacuation.nodes_load_error')}</div> : null}
          </div>

          <div>
            <div className="text-xs text-muted">{t('admin.node.evacuation.concurrency')}</div>
            <Input value={evConcurrency} onChange={(e) => onEvConcurrencyChange(e.target.value)} placeholder="1" />
            <div className="mt-1 text-xs text-faint">{t('admin.node.evacuation.concurrency_hint')}</div>
          </div>

          <div>
            <div className="text-xs text-muted">{t('common.reason_optional')}</div>
            <Input value={evReason} onChange={(e) => onEvReasonChange(e.target.value)} placeholder={t('admin.node.evacuation.reason_placeholder')} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Checkbox checked={evStopOnError} onChange={onEvStopOnErrorChange} label={t('common.stop_on_error')} testId="admin.node.evacuation.option.stop_on_error" />
          <Checkbox checked={evMaintenanceWindow} onChange={onEvMaintenanceWindowChange} label={t('common.use_maintenance_windows')} testId="admin.node.evacuation.option.maintenance_window" />
          <Checkbox checked={evCleanupData} onChange={onEvCleanupDataChange} label={t('common.cleanup_data')} testId="admin.node.evacuation.option.cleanup_data" />
          <Checkbox checked={evSendMail} onChange={onEvSendMailChange} label={t('common.send_mail')} testId="admin.node.evacuation.option.send_mail" />
        </div>

        {evResult?.migration_plan_id ? (
          <Alert title={t('admin.node.evacuation.result.title')} variant="neutral">
            {t('admin.node.evacuation.result.plan_prefix')}{' '}
            <Link className="font-medium underline" to={`${basePath}/migration-plans/${String(evResult.migration_plan_id)}`}>
              #{String(evResult.migration_plan_id)}
            </Link>
          </Alert>
        ) : null}

        {evacuateError ? (
          <Alert title={t('common.failed')} variant="danger">
            {formatErrorMessage(evacuateError)}
          </Alert>
        ) : null}
      </div>
    </Card>
  );
}

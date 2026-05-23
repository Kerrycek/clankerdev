import React from 'react';
import type { GateDecision } from '../../../../lib/gates/types';
import { Alert } from '../../../../components/ui/Alert';
import { ActionButton } from '../../../../components/ui/ActionButton';
import { Card } from '../../../../components/ui/Card';
import { Input } from '../../../../components/ui/Input';
import { formatErrorMessage } from '../../../../lib/errors';

export function NodeMaintenanceCard(props: {
  t: (key: any, params?: Record<string, unknown>) => string;
  lock: boolean;
  lockReason: string;
  maintReason: string;
  onMaintReasonChange: (value: string) => void;
  maintenanceError: unknown;
  maintenanceLockGate: GateDecision;
  maintenanceUnlockGate: GateDecision;
  onRequestLock: () => void;
  onRequestUnlock: () => void;
}) {
  const {
    t,
    lock,
    lockReason,
    maintReason,
    onMaintReasonChange,
    maintenanceError,
    maintenanceLockGate,
    maintenanceUnlockGate,
    onRequestLock,
    onRequestUnlock,
  } = props;

  return (
    <Card>
      <div className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold">{t('admin.node.maintenance.title')}</div>
            <div className="mt-1 text-sm text-muted">
              {lock ? (
                <>
                  {t('admin.node.maintenance.status_prefix')}{' '}
                  <span className="font-medium">{t('admin.node.maintenance.state.locked')}</span>.
                  {lockReason ? (
                    <>
                      {' '}
                      {t('admin.node.maintenance.reason_prefix')}{' '}
                      <span className="font-medium">{lockReason}</span>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  {t('admin.node.maintenance.status_prefix')}{' '}
                  <span className="font-medium">{t('admin.node.maintenance.state.unlocked')}</span>.
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {lock ? (
              <ActionButton
                variant="secondary"
                testId="admin.node.maintenance.unlock"
                onClick={onRequestUnlock}
                disabled={!maintenanceUnlockGate.allowed}
                disabledReason={!maintenanceUnlockGate.allowed ? maintenanceUnlockGate.reason : undefined}
              >
                {t('common.unlock')}
              </ActionButton>
            ) : (
              <ActionButton
                variant="warn"
                testId="admin.node.maintenance.lock"
                onClick={onRequestLock}
                disabled={!maintenanceLockGate.allowed}
                disabledReason={!maintenanceLockGate.allowed ? maintenanceLockGate.reason : undefined}
              >
                {t('common.lock')}
              </ActionButton>
            )}
          </div>
        </div>

        {!lock ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted">{t('common.reason_optional')}</div>
              <Input
                value={maintReason}
                onChange={(e) => onMaintReasonChange(e.target.value)}
                placeholder={t('admin.node.maintenance.reason_placeholder')}
              />
            </div>
            <div className="text-xs text-muted sm:self-end">{t('admin.node.maintenance.tip')}</div>
          </div>
        ) : null}

        {maintenanceError ? (
          <Alert title={t('common.failed')} variant="danger">
            {formatErrorMessage(maintenanceError)}
          </Alert>
        ) : null}
      </div>
    </Card>
  );
}

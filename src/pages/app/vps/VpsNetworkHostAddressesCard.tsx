import React from 'react';

import { useI18n } from '../../../app/i18n';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Spinner } from '../../../components/ui/Spinner';
import { Table } from '../../../components/ui/Table';
import type { HostIpAddress } from '../../../lib/api/networking';
import type { GateDecision } from '../../../lib/gates/types';
import { hostAddr, hostAssigned, hostPtrState, hostPtrValue, hostRouteLabel } from './VpsNetworkModel';

export function VpsNetworkHostAddressesCard(props: {
  gate: GateDecision;
  isLoading: boolean;
  errorMessage: string | null;
  actionErrorMessage: string | null;
  rows: HostIpAddress[];
  updatePtrPending: boolean;
  assignHostPending: boolean;
  freeHostPending: boolean;
  deleteHostPending: boolean;
  onRefresh: () => void;
  onEditPtr: (row: HostIpAddress) => void;
  onAssign: (row: HostIpAddress) => void;
  onFree: (row: HostIpAddress) => void;
  onDelete: (row: HostIpAddress) => void;
}) {
  const { t } = useI18n();
  const gate = props.gate;

  return (
    <Card testId="vps.network.host_addresses">
      <CardHeader
        title={t('vps.network.ptr.title')}
        subtitle={t('vps.network.ptr.subtitle')}
        actions={
          <Button variant="secondary" size="sm" onClick={props.onRefresh}>
            {t('common.refresh')}
          </Button>
        }
      />
      <CardBody>
        {props.isLoading ? (
          <div className="py-2">
            <Spinner label={t('common.loading')} />
          </div>
        ) : props.errorMessage ? (
          <Alert title={t('vps.network.host_addresses.load_error')} variant="danger">
            {props.errorMessage}
          </Alert>
        ) : props.rows.length === 0 ? (
          <div className="py-2 text-sm text-muted">{t('vps.network.host_addresses.empty')}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table testId="vps.network.host_addresses.table" minWidth="lg">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-3">{t('vps.network.host_addresses.field.address')}</th>
                  <th className="px-4 py-3">{t('vps.network.host_addresses.field.route')}</th>
                  <th className="px-4 py-3">{t('vps.network.host_addresses.field.ptr')}</th>
                  <th className="px-4 py-3">{t('vps.network.host_addresses.field.state')}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {props.rows.map((row) => {
                  const id = Number(row.id);
                  const assigned = hostAssigned(row);
                  const canDelete = row.user_created === true && !assigned;
                  const ptrState = hostPtrState(row);

                  return (
                    <tr key={id} data-testid={`vps.network.host_addresses.row.${id}`} className="border-b border-border/60 last:border-b-0">
                      <td className="px-4 py-3 font-mono text-sm">{hostAddr(row)}</td>
                      <td className="px-4 py-3 font-mono text-sm">{hostRouteLabel(row)}</td>
                      <td className="px-4 py-3 text-sm">{hostPtrValue(row)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={assigned ? 'ok' : 'warn'}>{assigned ? t('common.assigned') : t('common.unassigned')}</Badge>
                          <Badge variant={ptrState === 'set' ? 'ok' : 'info'}>{ptrState === 'set' ? t('vps.network.state.ptr_set') : t('vps.network.state.ptr_missing')}</Badge>
                          {!gate.allowed ? <Badge variant="warn">{t('vps.network.state.busy')}</Badge> : null}
                          {row.user_created === true ? <Badge variant="neutral">{t('common.custom')}</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <ActionButton
                            variant="secondary"
                            size="sm"
                            testId={`vps.network.host_addresses.row.${id}.ptr`}
                            disabled={!gate.allowed}
                            disabledReason={!gate.allowed ? gate.reason : undefined}
                            loading={props.updatePtrPending}
                            onClick={() => props.onEditPtr(row)}
                          >
                            {t('vps.network.host_addresses.action.ptr')}
                          </ActionButton>
                          {assigned ? (
                            <ActionButton
                              variant="danger"
                              size="sm"
                              testId={`vps.network.host_addresses.row.${id}.free`}
                              disabled={!gate.allowed}
                              disabledReason={!gate.allowed ? gate.reason : undefined}
                              loading={props.freeHostPending}
                              onClick={() => props.onFree(row)}
                            >
                              {t('vps.network.host_addresses.action.free')}
                            </ActionButton>
                          ) : (
                            <ActionButton
                              variant="primary"
                              size="sm"
                              testId={`vps.network.host_addresses.row.${id}.assign`}
                              disabled={!gate.allowed}
                              disabledReason={!gate.allowed ? gate.reason : undefined}
                              loading={props.assignHostPending}
                              onClick={() => props.onAssign(row)}
                            >
                              {t('vps.network.host_addresses.action.assign')}
                            </ActionButton>
                          )}
                          {canDelete ? (
                            <ActionButton
                              variant="danger"
                              size="sm"
                              testId={`vps.network.host_addresses.row.${id}.delete`}
                              disabled={!gate.allowed}
                              disabledReason={!gate.allowed ? gate.reason : undefined}
                              loading={props.deleteHostPending}
                              onClick={() => props.onDelete(row)}
                            >
                              {t('common.delete')}
                            </ActionButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}

        {props.actionErrorMessage ? (
          <Alert title={t('vps.network.host_addresses.action_error')} variant="danger" className="mt-3">
            {props.actionErrorMessage}
          </Alert>
        ) : null}
      </CardBody>
    </Card>
  );
}

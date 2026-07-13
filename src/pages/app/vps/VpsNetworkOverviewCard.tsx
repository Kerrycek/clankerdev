import React from 'react';

import { useI18n } from '../../../app/i18n';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import type { GateDecision } from '../../../lib/gates/types';
import { formatBytes, type NetworkRouteSummary } from './VpsNetworkModel';

function OverviewStatusItem(props: { label: string; value: string; description: string; tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'info'; testId: string }) {
  const tone = props.tone ?? 'neutral';
  const className =
    tone === 'ok'
      ? 'border-ok-border bg-ok-bg'
      : tone === 'warn'
        ? 'border-warn-border bg-warn-bg'
        : tone === 'danger'
          ? 'border-danger-border bg-danger-bg'
          : tone === 'info'
            ? 'border-info-border bg-info-bg'
            : 'border-border bg-surface';

  return (
    <div data-testid={props.testId} className={`rounded-lg border p-3 ${className}`}>
      <div className="text-xs text-muted">{props.label}</div>
      <div className="mt-1 text-sm font-semibold text-fg">{props.value}</div>
      <div className="mt-1 text-xs text-muted">{props.description}</div>
    </div>
  );
}

export function VpsNetworkOverviewCard(props: {
  netEnabled: boolean;
  gate: GateDecision;
  summary: NetworkRouteSummary;
  accountingLoading: boolean;
  accountingError: boolean;
  bytesIn: number;
  bytesOut: number;
  year: number;
  month: number;
  onRefresh: () => void;
  onAddIpAddress: () => void;
  onOpenTasks: () => void;
}) {
  const { t } = useI18n();
  const gate = props.gate;

  return (
    <Card testId="vps.network.summary">
      <CardHeader
        title={t('vps.network.overview.title')}
        subtitle={t('vps.network.overview.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              variant="primary"
              size="sm"
              testId="vps.network.ip_addresses.add"
              disabled={!gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              onClick={props.onAddIpAddress}
            >
              {t('network.user.action.add')}
            </ActionButton>
            <Button variant="secondary" size="sm" testId="vps.network.accounting.refresh" onClick={props.onRefresh}>
              {t('common.refresh')}
            </Button>
            <Badge variant={props.netEnabled ? 'ok' : 'warn'}>
              {props.netEnabled ? t('vps.network.status.enabled') : t('vps.network.status.disabled')}
            </Badge>
          </div>
        }
      />

      <CardBody className="space-y-4">
        {!gate.allowed ? (
          <Alert title={t(gate.reason.titleKey)} variant="warn">
            <div className="space-y-2">
              {gate.reason.descriptionKey ? <div>{t(gate.reason.descriptionKey)}</div> : null}
              <div>
                <Button variant="secondary" size="sm" onClick={props.onOpenTasks}>
                  {t('common.open_tasks')}
                </Button>
              </div>
            </div>
          </Alert>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <OverviewStatusItem
            testId="vps.network.overview.state"
            tone={props.netEnabled ? 'ok' : 'warn'}
            label={t('vps.network.overview.state.label')}
            value={props.netEnabled ? t('vps.network.state.enabled') : t('vps.network.state.disabled')}
            description={props.netEnabled ? t('vps.network.overview.state.enabled_help') : t('vps.network.overview.state.disabled_help')}
          />
          <OverviewStatusItem
            testId="vps.network.overview.interfaces"
            tone={props.summary.disabledInterfaceCount > 0 ? 'warn' : 'ok'}
            label={t('vps.network.interfaces.title')}
            value={t('vps.network.overview.interfaces.value', {
              enabled: props.summary.enabledInterfaceCount,
              total: props.summary.interfaceCount,
            })}
            description={t('vps.network.overview.interfaces.description', { disabled: props.summary.disabledInterfaceCount })}
          />
          <OverviewStatusItem
            testId="vps.network.accounting.in"
            tone={props.accountingError ? 'warn' : 'neutral'}
            label={t('vps.network.accounting.ingress')}
            value={props.accountingLoading ? t('common.loading') : props.accountingError ? t('vps.network.accounting.error') : formatBytes(props.bytesIn)}
            description={t('vps.network.accounting.period', {
              year: props.year,
              month: String(props.month).padStart(2, '0'),
            })}
          />
          <OverviewStatusItem
            testId="vps.network.accounting.out"
            tone={props.accountingError ? 'warn' : 'neutral'}
            label={t('vps.network.accounting.egress')}
            value={props.accountingLoading ? t('common.loading') : props.accountingError ? t('vps.network.accounting.error') : formatBytes(props.bytesOut)}
            description={t('vps.network.accounting.period', {
              year: props.year,
              month: String(props.month).padStart(2, '0'),
            })}
          />
        </div>
      </CardBody>
    </Card>
  );
}

export function VpsNetworkAdminActionsCard(props: {
  canAdmin: boolean;
  netEnabled: boolean;
  gate: GateDecision;
  netToggleError: string | null;
  onDisable: () => void;
  onEnable: () => void;
}) {
  const { t } = useI18n();
  const gate = props.gate;

  if (!props.canAdmin) return null;

  return (
    <Card testId="vps.network.admin_actions">
      <CardHeader
        title={t('vps.network.admin_actions.title')}
        subtitle={t('vps.network.admin_actions.subtitle')}
        actions={
          props.netEnabled ? (
            <ActionButton
              testId="vps.network.disable"
              variant="danger"
              size="sm"
              disabled={!gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              onClick={props.onDisable}
            >
              {t('vps.network.disable_button')}
            </ActionButton>
          ) : (
            <ActionButton
              testId="vps.network.enable"
              variant="primary"
              size="sm"
              disabled={!gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              onClick={props.onEnable}
            >
              {t('vps.network.enable_button')}
            </ActionButton>
          )
        }
      />
      <CardBody className="space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="text-xs text-muted">{t('vps.network.admin_actions.vps_network')}</div>
            <div className="mt-1 text-sm font-medium">{props.netEnabled ? t('vps.network.state.enabled') : t('vps.network.state.disabled')}</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="text-xs text-muted">{t('vps.network.admin_actions.route_owner')}</div>
            <div className="mt-1 text-sm font-medium">{t('vps.network.admin_actions.owner_help')}</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="text-xs text-muted">{t('vps.network.admin_actions.route_cleanup')}</div>
            <div className="mt-1 text-sm font-medium">{t('vps.network.admin_actions.cleanup_help')}</div>
          </div>
        </div>

        {props.netToggleError ? (
          <Alert title={t('vps.network.toggle_error.title')} variant="danger">
            {props.netToggleError}
          </Alert>
        ) : null}
      </CardBody>
    </Card>
  );
}

import { useI18n } from '../../../../app/i18n';
import { Badge } from '../../../../components/ui/Badge';
import { Card } from '../../../../components/ui/Card';
import { TableCard } from '../../../../components/ui/TableCard';
import type { Environment } from '../../../../lib/api/infra';
import { formatDurationSeconds } from '../../../../lib/format';
import {
  ClusterResourceActionControls,
  ClusterResourceActions,
} from './ClusterResourceActions';
import type { MaintenanceChange } from './MaintenanceControl';

type Props = {
  environments: Environment[];
  role: string;
  onEdit: (environment: Environment) => void;
  onSetMaintenance: (environment: Environment, change: MaintenanceChange) => Promise<unknown>;
  onMaintenanceChanged: () => Promise<unknown> | void;
};

type EnvironmentRow = {
  environment: Environment;
  label: string;
  description: string;
  domain: string;
  canCreate: boolean;
  canDestroy: boolean;
  maxVpsCount: string;
  lifetime: string;
  userOwnsIp: boolean;
};

function environmentLabel(environment: Environment): string {
  const label = typeof environment.label === 'string' ? environment.label.trim() : '';
  return label || `#${environment.id}`;
}

function formatUnlimited(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  return value === 0 ? '∞' : String(value);
}

export function formatEnvironmentLifetime(value: number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  return value === 0 ? '∞' : formatDurationSeconds(value);
}

function toEnvironmentRow(environment: Environment): EnvironmentRow {
  return {
    environment,
    label: environmentLabel(environment),
    description: typeof environment.description === 'string' ? environment.description.trim() : '',
    domain: typeof environment.domain === 'string' && environment.domain ? environment.domain : '—',
    canCreate: Boolean(environment.can_create_vps),
    canDestroy: Boolean(environment.can_destroy_vps),
    maxVpsCount: formatUnlimited(environment.max_vps_count),
    lifetime: formatEnvironmentLifetime(environment.vps_lifetime),
    userOwnsIp: environment.user_ip_ownership !== false,
  };
}

function EnvironmentActions(props: {
  row: EnvironmentRow;
  role: string;
  editLabel: string;
  testIdPrefix: string;
  mobile?: boolean;
  onEdit: (environment: Environment) => void;
  onSetMaintenance: (environment: Environment, change: MaintenanceChange) => Promise<unknown>;
  onMaintenanceChanged: () => Promise<unknown> | void;
}) {
  const actions = {
    role: props.role,
    maintenance: {
      value: props.row.environment.maintenance_lock,
      reason: props.row.environment.maintenance_lock_reason,
      label: props.row.label,
      testId: `${props.testIdPrefix}.maintenance`,
      setMaintenance: (change: MaintenanceChange) => props.onSetMaintenance(props.row.environment, change),
      onChanged: props.onMaintenanceChanged,
    },
    edit: {
      label: props.editLabel,
      testId: `${props.testIdPrefix}.edit`,
      onClick: () => props.onEdit(props.row.environment),
    },
  };

  return props.mobile ? (
    <ClusterResourceActionControls {...actions} layout="mobile" />
  ) : (
    <ClusterResourceActions {...actions} />
  );
}

export function EnvironmentsList(props: Props) {
  const { t } = useI18n();
  const rows = props.environments.map(toEnvironmentRow);

  const renderActions = (row: EnvironmentRow, testIdPrefix: string, mobile = false) => (
    <EnvironmentActions
      row={row}
      role={props.role}
      editLabel={t('common.edit')}
      testIdPrefix={testIdPrefix}
      mobile={mobile}
      onEdit={props.onEdit}
      onSetMaintenance={props.onSetMaintenance}
      onMaintenanceChanged={props.onMaintenanceChanged}
    />
  );

  return (
    <>
      <div className="space-y-3 md:hidden" data-testid="admin.cluster.environments.cards">
        {rows.map((row) => (
          <Card key={row.environment.id} testId={`admin.cluster.environments.card.${row.environment.id}`}>
            <div className="min-w-0 p-4">
              <div className="break-words text-base font-semibold text-fg">{row.label}</div>
              {row.description ? <div className="mt-1 break-words text-xs text-muted">{row.description}</div> : null}

              <dl className="mt-4 space-y-3 text-sm">
                <div className="min-w-0">
                  <dt className="text-xs text-faint">{t('common.domain')}</dt>
                  <dd className="mt-1 break-all text-fg">{row.domain}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="min-w-0 text-faint">{t('admin.cluster.environments.col.create_vps')}</dt>
                  <dd className="shrink-0"><Badge variant={row.canCreate ? 'ok' : 'neutral'}>{row.canCreate ? t('common.yes') : t('common.no')}</Badge></dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="min-w-0 text-faint">{t('admin.cluster.environments.col.destroy_vps')}</dt>
                  <dd className="shrink-0"><Badge variant={row.canDestroy ? 'warn' : 'neutral'}>{row.canDestroy ? t('common.yes') : t('common.no')}</Badge></dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="min-w-0 text-faint">{t('admin.cluster.environments.col.max_vps')}</dt>
                  <dd className="shrink-0 tabular-nums text-fg">{row.maxVpsCount}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="min-w-0 text-faint">{t('admin.cluster.environments.col.lifetime')}</dt>
                  <dd className="shrink-0 tabular-nums text-fg">{row.lifetime}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="min-w-0 text-faint">{t('admin.cluster.environments.col.ip_ownership')}</dt>
                  <dd className="shrink-0"><Badge variant={row.userOwnsIp ? 'ok' : 'warn'}>{row.userOwnsIp ? t('common.yes') : t('common.no')}</Badge></dd>
                </div>
              </dl>

              <div className="mt-4 border-t border-border pt-3">
                {renderActions(row, `admin.cluster.environments.card.${row.environment.id}`, true)}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <TableCard className="hidden md:block" testId="admin.cluster.environments.table" minWidth="lg">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.name')}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('common.domain')}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.environments.col.create_vps')}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.environments.col.destroy_vps')}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.environments.col.max_vps')}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.environments.col.lifetime')}</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t('admin.cluster.environments.col.ip_ownership')}</th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.environment.id} data-testid={`admin.cluster.environments.row.${row.environment.id}`}>
              <td className="px-3 py-2">
                <div className="font-medium text-fg">{row.label}</div>
                {row.description ? <div className="mt-0.5 text-xs text-muted">{row.description}</div> : null}
              </td>
              <td className="px-3 py-2 text-sm">{row.domain}</td>
              <td className="px-3 py-2"><Badge variant={row.canCreate ? 'ok' : 'neutral'}>{row.canCreate ? t('common.yes') : t('common.no')}</Badge></td>
              <td className="px-3 py-2"><Badge variant={row.canDestroy ? 'warn' : 'neutral'}>{row.canDestroy ? t('common.yes') : t('common.no')}</Badge></td>
              <td className="px-3 py-2 text-sm">{row.maxVpsCount}</td>
              <td className="px-3 py-2 text-sm">{row.lifetime}</td>
              <td className="px-3 py-2"><Badge variant={row.userOwnsIp ? 'ok' : 'warn'}>{row.userOwnsIp ? t('common.yes') : t('common.no')}</Badge></td>
              {renderActions(row, `admin.cluster.environments.row.${row.environment.id}`)}
            </tr>
          ))}
        </tbody>
      </TableCard>
    </>
  );
}

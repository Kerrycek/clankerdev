import type { ComponentProps } from 'react';

import { Button } from '../../../../components/ui/Button';
import { canManageClusterMaintenance, MaintenanceControl } from './MaintenanceControl';

type MaintenanceProps = ComponentProps<typeof MaintenanceControl>;

type ClusterResourceActionsProps = {
  role: string;
  maintenance: MaintenanceProps;
  edit: { label: string; testId: string; onClick: () => void };
};

export function ClusterResourceActionControls(
  props: ClusterResourceActionsProps & { layout?: 'inline' | 'mobile' },
) {
  const mobile = props.layout === 'mobile';

  return (
    <div className={mobile ? 'flex min-w-0 flex-col gap-2' : 'flex flex-wrap justify-end gap-2'}>
      {canManageClusterMaintenance(props.role) ? (
        <MaintenanceControl
          {...props.maintenance}
          actionSize={mobile ? 'lg' : props.maintenance.actionSize}
          actionClassName={mobile ? 'max-w-full' : props.maintenance.actionClassName}
        />
      ) : null}
      <Button
        variant="secondary"
        size={mobile ? 'lg' : 'sm'}
        className={mobile ? 'w-full min-w-0' : undefined}
        ariaLabel={mobile ? `${props.edit.label}: ${props.maintenance.label}` : undefined}
        onClick={props.edit.onClick}
        testId={props.edit.testId}
      >
        {props.edit.label}
      </Button>
    </div>
  );
}

export function ClusterResourceActions(props: ClusterResourceActionsProps) {
  return (
    <td className="px-3 py-2 text-right">
      <ClusterResourceActionControls {...props} />
    </td>
  );
}

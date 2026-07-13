import React from 'react';
import { Pencil, PlugZap, Trash2, Unplug } from 'lucide-react';

import { useI18n } from '../../../../app/i18n';
import { ActionButton } from '../../../../components/ui/ActionButton';
import { Button } from '../../../../components/ui/Button';

interface HostIpAddressRowActionsProps {
  assigned: boolean;
  userCreated: boolean;
  testIdPrefix: string;
  assignLoading?: boolean;
  freeLoading?: boolean;
  onEditPtr: () => void;
  onAssign: () => void;
  onFree: () => void;
  onDelete: () => void;
}

const iconButtonClass = 'h-8 w-8 min-w-8 shrink-0 px-0';
const iconClass = 'h-4 w-4 shrink-0';

export function HostIpAddressRowActions({
  assigned,
  userCreated,
  testIdPrefix,
  assignLoading,
  freeLoading,
  onEditPtr,
  onAssign,
  onFree,
  onDelete,
}: HostIpAddressRowActionsProps) {
  const { t } = useI18n();
  const ptrLabel = t('admin.host_ip_addresses.action.ptr');
  const assignLabel = t('admin.host_ip_addresses.action.assign');
  const freeLabel = t('admin.host_ip_addresses.action.free');
  const deleteLabel = t('common.delete');

  return (
    <div className="inline-flex flex-nowrap items-center justify-end gap-1" role="group" aria-label={t('common.actions')}>
      <Button
        variant="ghost"
        size="sm"
        className={iconButtonClass}
        testId={`${testIdPrefix}.ptr`}
        title={ptrLabel}
        ariaLabel={ptrLabel}
        onClick={onEditPtr}
      >
        <Pencil className={iconClass} aria-hidden="true" />
      </Button>

      {assigned ? (
        <ActionButton
          variant="danger"
          size="sm"
          className={iconButtonClass}
          testId={`${testIdPrefix}.free`}
          loading={freeLoading}
          title={freeLabel}
          ariaLabel={freeLabel}
          onClick={onFree}
        >
          <Unplug className={iconClass} aria-hidden="true" />
        </ActionButton>
      ) : (
        <ActionButton
          variant="ghost"
          size="sm"
          className={iconButtonClass}
          testId={`${testIdPrefix}.assign`}
          loading={assignLoading}
          title={assignLabel}
          ariaLabel={assignLabel}
          onClick={onAssign}
        >
          <PlugZap className={iconClass} aria-hidden="true" />
        </ActionButton>
      )}

      {userCreated && !assigned ? (
        <Button
          variant="danger"
          size="sm"
          className={iconButtonClass}
          testId={`${testIdPrefix}.delete`}
          title={deleteLabel}
          ariaLabel={deleteLabel}
          onClick={onDelete}
        >
          <Trash2 className={iconClass} aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

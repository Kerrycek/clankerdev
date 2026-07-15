import React from 'react';
import { Bug, History, Route, RouteOff, ServerCog, UserRoundCog } from 'lucide-react';

import { useI18n } from '../../../../app/i18n';

import { Button } from '../../../../components/ui/Button';
import { clsx } from '../../../../components/ui/clsx';

interface IpAddressRowActionsProps {
  ipAddr?: string;
  detailPath: string;
  basePath: string;
  assigned: boolean;
  testIdPrefix: string;
  className?: string;
}

const iconButtonClass = 'h-8 w-8 min-w-8 shrink-0 p-0 text-muted hover:text-accent';
const iconClass = 'h-4 w-4 shrink-0';

function IconAction(props: {
  to: string;
  label: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      to={props.to}
      variant="ghost"
      size="sm"
      className={iconButtonClass}
      testId={props.testId}
      title={props.label}
      ariaLabel={props.label}
    >
      {props.children}
    </Button>
  );
}

export function IpAddressRowActions({
  ipAddr,
  detailPath,
  basePath,
  assigned,
  testIdPrefix,
  className,
}: IpAddressRowActionsProps) {
  const { t } = useI18n();
  const routeLabel = assigned
    ? t('admin.ip_addresses.action.unassign_route')
    : t('admin.ip_addresses.action.assign_route');
  const RouteIcon = assigned ? RouteOff : Route;

  return (
    <div
      className={clsx('inline-flex flex-nowrap items-center justify-end gap-1', className)}
      role="group"
      aria-label={t('common.actions')}
      data-row-no-nav
    >
      {ipAddr ? (
        <>
          <IconAction
            to={`${basePath}/incidents?ip_addr=${encodeURIComponent(ipAddr)}`}
            label={t('admin.ip_addresses.action.incidents')}
            testId={`${testIdPrefix}.action.incidents`}
          >
            <Bug className={iconClass} aria-hidden="true" />
          </IconAction>
          <IconAction
            to={`${basePath}/networking/ip-address-assignments?q=${encodeURIComponent(ipAddr)}`}
            label={t('admin.ip_addresses.action.assignments')}
            testId={`${testIdPrefix}.action.assignments`}
          >
            <History className={iconClass} aria-hidden="true" />
          </IconAction>
        </>
      ) : null}

      <IconAction
        to={`${detailPath}#route`}
        label={routeLabel}
        testId={`${testIdPrefix}.action.route`}
      >
        <RouteIcon className={iconClass} aria-hidden="true" />
      </IconAction>
      <IconAction
        to={`${detailPath}#owner`}
        label={t('admin.ip.owner.title')}
        testId={`${testIdPrefix}.action.owner`}
      >
        <UserRoundCog className={iconClass} aria-hidden="true" />
      </IconAction>
      <IconAction
        to={`${detailPath}#hosts`}
        label={t('admin.ip.hosts.title')}
        testId={`${testIdPrefix}.action.hosts`}
      >
        <ServerCog className={iconClass} aria-hidden="true" />
      </IconAction>
    </div>
  );
}

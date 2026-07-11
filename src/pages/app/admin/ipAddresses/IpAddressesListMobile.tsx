import React from 'react';
import { Link } from 'react-router-dom';

import { useI18n } from '../../../../app/i18n';

import type { IpAddress } from '../../../../lib/api/ipAddresses';
import { formatDateTime } from '../../../../lib/format';

import { Badge } from '../../../../components/ui/Badge';
import { Card } from '../../../../components/ui/Card';
import { CopyButton } from '../../../../components/ui/CopyButton';
import { KeysetPagination } from '../../../../components/ui/KeysetPagination';
import { StatusDot } from '../../../../components/ui/StatusDot';
import { clsx } from '../../../../components/ui/clsx';
import { toneSurfaceClass } from '../../../../components/ui/tone';

import {
  ifaceLabel,
  environmentLabel,
  locationMark,
  ipAddressText,
  ipCreatedAt,
  ipDotVariant,
  ipId,
  ipLabel,
  ipRowVariant,
  ipUserId,
  ipVpsId,
  isAssignedToInterface,
  isRoutedIp,
  networkLabel,
  userLabel,
  vpsLabel,
} from './ipAddressListSemantics';

interface PaginationProps {
  page: number;
  pageCount: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoToPage: (page: number) => void;
  limit: number;
  allowedLimits: readonly number[];
  onLimitChange: (limit: number) => void;
}

interface IpAddressesListMobileProps {
  pageData: IpAddress[];
  ipDetailBasePath: string;
  basePath: string;
  na: string;
  locationFallback?: { label?: string | null; environment?: { label?: string | null } | null } | null;
  canPaginate: boolean;
  pagination: PaginationProps;
}

export function IpAddressesListMobile({ pageData, ipDetailBasePath, basePath, na, locationFallback, canPaginate, pagination }: IpAddressesListMobileProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="space-y-3 md:hidden">
        {pageData.map((ip) => {
          const id = ipId(ip);
          const createdAt = ipCreatedAt(ip);
          const vpsId = ipVpsId(ip);
          const userId = ipUserId(ip);
          const assigned = isAssignedToInterface(ip);
          const rowVariant = ipRowVariant(ip);
          const ipAddr = ipAddressText(ip);
          const mark = locationMark(ip, locationFallback);
          const detailPath = `${ipDetailBasePath}/${id}`;
          return (
            <Card key={id} testId={`admin.ip_addresses.card.${id}`} className={clsx(rowVariant ? toneSurfaceClass(rowVariant) : undefined)}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <StatusDot
                        variant={ipDotVariant(ip)}
                        ariaLabel={assigned ? t('admin.ip_addresses.chip.assigned_true') : t('admin.ip_addresses.chip.assigned_false')}
                        testId={`admin.ip_addresses.card.${id}.dot`}
                      />
                      <Link className="block truncate text-base font-semibold text-accent hover:underline" to={detailPath}>
                        {ipLabel(ip)}
                      </Link>
                    </div>
                    <div className="mt-0.5 text-xs text-faint">#{id}</div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge variant={assigned ? 'ok' : 'warn'}>
                      {assigned ? t('admin.ip_addresses.chip.assigned_true') : t('admin.ip_addresses.chip.assigned_false')}
                    </Badge>
                    {isRoutedIp(ip) ? <Badge variant="black">{t('admin.ip.routed_badge')}</Badge> : null}
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-xs text-muted">
                  <div>
                    <span className="text-faint">{t('admin.ip.field.network')}:</span> {networkLabel(ip, na)}
                  </div>
                  <div>
                    <span className="text-faint">{t('admin.ip_addresses.field.environment')}:</span> {mark ? mark.label : environmentLabel(ip, na)}
                  </div>
                  <div>
                    <span className="text-faint">{t('admin.ip.field.vps_id')}:</span> {vpsLabel(ip, na)}
                  </div>
                  <div>
                    <span className="text-faint">{t('admin.ip.field.user_id')}:</span> {userLabel(ip, na)}
                  </div>
                  <div>
                    <span className="text-faint">{t('admin.ip_addresses.field.interface')}:</span> {ifaceLabel(ip, na)}
                  </div>
                  {createdAt ? (
                    <div>
                      <span className="text-faint">{t('admin.ip.field.created')}:</span> {formatDateTime(createdAt)}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {ipAddr ? <CopyButton text={ipAddr} label={t('common.copy')} /> : null}
                  {ipAddr ? (
                    <Link className="text-xs text-accent hover:underline" to={`${basePath}/incidents?ip_addr=${encodeURIComponent(ipAddr)}`}>
                      {t('admin.ip_addresses.action.incidents')}
                    </Link>
                  ) : null}
                  {ipAddr ? (
                    <Link className="text-xs text-accent hover:underline" to={`${basePath}/networking/ip-address-assignments?q=${encodeURIComponent(ipAddr)}`}>
                      {t('admin.ip_addresses.action.assignments')}
                    </Link>
                  ) : null}
                  {vpsId ? (
                    <Link className="text-xs text-accent hover:underline" to={`${basePath}/vps/${vpsId}`}>
                      {t('object_kind.vps')} #{vpsId}
                    </Link>
                  ) : null}
                  {userId ? (
                    <Link className="text-xs text-accent hover:underline" to={`${basePath}/users/${userId}`}>
                      {t('admin.user.heading')} #{userId}
                    </Link>
                  ) : null}
                  <Link className="text-xs text-accent hover:underline" to={`${detailPath}#route`}>
                    {assigned ? t('admin.ip_addresses.action.unassign_route') : t('admin.ip_addresses.action.assign_route')}
                  </Link>
                  <Link className="text-xs text-accent hover:underline" to={`${detailPath}#owner`}>
                    {t('admin.ip.owner.title')}
                  </Link>
                  <Link className="text-xs text-accent hover:underline" to={`${detailPath}#hosts`}>
                    {t('admin.ip.hosts.title')}
                  </Link>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {canPaginate ? (
        <Card className="md:hidden">
          <KeysetPagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            canPrev={pagination.canPrev}
            canNext={pagination.canNext}
            onPrev={pagination.onPrev}
            onNext={pagination.onNext}
            onGoToPage={pagination.onGoToPage}
            limit={pagination.limit}
            allowedLimits={pagination.allowedLimits}
            onLimitChange={pagination.onLimitChange}
            testId="admin.ip_addresses.pagination.mobile"
          />
        </Card>
      ) : null}
    </>
  );
}

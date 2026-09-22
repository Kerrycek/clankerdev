import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';

import { deleteUserKnownDevice, fetchUserKnownDevices } from '../../lib/api/userDossier';

import { useKeysetPagination } from '../../lib/hooks/useKeysetPagination';
import { useTierCIntervalMs } from '../../lib/refreshTiers';
import { formatErrorMessage } from '../../lib/errors';

import {
  buildKnownDevicePageWindow,
  buildKnownDeviceSummary,
  filterKnownDevices,
} from './UserKnownDevicesModel';
import { UserKnownDeviceForgetDialog } from './UserKnownDevicesDialogs';
import { UserKnownDevicesList } from './UserKnownDevicesList';
import { UserSecurityMetricGrid } from './UserSecurityMetricGrid';

import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Input } from '../ui/Input';
import { KeysetPagination } from '../ui/KeysetPagination';
import { Spinner } from '../ui/Spinner';

export function UserKnownDevicesPanel(props: {
  userId: number;
  /** Test id prefix, e.g. "profile.security" or "admin.user.security" */
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSearch = (searchParams.get('q') ?? '').trim();
  const [q, setQ] = useState(() => activeSearch);
  const hydratingSearchFromUrlRef = useRef(false);

  useLayoutEffect(() => {
    hydratingSearchFromUrlRef.current = true;
    setQ(activeSearch);
  }, [activeSearch]);

  useEffect(() => {
    if (hydratingSearchFromUrlRef.current) {
      hydratingSearchFromUrlRef.current = false;
      return;
    }

    const next = new URLSearchParams(searchParams);
    const trimmed = q.trim();
    const searchChanged = trimmed !== activeSearch;
    if (trimmed) next.set('q', trimmed);
    else next.delete('q');

    if (searchChanged) {
      next.delete('from_id');
      next.set('page', '1');
    }

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [activeSearch, q, searchParams, setSearchParams]);

  const searchTrim = activeSearch;
  const pagination = useKeysetPagination({
    id: `${props.testIdPrefix}.known_devices.pagination`,
    filterKey: JSON.stringify({ userId: props.userId, q: searchTrim }),
    searchParams,
    setSearchParams,
    restoreUrlCursorOnSignatureChange: true,
    defaultLimit: 25,
    allowedLimits: [25, 50, 100],
  });

  const interval = useTierCIntervalMs();
  const requestLimit = pagination.limit + 1;

  const devicesQ = useQuery({
    queryKey: [
      'users',
      props.userId,
      'known_devices',
      { fromId: pagination.fromId ?? null, limit: requestLimit },
    ],
    queryFn: async () => {
      const res = await fetchUserKnownDevices(props.userId, {
        fromId: pagination.fromId ?? undefined,
        limit: requestLimit,
      });
      return res.data;
    },
    refetchInterval: interval,
  });

  const pageWindow = useMemo(
    () => buildKnownDevicePageWindow(devicesQ.data, pagination.limit),
    [devicesQ.data, pagination.limit]
  );
  const devices = useMemo(() => filterKnownDevices(pageWindow.rows, searchTrim), [pageWindow.rows, searchTrim]);
  const deviceSummary = useMemo(() => buildKnownDeviceSummary(pageWindow.rows), [pageWindow.rows]);
  const hasNextFromData =
    devicesQ.isSuccess && pageWindow.hasMore && pageWindow.cursor !== null;
  const canNext = hasNextFromData && !devicesQ.isFetching;
  const safePageCount = Math.min(
    pagination.stack.length,
    pagination.page + (hasNextFromData ? 1 : 0)
  );

  const shouldRecoverEmptyCursor =
    devicesQ.isSuccess && !devicesQ.isFetching && pageWindow.rows.length === 0 && pagination.canPrev;

  useLayoutEffect(() => {
    if (!shouldRecoverEmptyCursor) return;

    const previousIndex = pagination.index - 1;
    const previousCursor = pagination.stack[previousIndex] ?? null;
    const next = new URLSearchParams(searchParams);
    next.set('limit', String(pagination.limit));
    next.set('page', String(previousIndex + 1));
    if (previousCursor === null) next.delete('from_id');
    else next.set('from_id', String(previousCursor));
    setSearchParams(next, { replace: true });
  }, [
    pagination.index,
    pagination.limit,
    pagination.stack,
    searchParams,
    setSearchParams,
    shouldRecoverEmptyCursor,
  ]);

  const goNext = () => {
    if (!canNext || pageWindow.cursor === null) return;
    pagination.goToPageWithStack(
      pagination.page + 1,
      [...pagination.stack.slice(0, pagination.index + 1), pageWindow.cursor]
    );
  };

  const goToPage = (page: number) => {
    if (page === pagination.page + 1) {
      goNext();
      return;
    }
    if (page <= pagination.page) pagination.goToPage(page);
  };

  const [removeId, setRemoveId] = useState<number | null>(null);

  const removeM = useMutation({
    mutationFn: async (id: number) => deleteUserKnownDevice(props.userId, id),
    onSuccess: async () => {
      setRemoveId(null);
      await qc.invalidateQueries({
        queryKey: ['users', props.userId, 'known_devices'],
      });
    },
  });

  const openRemove = (id: number) => {
    removeM.reset();
    setRemoveId(id);
  };

  const closeRemove = () => {
    removeM.reset();
    setRemoveId(null);
  };

  const prefix = props.testIdPrefix;

  return (
    <>
      <Card testId={`${prefix}.known_devices.card`}>
        <CardHeader
          title={t('profile.security.known_devices.title')}
          subtitle={t('profile.security.known_devices.subtitle')}
          actions={
            <Button
              variant="secondary"
              onClick={() => void devicesQ.refetch()}
              disabled={devicesQ.isFetching}
              testId={`${prefix}.known_devices.refresh`}
            >
              {t('common.refresh')}
            </Button>
          }
        />

        <CardBody>
          <KnownDevicesSearch value={q} testIdPrefix={prefix} onChange={setQ} />

          <UserSecurityMetricGrid
            testId={`${prefix}.known_devices.summary`}
            items={[
              { key: 'total', label: t('profile.security.known_devices.summary.total'), value: deviceSummary.total },
              { key: 'trusted', label: t('profile.security.known_devices.summary.trusted'), value: deviceSummary.trusted },
              {
                key: 'client_ips',
                label: t('profile.security.known_devices.summary.client_ips'),
                value: deviceSummary.uniqueClientIps,
              },
              {
                key: 'api_ips',
                label: t('profile.security.known_devices.summary.api_ips'),
                value: deviceSummary.uniqueApiIps,
              },
            ]}
          />

          {devicesQ.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : devicesQ.isError ? (
            <Alert variant="danger" title={t('profile.security.known_devices.load_failed')}>
              {formatErrorMessage(devicesQ.error)}
            </Alert>
          ) : devices.length === 0 ? (
            <KnownDevicesEmptyState hasFilter={Boolean(searchTrim)} testIdPrefix={prefix} onClearFilter={() => setQ('')} />
          ) : (
            <UserKnownDevicesList devices={devices} testIdPrefix={prefix} onForget={openRemove} />
          )}
        </CardBody>

        <KeysetPagination
          testId={`${prefix}.known_devices.pagination`}
          page={pagination.page}
          pageCount={safePageCount}
          onGoToPage={goToPage}
          maxDirectPage={hasNextFromData ? pagination.page + 1 : pagination.page}
          jumpPending={devicesQ.isFetching}
          canPrev={pagination.canPrev}
          onPrev={() => pagination.goPrev()}
          canNext={canNext}
          onNext={goNext}
          limit={pagination.limit}
          allowedLimits={pagination.allowedLimits}
          onLimitChange={(l) => pagination.setLimit(l)}
        />
      </Card>

      <UserKnownDeviceForgetDialog
        open={removeId !== null}
        loading={removeM.isPending}
        error={removeM.error}
        testIdPrefix={prefix}
        onCancel={closeRemove}
        onConfirm={() => {
          if (removeId === null) return;
          removeM.mutate(removeId);
        }}
      />
    </>
  );
}

function KnownDevicesSearch(props: {
  value: string;
  testIdPrefix: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="mb-3">
      <div className="text-xs font-medium text-muted">{t('common.find')}</div>
      <div className="mt-1">
        <Input
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={t('profile.security.known_devices.search.placeholder')}
          testId={`${props.testIdPrefix}.known_devices.search`}
        />
      </div>
      <div className="mt-1 text-xs text-faint">{t('profile.security.known_devices.search.hint')}</div>
    </div>
  );
}

function KnownDevicesEmptyState(props: {
  hasFilter: boolean;
  testIdPrefix: string;
  onClearFilter: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="py-8 text-center text-sm text-muted" data-testid={`${props.testIdPrefix}.known_devices.empty`}>
      <div>{props.hasFilter ? t('profile.security.known_devices.empty_filtered') : t('profile.security.known_devices.empty')}</div>
      {props.hasFilter ? (
        <div className="mt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={props.onClearFilter}
            testId={`${props.testIdPrefix}.known_devices.clear_filters`}
          >
            {t('common.clear_filters')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

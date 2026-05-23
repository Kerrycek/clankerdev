import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';
import { fetchCluster, fetchClusterFullStats, setClusterMaintenance } from '../../../../lib/api/cluster';

import { Card, CardBody, CardHeader } from '../../../../components/ui/Card';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { LinkButton } from '../../../../components/ui/LinkButton';
import { StatCard } from '../../../../components/ui/StatCard';
import { StatusDot } from '../../../../components/ui/StatusDot';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { Input } from '../../../../components/ui/Input';
import { toneSurfaceClass } from '../../../../components/ui/tone';

function ratioLabel(used: number, total: number) {
  const u = Number.isFinite(used) ? used : 0;
  const t = Number.isFinite(total) ? total : 0;
  return `${u} / ${t}`;
}

export function ClusterSummaryPage() {
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const [confirmMode, setConfirmMode] = useState<'lock' | 'unlock' | null>(null);
  const [lockReason, setLockReason] = useState('');

  const statsQ = useQuery({
    queryKey: ['cluster', 'full_stats'],
    queryFn: async () => (await fetchClusterFullStats()).data,
    staleTime: 15_000,
  });

  const clusterQ = useQuery({
    queryKey: ['cluster', 'show'],
    queryFn: async () => (await fetchCluster()).data,
    staleTime: 15_000,
  });

  const stats = statsQ.data;
  const cluster = clusterQ.data;
  const clusterLocked = Boolean(cluster?.maintenance_lock);
  const clusterLockReason = typeof cluster?.maintenance_lock_reason === 'string' ? cluster.maintenance_lock_reason.trim() : '';

  const nodesVariant = useMemo(() => {
    if (!stats) return 'neutral' as const;
    if (stats.nodes_online >= stats.node_count) return 'ok' as const;
    if (stats.nodes_online === 0) return 'danger' as const;
    return 'warn' as const;
  }, [stats]);

  const maintenanceM = useMutation({
    mutationFn: async (lock: boolean) => setClusterMaintenance({ lock, reason: lock ? lockReason.trim() || undefined : undefined }),
    onSuccess: (_res, lock) => {
      pushToast({
        variant: lock ? 'warn' : 'ok',
        title: lock ? t('admin.cluster.summary.maintenance.toast.lock.title') : t('admin.cluster.summary.maintenance.toast.unlock.title'),
        body: lock ? t('admin.cluster.summary.maintenance.toast.lock.body') : t('admin.cluster.summary.maintenance.toast.unlock.body'),
      });
      setConfirmMode(null);
      if (!lock) setLockReason('');
      void clusterQ.refetch();
      void statsQ.refetch();
    },
    onError: (err: any, lock) => {
      pushToast({
        variant: 'danger',
        title: lock ? t('admin.cluster.summary.maintenance.toast.lock_error.title') : t('admin.cluster.summary.maintenance.toast.unlock_error.title'),
        body: typeof err?.message === 'string' && err.message ? err.message : t('common.try_again'),
      });
    },
  });

  if (statsQ.isLoading || clusterQ.isLoading) {
    return <LoadingState testId="admin.cluster.summary.loading" />;
  }

  if (statsQ.isError || clusterQ.isError) {
    return (
      <ErrorState
        title={t('admin.cluster.summary.error.title')}
        message={t('admin.cluster.summary.error.body')}
        onRetry={() => {
          void statsQ.refetch();
          void clusterQ.refetch();
        }}
        testId="admin.cluster.summary.error"
      />
    );
  }

  if (!stats || !cluster) {
    return <ErrorState title={t('common.error')} message={t('common.no_data')} testId="admin.cluster.summary.empty" />;
  }

  return (
    <div className="mt-4 space-y-6" data-testid="admin.cluster.summary.page">
      <Card testId="admin.cluster.summary.maintenance" className={toneSurfaceClass(clusterLocked ? 'warn' : 'muted')}>
        <CardHeader
          title={t('admin.cluster.summary.maintenance.title')}
          subtitle={clusterLocked ? t('admin.cluster.summary.maintenance.subtitle.locked') : t('admin.cluster.summary.maintenance.subtitle.unlocked')}
        />
        <CardBody>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusDot
                  variant={clusterLocked ? 'warn' : 'ok'}
                  size="md"
                  ariaLabel={clusterLocked ? t('admin.cluster.summary.maintenance.aria.locked') : t('admin.cluster.summary.maintenance.aria.unlocked')}
                />
                <Badge variant={clusterLocked ? 'warn' : 'ok'} testId="admin.cluster.summary.maintenance.badge">
                  {clusterLocked ? t('admin.cluster.summary.maintenance.status.locked') : t('admin.cluster.summary.maintenance.status.unlocked')}
                </Badge>
              </div>
              <p className="text-sm text-muted" data-testid="admin.cluster.summary.maintenance.body">
                {clusterLocked
                  ? clusterLockReason
                    ? t('admin.cluster.summary.maintenance.reason', { reason: clusterLockReason })
                    : t('admin.cluster.summary.maintenance.locked_no_reason')
                  : t('admin.cluster.summary.maintenance.unlocked_body')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <LinkButton to="/admin/nodes" variant="secondary" size="sm">
                {t('admin.cluster.summary.maintenance.view_nodes')}
              </LinkButton>
              {clusterLocked ? (
                <Button
                  size="sm"
                  variant="secondary"
                  testId="admin.cluster.summary.maintenance.unlock"
                  onClick={() => setConfirmMode('unlock')}
                >
                  {t('admin.cluster.summary.maintenance.action.unlock')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  testId="admin.cluster.summary.maintenance.lock"
                  onClick={() => setConfirmMode('lock')}
                >
                  {t('admin.cluster.summary.maintenance.action.lock')}
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          testId="admin.cluster.summary.stat.nodes"
          title={t('admin.cluster.summary.nodes.title')}
          subtitle={t('admin.cluster.summary.nodes.subtitle')}
          icon={<StatusDot variant={nodesVariant} size="md" ariaLabel={t('admin.cluster.summary.nodes.aria')} />}
          value={ratioLabel(stats.nodes_online, stats.node_count)}
          footer={t('admin.cluster.summary.nodes.footer')}
          actions={
            <LinkButton to="/admin/nodes" variant="secondary" size="sm">
              {t('admin.cluster.summary.view_nodes')}
            </LinkButton>
          }
        />

        <StatCard
          testId="admin.cluster.summary.stat.vps"
          title={t('admin.cluster.summary.vps.title')}
          subtitle={t('admin.cluster.summary.vps.subtitle')}
          value={stats.vps_count}
          footer={t('admin.cluster.summary.vps.footer', {
            running: stats.vps_running,
            stopped: stats.vps_stopped,
            suspended: stats.vps_suspended,
            deleted: stats.vps_deleted,
          })}
          actions={
            <LinkButton to="/admin/vps" variant="secondary" size="sm">
              {t('admin.cluster.summary.view_vps')}
            </LinkButton>
          }
        />

        <StatCard
          testId="admin.cluster.summary.stat.users"
          title={t('admin.cluster.summary.users.title')}
          subtitle={t('admin.cluster.summary.users.subtitle')}
          value={stats.user_count}
          footer={t('admin.cluster.summary.users.footer', {
            active: stats.user_active,
            suspended: stats.user_suspended,
            deleted: stats.user_deleted,
          })}
          actions={
            <LinkButton to="/admin/users" variant="secondary" size="sm">
              {t('admin.cluster.summary.view_users')}
            </LinkButton>
          }
        />

        <StatCard
          testId="admin.cluster.summary.stat.ipv4"
          title={t('admin.cluster.summary.ipv4.title')}
          subtitle={t('admin.cluster.summary.ipv4.subtitle')}
          value={ratioLabel(stats.ipv4_used, stats.ipv4_count)}
          footer={t('admin.cluster.summary.ipv4.footer')}
          actions={
            <LinkButton to="/admin/ip-addresses?version=4" variant="secondary" size="sm">
              {t('admin.cluster.summary.view_ips')}
            </LinkButton>
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card testId="admin.cluster.summary.shortcuts.ops">
          <CardHeader title={t('admin.cluster.summary.shortcuts.ops.title')} subtitle={t('admin.cluster.summary.shortcuts.ops.subtitle')} />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              <LinkButton to="/outages" variant="secondary" size="sm">
                {t('admin.cluster.summary.shortcuts.outages')}
              </LinkButton>
              <LinkButton to="/admin/monitoring" variant="secondary" size="sm">
                {t('admin.cluster.summary.shortcuts.monitoring')}
              </LinkButton>
              <LinkButton to="/admin/incidents" variant="secondary" size="sm">
                {t('admin.cluster.summary.shortcuts.incidents')}
              </LinkButton>
              <LinkButton to="/admin/oom-reports" variant="secondary" size="sm">
                {t('admin.cluster.summary.shortcuts.oom')}
              </LinkButton>
            </div>
          </CardBody>
        </Card>

        <Card testId="admin.cluster.summary.shortcuts.content">
          <CardHeader title={t('admin.cluster.summary.shortcuts.content.title')} subtitle={t('admin.cluster.summary.shortcuts.content.subtitle')} />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              <LinkButton to="/news" variant="secondary" size="sm">
                {t('admin.cluster.summary.shortcuts.news_read')}
              </LinkButton>
              <LinkButton to="/admin/content/news" variant="secondary" size="sm">
                {t('admin.cluster.summary.shortcuts.news_manage')}
              </LinkButton>
              <LinkButton to="/admin/content/help-boxes" variant="secondary" size="sm">
                {t('admin.cluster.summary.shortcuts.help_boxes')}
              </LinkButton>
            </div>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmMode === 'lock'}
        onCancel={() => {
          if (!maintenanceM.isPending) setConfirmMode(null);
        }}
        onConfirm={() => maintenanceM.mutate(true)}
        title={t('admin.cluster.summary.maintenance.dialog.lock.title')}
        description={t('admin.cluster.summary.maintenance.dialog.lock.body')}
        confirmLabel={t('admin.cluster.summary.maintenance.action.lock')}
        confirmLoading={maintenanceM.isPending && confirmMode === 'lock'}
        testId="admin.cluster.summary.maintenance.dialog.lock"
      >
        <div className="space-y-2">
          <label htmlFor="cluster-lock-reason" className="text-sm font-medium text-fg">
            {t('admin.cluster.summary.maintenance.dialog.lock.reason_label')}
          </label>
          <Input
            testId="admin.cluster.summary.maintenance.dialog.lock.reason"
            ariaLabel={t('admin.cluster.summary.maintenance.dialog.lock.reason_label')}
            value={lockReason}
            onChange={(e) => setLockReason(e.target.value)}
            placeholder={t('admin.cluster.summary.maintenance.dialog.lock.reason_placeholder')}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmMode === 'unlock'}
        onCancel={() => {
          if (!maintenanceM.isPending) setConfirmMode(null);
        }}
        onConfirm={() => maintenanceM.mutate(false)}
        title={t('admin.cluster.summary.maintenance.dialog.unlock.title')}
        description={t('admin.cluster.summary.maintenance.dialog.unlock.body')}
        confirmLabel={t('admin.cluster.summary.maintenance.action.unlock')}
        confirmLoading={maintenanceM.isPending && confirmMode === 'unlock'}
        testId="admin.cluster.summary.maintenance.dialog.unlock"
      />
    </div>
  );
}

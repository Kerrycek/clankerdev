import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';

import {
  fetchUserEnvironmentConfigs,
  updateUserEnvironmentConfig,
  type UserEnvironmentConfig,
} from '../../lib/api/userEnvironmentConfigs';

import { formatErrorMessage } from '../../lib/errors';
import { formatUptimeSeconds } from '../../lib/format';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';
import { Table } from '../ui/Table';
import { SwitchRow } from '../ui/SwitchRow';

function envLabel(cfg: UserEnvironmentConfig): string {
  const env: any = cfg.environment ?? {};
  const label = typeof env.label === 'string' ? env.label.trim() : '';
  if (label) return label;
  const id = typeof env.id === 'number' ? env.id : null;
  return id ? `#${id}` : '—';
}

function sortConfigs(list: UserEnvironmentConfig[]): UserEnvironmentConfig[] {
  return [...list].sort((a, b) => {
    const la = envLabel(a);
    const lb = envLabel(b);
    const cmp = la.localeCompare(lb);
    if (cmp !== 0) return cmp;
    return (Number(a.id) || 0) - (Number(b.id) || 0);
  });
}

function secondsToDaysString(seconds: number | undefined | null): string {
  const s = typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : 0;
  if (s <= 0) return '0';
  const days = s / 86400;
  if (Number.isInteger(days)) return String(days);
  // show up to 2 decimals for odd values
  return String(Math.round(days * 100) / 100);
}

function daysStringToSeconds(daysStr: string): number {
  const n = Number(daysStr);
  if (!Number.isFinite(n) || n < 0) throw new Error('Invalid days');
  if (n === 0) return 0;
  return Math.round(n * 86400);
}

export function UserEnvironmentConfigsPanel(props: {
  userId: number;
  /** Allow editing (admin) */
  editable?: boolean;
  /** Test id prefix, e.g. "admin.user.env_configs" */
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['user_environment_configs', props.userId],
    queryFn: async () => (await fetchUserEnvironmentConfigs(props.userId, { limit: 500 })).data,
    staleTime: 30_000,
  });

  const rows = useMemo(() => sortConfigs(q.data ?? []), [q.data]);

  const [editing, setEditing] = useState<UserEnvironmentConfig | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // form
  const [inherit, setInherit] = useState(true);
  const [canCreate, setCanCreate] = useState(true);
  const [canDestroy, setCanDestroy] = useState(true);
  const [lifetimeDays, setLifetimeDays] = useState('0');
  const [maxVps, setMaxVps] = useState('0');

  const [resetTarget, setResetTarget] = useState<UserEnvironmentConfig | null>(null);

  const prefix = props.testIdPrefix;

  const openEdit = (cfg: UserEnvironmentConfig) => {
    setEditing(cfg);
    const isDefault = cfg.default === true;
    setInherit(isDefault);
    setCanCreate(Boolean(cfg.can_create_vps));
    setCanDestroy(Boolean(cfg.can_destroy_vps));
    setLifetimeDays(secondsToDaysString(cfg.vps_lifetime));
    setMaxVps(String(typeof cfg.max_vps_count === 'number' ? cfg.max_vps_count : 0));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const saveM = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error('Missing config');

      if (inherit) {
        return await updateUserEnvironmentConfig(props.userId, editing.id, { default: true });
      }

      const max = Number(maxVps);
      if (!Number.isFinite(max) || max < 0) throw new Error(t('admin.user.env_configs.validation.max_vps'));

      let seconds = 0;
      try {
        seconds = daysStringToSeconds(lifetimeDays);
      } catch {
        throw new Error(t('admin.user.env_configs.validation.vps_lifetime'));
      }

      return await updateUserEnvironmentConfig(props.userId, editing.id, {
        default: false,
        can_create_vps: canCreate,
        can_destroy_vps: canDestroy,
        vps_lifetime: seconds,
        max_vps_count: Math.floor(max),
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['user_environment_configs', props.userId] });
      closeModal();
      pushToast({ variant: 'ok', title: t('admin.user.env_configs.toast.saved') });
    },
  });

  const resetM = useMutation({
    mutationFn: async (cfg: UserEnvironmentConfig) =>
      updateUserEnvironmentConfig(props.userId, cfg.id, { default: true }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['user_environment_configs', props.userId] });
      setResetTarget(null);
      pushToast({ variant: 'ok', title: t('admin.user.env_configs.toast.reset') });
    },
    onError: (err) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(err) }),
  });

  const lifetimePreview = useMemo(() => {
    try {
      const s = daysStringToSeconds(lifetimeDays);
      return s === 0 ? t('common.unlimited') : formatUptimeSeconds(s);
    } catch {
      return '—';
    }
  }, [lifetimeDays, t]);

  return (
    <>
      <Card testId={`${prefix}.card`}>
        <CardHeader title={t('admin.user.env_configs.title')} subtitle={t('admin.user.env_configs.subtitle')} />

        <CardBody>
          {q.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : q.isError ? (
            <Alert variant="danger" title={t('admin.user.env_configs.load_failed')}>
              {formatErrorMessage(q.error)}
            </Alert>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted" data-testid={`${prefix}.empty`}>
              {t('admin.user.env_configs.empty')}
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {rows.map((cfg) => {
                  const isDefault = cfg.default === true;
                  const isCustom = cfg.default === false;
                  const lifetime = typeof cfg.vps_lifetime === 'number' ? cfg.vps_lifetime : 0;
                  const max = typeof cfg.max_vps_count === 'number' ? cfg.max_vps_count : 0;

                  return (
                    <div
                      key={cfg.id}
                      data-testid={`${prefix}.row.${cfg.id}`}
                      className="rounded-md border border-border bg-surface-2 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-fg">{envLabel(cfg)}</div>
                          <div className="mt-0.5 text-xs text-faint">#{cfg.id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isDefault ? (
                            <Badge variant="neutral">{t('admin.user.env_configs.badge.inherited')}</Badge>
                          ) : isCustom ? (
                            <Badge variant="info">{t('admin.user.env_configs.badge.custom')}</Badge>
                          ) : (
                            <Badge variant="neutral">—</Badge>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-faint">{t('admin.user.env_configs.table.can_create')}</div>
                          <div className="font-medium text-fg">
                            {cfg.can_create_vps ? t('common.yes') : t('common.no')}
                          </div>
                        </div>
                        <div>
                          <div className="text-faint">{t('admin.user.env_configs.table.can_destroy')}</div>
                          <div className="font-medium text-fg">
                            {cfg.can_destroy_vps ? t('common.yes') : t('common.no')}
                          </div>
                        </div>
                        <div>
                          <div className="text-faint">{t('admin.user.env_configs.table.vps_lifetime')}</div>
                          <div className="font-medium text-fg">
                            {lifetime === 0 ? t('common.unlimited') : formatUptimeSeconds(lifetime)}
                          </div>
                        </div>
                        <div>
                          <div className="text-faint">{t('admin.user.env_configs.table.max_vps')}</div>
                          <div className="font-medium text-fg">{max === 0 ? t('common.unlimited') : String(max)}</div>
                        </div>
                      </div>

                      {props.editable ? (
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openEdit(cfg)}
                            testId={`${prefix}.row.${cfg.id}.edit`}
                          >
                            {t('common.edit')}
                          </Button>
                          {isCustom ? (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setResetTarget(cfg)}
                              testId={`${prefix}.row.${cfg.id}.reset`}
                            >
                              {t('admin.user.env_configs.reset')}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <Table minWidth="md" testId={`${prefix}.table`}>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-2">{t('admin.user.env_configs.table.environment')}</th>
                      <th className="px-4 py-2">{t('admin.user.env_configs.table.mode')}</th>
                      <th className="px-4 py-2">{t('admin.user.env_configs.table.can_create')}</th>
                      <th className="px-4 py-2">{t('admin.user.env_configs.table.can_destroy')}</th>
                      <th className="px-4 py-2">{t('admin.user.env_configs.table.vps_lifetime')}</th>
                      <th className="px-4 py-2">{t('admin.user.env_configs.table.max_vps')}</th>
                      {props.editable ? (
                        <th className="px-4 py-2 text-right">{t('admin.user.env_configs.table.actions')}</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((cfg) => {
                      const isDefault = cfg.default === true;
                      const isCustom = cfg.default === false;
                      const lifetime = typeof cfg.vps_lifetime === 'number' ? cfg.vps_lifetime : 0;
                      const max = typeof cfg.max_vps_count === 'number' ? cfg.max_vps_count : 0;

                      return (
                        <tr
                          key={cfg.id}
                          className="border-b border-border/60 last:border-b-0"
                          data-testid={`${prefix}.row.${cfg.id}`}
                        >
                          <td className="px-4 py-2">
                            <div className="font-medium text-fg">{envLabel(cfg)}</div>
                            <div className="text-xs text-faint">#{cfg.id}</div>
                          </td>
                          <td className="px-4 py-2">
                            {isDefault ? (
                              <Badge variant="neutral">{t('admin.user.env_configs.badge.inherited')}</Badge>
                            ) : isCustom ? (
                              <Badge variant="info">{t('admin.user.env_configs.badge.custom')}</Badge>
                            ) : (
                              <Badge variant="neutral">—</Badge>
                            )}
                          </td>
                          <td className="px-4 py-2">{cfg.can_create_vps ? t('common.yes') : t('common.no')}</td>
                          <td className="px-4 py-2">{cfg.can_destroy_vps ? t('common.yes') : t('common.no')}</td>
                          <td className="px-4 py-2">
                            {lifetime === 0 ? t('common.unlimited') : formatUptimeSeconds(lifetime)}
                          </td>
                          <td className="px-4 py-2">{max === 0 ? t('common.unlimited') : String(max)}</td>
                          {props.editable ? (
                            <td className="px-4 py-2 text-right">
                              <div className="inline-flex items-center gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openEdit(cfg)}
                                  testId={`${prefix}.row.${cfg.id}.edit`}
                                >
                                  {t('common.edit')}
                                </Button>
                                {isCustom ? (
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => setResetTarget(cfg)}
                                    testId={`${prefix}.row.${cfg.id}.reset`}
                                  >
                                    {t('admin.user.env_configs.reset')}
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        size="md"
        title={
          editing
            ? t('admin.user.env_configs.modal.title', { environment: envLabel(editing) })
            : t('admin.user.env_configs.modal.title_fallback')
        }
        onClose={() => {
          if (saveM.isPending) return;
          closeModal();
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (saveM.isPending) return;
                closeModal();
              }}
              testId={`${prefix}.modal.cancel`}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={() => saveM.mutate()} loading={saveM.isPending} testId={`${prefix}.modal.save`}>
              {t('common.save')}
            </Button>
          </div>
        }
        testId={`${prefix}.modal`}
      >
        {saveM.isError ? (
          <Alert variant="danger" title={t('admin.user.env_configs.modal.save_failed')}>
            {formatErrorMessage(saveM.error)}
          </Alert>
        ) : null}

        <div className="space-y-4">
          <SwitchRow
            checked={inherit}
            onChange={setInherit}
            label={t('admin.user.env_configs.field.inherit')}
            description={t('admin.user.env_configs.field.inherit.help')}
            disabled={!props.editable}
            testId={`${prefix}.modal.inherit`}
          />

          <div className={inherit ? 'opacity-60' : ''}>
            <div className="grid gap-3 md:grid-cols-2">
              <SwitchRow
                checked={canCreate}
                onChange={setCanCreate}
                label={t('admin.user.env_configs.field.can_create')}
                description={t('admin.user.env_configs.field.can_create.help')}
                disabled={!props.editable || inherit}
                testId={`${prefix}.modal.can_create`}
              />

              <SwitchRow
                checked={canDestroy}
                onChange={setCanDestroy}
                label={t('admin.user.env_configs.field.can_destroy')}
                description={t('admin.user.env_configs.field.can_destroy.help')}
                disabled={!props.editable || inherit}
                testId={`${prefix}.modal.can_destroy`}
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm font-medium">{t('admin.user.env_configs.field.vps_lifetime_days')}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {t('admin.user.env_configs.field.vps_lifetime_days.help', { preview: lifetimePreview })}
                </div>
                <div className="mt-2">
                  <Input
                    type="number"
                    value={lifetimeDays}
                    onChange={(e) => setLifetimeDays(e.target.value)}
                    disabled={!props.editable || inherit}
                    testId={`${prefix}.modal.vps_lifetime_days`}
                  />
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">{t('admin.user.env_configs.field.max_vps')}</div>
                <div className="mt-0.5 text-xs text-muted">{t('admin.user.env_configs.field.max_vps.help')}</div>
                <div className="mt-2">
                  <Input
                    type="number"
                    value={maxVps}
                    onChange={(e) => setMaxVps(e.target.value)}
                    disabled={!props.editable || inherit}
                    testId={`${prefix}.modal.max_vps`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title={t('admin.user.env_configs.reset_confirm.title')}
        description={
          resetTarget
            ? t('admin.user.env_configs.reset_confirm.body', { environment: envLabel(resetTarget) })
            : undefined
        }
        danger
        confirmLabel={t('admin.user.env_configs.reset_confirm.confirm')}
        confirmLoading={resetM.isPending}
        onCancel={() => {
          if (resetM.isPending) return;
          setResetTarget(null);
        }}
        onConfirm={() => {
          if (!resetTarget) return;
          resetM.mutate(resetTarget);
        }}
        testId={`${prefix}.reset_confirm`}
      />
    </>
  );
}

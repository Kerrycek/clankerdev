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
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import { Table } from '../ui/Table';

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

interface EnvConfigDraft {
  inherit: boolean;
  canCreate: boolean;
  canDestroy: boolean;
  lifetimeDays: string;
  maxVps: string;
}

function makeDraft(cfg: UserEnvironmentConfig): EnvConfigDraft {
  return {
    inherit: cfg.default === true,
    canCreate: Boolean(cfg.can_create_vps),
    canDestroy: Boolean(cfg.can_destroy_vps),
    lifetimeDays: secondsToDaysString(cfg.vps_lifetime),
    maxVps: String(typeof cfg.max_vps_count === 'number' ? cfg.max_vps_count : 0),
  };
}

function draftChanged(cfg: UserEnvironmentConfig, draft: EnvConfigDraft): boolean {
  const original = makeDraft(cfg);
  if (draft.inherit !== original.inherit) return true;
  if (draft.inherit) return false;

  return (
    draft.canCreate !== original.canCreate ||
    draft.canDestroy !== original.canDestroy ||
    draft.lifetimeDays !== original.lifetimeDays ||
    draft.maxVps !== original.maxVps
  );
}

function draftPreview(draft: EnvConfigDraft, unlimited: string): string {
  try {
    const seconds = daysStringToSeconds(draft.lifetimeDays);
    return seconds === 0 ? unlimited : formatUptimeSeconds(seconds);
  } catch {
    return '—';
  }
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

  const [drafts, setDrafts] = useState<Record<number, EnvConfigDraft>>({});

  const prefix = props.testIdPrefix;

  const saveM = useMutation({
    mutationFn: async ({ cfg, draft }: { cfg: UserEnvironmentConfig; draft: EnvConfigDraft }) => {
      if (draft.inherit) {
        return await updateUserEnvironmentConfig(props.userId, cfg.id, { default: true });
      }

      const max = Number(draft.maxVps);
      if (!Number.isFinite(max) || max < 0) throw new Error(t('admin.user.env_configs.validation.max_vps'));

      let seconds = 0;
      try {
        seconds = daysStringToSeconds(draft.lifetimeDays);
      } catch {
        throw new Error(t('admin.user.env_configs.validation.vps_lifetime'));
      }

      return await updateUserEnvironmentConfig(props.userId, cfg.id, {
        default: false,
        can_create_vps: draft.canCreate,
        can_destroy_vps: draft.canDestroy,
        vps_lifetime: seconds,
        max_vps_count: Math.floor(max),
      });
    },
    onSuccess: async (_data, vars) => {
      await qc.invalidateQueries({ queryKey: ['user_environment_configs', props.userId] });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[vars.cfg.id];
        return next;
      });
      pushToast({ variant: 'ok', title: t('admin.user.env_configs.toast.saved') });
    },
    onError: (err) => pushToast({ variant: 'danger', title: t('common.error'), body: formatErrorMessage(err) }),
  });

  function draftFor(cfg: UserEnvironmentConfig): EnvConfigDraft {
    return drafts[cfg.id] ?? makeDraft(cfg);
  }

  function updateDraft<K extends keyof EnvConfigDraft>(cfg: UserEnvironmentConfig, key: K, value: EnvConfigDraft[K]) {
    setDrafts((prev) => ({
      ...prev,
      [cfg.id]: {
        ...(prev[cfg.id] ?? makeDraft(cfg)),
        [key]: value,
      },
    }));
  }

  function saveDisabled(cfg: UserEnvironmentConfig, draft: EnvConfigDraft): boolean {
    if (!draftChanged(cfg, draft)) return true;
    if (draft.inherit) return false;

    const max = Number(draft.maxVps);
    if (!Number.isFinite(max) || max < 0) return true;

    try {
      daysStringToSeconds(draft.lifetimeDays);
    } catch {
      return true;
    }

    return false;
  }

  function ModeCell(props2: { cfg: UserEnvironmentConfig; draft: EnvConfigDraft }) {
    return (
      <Select
        value={props2.draft.inherit ? 'inherit' : 'custom'}
        onChange={(e) => updateDraft(props2.cfg, 'inherit', e.target.value === 'inherit')}
        testId={`${prefix}.row.${props2.cfg.id}.mode`}
      >
        <option value="inherit">{t('admin.user.env_configs.badge.inherited')}</option>
        <option value="custom">{t('admin.user.env_configs.badge.custom')}</option>
      </Select>
    );
  }

  function BoolCell(props2: { cfg: UserEnvironmentConfig; draft: EnvConfigDraft; field: 'canCreate' | 'canDestroy' }) {
    return (
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={props2.draft[props2.field]}
          disabled={props2.draft.inherit}
          onChange={(e) => updateDraft(props2.cfg, props2.field, e.target.checked)}
          data-testid={`${prefix}.row.${props2.cfg.id}.${props2.field}`}
          className="h-4 w-4 rounded border-border text-accent focus:ring-focus"
        />
        <span>{props2.draft[props2.field] ? t('common.yes') : t('common.no')}</span>
      </label>
    );
  }

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
                        <div className="mt-3 space-y-3">
                          {(() => {
                            const draft = draftFor(cfg);
                            return (
                              <>
                                <ModeCell cfg={cfg} draft={draft} />
                                <div
                                  className={
                                    draft.inherit ? 'grid grid-cols-2 gap-2 opacity-60' : 'grid grid-cols-2 gap-2'
                                  }
                                >
                                  <BoolCell cfg={cfg} draft={draft} field="canCreate" />
                                  <BoolCell cfg={cfg} draft={draft} field="canDestroy" />
                                  <div>
                                    <div className="text-xs text-faint">
                                      {t('admin.user.env_configs.field.vps_lifetime_days')}
                                    </div>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={draft.lifetimeDays}
                                      onChange={(e) => updateDraft(cfg, 'lifetimeDays', e.target.value)}
                                      disabled={draft.inherit}
                                      testId={`${prefix}.row.${cfg.id}.vps_lifetime_days`}
                                    />
                                    <div className="mt-1 text-xs text-muted">
                                      {draftPreview(draft, t('common.unlimited'))}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-faint">
                                      {t('admin.user.env_configs.field.max_vps')}
                                    </div>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={draft.maxVps}
                                      onChange={(e) => updateDraft(cfg, 'maxVps', e.target.value)}
                                      disabled={draft.inherit}
                                      testId={`${prefix}.row.${cfg.id}.max_vps`}
                                    />
                                  </div>
                                </div>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => saveM.mutate({ cfg, draft })}
                                  loading={saveM.isPending}
                                  disabled={saveDisabled(cfg, draft)}
                                  testId={`${prefix}.row.${cfg.id}.save`}
                                >
                                  {t('common.save')}
                                </Button>
                              </>
                            );
                          })()}
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
                      const draft = draftFor(cfg);

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
                            {props.editable ? (
                              <ModeCell cfg={cfg} draft={draft} />
                            ) : isDefault ? (
                              <Badge variant="neutral">{t('admin.user.env_configs.badge.inherited')}</Badge>
                            ) : isCustom ? (
                              <Badge variant="info">{t('admin.user.env_configs.badge.custom')}</Badge>
                            ) : (
                              <Badge variant="neutral">—</Badge>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {props.editable ? (
                              <BoolCell cfg={cfg} draft={draft} field="canCreate" />
                            ) : cfg.can_create_vps ? (
                              t('common.yes')
                            ) : (
                              t('common.no')
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {props.editable ? (
                              <BoolCell cfg={cfg} draft={draft} field="canDestroy" />
                            ) : cfg.can_destroy_vps ? (
                              t('common.yes')
                            ) : (
                              t('common.no')
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {props.editable ? (
                              <div className="w-28">
                                <Input
                                  type="number"
                                  min={0}
                                  value={draft.lifetimeDays}
                                  onChange={(e) => updateDraft(cfg, 'lifetimeDays', e.target.value)}
                                  disabled={draft.inherit}
                                  testId={`${prefix}.row.${cfg.id}.vps_lifetime_days`}
                                />
                                <div className="mt-1 text-xs text-muted">
                                  {draftPreview(draft, t('common.unlimited'))}
                                </div>
                              </div>
                            ) : lifetime === 0 ? (
                              t('common.unlimited')
                            ) : (
                              formatUptimeSeconds(lifetime)
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {props.editable ? (
                              <div className="w-28">
                                <Input
                                  type="number"
                                  min={0}
                                  value={draft.maxVps}
                                  onChange={(e) => updateDraft(cfg, 'maxVps', e.target.value)}
                                  disabled={draft.inherit}
                                  testId={`${prefix}.row.${cfg.id}.max_vps`}
                                />
                              </div>
                            ) : max === 0 ? (
                              t('common.unlimited')
                            ) : (
                              String(max)
                            )}
                          </td>
                          {props.editable ? (
                            <td className="px-4 py-2 text-right">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => saveM.mutate({ cfg, draft })}
                                loading={saveM.isPending}
                                disabled={saveDisabled(cfg, draft)}
                                testId={`${prefix}.row.${cfg.id}.save`}
                              >
                                {t('common.save')}
                              </Button>
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
    </>
  );
}

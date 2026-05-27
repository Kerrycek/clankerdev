import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useChrome } from '../../../components/layout/ChromeContext';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Input } from '../../../components/ui/Input';
import { NodeLookupInput } from '../../../components/ui/NodeLookupInput';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';
import { VpsLookupInput } from '../../../components/ui/VpsLookupInput';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { fetchOsTemplates, type OsTemplate } from '../../../lib/api/osTemplates';
import {
  updateVps,
  vpsBoot,
  vpsClone,
  vpsDelete,
  vpsMigrate,
  vpsReinstall,
  vpsReplace,
  vpsSwapWith,
  type VpsBootPayload,
  type VpsClonePayload,
  type VpsMigratePayload,
  type VpsReplacePayload,
  type VpsSwapWithPayload,
} from '../../../lib/api/vps';
import { formatDateTime } from '../../../lib/format';
import { gateVpsMutation } from '../../../lib/gates/vps';
import { preflightVpsNotBusy } from './vpsPreflight';
import { useVps } from './VpsContext';

type CloneForm = {
  user: string;
  node: string;
  hostname: string;
  subdatasets: boolean;
  datasetPlans: boolean;
  resources: boolean;
  features: boolean;
  stop: boolean;
  confirm: boolean;
};

type SwapForm = {
  targetVps: number | null;
  hostname: boolean;
  resources: boolean;
  expirations: boolean;
  confirm: boolean;
};

type ReplaceForm = {
  node: string;
  expirationDate: string;
  start: boolean;
  reason: string;
  confirm: boolean;
};

type TemplateForm = {
  osTemplate: string;
  autoUpdate: boolean;
  confirm: boolean;
};

type BootForm = {
  osTemplate: string;
  mountRootDataset: boolean;
  mountpoint: string;
  confirm: boolean;
};

type ReinstallForm = {
  osTemplate: string;
  confirm: boolean;
};

type MigrateForm = {
  node: string;
  replaceIpAddresses: boolean;
  transferIpAddresses: boolean;
  maintenanceWindow: boolean;
  finishWeekday: string;
  finishMinutes: string;
  stopOnError: boolean;
  cleanupData: boolean;
  sendMail: boolean;
  confirm: boolean;
};

type DeleteForm = {
  lazy: boolean;
  confirm: boolean;
};

function resourceId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  if (value && typeof value === 'object') {
    const raw = (value as any).id;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) return Number(raw.trim());
  }
  return null;
}

function parseOptionalId(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0) throw new Error('invalid-id');
  return n;
}

function parseRequiredId(raw: string): number {
  const n = parseOptionalId(raw);
  if (n === undefined) throw new Error('required-id');
  return n;
}

function parseOptionalNonNegativeInt(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) throw new Error('invalid-id');
  return n;
}

function defaultExpirationInput(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 2);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoDateTime(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const d = new Date(trimmed);
  if (!Number.isFinite(d.getTime())) throw new Error('invalid-date');
  return d.toISOString();
}

function Field(props: { label: React.ReactNode; help?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted">{props.label}</div>
      <div className="mt-1">{props.children}</div>
      {props.help ? <div className="mt-1 text-xs text-faint">{props.help}</div> : null}
    </label>
  );
}

function templateLabel(tpl: OsTemplate): string {
  return String(tpl.label ?? tpl.name ?? `#${tpl.id}`);
}

function mutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message && error.message !== 'invalid-id' && error.message !== 'required-id' && error.message !== 'invalid-date') {
    return error.message;
  }
  return fallback;
}

export function VpsLifecyclePage() {
  const { t } = useI18n();
  const { mode, basePath } = useAppMode();
  const chrome = useChrome();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { vps, refetch, refetchChains, vpsRef, busyTransaction, busyLocalLock } = useVps();

  const vpsId = Number(vps.id);
  const objectLabel = String((vps as any).hostname ?? '') || `#${vpsId}`;
  const ownerId = resourceId((vps as any).user);
  const nodeId = resourceId((vps as any).node);
  const osTemplateId = resourceId((vps as any).os_template);
  const isAdminMode = mode === 'admin';

  const templatesQ = useQuery({
    queryKey: ['os_templates', 'vps-lifecycle', { limit: 500, enabled: true, hypervisorType: 'vpsadminos' }],
    queryFn: async () => (await fetchOsTemplates({ limit: 500, enabled: true, hypervisorType: 'vpsadminos' })).data,
    enabled: isAdminMode,
    staleTime: 60_000,
  });

  const [clone, setClone] = useState<CloneForm>(() => ({
    user: ownerId ? String(ownerId) : '',
    node: nodeId ? String(nodeId) : '',
    hostname: `${String((vps as any).hostname ?? `vps-${vpsId}`)}-${vpsId}-clone`,
    subdatasets: true,
    datasetPlans: true,
    resources: true,
    features: true,
    stop: true,
    confirm: false,
  }));

  const [swap, setSwap] = useState<SwapForm>({
    targetVps: null,
    hostname: true,
    resources: true,
    expirations: true,
    confirm: false,
  });

  const [replace, setReplace] = useState<ReplaceForm>(() => ({
    node: nodeId ? String(nodeId) : '',
    expirationDate: defaultExpirationInput(),
    start: false,
    reason: '',
    confirm: false,
  }));

  const [templateForm, setTemplateForm] = useState<TemplateForm>(() => ({
    osTemplate: osTemplateId ? String(osTemplateId) : '',
    autoUpdate: Boolean((vps as any).enable_os_template_auto_update),
    confirm: false,
  }));

  const [boot, setBoot] = useState<BootForm>(() => ({
    osTemplate: osTemplateId ? String(osTemplateId) : '',
    mountRootDataset: true,
    mountpoint: '/mnt/vps',
    confirm: false,
  }));

  const [reinstall, setReinstall] = useState<ReinstallForm>(() => ({
    osTemplate: osTemplateId ? String(osTemplateId) : '',
    confirm: false,
  }));

  const [migrate, setMigrate] = useState<MigrateForm>(() => ({
    node: nodeId ? String(nodeId) : '',
    replaceIpAddresses: false,
    transferIpAddresses: true,
    maintenanceWindow: false,
    finishWeekday: '',
    finishMinutes: '',
    stopOnError: true,
    cleanupData: true,
    sendMail: true,
    confirm: false,
  }));

  const [deleteForm, setDeleteForm] = useState<DeleteForm>({
    lazy: true,
    confirm: false,
  });

  const preflight = async () => {
    await preflightVpsNotBusy({ vpsId, t, knownBusy: busyLocalLock || busyTransaction });
  };

  const track = (meta: unknown, labelKey: string) => {
    const asId = getMetaActionStateId(meta);
    if (asId !== undefined) {
      chrome.trackActionState(asId, { actionLabelKey: labelKey, objectLabel, object: vpsRef });
    }
    refetchChains();
    refetch();
  };

  const cloneM = useMutation({
    mutationFn: async () => {
      await preflight();

      const payload: VpsClonePayload = {
        user: parseRequiredId(clone.user),
        node: parseRequiredId(clone.node),
        hostname: clone.hostname.trim() || undefined,
        subdatasets: clone.subdatasets,
        dataset_plans: clone.datasetPlans,
        resources: clone.resources,
        features: clone.features,
        stop: clone.stop,
      };

      return vpsClone(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.clone.label');
      const newId = Number((res.data as any)?.id);
      if (Number.isInteger(newId) && newId > 0) navigate(`${basePath}/vps/${newId}`);
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const swapM = useMutation({
    mutationFn: async () => {
      await preflight();
      if (!swap.targetVps) throw new Error('required-id');

      const payload: VpsSwapWithPayload = {
        vps: swap.targetVps,
        hostname: swap.hostname,
        resources: swap.resources,
        expirations: swap.expirations,
      };

      return vpsSwapWith(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.swap.label');
      void qc.invalidateQueries({ queryKey: ['vps', vpsId] });
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const replaceM = useMutation({
    mutationFn: async () => {
      await preflight();

      const payload: VpsReplacePayload = {
        node: parseOptionalId(replace.node),
        expiration_date: toIsoDateTime(replace.expirationDate),
        start: replace.start,
        reason: replace.reason.trim() || undefined,
      };

      return vpsReplace(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.replace.label');
      const newId = Number((res.data as any)?.id);
      if (Number.isInteger(newId) && newId > 0 && newId !== vpsId) navigate(`${basePath}/vps/${newId}`);
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const templateM = useMutation({
    mutationFn: async () => {
      await preflight();
      const payload: Record<string, unknown> = {
        os_template: parseRequiredId(templateForm.osTemplate),
        enable_os_template_auto_update: templateForm.autoUpdate,
      };
      return updateVps(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.template.label');
      void qc.invalidateQueries({ queryKey: ['vps', vpsId] });
      setTemplateForm((p) => ({ ...p, confirm: false }));
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const bootM = useMutation({
    mutationFn: async () => {
      await preflight();
      const payload: VpsBootPayload = {
        os_template: parseRequiredId(boot.osTemplate),
      };
      if (boot.mountRootDataset) {
        const mountpoint = boot.mountpoint.trim();
        if (!mountpoint || !mountpoint.startsWith('/')) throw new Error('invalid-id');
        payload.mount_root_dataset = mountpoint;
      }
      return vpsBoot(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.boot.label');
      setBoot((p) => ({ ...p, confirm: false }));
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const reinstallM = useMutation({
    mutationFn: async () => {
      await preflight();
      return vpsReinstall(vpsId, { os_template: parseRequiredId(reinstall.osTemplate) });
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.reinstall.label');
      setReinstall((p) => ({ ...p, confirm: false }));
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const migrateM = useMutation({
    mutationFn: async () => {
      await preflight();
      const finishWeekday = parseOptionalNonNegativeInt(migrate.finishWeekday);
      const finishMinutes = parseOptionalNonNegativeInt(migrate.finishMinutes);
      if ((finishWeekday === undefined) !== (finishMinutes === undefined)) throw new Error('invalid-id');
      if (migrate.maintenanceWindow && (finishWeekday !== undefined || finishMinutes !== undefined)) throw new Error('invalid-id');
      const payload: VpsMigratePayload = {
        node: parseRequiredId(migrate.node),
        replace_ip_addresses: migrate.replaceIpAddresses,
        transfer_ip_addresses: migrate.transferIpAddresses,
        maintenance_window: migrate.maintenanceWindow,
        stop_on_error: migrate.stopOnError,
        cleanup_data: migrate.cleanupData,
        send_mail: migrate.sendMail,
      };
      if (finishWeekday !== undefined) payload.finish_weekday = finishWeekday;
      if (finishMinutes !== undefined) payload.finish_minutes = finishMinutes;
      return vpsMigrate(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.migrate.label');
      setMigrate((p) => ({ ...p, confirm: false }));
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const deleteM = useMutation({
    mutationFn: async () => {
      await preflight();
      return vpsDelete(vpsId, { lazy: deleteForm.lazy });
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, 'action.vps.delete.label');
      navigate(`${basePath}/vps`);
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });

  const busyLocal =
    busyLocalLock ||
    cloneM.isPending ||
    swapM.isPending ||
    replaceM.isPending ||
    templateM.isPending ||
    bootM.isPending ||
    reinstallM.isPending ||
    migrateM.isPending ||
    deleteM.isPending;
  const gate = gateVpsMutation({ vps, busyLocal, busyTransaction });

  const adminSummary = useMemo(
    () => [
      t('vps.lifecycle.admin.summary.clone'),
      t('vps.lifecycle.admin.summary.swap'),
      t('vps.lifecycle.admin.summary.replace'),
      t('vps.lifecycle.admin.summary.template'),
      t('vps.lifecycle.admin.summary.boot'),
      t('vps.lifecycle.admin.summary.migrate'),
      t('vps.lifecycle.admin.summary.delete'),
    ],
    [t],
  );

  if (!isAdminMode) {
    return (
      <Card testId="vps.lifecycle.user_blocked">
        <CardHeader title={t('vps.lifecycle.title')} subtitle={t('vps.lifecycle.user_blocked.subtitle')} />
        <CardBody>
          <Alert variant="neutral">{t('vps.lifecycle.user_blocked.body')}</Alert>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="vps.lifecycle.page">
      <Card testId="vps.lifecycle.summary">
        <CardHeader title={t('vps.lifecycle.title')} subtitle={t('vps.lifecycle.subtitle_admin')} />
        <CardBody>
          <div className="grid gap-3 md:grid-cols-3">
            {adminSummary.map((item) => (
              <div key={item} className="rounded-md border border-border bg-surface-2 p-3 text-sm text-muted">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-faint">
            {t('vps.lifecycle.current_target', {
              vps: `#${vpsId}`,
              node: nodeId ? `#${nodeId}` : '—',
              owner: ownerId ? `#${ownerId}` : '—',
              expiration: formatDateTime((vps as any).expiration_date),
            })}
          </div>
        </CardBody>
      </Card>

      <Card testId="vps.lifecycle.template">
        <CardHeader title={t('vps.lifecycle.template.title')} subtitle={t('vps.lifecycle.template.subtitle')} />
        <CardBody className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t('vps.lifecycle.field.os_template')} help={t('vps.lifecycle.template.os_template_help')}>
              <Select
                value={templateForm.osTemplate}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, osTemplate: e.target.value }))}
                disabled={templateM.isPending || templatesQ.isLoading}
                testId="vps.lifecycle.template.os_template"
              >
                <option value="">{t('vps.lifecycle.placeholder.os_template')}</option>
                {templatesQ.data?.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {templateLabel(tpl)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex items-end">
              <Checkbox
                checked={templateForm.autoUpdate}
                onChange={(v) => setTemplateForm((p) => ({ ...p, autoUpdate: v }))}
                label={t('vps.lifecycle.template.auto_update')}
                description={t('vps.lifecycle.template.auto_update_help')}
                testId="vps.lifecycle.template.auto_update"
              />
            </div>
          </div>

          <Checkbox
            checked={templateForm.confirm}
            onChange={(v) => setTemplateForm((p) => ({ ...p, confirm: v }))}
            label={t('vps.lifecycle.confirm.template')}
            testId="vps.lifecycle.template.confirm"
          />

          {templateM.isError ? (
            <Alert title={t('vps.lifecycle.template.error')} variant="danger">
              {mutationErrorMessage(templateM.error, t('vps.lifecycle.validation.template'))}
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <ActionButton
              variant="primary"
              testId="vps.lifecycle.template.submit"
              disabled={!templateForm.confirm || !templateForm.osTemplate || !gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={templateM.isPending}
              onClick={() => templateM.mutate()}
            >
              {t('vps.lifecycle.template.submit')}
            </ActionButton>
          </div>
        </CardBody>
      </Card>

      <Card testId="vps.lifecycle.boot">
        <CardHeader title={t('vps.lifecycle.boot.title')} subtitle={t('vps.lifecycle.boot.subtitle')} />
        <CardBody className="space-y-4">
          <Alert variant="warn" title={t('vps.lifecycle.boot.warning_title')}>
            {t('vps.lifecycle.boot.warning_body')}
          </Alert>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t('vps.lifecycle.field.os_template')} help={t('vps.lifecycle.boot.os_template_help')}>
              <Select
                value={boot.osTemplate}
                onChange={(e) => setBoot((prev) => ({ ...prev, osTemplate: e.target.value }))}
                disabled={bootM.isPending || templatesQ.isLoading}
                testId="vps.lifecycle.boot.os_template"
              >
                <option value="">{t('vps.lifecycle.placeholder.os_template')}</option>
                {templatesQ.data?.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {templateLabel(tpl)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('vps.lifecycle.boot.mountpoint')} help={t('vps.lifecycle.boot.mountpoint_help')}>
              <Input
                value={boot.mountpoint}
                onChange={(e) => setBoot((prev) => ({ ...prev, mountpoint: e.target.value }))}
                disabled={bootM.isPending || !boot.mountRootDataset}
                testId="vps.lifecycle.boot.mountpoint"
              />
            </Field>
          </div>

          <Checkbox
            checked={boot.mountRootDataset}
            onChange={(v) => setBoot((p) => ({ ...p, mountRootDataset: v }))}
            label={t('vps.lifecycle.boot.mount_root_dataset')}
            description={t('vps.lifecycle.boot.mount_root_dataset_help')}
            testId="vps.lifecycle.boot.mount_root_dataset"
          />

          <Checkbox
            checked={boot.confirm}
            onChange={(v) => setBoot((p) => ({ ...p, confirm: v }))}
            label={t('vps.lifecycle.confirm.boot')}
            testId="vps.lifecycle.boot.confirm"
          />

          {bootM.isError ? (
            <Alert title={t('vps.lifecycle.boot.error')} variant="danger">
              {mutationErrorMessage(bootM.error, t('vps.lifecycle.validation.boot'))}
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <ActionButton
              variant="danger"
              testId="vps.lifecycle.boot.submit"
              disabled={!boot.confirm || !boot.osTemplate || !gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={bootM.isPending}
              onClick={() => bootM.mutate()}
            >
              {t('vps.lifecycle.boot.submit')}
            </ActionButton>
          </div>
        </CardBody>
      </Card>

      <Card testId="vps.lifecycle.reinstall">
        <CardHeader title={t('vps.lifecycle.reinstall.title')} subtitle={t('vps.lifecycle.reinstall.subtitle')} />
        <CardBody className="space-y-4">
          <Alert variant="warn" title={t('vps.lifecycle.reinstall.warning_title')}>
            {t('vps.lifecycle.reinstall.warning_body')}
          </Alert>

          <Field label={t('vps.lifecycle.field.os_template')} help={t('vps.lifecycle.reinstall.os_template_help')}>
            <Select
              value={reinstall.osTemplate}
              onChange={(e) => setReinstall((prev) => ({ ...prev, osTemplate: e.target.value }))}
              disabled={reinstallM.isPending || templatesQ.isLoading}
              testId="vps.lifecycle.reinstall.os_template"
            >
              <option value="">{t('vps.lifecycle.placeholder.os_template')}</option>
              {templatesQ.data?.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {templateLabel(tpl)}
                </option>
              ))}
            </Select>
          </Field>

          <Checkbox
            checked={reinstall.confirm}
            onChange={(v) => setReinstall((p) => ({ ...p, confirm: v }))}
            label={t('vps.lifecycle.confirm.reinstall')}
            testId="vps.lifecycle.reinstall.confirm"
          />

          {reinstallM.isError ? (
            <Alert title={t('vps.lifecycle.reinstall.error')} variant="danger">
              {mutationErrorMessage(reinstallM.error, t('vps.lifecycle.validation.reinstall'))}
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <ActionButton
              variant="danger"
              testId="vps.lifecycle.reinstall.submit"
              disabled={!reinstall.confirm || !reinstall.osTemplate || !gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={reinstallM.isPending}
              onClick={() => reinstallM.mutate()}
            >
              {t('vps.lifecycle.reinstall.submit')}
            </ActionButton>
          </div>
        </CardBody>
      </Card>

      <Card testId="vps.lifecycle.clone">
        <CardHeader title={t('vps.lifecycle.clone.title')} subtitle={t('vps.lifecycle.clone.subtitle')} />
        <CardBody className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label={t('vps.lifecycle.field.owner')} help={t('vps.lifecycle.clone.owner_help')}>
              <UserLookupInput
                value={clone.user}
                onChange={(user) => setClone((prev) => ({ ...prev, user }))}
                placeholder={t('vps.lifecycle.placeholder.user')}
                testId="vps.lifecycle.clone.user"
                disabled={cloneM.isPending}
              />
            </Field>
            <Field label={t('vps.lifecycle.field.node')} help={t('vps.lifecycle.clone.node_help')}>
              <NodeLookupInput
                value={clone.node}
                onChange={(node) => setClone((prev) => ({ ...prev, node }))}
                placeholder={t('vps.lifecycle.placeholder.node')}
                testId="vps.lifecycle.clone.node"
                disabled={cloneM.isPending}
              />
            </Field>
            <Field label={t('vps.lifecycle.field.hostname')} help={t('vps.lifecycle.clone.hostname_help')}>
              <Input
                value={clone.hostname}
                onChange={(e) => setClone((prev) => ({ ...prev, hostname: e.target.value }))}
                testId="vps.lifecycle.clone.hostname"
                disabled={cloneM.isPending}
              />
            </Field>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <Checkbox checked={clone.subdatasets} onChange={(v) => setClone((p) => ({ ...p, subdatasets: v }))} label={t('vps.lifecycle.clone.option.subdatasets')} testId="vps.lifecycle.clone.subdatasets" />
            <Checkbox checked={clone.datasetPlans} onChange={(v) => setClone((p) => ({ ...p, datasetPlans: v }))} label={t('vps.lifecycle.clone.option.dataset_plans')} testId="vps.lifecycle.clone.dataset_plans" />
            <Checkbox checked={clone.resources} onChange={(v) => setClone((p) => ({ ...p, resources: v }))} label={t('vps.lifecycle.clone.option.resources')} testId="vps.lifecycle.clone.resources" />
            <Checkbox checked={clone.features} onChange={(v) => setClone((p) => ({ ...p, features: v }))} label={t('vps.lifecycle.clone.option.features')} testId="vps.lifecycle.clone.features" />
            <Checkbox checked={clone.stop} onChange={(v) => setClone((p) => ({ ...p, stop: v }))} label={t('vps.lifecycle.clone.option.stop')} testId="vps.lifecycle.clone.stop" />
          </div>

          <Checkbox
            checked={clone.confirm}
            onChange={(v) => setClone((p) => ({ ...p, confirm: v }))}
            label={t('vps.lifecycle.confirm.clone')}
            testId="vps.lifecycle.clone.confirm"
          />

          {cloneM.isError ? (
            <Alert title={t('vps.lifecycle.clone.error')} variant="danger">
              {mutationErrorMessage(cloneM.error, t('vps.lifecycle.validation.clone'))}
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <ActionButton
              variant="primary"
              testId="vps.lifecycle.clone.submit"
              disabled={!clone.confirm || !gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={cloneM.isPending}
              onClick={() => cloneM.mutate()}
            >
              {t('vps.lifecycle.clone.submit')}
            </ActionButton>
          </div>
        </CardBody>
      </Card>

      <Card testId="vps.lifecycle.swap">
        <CardHeader title={t('vps.lifecycle.swap.title')} subtitle={t('vps.lifecycle.swap.subtitle')} />
        <CardBody className="space-y-4">
          <Field label={t('vps.lifecycle.field.target_vps')} help={t('vps.lifecycle.swap.target_help')}>
            <VpsLookupInput
              value={swap.targetVps}
              onChange={(targetVps) => setSwap((prev) => ({ ...prev, targetVps }))}
              placeholder={t('vps.lifecycle.placeholder.vps')}
              testId="vps.lifecycle.swap.target"
              disabled={swapM.isPending}
            />
          </Field>

          <div className="grid gap-2 sm:grid-cols-3">
            <Checkbox checked={swap.hostname} onChange={(v) => setSwap((p) => ({ ...p, hostname: v }))} label={t('vps.lifecycle.swap.option.hostname')} testId="vps.lifecycle.swap.hostname" />
            <Checkbox checked={swap.resources} onChange={(v) => setSwap((p) => ({ ...p, resources: v }))} label={t('vps.lifecycle.swap.option.resources')} testId="vps.lifecycle.swap.resources" />
            <Checkbox checked={swap.expirations} onChange={(v) => setSwap((p) => ({ ...p, expirations: v }))} label={t('vps.lifecycle.swap.option.expirations')} testId="vps.lifecycle.swap.expirations" />
          </div>

          <Checkbox
            checked={swap.confirm}
            onChange={(v) => setSwap((p) => ({ ...p, confirm: v }))}
            label={t('vps.lifecycle.confirm.swap')}
            testId="vps.lifecycle.swap.confirm"
          />

          {swapM.isError ? (
            <Alert title={t('vps.lifecycle.swap.error')} variant="danger">
              {mutationErrorMessage(swapM.error, t('vps.lifecycle.validation.swap'))}
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <ActionButton
              variant="danger"
              testId="vps.lifecycle.swap.submit"
              disabled={!swap.confirm || !swap.targetVps || !gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={swapM.isPending}
              onClick={() => swapM.mutate()}
            >
              {t('vps.lifecycle.swap.submit')}
            </ActionButton>
          </div>
        </CardBody>
      </Card>

      <Card testId="vps.lifecycle.replace">
        <CardHeader title={t('vps.lifecycle.replace.title')} subtitle={t('vps.lifecycle.replace.subtitle')} />
        <CardBody className="space-y-4">
          <Alert variant="warn" title={t('vps.lifecycle.replace.warning_title')}>
            {t('vps.lifecycle.replace.warning_body')}
          </Alert>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t('vps.lifecycle.field.node')} help={t('vps.lifecycle.replace.node_help')}>
              <NodeLookupInput
                value={replace.node}
                onChange={(node) => setReplace((prev) => ({ ...prev, node }))}
                placeholder={t('vps.lifecycle.placeholder.node_optional')}
                testId="vps.lifecycle.replace.node"
                disabled={replaceM.isPending}
              />
            </Field>
            <Field label={t('vps.lifecycle.field.expiration_date')} help={t('vps.lifecycle.replace.expiration_help')}>
              <Input
                type="datetime-local"
                value={replace.expirationDate}
                onChange={(e) => setReplace((prev) => ({ ...prev, expirationDate: e.target.value }))}
                testId="vps.lifecycle.replace.expiration"
                disabled={replaceM.isPending}
              />
            </Field>
          </div>

          <Checkbox
            checked={replace.start}
            onChange={(v) => setReplace((p) => ({ ...p, start: v }))}
            label={t('vps.lifecycle.replace.start')}
            description={t('vps.lifecycle.replace.start_help')}
            testId="vps.lifecycle.replace.start"
          />

          <Field label={t('vps.lifecycle.field.reason')} help={t('vps.lifecycle.replace.reason_help')}>
            <Textarea
              rows={3}
              value={replace.reason}
              onChange={(e) => setReplace((prev) => ({ ...prev, reason: e.target.value }))}
              testId="vps.lifecycle.replace.reason"
              disabled={replaceM.isPending}
            />
          </Field>

          <Checkbox
            checked={replace.confirm}
            onChange={(v) => setReplace((p) => ({ ...p, confirm: v }))}
            label={t('vps.lifecycle.confirm.replace')}
            testId="vps.lifecycle.replace.confirm"
          />

          {replaceM.isError ? (
            <Alert title={t('vps.lifecycle.replace.error')} variant="danger">
              {mutationErrorMessage(replaceM.error, t('vps.lifecycle.validation.replace'))}
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <ActionButton
              variant="danger"
              testId="vps.lifecycle.replace.submit"
              disabled={!replace.confirm || !gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={replaceM.isPending}
              onClick={() => replaceM.mutate()}
            >
              {t('vps.lifecycle.replace.submit')}
            </ActionButton>
          </div>
        </CardBody>
      </Card>

      <Card testId="vps.lifecycle.migrate">
        <CardHeader title={t('vps.lifecycle.migrate.title')} subtitle={t('vps.lifecycle.migrate.subtitle')} />
        <CardBody className="space-y-4">
          <Field label={t('vps.lifecycle.field.node')} help={t('vps.lifecycle.migrate.node_help')}>
            <NodeLookupInput
              value={migrate.node}
              onChange={(node) => setMigrate((prev) => ({ ...prev, node }))}
              placeholder={t('vps.lifecycle.placeholder.node')}
              testId="vps.lifecycle.migrate.node"
              disabled={migrateM.isPending}
            />
          </Field>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Checkbox checked={migrate.transferIpAddresses} onChange={(v) => setMigrate((p) => ({ ...p, transferIpAddresses: v }))} label={t('vps.lifecycle.migrate.option.transfer_ip_addresses')} testId="vps.lifecycle.migrate.transfer_ip_addresses" />
            <Checkbox checked={migrate.replaceIpAddresses} onChange={(v) => setMigrate((p) => ({ ...p, replaceIpAddresses: v }))} label={t('vps.lifecycle.migrate.option.replace_ip_addresses')} testId="vps.lifecycle.migrate.replace_ip_addresses" />
            <Checkbox checked={migrate.maintenanceWindow} onChange={(v) => setMigrate((p) => ({ ...p, maintenanceWindow: v }))} label={t('vps.lifecycle.migrate.option.maintenance_window')} testId="vps.lifecycle.migrate.maintenance_window" />
            <Checkbox checked={migrate.stopOnError} onChange={(v) => setMigrate((p) => ({ ...p, stopOnError: v }))} label={t('vps.lifecycle.migrate.option.stop_on_error')} testId="vps.lifecycle.migrate.stop_on_error" />
            <Checkbox checked={migrate.cleanupData} onChange={(v) => setMigrate((p) => ({ ...p, cleanupData: v }))} label={t('vps.lifecycle.migrate.option.cleanup_data')} testId="vps.lifecycle.migrate.cleanup_data" />
            <Checkbox checked={migrate.sendMail} onChange={(v) => setMigrate((p) => ({ ...p, sendMail: v }))} label={t('vps.lifecycle.migrate.option.send_mail')} testId="vps.lifecycle.migrate.send_mail" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t('vps.lifecycle.migrate.finish_weekday')} help={t('vps.lifecycle.migrate.finish_weekday_help')}>
              <Input
                value={migrate.finishWeekday}
                onChange={(e) => setMigrate((prev) => ({ ...prev, finishWeekday: e.target.value }))}
                testId="vps.lifecycle.migrate.finish_weekday"
                disabled={migrateM.isPending || migrate.maintenanceWindow}
              />
            </Field>
            <Field label={t('vps.lifecycle.migrate.finish_minutes')} help={t('vps.lifecycle.migrate.finish_minutes_help')}>
              <Input
                value={migrate.finishMinutes}
                onChange={(e) => setMigrate((prev) => ({ ...prev, finishMinutes: e.target.value }))}
                testId="vps.lifecycle.migrate.finish_minutes"
                disabled={migrateM.isPending || migrate.maintenanceWindow}
              />
            </Field>
          </div>

          <Checkbox
            checked={migrate.confirm}
            onChange={(v) => setMigrate((p) => ({ ...p, confirm: v }))}
            label={t('vps.lifecycle.confirm.migrate')}
            testId="vps.lifecycle.migrate.confirm"
          />

          {migrateM.isError ? (
            <Alert title={t('vps.lifecycle.migrate.error')} variant="danger">
              {mutationErrorMessage(migrateM.error, t('vps.lifecycle.validation.migrate'))}
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <ActionButton
              variant="danger"
              testId="vps.lifecycle.migrate.submit"
              disabled={!migrate.confirm || !migrate.node.trim() || !gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={migrateM.isPending}
              onClick={() => migrateM.mutate()}
            >
              {t('vps.lifecycle.migrate.submit')}
            </ActionButton>
          </div>
        </CardBody>
      </Card>

      <Card testId="vps.lifecycle.delete">
        <CardHeader title={t('vps.lifecycle.delete.title')} subtitle={t('vps.lifecycle.delete.subtitle')} />
        <CardBody className="space-y-4">
          <Alert variant="danger" title={t('vps.lifecycle.delete.warning_title')}>
            {t('vps.lifecycle.delete.warning_body')}
          </Alert>

          <Checkbox
            checked={deleteForm.lazy}
            onChange={(v) => setDeleteForm((p) => ({ ...p, lazy: v }))}
            label={t('vps.lifecycle.delete.lazy')}
            description={t('vps.lifecycle.delete.lazy_help')}
            testId="vps.lifecycle.delete.lazy"
          />
          <Checkbox
            checked={deleteForm.confirm}
            onChange={(v) => setDeleteForm((p) => ({ ...p, confirm: v }))}
            label={t('vps.lifecycle.confirm.delete')}
            testId="vps.lifecycle.delete.confirm"
          />

          {deleteM.isError ? (
            <Alert title={t('vps.lifecycle.delete.error')} variant="danger">
              {mutationErrorMessage(deleteM.error, t('vps.lifecycle.validation.delete'))}
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <ActionButton
              variant="danger"
              testId="vps.lifecycle.delete.submit"
              disabled={!deleteForm.confirm || !gate.allowed}
              disabledReason={!gate.allowed ? gate.reason : undefined}
              loading={deleteM.isPending}
              onClick={() => deleteM.mutate()}
            >
              {t('vps.lifecycle.delete.submit')}
            </ActionButton>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

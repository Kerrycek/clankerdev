import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Textarea } from '../../../components/ui/Textarea';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';
import { VpsLookupInput } from '../../../components/ui/VpsLookupInput';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { vpsClone, vpsReplace, vpsSwapWith, type VpsClonePayload, type VpsReplacePayload, type VpsSwapWithPayload } from '../../../lib/api/vps';
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
  const isAdminMode = mode === 'admin';

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

  const busyLocal = busyLocalLock || cloneM.isPending || swapM.isPending || replaceM.isPending;
  const gate = gateVpsMutation({ vps, busyLocal, busyTransaction });

  const adminSummary = useMemo(
    () => [
      t('vps.lifecycle.admin.summary.clone'),
      t('vps.lifecycle.admin.summary.swap'),
      t('vps.lifecycle.admin.summary.replace'),
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
    </div>
  );
}


import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../../../app/auth';
import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';
import { useChrome } from '../../../components/layout/ChromeContext';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import { fetchDataset, updateDataset } from '../../../lib/api/datasets';
import { getMetaActionStateId, isMissingActionStateError, requireActionStateResult } from '../../../lib/api/haveapi';
import { fetchActiveTransactionChains } from '../../../lib/api/transactions';
import { gateDatasetAction } from '../../../lib/gates/dataset';
import { formatMiB } from '../../../lib/format';
import { objectRef } from '../../../lib/objectRef';
import { hasActiveChains } from '../../../lib/taskStatus';
import { useVps } from './VpsContext';
import { datasetId, rootDatasetSummary, ssdSizeGiBInput, validateSsdResize } from './VpsStorageModel';
import { preflightVpsNotBusy } from './vpsPreflight';

/** Root disk edits stay independent of the VPS draft and its save operation. */
export function VpsResourceDiskCard(props: { vpsPending: boolean; onPendingChange: (pending: boolean) => void }) {
  const { t } = useI18n();
  const auth = useAuth();
  const { mode, basePath } = useAppMode();
  const { vps, busyTransaction, busyLocalLock } = useVps();
  const chrome = useChrome();
  const qc = useQueryClient();
  const canEdit = mode === 'admin' && auth.role === 'admin';
  const id = datasetId(vps.dataset);
  const [size, setSize] = useState<string | null>(null);
  const [override, setOverride] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const datasetQ = useQuery({
    queryKey: ['datasets', 'show', id, 'vps-resource-editor'],
    enabled: canEdit && id !== null,
    queryFn: async () => (await fetchDataset(id!, { includes: 'vps,environment,user,parent' })).data,
    refetchOnWindowFocus: false,
  });
  const chainsQ = useQuery({
    queryKey: ['transaction_chain', 'active', { className: 'Dataset', rowId: id }],
    enabled: canEdit && id !== null && datasetQ.isSuccess,
    queryFn: () => fetchActiveTransactionChains({ className: 'Dataset', rowId: id! }),
    refetchInterval: 15000,
  });
  const root = rootDatasetSummary(datasetQ.data ?? null, vps.dataset ?? null);
  const ref = id === null ? null : objectRef('Dataset', id);
  const gate = datasetQ.data ? gateDatasetAction('dataset.update', {
    dataset: datasetQ.data,
    permission: canEdit,
    role: auth.role,
    busyTransaction: busyTransaction || hasActiveChains(chainsQ.data ?? []),
    busyLocal: busyLocalLock || props.vpsPending || Boolean(ref && chrome.isLocallyLocked(ref)),
  }) : null;
  const input = size ?? ssdSizeGiBInput(root.referenceQuota);
  const validation = validateSsdResize(input, root.referenceQuota, root.used);
  const resize = useMutation({
    mutationFn: async (variables: { id: number; vpsId: number; value: number; override: boolean }) => {
      if (!canEdit) throw new Error(t('gate.blocked.permission.body'));
      await preflightVpsNotBusy({ vpsId: variables.vpsId, t, knownBusy: busyTransaction || busyLocalLock });
      const fresh = (await fetchDataset(variables.id, { includes: 'vps,user' })).data;
      const chains = await fetchActiveTransactionChains({ className: 'Dataset', rowId: variables.id });
      const freshGate = gateDatasetAction('dataset.update', { dataset: fresh, permission: canEdit, busyTransaction: hasActiveChains(chains) });
      if (!freshGate.allowed) throw new Error(t(freshGate.reason.titleKey));
      const freshRoot = rootDatasetSummary(fresh, vps.dataset ?? null);
      const checked = validateSsdResize(String(variables.value / 1024), freshRoot.referenceQuota, freshRoot.used);
      if (!checked.ok) throw new Error(t(`vps.storage.resize.validation.${checked.issue}`));
      return requireActionStateResult(await updateDataset(variables.id, {
        refquota: variables.value,
        ...(variables.override ? { admin_override: true } : {}),
      }), 'dataset.update');
    },
    onMutate: async (variables) => {
      const lockRef = objectRef('Dataset', variables.id);
      return { lockRef, generation: await chrome.acquireLocalLock(lockRef, { durable: true }) };
    },
    onSuccess: (response, variables, context) => {
      setConfirm(false);
      setSize(null);
      setOverride(false);
      setSubmitted(true);
      void qc.invalidateQueries({ queryKey: ['datasets', 'show', variables.id] });
      void qc.invalidateQueries({ queryKey: ['vps', 'show', { id: variables.vpsId }] });
      chrome.trackActionState(getMetaActionStateId(response.meta)!, {
        actionLabelKey: 'action.dataset.update.label',
        objectLabel: `${vps.hostname ?? variables.vpsId} · ${root.label}`,
        object: context?.lockRef,
        mutationGeneration: context?.generation,
      });
    },
    onSettled: (_data, error, _variables, context) => context && chrome.settleLocalLock(context.lockRef, error, context.generation),
  });
  useEffect(() => {
    props.onPendingChange(resize.isPending);
    return () => props.onPendingChange(false);
  }, [props.onPendingChange, resize.isPending]);
  if (!canEdit) return null;
  const disabled = !gate?.allowed || !validation.ok || resize.isPending || !chainsQ.isSuccess;
  const error = resize.error ? (isMissingActionStateError(resize.error) ? t('vps.resources.disk.unknown') : String(resize.error.message)) : null;
  const edit = (value: string) => { setSize(value); setSubmitted(false); resize.reset(); };

  return (
    <Card testId="vps.resources.disk">
      <CardHeader title={t('vps.config.field.ssd')} subtitle={t('vps.resources.disk.subtitle')} actions={<Badge variant="ok">{t('vps.config.risk.live')}</Badge>} />
      <CardBody className="space-y-4">
        {id === null ? <Alert variant="neutral">{t('vps.resources.disk.missing')}</Alert> : datasetQ.isLoading ? <Spinner /> : datasetQ.isError ? (
          <Alert variant="danger">
            {t('vps.resources.disk.load_error')}
            <Button variant="secondary" onClick={() => void datasetQ.refetch()}>{t('common.refresh')}</Button>
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0 break-all font-medium">{root.label}</span>
              <Button to={`${basePath}/datasets/${id}`} variant="ghost" size="sm">{t('common.details')}</Button>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface-2 p-3 text-sm">
              <div><div className="text-xs text-muted">{t('vps.resources.disk.current')}</div><strong>{root.referenceQuota === null ? t('common.na') : formatMiB(root.referenceQuota)}</strong></div>
              <div><div className="text-xs text-muted">{t('vps.resources.disk.used')}</div><strong>{root.used === null ? t('common.na') : formatMiB(root.used)}</strong></div>
            </div>
            <label className="block text-sm font-medium">
              {t('vps.storage.resize.field.size')}
              <Input value={input} type="number" min={0.01} step={1} onChange={event => edit(event.target.value)} disabled={resize.isPending || props.vpsPending} testId="vps.resources.disk.size" />
            </label>
            {size !== null && validation.issue && validation.issue !== 'unchanged' ? <Alert variant="warn">{t(`vps.storage.resize.validation.${validation.issue}`)}</Alert> : null}
            <Checkbox checked={override} onChange={value => { setOverride(value); resize.reset(); }} label={t('vps.config.field.admin_override')} description={t('vps.config.help.admin_override')} disabled={resize.isPending} testId="vps.resources.disk.override" />
            {gate && !gate.allowed ? <Alert variant="warn">{t(gate.reason.titleKey)}</Alert> : null}
            {chainsQ.isError ? <Alert variant="warn">{t('vps.resources.disk.load_error')} <Button variant="secondary" onClick={() => void chainsQ.refetch()}>{t('common.refresh')}</Button></Alert> : null}
            {error ? <Alert variant="danger">{error}</Alert> : null}
            {submitted ? <Alert variant="ok">{t('vps.resources.disk.submitted')}</Alert> : null}
            <ActionButton onClick={() => { resize.reset(); setConfirm(true); }} disabled={disabled} loading={resize.isPending} testId="vps.resources.disk.save">{t('vps.resources.disk.save')}</ActionButton>
          </>
        )}
        <ConfirmDialog open={confirm} title={t('vps.storage.resize.title')} confirmLabel={t('vps.resources.disk.save')} confirmLoading={resize.isPending} confirmDisabled={disabled} onCancel={() => setConfirm(false)} onConfirm={() => {
          if (disabled || id === null || validation.valueMiB === null) return;
          resize.mutate({ id, vpsId: Number(vps.id), value: validation.valueMiB, override });
        }} testId="vps.resources.disk.confirm">
          <div className="space-y-3">
            <div className="text-sm font-semibold">{String(vps.hostname ?? vps.id)} · {root.label}</div>
            <div className="rounded-lg border border-border bg-surface-2 p-3 text-lg font-semibold">{root.referenceQuota === null ? t('common.na') : formatMiB(root.referenceQuota)} → {formatMiB(validation.valueMiB ?? 0)}</div>
            <p className="text-sm text-muted">{t('vps.resources.disk.confirm_help')}</p>
            {override ? <Badge variant="warn">{t('vps.config.field.admin_override')}</Badge> : null}
            {error ? <Alert variant="danger">{error}</Alert> : null}
          </div>
        </ConfirmDialog>
      </CardBody>
    </Card>
  );
}

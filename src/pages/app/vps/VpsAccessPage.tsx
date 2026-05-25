import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../../app/i18n';
import { useChrome } from '../../../components/layout/ChromeContext';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import {
  deployVpsPublicKey,
  getCurrentUser,
  listUserPublicKeys,
  resetVpsRootPassword,
  type ApiResult,
  type UserIdentity,
  type VpsGeneratedPassword,
  type VpsPasswordType,
  type VpsPublicKey,
} from '../../../lib/api/vpsAccess';
import { gateVpsMutation } from '../../../lib/gates/vps';
import { preflightVpsNotBusy } from './vpsPreflight';
import { useVps } from './VpsContext';

type GeneratedCredential = {
  password: string;
  passwordType: VpsPasswordType;
};

function boolValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function resourceLabel(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return String(obj['label'] ?? obj['name'] ?? obj['full_name'] ?? obj['login'] ?? obj['id'] ?? '—');
  }
  return '—';
}

function resourceId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  if (value && typeof value === 'object') {
    const id = (value as Record<string, unknown>)['id'];
    if (typeof id === 'number' && Number.isFinite(id)) return id;
    if (typeof id === 'string' && /^\d+$/.test(id)) return Number(id);
  }
  return null;
}

function extractPassword(res: ApiResult<VpsGeneratedPassword>): string {
  const direct = (res.data as any)?.password;
  if (direct !== undefined && direct !== null && direct !== '') return String(direct);

  const raw = res.raw as any;
  const responsePassword = raw?.response?.vps?.password ?? raw?.response?.password ?? raw?.vps?.password ?? raw?.password;
  return responsePassword !== undefined && responsePassword !== null ? String(responsePassword) : '';
}

function publicKeyLabel(key: VpsPublicKey | null | undefined): string {
  if (!key) return '—';
  const label = key.label || key.comment || `#${key.id}`;
  return key.fingerprint ? `${label} · ${key.fingerprint}` : label;
}

function StatusItem(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs text-muted">{props.label}</div>
      <div className="mt-1 text-sm font-medium text-fg">{props.value}</div>
    </div>
  );
}

function PasswordBox(props: { password: string; onClear: () => void }) {
  const { t } = useI18n();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPassword = async () => {
    if (!navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(props.password);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          readOnly
          value={props.password}
          type={revealed ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-md border border-border bg-bg px-3 py-2 font-mono text-sm text-fg"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setRevealed((value) => !value)}>
            {revealed ? t('vps.access.secret.hide') : t('vps.access.secret.reveal')}
          </Button>
          <Button variant="secondary" onClick={() => void copyPassword()}>
            {copied ? t('vps.access.secret.copied') : t('vps.access.secret.copy')}
          </Button>
          <Button variant="secondary" onClick={props.onClear}>
            {t('vps.access.secret.clear')}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted">{t('vps.access.secret.once')}</p>
    </div>
  );
}

export function VpsAccessPage() {
  const chrome = useChrome();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { vps, refetch, refetchChains, vpsRef, busyTransaction, busyLocalLock } = useVps();
  const vpsId = Number(vps.id);
  const objectLabel = String((vps as any).hostname ?? '') || `#${vpsId}`;
  const isRunning = boolValue((vps as any).is_running);
  const ownerUserId = resourceId((vps as any).user);
  const ownerLabel = resourceLabel((vps as any).user);
  const [passwordType, setPasswordType] = useState<VpsPasswordType>('secure');
  const [pendingPasswordType, setPendingPasswordType] = useState<VpsPasswordType | null>(null);
  const [selectedPublicKeyId, setSelectedPublicKeyId] = useState<number | null>(null);
  const [pendingPublicKeyId, setPendingPublicKeyId] = useState<number | null>(null);
  const [generated, setGenerated] = useState<GeneratedCredential | null>(null);
  const [missingPassword, setMissingPassword] = useState(false);
  const [keyDeployMessage, setKeyDeployMessage] = useState('');

  const currentUserQ = useQuery<ApiResult<UserIdentity>>({
    queryKey: ['user', 'current'],
    queryFn: getCurrentUser,
    enabled: ownerUserId === null,
  });
  const fallbackUserId = resourceId((currentUserQ.data as ApiResult<any> | undefined)?.data);
  const publicKeyUserId = ownerUserId ?? fallbackUserId;

  const publicKeysQ = useQuery<ApiResult<VpsPublicKey[]>>({
    queryKey: ['user', 'public_keys', { userId: publicKeyUserId }],
    queryFn: () => listUserPublicKeys(publicKeyUserId as number),
    enabled: publicKeyUserId !== null,
  });

  const publicKeys: VpsPublicKey[] = useMemo(() => publicKeysQ.data?.data ?? [], [publicKeysQ.data]);
  const selectedPublicKey = useMemo(
    () => publicKeys.find((key: VpsPublicKey) => Number(key.id) === selectedPublicKeyId) ?? null,
    [publicKeys, selectedPublicKeyId]
  );
  const pendingPublicKey = useMemo(
    () => publicKeys.find((key: VpsPublicKey) => Number(key.id) === pendingPublicKeyId) ?? null,
    [pendingPublicKeyId, publicKeys]
  );

  useEffect(() => {
    if (publicKeys.length === 0) {
      setSelectedPublicKeyId(null);
      return;
    }
    if (!selectedPublicKeyId || !publicKeys.some((key: VpsPublicKey) => Number(key.id) === selectedPublicKeyId)) {
      const firstId = publicKeys[0]?.id;
      if (firstId !== undefined) setSelectedPublicKeyId(Number(firstId));
    }
  }, [publicKeys, selectedPublicKeyId]);

  const passwdM = useMutation({
    mutationFn: async (type: VpsPasswordType) => {
      await preflightVpsNotBusy({ vpsId, t, knownBusy: busyTransaction || busyLocalLock });
      return resetVpsRootPassword(vpsId, { type });
    },
    onMutate: () => {
      setGenerated(null);
      setMissingPassword(false);
      chrome.acquireLocalLock(vpsRef);
    },
    onSuccess: (res: ApiResult<VpsGeneratedPassword>, type: VpsPasswordType) => {
      setPendingPasswordType(null);
      const password = extractPassword(res);
      if (password) {
        setGenerated({ password, passwordType: type });
      } else {
        setMissingPassword(true);
      }
      void qc.invalidateQueries({ queryKey: ['vps', 'show', { id: vpsId }] });
      refetch();
      refetchChains();
      const asId = getMetaActionStateId(res.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.vps.access.passwd.label',
          objectLabel,
          object: vpsRef,
        });
      }
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => {
      chrome.releaseLocalLock(vpsRef);
    },
  });

  const deployKeyM = useMutation({
    mutationFn: async (publicKeyId: number) => {
      await preflightVpsNotBusy({ vpsId, t, knownBusy: busyTransaction || busyLocalLock });
      return deployVpsPublicKey(vpsId, publicKeyId);
    },
    onMutate: () => {
      setKeyDeployMessage('');
      chrome.acquireLocalLock(vpsRef);
    },
    onSuccess: (res: ApiResult<Record<string, never>>, publicKeyId: number) => {
      const deployedKey = publicKeys.find((key: VpsPublicKey) => Number(key.id) === publicKeyId);
      setPendingPublicKeyId(null);
      setKeyDeployMessage(publicKeyLabel(deployedKey));
      void qc.invalidateQueries({ queryKey: ['vps', 'show', { id: vpsId }] });
      refetch();
      refetchChains();
      const asId = getMetaActionStateId(res.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.vps.access.deploy_public_key.label',
          objectLabel,
          object: vpsRef,
        });
      }
    },
    onError: (e: any) => {
      if (e?.code === 'BUSY') chrome.openTasks();
    },
    onSettled: () => {
      chrome.releaseLocalLock(vpsRef);
    },
  });

  const busyLocal = busyLocalLock || passwdM.isPending || deployKeyM.isPending;
  const gate = gateVpsMutation({ vps, busyLocal, busyTransaction });
  const canGenerate = gate.allowed && !passwdM.isPending;
  const canDeployKey = gate.allowed && !deployKeyM.isPending && selectedPublicKeyId !== null && publicKeys.length > 0;
  const selectedTypeLabel = t(passwordType === 'secure' ? 'vps.access.password_type.secure' : 'vps.access.password_type.simple');
  const pendingTypeLabel = pendingPasswordType
    ? t(pendingPasswordType === 'secure' ? 'vps.access.password_type.secure' : 'vps.access.password_type.simple')
    : '';
  const selectedKeyLabel = publicKeyLabel(selectedPublicKey);
  const pendingKeyLabel = publicKeyLabel(pendingPublicKey);

  const statusItems = useMemo(
    () => [
      { label: t('vps.access.status.hostname'), value: objectLabel },
      { label: t('vps.access.status.os_template'), value: resourceLabel((vps as any).os_template) },
      { label: t('vps.access.status.owner'), value: ownerLabel },
      { label: t('vps.access.status.running'), value: isRunning ? t('vps.access.status.running_yes') : t('vps.access.status.running_no') },
      { label: t('vps.access.status.password_type'), value: selectedTypeLabel },
    ],
    [isRunning, objectLabel, ownerLabel, selectedTypeLabel, t, vps]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('vps.access.title')} subtitle={t('vps.access.subtitle')} />
        <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {statusItems.map((item) => (
            <StatusItem key={item.label} label={item.label} value={item.value} />
          ))}
        </CardBody>
      </Card>

      {!gate.allowed ? (
        <Alert variant="warn" title={t(gate.reason.titleKey)}>
          {gate.reason.descriptionKey ? <p>{t(gate.reason.descriptionKey)}</p> : null}
          <Button variant="secondary" onClick={() => chrome.openTasks()}>
            {t('common.open_tasks')}
          </Button>
        </Alert>
      ) : null}

      {passwdM.error ? <Alert variant="danger">{String((passwdM.error as any)?.message ?? passwdM.error)}</Alert> : null}
      {deployKeyM.error ? <Alert variant="danger">{String((deployKeyM.error as any)?.message ?? deployKeyM.error)}</Alert> : null}
      {missingPassword ? <Alert variant="warn">{t('vps.access.generated.missing_password')}</Alert> : null}
      {keyDeployMessage ? <Alert variant="info">{t('vps.access.ssh.deployed', { key: keyDeployMessage })}</Alert> : null}

      <Card>
        <CardHeader title={t('vps.access.reset.title')} subtitle={t('vps.access.reset.subtitle')} />
        <CardBody className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="space-y-2">
              <span className="text-sm font-medium text-fg">{t('vps.access.form.type.label')}</span>
              <select
                value={passwordType}
                onChange={(event: any) => setPasswordType(event.target.value as VpsPasswordType)}
                disabled={passwdM.isPending}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg"
              >
                <option value="secure">{t('vps.access.password_type.secure')}</option>
                <option value="simple">{t('vps.access.password_type.simple')}</option>
              </select>
              <span className="block text-xs text-muted">{t('vps.access.form.type.description')}</span>
            </label>

            <ActionButton loading={passwdM.isPending} disabled={!canGenerate} onClick={() => setPendingPasswordType(passwordType)}>
              {t('vps.access.reset.button')}
            </ActionButton>
          </div>

          <Alert variant="info" title={t('vps.access.safety.title')}>
            {t('vps.access.safety.description')}
          </Alert>
        </CardBody>
      </Card>

      {generated ? (
        <Card>
          <CardHeader
            title={t('vps.access.generated.title')}
            subtitle={t('vps.access.generated.subtitle', {
              type: t(generated.passwordType === 'secure' ? 'vps.access.password_type.secure' : 'vps.access.password_type.simple'),
            })}
          />
          <CardBody>
            <PasswordBox password={generated.password} onClear={() => setGenerated(null)} />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title={t('vps.access.ssh.title')} subtitle={t('vps.access.ssh.subtitle')} />
        <CardBody className="space-y-4">
          {publicKeyUserId === null && currentUserQ.isPending ? <Alert variant="info">{t('vps.access.ssh.loading_user')}</Alert> : null}
          {currentUserQ.error ? <Alert variant="danger">{String((currentUserQ.error as any)?.message ?? currentUserQ.error)}</Alert> : null}
          {publicKeysQ.error ? <Alert variant="danger">{String((publicKeysQ.error as any)?.message ?? publicKeysQ.error)}</Alert> : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
            <label className="space-y-2">
              <span className="text-sm font-medium text-fg">{t('vps.access.ssh.key.label')}</span>
              <select
                value={selectedPublicKeyId ?? ''}
                onChange={(event: any) => setSelectedPublicKeyId(event.target.value ? Number(event.target.value) : null)}
                disabled={publicKeysQ.isPending || publicKeys.length === 0 || deployKeyM.isPending}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg"
              >
                {publicKeys.length === 0 ? <option value="">{t('vps.access.ssh.no_keys_option')}</option> : null}
                {publicKeys.map((key: VpsPublicKey) => (
                  <option key={key.id} value={key.id}>
                    {publicKeyLabel(key)}
                  </option>
                ))}
              </select>
              <span className="block text-xs text-muted">
                {publicKeyUserId !== null
                  ? t('vps.access.ssh.key.description', { owner: ownerLabel || `#${publicKeyUserId}` })
                  : t('vps.access.ssh.key.description_unknown_owner')}
              </span>
            </label>

            <Button variant="secondary" onClick={() => void publicKeysQ.refetch()} disabled={publicKeyUserId === null || publicKeysQ.isPending}>
              {publicKeysQ.isPending ? t('vps.access.ssh.loading') : t('vps.access.ssh.refresh')}
            </Button>

            <ActionButton
              loading={deployKeyM.isPending}
              disabled={!canDeployKey}
              onClick={() => (selectedPublicKeyId !== null ? setPendingPublicKeyId(selectedPublicKeyId) : undefined)}
            >
              {t('vps.access.ssh.deploy.button')}
            </ActionButton>
          </div>

          {publicKeysQ.isPending ? <Alert variant="info">{t('vps.access.ssh.loading_keys')}</Alert> : null}
          {!publicKeysQ.isPending && publicKeyUserId !== null && publicKeys.length === 0 ? (
            <Alert variant="warn" title={t('vps.access.ssh.no_keys.title')}>
              {t('vps.access.ssh.no_keys.description')}
            </Alert>
          ) : null}

          {selectedPublicKey ? (
            <div className="rounded-lg border border-border bg-surface p-4 text-sm">
              <div className="font-medium text-fg">{selectedKeyLabel}</div>
              {selectedPublicKey.comment ? <div className="mt-1 text-muted">{selectedPublicKey.comment}</div> : null}
              {selectedPublicKey.auto_add !== undefined ? (
                <div className="mt-1 text-xs text-muted">
                  {selectedPublicKey.auto_add ? t('vps.access.ssh.auto_add.yes') : t('vps.access.ssh.auto_add.no')}
                </div>
              ) : null}
            </div>
          ) : null}

          <Alert variant="info" title={t('vps.access.ssh.safety.title')}>
            {t('vps.access.ssh.safety.description')}
          </Alert>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={pendingPasswordType !== null}
        title={t('vps.access.confirm.title')}
        description={t('vps.access.confirm.description', { hostname: objectLabel, type: pendingTypeLabel })}
        confirmLabel={t('vps.access.confirm.button')}
        confirmLoading={passwdM.isPending}
        confirmDisabled={!pendingPasswordType || passwdM.isPending}
        onCancel={() => setPendingPasswordType(null)}
        onConfirm={() => (pendingPasswordType ? passwdM.mutate(pendingPasswordType) : undefined)}
      />

      <ConfirmDialog
        open={pendingPublicKeyId !== null}
        title={t('vps.access.ssh.confirm.title')}
        description={t('vps.access.ssh.confirm.description', { hostname: objectLabel, key: pendingKeyLabel })}
        confirmLabel={t('vps.access.ssh.confirm.button')}
        confirmLoading={deployKeyM.isPending}
        confirmDisabled={!pendingPublicKeyId || deployKeyM.isPending}
        onCancel={() => setPendingPublicKeyId(null)}
        onConfirm={() => (pendingPublicKeyId ? deployKeyM.mutate(pendingPublicKeyId) : undefined)}
      />
    </div>
  );
}

export default VpsAccessPage;

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { useAppMode } from '../../../app/appMode';
import { useI18n } from '../../../app/i18n';

import { useChrome } from '../../../components/layout/ChromeContext';
import { Alert } from '../../../components/ui/Alert';
import { ActionButton } from '../../../components/ui/ActionButton';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';

import { deleteDnsZone, updateDnsZone } from '../../../lib/api/dns';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { formatErrorMessage } from '../../../lib/errors';
import { gateDnsAction } from '../../../lib/gates/dns';

import { useDnsZoneContext } from './DnsZoneContext';
import { preflightDnsZoneNotBusy } from './dnsPreflight';

export function DnsZoneSettingsPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const chrome = useChrome();
  const navigate = useNavigate();

  const { zone, refetch: refetchZone, refetchChains, zoneRef, busyLocalLock, busyTransaction, concernClasses } =
    useDnsZoneContext();

  const zoneLabelForToast = String((zone as any).name ?? (zone as any).label ?? `Zone #${zone.id}`);

  const zoneDefaults = useMemo(
    () => ({
      label: String((zone as any).label ?? ''),
      email: String((zone as any).email ?? ''),
      defaultTtl: (zone as any).default_ttl != null ? String((zone as any).default_ttl) : '',
      enabled: (zone as any).enabled !== false,
      dnssec: (zone as any).dnssec_enabled === true,
    }),
    [zone]
  );

  const [label, setLabel] = useState(zoneDefaults.label);
  const [email, setEmail] = useState(zoneDefaults.email);
  const [defaultTtl, setDefaultTtl] = useState(zoneDefaults.defaultTtl);
  const [enabled, setEnabled] = useState(zoneDefaults.enabled);
  const [dnssec, setDnssec] = useState(zoneDefaults.dnssec);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveM = useMutation({
    mutationFn: async () => {
      await preflightDnsZoneNotBusy({
        zoneId: zone.id,
        t,
        concernClasses,
        knownBusy: busyTransaction || busyLocalLock,
      });

      return updateDnsZone(zone.id, {
        label: label.trim() || undefined,
        email: email.trim() || undefined,
        default_ttl: defaultTtl.trim() ? Number(defaultTtl.trim()) : undefined,
        enabled,
        dnssec_enabled: dnssec,
      });
    },
    onMutate: () => {
      chrome.acquireLocalLock(zoneRef);
    },
    onSuccess: (r) => {
      const asId = getMetaActionStateId((r as any)?.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.dns.zone.update.label',
          objectLabel: zoneLabelForToast,
          object: zoneRef,
        });
      }
      refetchZone();
      refetchChains();
    },
    onSettled: () => {
      chrome.releaseLocalLock(zoneRef);
    },
    onError: (err: any) => {
      if (err?.code === 'BUSY') chrome.openTasks();
    },
  });

  const deleteM = useMutation({
    mutationFn: async () => {
      await preflightDnsZoneNotBusy({
        zoneId: zone.id,
        t,
        concernClasses,
        knownBusy: busyTransaction || busyLocalLock,
      });
      return deleteDnsZone(zone.id);
    },
    onMutate: () => {
      chrome.acquireLocalLock(zoneRef);
    },
    onSuccess: (r) => {
      const asId = getMetaActionStateId((r as any)?.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: 'action.dns.zone.delete.label',
          objectLabel: zoneLabelForToast,
          object: zoneRef,
        });
      }
      // When a zone is deleted successfully, go back to the list.
      navigate(`${basePath}/dns`);
    },
    onSettled: () => {
      chrome.releaseLocalLock(zoneRef);
    },
    onError: (err: any) => {
      if (err?.code === 'BUSY') chrome.openTasks();
    },
  });

  useEffect(() => {
    // Keep the form in sync when the zone changes/refetches.
    setLabel(zoneDefaults.label);
    setEmail(zoneDefaults.email);
    setDefaultTtl(zoneDefaults.defaultTtl);
    setEnabled(zoneDefaults.enabled);
    setDnssec(zoneDefaults.dnssec);
  }, [zoneDefaults]);

  const busyLocal = busyLocalLock || saveM.isPending || deleteM.isPending;
  const gateCtx = { busyLocal, busyTransaction };

  const saveGate = gateDnsAction('zone.update', gateCtx);
  const deleteGate = gateDnsAction('zone.delete', gateCtx);

  const formDisabled = saveM.isPending || deleteM.isPending;

  return (
    <div className="space-y-4" data-testid="dns.settings.form">
      <Card>
        <div className="p-4">
          <div className="text-sm font-medium">{t('dns.zone.settings.card.title')}</div>
          <div className="mt-1 text-sm text-muted">{t('dns.zone.settings.card.description')}</div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.settings.label.label')}</div>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('common.optional')}
                disabled={formDisabled}
                testId="dns.settings.label"
              />
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.settings.email.label')}</div>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('dns.zone.settings.email.placeholder')}
                disabled={formDisabled}
                testId="dns.settings.email"
              />
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-muted">{t('dns.zone.settings.ttl.label')}</div>
              <Input
                value={defaultTtl}
                onChange={(e) => setDefaultTtl(e.target.value)}
                placeholder={t('common.unchanged')}
                disabled={formDisabled}
                testId="dns.settings.default_ttl"
              />
            </div>

            <div className="space-y-2 pt-1">
              <Checkbox
                checked={enabled}
                onChange={setEnabled}
                label={t('common.enabled')}
                disabled={formDisabled}
                testId="dns.settings.enabled"
              />
              <Checkbox
                checked={dnssec}
                onChange={setDnssec}
                label={t('dns.zone.settings.dnssec.label')}
                disabled={formDisabled}
                testId="dns.settings.dnssec"
              />
            </div>
          </div>

          {saveM.isError ? (
            <Alert title={t('dns.zone.settings.save_failed')} variant="danger" className="mt-4">
              {formatErrorMessage(saveM.error)}
            </Alert>
          ) : null}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setLabel(zoneDefaults.label);
                setEmail(zoneDefaults.email);
                setDefaultTtl(zoneDefaults.defaultTtl);
                setEnabled(zoneDefaults.enabled);
                setDnssec(zoneDefaults.dnssec);
              }}
              disabled={formDisabled}
              testId="dns.settings.reset"
            >
              {t('common.reset')}
            </Button>
            <ActionButton
              onClick={() => saveM.mutate()}
              loading={saveM.isPending}
              disabled={!saveGate.allowed}
              disabledReason={!saveGate.allowed ? saveGate.reason : undefined}
              testId="dns.settings.save"
            >
              {saveM.isPending ? t('common.saving') : t('dns.zone.settings.action.save_changes')}
            </ActionButton>
          </div>
        </div>
      </Card>

      <Card testId="dns.settings.danger">
        <div className="p-4">
          <div className="text-sm font-medium text-danger">{t('dns.zone.settings.danger.title')}</div>
          <div className="mt-1 text-sm text-muted">{t('dns.zone.settings.danger.description')}</div>

          {deleteM.isError ? (
            <Alert title={t('dns.zone.settings.delete_failed')} variant="danger" className="mt-4">
              {formatErrorMessage(deleteM.error)}
            </Alert>
          ) : null}

          <div className="mt-4 flex justify-end">
            <ActionButton
              variant="danger"
              onClick={() => setConfirmDelete(true)}
              disabled={!deleteGate.allowed}
              disabledReason={!deleteGate.allowed ? deleteGate.reason : undefined}
              testId="dns.settings.delete.open"
            >
              {t('dns.zone.settings.action.delete_zone')}
            </ActionButton>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        testId="dns.settings.delete_confirm"
        title={t('dns.zone.settings.delete_confirm.title')}
        description={t('dns.zone.settings.delete_confirm.description')}
        confirmLabel={t('common.delete')}
        danger
        confirmDisabled={!deleteGate.allowed}
        confirmLoading={deleteM.isPending}
        cancelDisabled={deleteM.isPending}
        onCancel={() => {
          if (deleteM.isPending) return;
          setConfirmDelete(false);
          deleteM.reset();
        }}
        onConfirm={() => deleteM.mutate()}
      >
        {!deleteGate.allowed ? (
          <Alert title={t(deleteGate.reason.titleKey)} variant="warn" className="mb-3">
            {deleteGate.reason.descriptionKey ? t(deleteGate.reason.descriptionKey) : null}
          </Alert>
        ) : null}
        <div className="text-sm">
          {t('dns.zone.settings.delete_confirm.prompt', {
            name: String((zone as any).name ?? (zone as any).label ?? zone.id),
          })}
        </div>
      </ConfirmDialog>
    </div>
  );
}

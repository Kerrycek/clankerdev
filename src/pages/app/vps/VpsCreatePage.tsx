import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { useAppMode } from '../../../app/appMode';
import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import { useChrome } from '../../../components/layout/ChromeContext';
import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import { SyncStaleBanner } from '../../../components/layout/SyncStaleBanner';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { fetchDefaultObjectClusterResources } from '../../../lib/api/clusterResources';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { fetchLocations } from '../../../lib/api/infra';
import { fetchNodes } from '../../../lib/api/nodes';
import { fetchOsTemplates } from '../../../lib/api/osTemplates';
import { createVps } from '../../../lib/api/vps';
import { objectRef } from '../../../lib/objectRef';
import {
  buildVpsCreatePayload,
  defaultForm,
  isVpsHypervisorNode,
  locationEnvironmentId,
  optionalResource,
  osFamilyLabel,
  RESOURCE_PRESETS,
  validateForm,
  type FormState,
  type HiddenAdminTarget,
  type ResourcePresetId,
} from './VpsCreateModel';
import {
  CreateAccessHintCard,
  CreateAdvancedHintCard,
  CreateIdentityCard,
  CreateNetworkCard,
  CreatePageIntroCard,
  CreateResourcesCard,
  CreateReviewCard,
  CreateStepRail,
  CreateSystemCard,
  CreateTargetCard,
} from './VpsCreateWizardPrimitives';

export {
  buildVpsCreatePayload,
  defaultForm,
  validateForm,
  type FormState,
} from './VpsCreateModel';

export function VpsCreatePage() {
  const { basePath, mode } = useAppMode();
  const isAdminMode = mode === 'admin';
  const effectiveBasePath = isAdminMode ? '/admin' : basePath;
  const auth = useAuth();
  const isAdminAccount = auth.role === 'admin';
  const needsAdminPayload = isAdminMode || isAdminAccount;
  const { t } = useI18n();
  const navigate = useNavigate();
  const chrome = useChrome();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => defaultForm());
  const [submitted, setSubmitted] = useState(false);

  const locationQ = useQuery({
    queryKey: ['locations', { limit: 500, hasHypervisor: true, includes: 'environment' }],
    queryFn: async () =>
      (
        await fetchLocations({
          limit: 500,
          hasHypervisor: true,
          includes: 'environment',
        })
      ).data,
  });
  const locations = locationQ.data ?? [];
  const selectedLocationId = optionalResource(form.locationId);
  const selectedLocation = useMemo(
    () => locations.find((loc) => Number(loc.id) === selectedLocationId),
    [locations, selectedLocationId]
  );
  const selectedEnvironmentId = locationEnvironmentId(selectedLocation);

  const nodesQ = useQuery({
    queryKey: ['nodes', { limit: 500, location: selectedLocationId ?? null, type: 'node', hypervisorType: 'vpsadminos' }],
    queryFn: async () =>
      (
        await fetchNodes({
          limit: 500,
          location: selectedLocationId,
          type: 'node',
          hypervisorType: 'vpsadminos',
        })
      ).data,
    enabled: needsAdminPayload && selectedLocationId !== undefined,
  });
  const templatesQ = useQuery({
    queryKey: ['os_templates', { limit: 500, enabled: true, hypervisorType: 'vpsadminos' }],
    queryFn: async () => (await fetchOsTemplates({ limit: 500, enabled: true, hypervisorType: 'vpsadminos' })).data,
  });
  const defaultResourcesQ = useQuery({
    queryKey: ['default_object_cluster_resources', { environment: selectedEnvironmentId ?? null, className: 'Vps' }],
    queryFn: async () =>
      (await fetchDefaultObjectClusterResources({ limit: 50, environmentId: selectedEnvironmentId, className: 'Vps' })).data,
    enabled: selectedEnvironmentId !== undefined,
  });

  const nodes = useMemo(
    () => (needsAdminPayload ? (nodesQ.data ?? []).filter(isVpsHypervisorNode) : []),
    [needsAdminPayload, nodesQ.data]
  );
  const hiddenAdminTarget = useMemo<HiddenAdminTarget | undefined>(
    () => (!isAdminMode && isAdminAccount ? { userId: auth.user?.id, nodeId: nodes[0]?.id } : undefined),
    [auth.user?.id, isAdminAccount, isAdminMode, nodes]
  );
  const templates = templatesQ.data ?? [];
  const selectedTemplateId = optionalResource(form.osTemplateId);
  const selectedTemplate = useMemo(
    () => templates.find((tpl) => Number(tpl.id) === selectedTemplateId),
    [selectedTemplateId, templates]
  );
  const selectedNodeId = optionalResource(form.nodeId);
  const selectedNode = useMemo(
    () => nodes.find((node) => Number(node.id) === selectedNodeId),
    [nodes, selectedNodeId]
  );
  const templatesByFamily = useMemo(() => {
    const groups = new Map<string, typeof templates>();
    for (const tpl of templates) {
      const family = osFamilyLabel(tpl.os_family, t('vps.create.option.other_templates'));
      const list = groups.get(family) ?? [];
      list.push(tpl);
      groups.set(family, list);
    }

    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [t, templates]);

  useEffect(() => {
    const defaults = defaultResourcesQ.data;
    if (!defaults) return;

    const next: Partial<FormState> = {};
    for (const item of defaults) {
      const name = item.cluster_resource?.name;
      const value = typeof item.value === 'number' ? String(item.value) : undefined;
      if (value === undefined) continue;
      if (name === 'cpu') next.cpu = value;
      else if (name === 'memory') next.memory = value;
      else if (name === 'swap') next.swap = value;
      else if (name === 'diskspace') next.diskspace = value;
      else if (name === 'ipv4') next.ipv4 = value;
      else if (name === 'ipv4_private') next.ipv4Private = value;
      else if (name === 'ipv6') next.ipv6 = value;
    }

    if (Object.keys(next).length === 0) return;
    setForm((prev) => ({ ...prev, ...next }));
  }, [defaultResourcesQ.data]);

  const validationKeys = useMemo(
    () => validateForm(form, isAdminMode, hiddenAdminTarget),
    [form, hiddenAdminTarget, isAdminMode]
  );
  const canSubmit = validationKeys.length === 0;

  // audit:ignore missing-local-lock -- create has no stable VPS object ref before the API returns the new id.
  const createM = useMutation({
    mutationFn: async () => {
      const errors = validateForm(form, isAdminMode, hiddenAdminTarget);
      if (errors.length > 0) {
        const err = new Error('validation') as Error & { validationKeys?: string[] };
        err.validationKeys = errors;
        throw err;
      }

      const payload = buildVpsCreatePayload(form, {
        isAdminMode,
        needsAdminPayload,
        hiddenAdminTarget,
      });

      return createVps(payload);
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['vps', 'list'] });
      void qc.invalidateQueries({ queryKey: ['transaction_chain', 'active'] });

      const vpsId = Number(res.data?.id);
      const actionStateId = getMetaActionStateId(res.meta);
      if (actionStateId !== undefined) {
        chrome.trackActionState(actionStateId, {
          actionLabelKey: 'action.vps.create.label',
          objectLabel: form.hostname.trim() || (Number.isFinite(vpsId) ? t('common.vps_ref', { id: vpsId }) : t('vps.create.title')),
          object: Number.isFinite(vpsId) ? objectRef('Vps', vpsId) : undefined,
        });
        chrome.openTasks();
        navigate(Number.isFinite(vpsId) ? `${effectiveBasePath}/vps/${vpsId}` : `${effectiveBasePath}/vps`);
        return;
      }

      navigate(Number.isFinite(vpsId) ? `${effectiveBasePath}/vps/${vpsId}` : `${effectiveBasePath}/vps`);
    },
  });

  const loading = locationQ.isLoading || (needsAdminPayload && nodesQ.isLoading) || templatesQ.isLoading;
  const loadError = locationQ.error || (needsAdminPayload ? nodesQ.error : null) || templatesQ.error;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function applyResourcePreset(presetId: string) {
    const preset = RESOURCE_PRESETS.find((item) => item.id === (presetId as ResourcePresetId));
    if (!preset) return;
    setForm((prev) => ({
      ...prev,
      cpu: preset.cpu,
      memory: preset.memory,
      diskspace: preset.diskspace,
      swap: preset.swap,
    }));
  }

  function submit() {
    setSubmitted(true);
    if (canSubmit) createM.mutate();
  }

  return (
    <ListShell
      variant="wide"
      testId="vps.create"
      banner={<SyncStaleBanner />}
      header={
        <PageHeader
          testId="vps.create.header"
          title={t('vps.create.title')}
          description={t('vps.create.description')}
          actions={
            <Button variant="secondary" to={`${effectiveBasePath}/vps`} testId="vps.create.back">
              <ArrowLeft className="h-4 w-4" />
              {t('common.back')}
            </Button>
          }
        />
      }
    >
      {loading ? (
        <LoadingState testId="vps.create.loading" />
      ) : loadError ? (
        <ErrorState
          testId="vps.create.load_error"
          title={t('vps.create.load_error.title')}
          error={loadError}
          onRetry={() => {
            void locationQ.refetch();
            void nodesQ.refetch();
            void templatesQ.refetch();
            void defaultResourcesQ.refetch();
          }}
          showBack={false}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <CreatePageIntroCard />
            <CreateTargetCard
              form={form}
              isAdminMode={isAdminMode}
              isAdminAccount={isAdminAccount}
              locations={locations}
              nodes={nodes}
              selectedLocation={selectedLocation}
              selectedLocationId={selectedLocationId}
              hiddenAdminTarget={hiddenAdminTarget}
              onUpdate={update}
              onLocationChange={(value) => setForm((prev) => ({ ...prev, locationId: value, nodeId: '' }))}
            />
            <CreateSystemCard form={form} templatesByFamily={templatesByFamily} selectedTemplate={selectedTemplate} onUpdate={update} />
            <CreateIdentityCard form={form} isAdminMode={isAdminMode} onUpdate={update} />
            <CreateResourcesCard form={form} onApplyPreset={applyResourcePreset} onUpdate={update} />
            <CreateNetworkCard form={form} onUpdate={update} />
            <CreateAccessHintCard />
            <CreateAdvancedHintCard />
          </div>

          <div className="space-y-4">
            <CreateStepRail
              form={form}
              isAdminMode={isAdminMode}
              hiddenAdminTarget={hiddenAdminTarget}
              selectedTemplate={selectedTemplate}
              validationKeys={validationKeys}
            />
            <CreateReviewCard
              form={form}
              isAdminMode={isAdminMode}
              selectedLocation={selectedLocation}
              selectedTemplate={selectedTemplate}
              selectedNode={selectedNode}
              validationKeys={validationKeys}
              submitted={submitted}
              createError={createM.error}
              isPending={createM.isPending}
              onSubmit={submit}
            />
          </div>
        </div>
      )}
    </ListShell>
  );
}

export default VpsCreatePage;

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { useAppMode } from '../../../app/appMode';
import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import { useObjectScope } from '../../../app/objectScope';
import { useToasts } from '../../../app/toasts';
import { useChrome } from '../../../components/layout/ChromeContext';
import { fetchDataset, fetchDatasetSnapshots } from '../../../lib/api/datasets';
import { createExport } from '../../../lib/api/exports';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { objectRef } from '../../../lib/objectRef';

import { ExportCreateDrawer } from './ExportCreateDrawer';
import {
  buildCreateExportPayload,
  defaultCreateForm,
  exportDatasetMatchesRequiredOwner,
  parsePositiveInt,
  validateCreateExportForm,
  type CreateExportFormState,
} from './ExportModel';

type ExportCreateMutationVariables = {
  form: CreateExportFormState;
  isAdminAccount: boolean;
  requiresOwnDataset: boolean;
  requiredDatasetOwnerId?: number;
};

type ExportCreateMutationContext = {
  datasetId: number | null;
};

export function ExportCreateDialog(props: {
  open: boolean;
  onClose: () => void;
  fixedDatasetId?: number;
  embedded?: boolean;
  onCreated?: () => void | Promise<void>;
}) {
  const { basePath, mode } = useAppMode();
  const auth = useAuth();
  const scope = useObjectScope();
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const chrome = useChrome();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdminAccount = auth.role === 'admin';
  const requiresOwnDataset = isAdminAccount && mode === 'user';
  const requiredDatasetOwnerId = requiresOwnDataset ? scope.mineUserId : undefined;
  const [form, setForm] = useState<CreateExportFormState>(() => defaultCreateForm(props.fixedDatasetId ?? null));
  const selectedDatasetId = parsePositiveInt(form.datasetId);

  useEffect(() => {
    if (!props.open) return;
    setForm(defaultCreateForm(props.fixedDatasetId ?? null));
  }, [props.fixedDatasetId, props.open]);

  const selectedDatasetQ = useQuery({
    queryKey: ['datasets', 'show', selectedDatasetId, 'for_export_form'],
    enabled: props.open && selectedDatasetId !== null,
    queryFn: async () => {
      if (selectedDatasetId === null) throw new Error('invalid dataset id');
      return (await fetchDataset(selectedDatasetId, { includes: 'user' })).data;
    },
    staleTime: 15_000,
  });

  const datasetSelectionAllowed =
    selectedDatasetId !== null &&
    selectedDatasetQ.isSuccess &&
    (!requiresOwnDataset || (
      requiredDatasetOwnerId !== undefined &&
      exportDatasetMatchesRequiredOwner(selectedDatasetQ.data, requiredDatasetOwnerId)
    ));
  const datasetSelectionPending =
    selectedDatasetId !== null && selectedDatasetQ.isPending;
  const datasetSelectionAlert = selectedDatasetId !== null && selectedDatasetQ.isError
    ? {
        title: t('exports.form.dataset_load_error.title'),
        body: t('exports.form.dataset_load_error.body', { id: String(selectedDatasetId) }),
      }
    : requiresOwnDataset && selectedDatasetId !== null && selectedDatasetQ.isSuccess && !datasetSelectionAllowed
      ? {
          title: t('scope.mismatch.title'),
          body: t('scope.mismatch.body', {
            object: t('object_kind.dataset'),
            label: `“${String(selectedDatasetQ.data.full_name ?? selectedDatasetQ.data.name ?? `#${selectedDatasetId}`)}”`,
          }),
        }
      : undefined;

  const snapshotsQ = useQuery({
    queryKey: ['datasets', selectedDatasetId, 'snapshots', 'export_create'],
    enabled: props.open && selectedDatasetId !== null && datasetSelectionAllowed,
    queryFn: async () => {
      if (selectedDatasetId === null) throw new Error('invalid dataset id');
      return (await fetchDatasetSnapshots(selectedDatasetId, { limit: 100 })).data;
    },
    staleTime: 15_000,
  });

  const createM = useMutation({
    mutationFn: async (variables: ExportCreateMutationVariables) => {
      const datasetId = parsePositiveInt(variables.form.datasetId);
      const validation = validateCreateExportForm(variables.form, variables.isAdminAccount);
      if (!validation.ok) throw new Error(t('exports.validation.title'));

      if (variables.requiresOwnDataset) {
        if (datasetId === null || variables.requiredDatasetOwnerId === undefined) {
          throw new Error(t('scope.mismatch.title'));
        }

        // The account has administrator API privileges even in /app. Re-check
        // ownership immediately before Create so a stale lookup result cannot
        // turn My view into a cross-user write.
        const latestDataset = (
          await fetchDataset(datasetId, { includes: 'user' })
        ).data;
        if (!exportDatasetMatchesRequiredOwner(latestDataset, variables.requiredDatasetOwnerId)) {
          throw new Error(t('scope.mismatch.title'));
        }
      }

      return createExport(buildCreateExportPayload(variables.form, variables.isAdminAccount));
    },
    onMutate: (variables): ExportCreateMutationContext => {
      const datasetId = parsePositiveInt(variables.form.datasetId);
      if (datasetId !== null) chrome.acquireLocalLock(objectRef('Dataset', datasetId));
      return { datasetId };
    },
    onSuccess: async (res, variables) => {
      const actionStateId = getMetaActionStateId(res.meta);
      const datasetId = parsePositiveInt(variables.form.datasetId);
      if (actionStateId !== undefined && datasetId !== null) {
        chrome.trackActionState(actionStateId, {
          actionLabelKey: 'action.export.create.label',
          objectLabel: `Dataset #${datasetId}`,
          object: objectRef('Dataset', datasetId),
        });
      }

      await qc.invalidateQueries({ queryKey: ['exports'] });
      if (datasetId !== null) await qc.invalidateQueries({ queryKey: ['datasets', 'show', datasetId] });
      await props.onCreated?.();
      props.onClose();
      pushToast({ variant: 'ok', title: t('exports.create.success') });

      const exportId = parsePositiveInt(res.data?.id);
      if (exportId) navigate(`${basePath}/exports/${exportId}`);
    },
    onError: (err: unknown) => {
      pushToast({
        variant: 'danger',
        title: t('exports.create.error'),
        body: err instanceof Error ? err.message : String(err),
      });
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.datasetId !== null && context?.datasetId !== undefined) {
        chrome.releaseLocalLock(objectRef('Dataset', context.datasetId));
      }
    },
  });

  return (
    <ExportCreateDrawer
      open={props.open}
      onClose={props.onClose}
      embedded={props.embedded ?? false}
      fixedDatasetId={props.fixedDatasetId}
      form={form}
      onFormChange={setForm}
      selectedDataset={selectedDatasetQ.data}
      snapshots={snapshotsQ.data ?? []}
      datasetSelectionAllowed={datasetSelectionAllowed}
      datasetSelectionPending={datasetSelectionPending}
      datasetSelectionAlert={datasetSelectionAlert}
      isAdmin={isAdminAccount}
      pending={createM.isPending}
      onSubmit={() => createM.mutate({
        form: { ...form },
        isAdminAccount,
        requiresOwnDataset,
        requiredDatasetOwnerId,
      })}
    />
  );
}

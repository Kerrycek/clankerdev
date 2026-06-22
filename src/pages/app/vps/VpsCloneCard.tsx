import type { Dispatch, SetStateAction } from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Checkbox } from '../../../components/ui/Checkbox';
import { Input } from '../../../components/ui/Input';
import { NodeLookupInput } from '../../../components/ui/NodeLookupInput';
import { Select } from '../../../components/ui/Select';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';
import type { Location } from '../../../lib/api/infra';
import type { Vps } from '../../../lib/api/vps';
import type { GateDecision } from '../../../lib/gates/types';
import { cloneCopiedOptionKeys, cloneTargetDescription, type CloneForm } from './VpsCloneModel';
import { nodeLabel, ownerLabel, resourceSummary, vpsLabel, vpsLocationLabel } from './VpsLifecycleModel';
import {
  ActionGateAlert,
  ActionImpactSummary,
  AsyncActionResult,
  Field,
  ImpactItem,
  LifecycleActionShell,
  LifecycleSubmitButton,
} from './VpsLifecyclePrimitives';

export type { CloneForm } from './VpsCloneModel';

export function VpsCloneCard(props: {
  isAdminMode: boolean;
  sourceVps: Vps;
  form: CloneForm;
  onChange: Dispatch<SetStateAction<CloneForm>>;
  locations: Location[];
  selectedLocation?: Location;
  locationsLoading: boolean;
  targetReady: boolean;
  gate: GateDecision;
  pending: boolean;
  errorMessage?: string;
  onOpenTasks: () => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();

  const setForm = (patch: Partial<CloneForm>) => {
    props.onChange((prev) => ({ ...prev, ...patch }));
  };

  const target = cloneTargetDescription(props.form, {
    isAdminMode: props.isAdminMode,
    location: props.selectedLocation,
  });
  const copiedKeys = cloneCopiedOptionKeys(props.form);
  const copiedParts = copiedKeys.length ? copiedKeys.map((key) => t(key)).join(', ') : t('common.none');
  const hostname = props.form.hostname.trim() || t('vps.lifecycle.clone.impact.hostname_backend');

  return (
    <LifecycleActionShell
      testId="vps.lifecycle.clone"
      footer={
        <LifecycleSubmitButton
          variant="primary"
          testId="vps.lifecycle.clone.submit"
          disabled={!props.form.confirm || !props.targetReady}
          gate={props.gate}
          loading={props.pending}
          onClick={props.onSubmit}
        >
          {t('vps.lifecycle.clone.submit')}
        </LifecycleSubmitButton>
      }
    >
      <Alert variant="neutral">
        {props.isAdminMode ? t('vps.lifecycle.clone.subtitle') : t('vps.lifecycle.clone.subtitle_user')}
        {' '}
        {t('vps.lifecycle.clone.review.help')}
      </Alert>

      <ActionGateAlert gate={props.gate} onOpenTasks={props.onOpenTasks} />

      <div className="grid gap-3 md:grid-cols-3">
        {props.isAdminMode ? (
          <>
            <Field label={t('vps.lifecycle.field.owner')} help={t('vps.lifecycle.clone.owner_help')}>
              <UserLookupInput
                value={props.form.user}
                onChange={(user) => setForm({ user, confirm: false })}
                placeholder={t('vps.lifecycle.placeholder.user')}
                testId="vps.lifecycle.clone.user"
                disabled={props.pending}
              />
            </Field>
            <Field label={t('vps.lifecycle.field.node')} help={t('vps.lifecycle.clone.node_help')}>
              <NodeLookupInput
                value={props.form.node}
                onChange={(node) => setForm({ node, confirm: false })}
                placeholder={t('vps.lifecycle.placeholder.node')}
                testId="vps.lifecycle.clone.node"
                disabled={props.pending}
              />
            </Field>
          </>
        ) : (
          <Field label={t('vps.lifecycle.field.location')} help={t('vps.lifecycle.clone.location_help')}>
            <Select
              value={props.form.location}
              onChange={(e) => setForm({ location: e.target.value, confirm: false })}
              disabled={props.pending || props.locationsLoading}
              testId="vps.lifecycle.clone.location"
            >
              <option value="">{t('vps.lifecycle.placeholder.location')}</option>
              {props.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {String(location.label ?? location.description ?? location.domain ?? `#${location.id}`)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t('vps.lifecycle.field.hostname')} help={t('vps.lifecycle.clone.hostname_help')}>
          <Input
            value={props.form.hostname}
            onChange={(e) => setForm({ hostname: e.target.value, confirm: false })}
            testId="vps.lifecycle.clone.hostname"
            disabled={props.pending}
          />
        </Field>
      </div>

      <ActionImpactSummary className="grid gap-3 md:grid-cols-2" testId="vps.lifecycle.clone.review">
        <ImpactItem label={t('vps.lifecycle.clone.impact.source')} testId="vps.lifecycle.clone.review.source">
          {t('vps.lifecycle.clone.impact.source_body', {
            vps: vpsLabel(props.sourceVps, props.sourceVps.id),
            owner: ownerLabel(props.sourceVps),
            node: nodeLabel(props.sourceVps),
            location: vpsLocationLabel(props.sourceVps),
          })}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.clone.impact.target')} testId="vps.lifecycle.clone.review.target">
          {props.isAdminMode
            ? t('vps.lifecycle.clone.impact.target_admin', { owner: target.owner ?? '—', node: target.node ?? '—' })
            : t('vps.lifecycle.clone.impact.target_user', { location: target.location ?? '—', environment: target.environment ?? '—' })}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.clone.impact.hostname')} testId="vps.lifecycle.clone.review.hostname">
          {hostname}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.clone.impact.resources')} testId="vps.lifecycle.clone.review.resources">
          {resourceSummary(props.sourceVps)}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.clone.impact.copied')} testId="vps.lifecycle.clone.review.copied">
          {copiedParts}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.clone.impact.consistency')} testId="vps.lifecycle.clone.review.consistency">
          {props.form.stop ? t('vps.lifecycle.clone.impact.consistency_stop') : t('vps.lifecycle.clone.impact.consistency_live')}
        </ImpactItem>
      </ActionImpactSummary>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Checkbox checked={props.form.subdatasets} onChange={(subdatasets) => setForm({ subdatasets, confirm: false })} label={t('vps.lifecycle.clone.option.subdatasets')} testId="vps.lifecycle.clone.subdatasets" />
        <Checkbox checked={props.form.datasetPlans} onChange={(datasetPlans) => setForm({ datasetPlans, confirm: false })} label={t('vps.lifecycle.clone.option.dataset_plans')} testId="vps.lifecycle.clone.dataset_plans" />
        <Checkbox checked={props.form.resources} onChange={(resources) => setForm({ resources, confirm: false })} label={t('vps.lifecycle.clone.option.resources')} testId="vps.lifecycle.clone.resources" />
        <Checkbox checked={props.form.features} onChange={(features) => setForm({ features, confirm: false })} label={t('vps.lifecycle.clone.option.features')} testId="vps.lifecycle.clone.features" />
        <Checkbox checked={props.form.stop} onChange={(stop) => setForm({ stop, confirm: false })} label={t('vps.lifecycle.clone.option.stop')} description={t('vps.lifecycle.clone.option.stop_help')} testId="vps.lifecycle.clone.stop" />
      </div>

      <Checkbox
        checked={props.form.confirm}
        onChange={(confirm) => setForm({ confirm })}
        label={t('vps.lifecycle.confirm.clone')}
        description={t('vps.lifecycle.clone.confirm_help')}
        testId="vps.lifecycle.clone.confirm"
      />

      <AsyncActionResult
        errorTitle={t('vps.lifecycle.clone.error')}
        errorMessage={props.errorMessage}
      />
    </LifecycleActionShell>
  );
}

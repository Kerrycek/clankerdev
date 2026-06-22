import type { Dispatch, SetStateAction } from 'react';

import { useI18n } from '../../../app/i18n';
import { Alert } from '../../../components/ui/Alert';
import { Checkbox } from '../../../components/ui/Checkbox';
import { VpsLookupInput } from '../../../components/ui/VpsLookupInput';
import type { IpAddress } from '../../../lib/api/ipAddresses';
import type { Vps } from '../../../lib/api/vps';
import { formatDateTime } from '../../../lib/format';
import type { GateDecision } from '../../../lib/gates/types';
import {
  datasetLabel,
  ipAddressText,
  nodeLabel,
  ownerLabel,
  resourceSummary,
  stateLabel,
  vpsLabel,
  vpsLocationLabel,
} from './VpsLifecycleModel';
import {
  buildSwapAfterPreview,
  isSameSwapTarget,
  looksLikeSwapCandidate,
  swapCandidateReasonKeys,
  swapTargetFit,
  type SwapForm,
} from './VpsSwapModel';
import {
  ActionGateAlert,
  ActionImpactSummary,
  AsyncActionResult,
  Field,
  ImpactItem,
  LifecycleActionShell,
  LifecycleSubmitButton,
} from './VpsLifecyclePrimitives';

function IpList(props: { ips: IpAddress[] | undefined; loading: boolean; empty: string; loadingText: string; testId: string }) {
  if (props.loading) return <div className="text-sm text-muted">{props.loadingText}</div>;
  if (!props.ips?.length) return <div className="text-sm text-muted">{props.empty}</div>;
  return (
    <ul className="space-y-1 text-sm" data-testid={props.testId}>
      {props.ips.map((ip) => (
        <li key={ip.id} className="font-mono text-xs">
          {ipAddressText(ip)}
        </li>
      ))}
    </ul>
  );
}

function CompactValueList(props: { values: string[]; empty: string; testId: string }) {
  if (!props.values.length) return <span className="text-muted" data-testid={props.testId}>{props.empty}</span>;
  return (
    <span className="inline-flex flex-col gap-0.5" data-testid={props.testId}>
      {props.values.map((value) => (
        <span key={value} className="font-mono text-xs">
          {value}
        </span>
      ))}
    </span>
  );
}

export function VpsSwapCard(props: {
  isAdminMode: boolean;
  vps: Vps;
  vpsId: number;
  ownerId: number | null;
  nodeId: number | null;
  locationId: number | null;
  form: SwapForm;
  onChange: Dispatch<SetStateAction<SwapForm>>;
  candidates: Vps[];
  candidatesLoading: boolean;
  selectedTarget?: Vps;
  targetLoading: boolean;
  targetError: boolean;
  sourceIps: IpAddress[];
  sourceIpsLoading: boolean;
  sourceIpsError: boolean;
  targetIps: IpAddress[];
  targetIpsLoading: boolean;
  targetIpsError: boolean;
  gate: GateDecision;
  pending: boolean;
  errorMessage?: string;
  onOpenTasks: () => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const likelyCandidateRows = props.candidates.filter((candidate) => looksLikeSwapCandidate(candidate));
  const selectedTarget = props.selectedTarget;
  const targetLabel = props.targetLoading
    ? t('common.loading')
    : props.targetError
      ? `#${props.form.targetVps}`
      : vpsLabel(selectedTarget, props.form.targetVps);
  const selectedSourceIps = props.sourceIps.map(ipAddressText);
  const selectedTargetIps = props.targetIps.map(ipAddressText);
  const targetFit = swapTargetFit({
    source: props.vps,
    target: selectedTarget,
    ownerId: props.ownerId,
    locationId: props.locationId,
  });
  const sourceIpCount = props.sourceIps.length;
  const targetIpCount = props.targetIps.length;
  const sameTarget = isSameSwapTarget(props.vpsId, props.form.targetVps);
  const after = buildSwapAfterPreview({
    source: props.vps,
    target: selectedTarget,
    form: props.form,
    sourceId: props.vpsId,
    isAdminMode: props.isAdminMode,
    targetLabel,
    formatDateTime,
  });

  const setForm = (patch: Partial<SwapForm>) => {
    props.onChange((prev) => ({ ...prev, ...patch }));
  };

  const afterRows: Array<[string, string, string]> = [
    [t('vps.lifecycle.swap.preview.hostname'), after.sourceHostnameAfter, after.targetHostnameAfter],
    [t('vps.lifecycle.swap.preview.owner'), ownerLabel(props.vps), ownerLabel(selectedTarget)],
    [t('vps.lifecycle.swap.preview.node'), nodeLabel(props.vps), nodeLabel(selectedTarget)],
    [t('vps.lifecycle.swap.preview.location'), vpsLocationLabel(props.vps), vpsLocationLabel(selectedTarget)],
    [t('vps.lifecycle.swap.preview.resources'), after.sourceResourcesAfter, after.targetResourcesAfter],
    [t('vps.lifecycle.swap.preview.dataset'), after.sourceDatasetAfter, after.targetDatasetAfter],
    [t('vps.lifecycle.swap.preview.expiration'), after.sourceExpirationAfter, after.targetExpirationAfter],
  ];

  const swapPreview = props.form.targetVps ? (
    <div className="rounded-md border border-border bg-surface-2 p-3" data-testid="vps.lifecycle.swap.preview">
      <div className="text-sm font-medium">{t('vps.lifecycle.swap.preview.title')}</div>
      <div className="mt-1 text-xs text-faint">{t('vps.lifecycle.swap.preview.help')}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-xs font-medium text-muted">{t('vps.lifecycle.swap.preview.source')}</div>
          <div className="mt-1 text-sm font-medium" data-testid="vps.lifecycle.swap.preview.source_label">
            {vpsLabel(props.vps, props.vpsId)}
          </div>
          <dl className="mt-2 space-y-1 text-xs">
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.owner')}</dt><dd className="inline"> {ownerLabel(props.vps)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.node')}</dt><dd className="inline"> {nodeLabel(props.vps)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.location')}</dt><dd className="inline"> {vpsLocationLabel(props.vps)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.resources')}</dt><dd className="inline"> {resourceSummary(props.vps)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.dataset')}</dt><dd className="inline"> {datasetLabel(props.vps)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.expiration')}</dt><dd className="inline"> {formatDateTime(props.vps.expiration_date)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.state')}</dt><dd className="inline"> {stateLabel(props.vps)}</dd></div>
          </dl>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-xs font-medium text-muted">{t('vps.lifecycle.swap.preview.target')}</div>
          <div className="mt-1 text-sm font-medium" data-testid="vps.lifecycle.swap.preview.target_label">
            {targetLabel}
          </div>
          <dl className="mt-2 space-y-1 text-xs">
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.owner')}</dt><dd className="inline"> {ownerLabel(selectedTarget)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.node')}</dt><dd className="inline"> {nodeLabel(selectedTarget)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.location')}</dt><dd className="inline"> {vpsLocationLabel(selectedTarget)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.resources')}</dt><dd className="inline"> {resourceSummary(selectedTarget)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.dataset')}</dt><dd className="inline"> {datasetLabel(selectedTarget)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.expiration')}</dt><dd className="inline"> {formatDateTime(selectedTarget?.expiration_date)}</dd></div>
            <div><dt className="inline text-faint">{t('vps.lifecycle.swap.preview.state')}</dt><dd className="inline"> {stateLabel(selectedTarget)}</dd></div>
          </dl>
        </div>
      </div>

      <ActionImpactSummary className="mt-3 grid gap-2 md:grid-cols-2" testId="vps.lifecycle.swap.impact_summary">
        <ImpactItem label={t('vps.lifecycle.swap.impact.target_fit')} testId="vps.lifecycle.swap.impact.target_fit">
          {targetFit.likely
            ? t('vps.lifecycle.swap.impact.target_fit_likely')
            : t('vps.lifecycle.swap.impact.target_fit_manual')}
          {' '}
          {targetFit.sameOwner ? t('vps.lifecycle.swap.impact.same_owner') : t('vps.lifecycle.swap.impact.owner_differs')}
          {' '}
          {targetFit.sameLocation ? t('vps.lifecycle.swap.impact.same_location') : t('vps.lifecycle.swap.impact.location_differs')}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.swap.impact.network')} testId="vps.lifecycle.swap.impact.network">
          {t('vps.lifecycle.swap.impact.network_body', { source: sourceIpCount, target: targetIpCount })}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.swap.impact.dataset')} testId="vps.lifecycle.swap.impact.dataset">
          {t('vps.lifecycle.swap.impact.dataset_body', { source: datasetLabel(props.vps), target: datasetLabel(selectedTarget) })}
        </ImpactItem>
        <ImpactItem label={t('vps.lifecycle.swap.impact.options')} testId="vps.lifecycle.swap.impact.options">
          {props.isAdminMode
            ? t('vps.lifecycle.swap.preview.admin_options', {
                hostname: props.form.hostname ? t('common.yes') : t('common.no'),
                resources: props.form.resources ? t('common.yes') : t('common.no'),
                expirations: props.form.expirations ? t('common.yes') : t('common.no'),
              })
            : t('vps.lifecycle.swap.preview.user_options')}
        </ImpactItem>
      </ActionImpactSummary>

      {props.targetError || props.sourceIpsError || props.targetIpsError ? (
        <Alert className="mt-3" variant="warn" title={t('vps.lifecycle.swap.preview.partial_title')} testId="vps.lifecycle.swap.preview.partial">
          {t('vps.lifecycle.swap.preview.partial_body')}
        </Alert>
      ) : null}

      <div className="mt-3 overflow-hidden rounded-md border border-border bg-surface" data-testid="vps.lifecycle.swap.preview.after_table">
        <div className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-border bg-surface-2 px-3 py-2 text-xs font-medium text-muted">
          <div>{t('vps.lifecycle.swap.preview.after_field')}</div>
          <div>{t('vps.lifecycle.swap.preview.after_source')}</div>
          <div>{t('vps.lifecycle.swap.preview.after_target')}</div>
        </div>
        {afterRows.map(([label, sourceValue, targetValue]) => (
          <div key={label} className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-border px-3 py-2 text-xs last:border-b-0">
            <div className="font-medium text-muted">{label}</div>
            <div className="min-w-0 pr-2">{sourceValue}</div>
            <div className="min-w-0">{targetValue}</div>
          </div>
        ))}
        <div className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] px-3 py-2 text-xs">
          <div className="font-medium text-muted">{t('vps.lifecycle.swap.preview.ip_assignments')}</div>
          <div className="min-w-0 pr-2">
            <CompactValueList values={selectedTargetIps} empty={t('vps.lifecycle.swap.preview.no_target_ips')} testId="vps.lifecycle.swap.preview.after_table.source_ips" />
          </div>
          <div className="min-w-0">
            <CompactValueList values={selectedSourceIps} empty={t('vps.lifecycle.swap.preview.no_source_ips')} testId="vps.lifecycle.swap.preview.after_table.target_ips" />
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-xs font-medium text-muted">{t('vps.lifecycle.swap.preview.source_after')}</div>
          <div className="mt-1 text-xs text-faint">{t('vps.lifecycle.swap.preview.source_after_help')}</div>
          <div className="mt-2">
            <IpList
              ips={props.targetIps}
              loading={props.targetIpsLoading}
              empty={t('vps.lifecycle.swap.preview.no_target_ips')}
              loadingText={t('common.loading')}
              testId="vps.lifecycle.swap.preview.source_ips_after"
            />
          </div>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-xs font-medium text-muted">{t('vps.lifecycle.swap.preview.target_after')}</div>
          <div className="mt-1 text-xs text-faint">{t('vps.lifecycle.swap.preview.target_after_help')}</div>
          <div className="mt-2">
            <IpList
              ips={props.sourceIps}
              loading={props.sourceIpsLoading}
              empty={t('vps.lifecycle.swap.preview.no_source_ips')}
              loadingText={t('common.loading')}
              testId="vps.lifecycle.swap.preview.target_ips_after"
            />
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-faint" data-testid="vps.lifecycle.swap.preview.options">
        {props.isAdminMode
          ? t('vps.lifecycle.swap.preview.admin_options', {
              hostname: props.form.hostname ? t('common.yes') : t('common.no'),
              resources: props.form.resources ? t('common.yes') : t('common.no'),
              expirations: props.form.expirations ? t('common.yes') : t('common.no'),
            })
          : t('vps.lifecycle.swap.preview.user_options')}
      </div>
    </div>
  ) : (
    <Alert variant="neutral">{t('vps.lifecycle.swap.preview.empty')}</Alert>
  );

  return (
    <LifecycleActionShell
      testId="vps.lifecycle.swap"
      footer={
        <LifecycleSubmitButton
          variant="danger"
          testId="vps.lifecycle.swap.submit"
          disabled={!props.form.confirm || !props.form.targetVps || sameTarget}
          gate={props.gate}
          loading={props.pending}
          onClick={props.onSubmit}
        >
          {t('vps.lifecycle.swap.submit')}
        </LifecycleSubmitButton>
      }
    >
      <Alert variant="neutral">
        {props.isAdminMode ? t('vps.lifecycle.swap.subtitle') : t('vps.lifecycle.swap.subtitle_user')}
        {' '}
        {t('vps.lifecycle.swap.entry_summary')}
      </Alert>

      <ActionGateAlert gate={props.gate} onOpenTasks={props.onOpenTasks} />

      <div className="space-y-2" data-testid="vps.lifecycle.swap.candidates">
        <div className="text-xs font-medium text-muted">{t('vps.lifecycle.swap.candidates.title')}</div>
        {props.candidatesLoading ? (
          <div className="text-sm text-muted">{t('common.loading')}</div>
        ) : likelyCandidateRows.length > 0 ? (
          <>
            <div className="text-xs text-faint" data-testid="vps.lifecycle.swap.candidates.summary">
              {t('vps.lifecycle.swap.entry_candidates', { count: likelyCandidateRows.length })}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {likelyCandidateRows.map((candidate) => {
                const selected = Number(candidate.id) === props.form.targetVps;
                const reasons = swapCandidateReasonKeys(candidate, props.vps, props.nodeId, props.locationId);
                return (
                  <button
                    type="button"
                    key={candidate.id}
                    className={[
                      'rounded-md border p-3 text-left text-sm hover:bg-surface-2',
                      selected ? 'border-border bg-surface-2 ring-2 ring-focus/35' : 'border-border bg-surface',
                    ].join(' ')}
                    onClick={() => setForm({ targetVps: Number(candidate.id), confirm: false })}
                    data-testid={`vps.lifecycle.swap.candidate.${candidate.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{vpsLabel(candidate, candidate.id)}</div>
                      <span className="shrink-0 rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-muted" data-testid={`vps.lifecycle.swap.candidate.${candidate.id}.badge`}>
                        {selected ? t('vps.lifecycle.swap.candidate.selected') : t('vps.lifecycle.swap.candidate.badge')}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-faint">
                      {nodeLabel(candidate)} / {vpsLocationLabel(candidate)}
                    </div>
                    <div className="mt-1 text-xs text-faint">{resourceSummary(candidate)}</div>
                    <div className="mt-1 text-xs text-faint">
                      {t('vps.lifecycle.swap.preview.dataset')} {datasetLabel(candidate)}
                    </div>
                    <div className="mt-2 text-xs text-muted" data-testid={`vps.lifecycle.swap.candidate.${candidate.id}.reasons`}>
                      {reasons.map((reason) => t(reason)).join(' · ')}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <Alert variant="neutral" title={t('vps.lifecycle.swap.candidates.empty_title')}>
            {t('vps.lifecycle.swap.candidates.empty')}
          </Alert>
        )}
      </div>

      <Field label={t('vps.lifecycle.field.target_vps')} help={t('vps.lifecycle.swap.target_help')}>
        <VpsLookupInput
          value={props.form.targetVps}
          onChange={(targetVps) => setForm({ targetVps, confirm: false })}
          userId={props.ownerId ?? undefined}
          placeholder={t('vps.lifecycle.placeholder.vps')}
          testId="vps.lifecycle.swap.target"
          disabled={props.pending}
        />
      </Field>

      {sameTarget ? (
        <Alert variant="warn" title={t('vps.lifecycle.swap.same_target_title')} testId="vps.lifecycle.swap.same_target">
          {t('vps.lifecycle.swap.same_target_body')}
        </Alert>
      ) : null}

      {props.isAdminMode ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <Checkbox checked={props.form.hostname} onChange={(hostname) => setForm({ hostname, confirm: false })} label={t('vps.lifecycle.swap.option.hostname')} testId="vps.lifecycle.swap.hostname" />
          <Checkbox checked={props.form.resources} onChange={(resources) => setForm({ resources, confirm: false })} label={t('vps.lifecycle.swap.option.resources')} testId="vps.lifecycle.swap.resources" />
          <Checkbox checked={props.form.expirations} onChange={(expirations) => setForm({ expirations, confirm: false })} label={t('vps.lifecycle.swap.option.expirations')} testId="vps.lifecycle.swap.expirations" />
        </div>
      ) : (
        <Alert variant="neutral">{t('vps.lifecycle.swap.user_options_hint')}</Alert>
      )}

      {swapPreview}

      <Alert variant="warn" title={t('vps.lifecycle.swap.warning_title')}>
        {t('vps.lifecycle.swap.warning_body')}
      </Alert>

      <Checkbox
        checked={props.form.confirm}
        onChange={(confirm) => setForm({ confirm })}
        label={t('vps.lifecycle.confirm.swap')}
        description={targetLabel && props.form.targetVps ? t('vps.lifecycle.swap.confirm_help', { target: targetLabel }) : undefined}
        testId="vps.lifecycle.swap.confirm"
      />

      <AsyncActionResult
        errorTitle={t('vps.lifecycle.swap.error')}
        errorMessage={props.errorMessage}
      />
    </LifecycleActionShell>
  );
}

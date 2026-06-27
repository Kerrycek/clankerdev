import { ActionButton } from "../../../components/ui/ActionButton";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { Checkbox } from "../../../components/ui/Checkbox";
import { Drawer } from "../../../components/ui/Drawer";
import { VpsLookupInput } from "../../../components/ui/VpsLookupInput";
import type { Vps } from "../../../lib/api/vps";
import { formatDateTime } from "../../../lib/format";
import { CompactValueList, Field, ImpactItem, IpList, datasetLabel, ipAddressText, looksLikeSwapCandidate, nodeLabel, ownerLabel, resourceId, resourceSummary, stateLabel, swapCandidateReasonKeys, vpsLabel, mutationErrorMessage, vpsLocationId, vpsLocationLabel } from "./VpsLifecyclePage.shared";
export function renderVpsLifecycleSwapCard(ctx: LegacyAny) {
  const { t, isAdminMode, swapCandidatesQ, targetVpsQ, swap, sourceIps, targetIps, vps, vpsId, ownerId, locationId, sourceIpsQ, targetIpsQ, setSwap, setSwapOpen, swapOpen, swapM, gate, nodeId } = ctx;
  const candidateRows = swapCandidatesQ.data ?? [];
  const likelyCandidateRows = candidateRows.filter((candidate: Vps) => looksLikeSwapCandidate(candidate));
  const selectedTarget = targetVpsQ.data;
  const targetLabel = targetVpsQ.isLoading ? t("common.loading") : targetVpsQ.isError ? `#${swap.targetVps}` : vpsLabel(selectedTarget, swap.targetVps);
  const selectedSourceIps = sourceIps.map(ipAddressText);
  const selectedTargetIps = targetIps.map(ipAddressText);
  const sourceHostnameAfter = isAdminMode && !swap.hostname ? vpsLabel(vps, vpsId) : targetLabel;
  const targetHostnameAfter = isAdminMode && !swap.hostname ? targetLabel : vpsLabel(vps, vpsId);
  const sourceResourcesAfter = isAdminMode && !swap.resources ? resourceSummary(vps) : resourceSummary(selectedTarget);
  const targetResourcesAfter = isAdminMode && !swap.resources ? resourceSummary(selectedTarget) : resourceSummary(vps);
  const sourceExpirationAfter = isAdminMode && !swap.expirations ? formatDateTime((vps as LegacyAny).expiration_date) : formatDateTime((selectedTarget as LegacyAny)?.expiration_date);
  const targetExpirationAfter = isAdminMode && !swap.expirations ? formatDateTime((selectedTarget as LegacyAny)?.expiration_date) : formatDateTime((vps as LegacyAny).expiration_date);
  const sourceDatasetAfter = selectedTarget ? datasetLabel(selectedTarget) : "—";
  const targetDatasetAfter = datasetLabel(vps);
  const selectedTargetIsLikely = Boolean(selectedTarget && looksLikeSwapCandidate(selectedTarget as Vps));
  const selectedTargetOwnerId = selectedTarget ? resourceId((selectedTarget as LegacyAny).user) : null;
  const selectedTargetLocationId = selectedTarget ? vpsLocationId(selectedTarget) : null;
  const selectedTargetSameOwner = selectedTargetOwnerId !== null && ownerId !== null && selectedTargetOwnerId === ownerId;
  const selectedTargetSameLocation = selectedTargetLocationId !== null && locationId !== null && selectedTargetLocationId === locationId;
  const sourceIpCount = sourceIps.length;
  const targetIpCount = targetIps.length;
  const swapPreview = swap.targetVps ? (
    <div className="rounded-md border border-border bg-surface-2 p-3" data-testid="vps.lifecycle.swap.preview">
      <div className="text-sm font-medium">{t("vps.lifecycle.swap.preview.title")}</div>
      <div className="mt-1 text-xs text-faint">{t("vps.lifecycle.swap.preview.help")}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-xs font-medium text-muted">{t("vps.lifecycle.swap.preview.source")}</div>
          <div className="mt-1 text-sm font-medium" data-testid="vps.lifecycle.swap.preview.source_label">
            {vpsLabel(vps, vpsId)}
          </div>
          <dl className="mt-2 space-y-1 text-xs">
            <div>
              <dt className="inline text-faint">{t("vps.lifecycle.swap.preview.owner")}</dt>
              <dd className="inline"> {ownerLabel(vps)}</dd>
            </div>
            <div>
              <dt className="inline text-faint">{t("vps.lifecycle.swap.preview.node")}</dt>
              <dd className="inline"> {nodeLabel(vps)}</dd>
            </div>
            <div>
              <dt className="inline text-faint">{t("vps.lifecycle.swap.preview.location")}</dt>
              <dd className="inline"> {vpsLocationLabel(vps)}</dd>
            </div>
            <div>
              <dt className="inline text-faint">{t("vps.lifecycle.swap.preview.resources")}</dt>
              <dd className="inline"> {resourceSummary(vps)}</dd>
            </div>
            <div>
              <dt className="inline text-faint">{t("vps.lifecycle.swap.preview.dataset")}</dt>
              <dd className="inline"> {datasetLabel(vps)}</dd>
            </div>
            <div>
              <dt className="inline text-faint">{t("vps.lifecycle.swap.preview.expiration")}</dt>
              <dd className="inline"> {formatDateTime((vps as LegacyAny).expiration_date)}</dd>
            </div>
            <div>
              <dt className="inline text-faint">{t("vps.lifecycle.swap.preview.state")}</dt>
              <dd className="inline"> {stateLabel(vps)}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-xs font-medium text-muted">{t("vps.lifecycle.swap.preview.target")}</div>
          <div className="mt-1 text-sm font-medium" data-testid="vps.lifecycle.swap.preview.target_label">
            {targetLabel}
          </div>
          <dl className="mt-2 space-y-1 text-xs">
            <div>
              <dt className="inline text-faint">{t("vps.lifecycle.swap.preview.owner")}</dt>
              <dd className="inline"> {ownerLabel(selectedTarget)}</dd>
            </div>
            <div>
              <dt className="inline text-faint">{t("vps.lifecycle.swap.preview.node")}</dt>
              <dd className="inline"> {nodeLabel(selectedTarget)}</dd>
            </div>
            <div>
              <dt className="inline text-faint">{t("vps.lifecycle.swap.preview.location")}</dt>
              <dd className="inline"> {vpsLocationLabel(selectedTarget)}</dd>
            </div>
            <div>
              <dt className="inline text-faint">{t("vps.lifecycle.swap.preview.resources")}</dt>
              <dd className="inline"> {resourceSummary(selectedTarget)}</dd>
            </div>
            <div>
              <dt className="inline text-faint">{t("vps.lifecycle.swap.preview.dataset")}</dt>
              <dd className="inline"> {datasetLabel(selectedTarget)}</dd>
            </div>
            <div>
              <dt className="inline text-faint">{t("vps.lifecycle.swap.preview.expiration")}</dt>
              <dd className="inline"> {formatDateTime((selectedTarget as LegacyAny)?.expiration_date)}</dd>
            </div>
            <div>
              <dt className="inline text-faint">{t("vps.lifecycle.swap.preview.state")}</dt>
              <dd className="inline"> {stateLabel(selectedTarget)}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="vps.lifecycle.swap.impact_summary">
        <ImpactItem label={t("vps.lifecycle.swap.impact.target_fit")} testId="vps.lifecycle.swap.impact.target_fit">
          {selectedTargetIsLikely ? t("vps.lifecycle.swap.impact.target_fit_likely") : t("vps.lifecycle.swap.impact.target_fit_manual")} {selectedTargetSameOwner ? t("vps.lifecycle.swap.impact.same_owner") : t("vps.lifecycle.swap.impact.owner_differs")} {selectedTargetSameLocation ? t("vps.lifecycle.swap.impact.same_location") : t("vps.lifecycle.swap.impact.location_differs")}
        </ImpactItem>
        <ImpactItem label={t("vps.lifecycle.swap.impact.network")} testId="vps.lifecycle.swap.impact.network">
          {t("vps.lifecycle.swap.impact.network_body", { source: sourceIpCount, target: targetIpCount })}
        </ImpactItem>
        <ImpactItem label={t("vps.lifecycle.swap.impact.dataset")} testId="vps.lifecycle.swap.impact.dataset">
          {t("vps.lifecycle.swap.impact.dataset_body", { source: datasetLabel(vps), target: datasetLabel(selectedTarget) })}
        </ImpactItem>
        <ImpactItem label={t("vps.lifecycle.swap.impact.options")} testId="vps.lifecycle.swap.impact.options">
          {isAdminMode
            ? t("vps.lifecycle.swap.preview.admin_options", {
                hostname: swap.hostname ? t("common.yes") : t("common.no"),
                resources: swap.resources ? t("common.yes") : t("common.no"),
                expirations: swap.expirations ? t("common.yes") : t("common.no"),
              })
            : t("vps.lifecycle.swap.preview.user_options")}
        </ImpactItem>
      </div>
      {targetVpsQ.isError || sourceIpsQ.isError || targetIpsQ.isError ? (
        <Alert className="mt-3" variant="warn" title={t("vps.lifecycle.swap.preview.partial_title")} testId="vps.lifecycle.swap.preview.partial">
          {t("vps.lifecycle.swap.preview.partial_body")}
        </Alert>
      ) : null}
      <div className="mt-3 overflow-hidden rounded-md border border-border bg-surface" data-testid="vps.lifecycle.swap.preview.after_table">
        <div className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-border bg-surface-2 px-3 py-2 text-xs font-medium text-muted">
          <div>{t("vps.lifecycle.swap.preview.after_field")}</div>
          <div>{t("vps.lifecycle.swap.preview.after_source")}</div>
          <div>{t("vps.lifecycle.swap.preview.after_target")}</div>
        </div>
        {[
          [t("vps.lifecycle.swap.preview.hostname"), sourceHostnameAfter, targetHostnameAfter],
          [t("vps.lifecycle.swap.preview.owner"), ownerLabel(vps), ownerLabel(selectedTarget)],
          [t("vps.lifecycle.swap.preview.node"), nodeLabel(vps), nodeLabel(selectedTarget)],
          [t("vps.lifecycle.swap.preview.location"), vpsLocationLabel(vps), vpsLocationLabel(selectedTarget)],
          [t("vps.lifecycle.swap.preview.resources"), sourceResourcesAfter, targetResourcesAfter],
          [t("vps.lifecycle.swap.preview.dataset"), sourceDatasetAfter, targetDatasetAfter],
          [t("vps.lifecycle.swap.preview.expiration"), sourceExpirationAfter, targetExpirationAfter],
        ].map(([label, sourceValue, targetValue]) => (
          <div key={label} className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-border px-3 py-2 text-xs last:border-b-0">
            <div className="font-medium text-muted">{label}</div>
            <div className="min-w-0 pr-2">{sourceValue}</div>
            <div className="min-w-0">{targetValue}</div>
          </div>
        ))}
        <div className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] px-3 py-2 text-xs">
          <div className="font-medium text-muted">{t("vps.lifecycle.swap.preview.ip_assignments")}</div>
          <div className="min-w-0 pr-2">
            <CompactValueList values={selectedTargetIps} empty={t("vps.lifecycle.swap.preview.no_target_ips")} testId="vps.lifecycle.swap.preview.after_table.source_ips" />
          </div>
          <div className="min-w-0">
            <CompactValueList values={selectedSourceIps} empty={t("vps.lifecycle.swap.preview.no_source_ips")} testId="vps.lifecycle.swap.preview.after_table.target_ips" />
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-xs font-medium text-muted">{t("vps.lifecycle.swap.preview.source_after")}</div>
          <div className="mt-1 text-xs text-faint">{t("vps.lifecycle.swap.preview.source_after_help")}</div>
          <div className="mt-2">
            <IpList ips={targetIps} loading={targetIpsQ.isLoading} empty={t("vps.lifecycle.swap.preview.no_target_ips")} loadingText={t("common.loading")} testId="vps.lifecycle.swap.preview.source_ips_after" />
          </div>
        </div>
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-xs font-medium text-muted">{t("vps.lifecycle.swap.preview.target_after")}</div>
          <div className="mt-1 text-xs text-faint">{t("vps.lifecycle.swap.preview.target_after_help")}</div>
          <div className="mt-2">
            <IpList ips={sourceIps} loading={sourceIpsQ.isLoading} empty={t("vps.lifecycle.swap.preview.no_source_ips")} loadingText={t("common.loading")} testId="vps.lifecycle.swap.preview.target_ips_after" />
          </div>
        </div>
      </div>
      <div className="mt-3 text-xs text-faint" data-testid="vps.lifecycle.swap.preview.options">
        {isAdminMode
          ? t("vps.lifecycle.swap.preview.admin_options", {
              hostname: swap.hostname ? t("common.yes") : t("common.no"),
              resources: swap.resources ? t("common.yes") : t("common.no"),
              expirations: swap.expirations ? t("common.yes") : t("common.no"),
            })
          : t("vps.lifecycle.swap.preview.user_options")}
      </div>
    </div>
  ) : (
    <Alert variant="neutral">{t("vps.lifecycle.swap.preview.empty")}</Alert>
  );
  const swapDrawer = (
    <Drawer
      open={swapOpen}
      onClose={() => setSwapOpen(false)}
      side="right"
      width="lg"
      title={t("vps.lifecycle.swap.title")}
      testId="vps.lifecycle.swap.drawer"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => setSwapOpen(false)} disabled={swapM.isPending}>
            {t("common.cancel")}
          </Button>
          <ActionButton variant="danger" testId="vps.lifecycle.swap.submit" disabled={!swap.confirm || !swap.targetVps || !gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} loading={swapM.isPending} onClick={() => swapM.mutate()}>
            {t("vps.lifecycle.swap.submit")}
          </ActionButton>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-muted">{isAdminMode ? t("vps.lifecycle.swap.subtitle") : t("vps.lifecycle.swap.subtitle_user")}</div>
        <div className="space-y-2" data-testid="vps.lifecycle.swap.candidates">
          <div className="text-xs font-medium text-muted">{t("vps.lifecycle.swap.candidates.title")}</div>
          {swapCandidatesQ.isLoading ? (
            <div className="text-sm text-muted">{t("common.loading")}</div>
          ) : likelyCandidateRows.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {likelyCandidateRows.map((candidate: Vps) => {
                const selected = Number(candidate.id) === swap.targetVps;
                const reasons = swapCandidateReasonKeys(candidate, vps as Vps, nodeId ?? null, locationId ?? null);
                return (
                  <button type="button" key={candidate.id} className={["rounded-md border p-3 text-left text-sm hover:bg-surface-2", selected ? "border-border bg-surface-2 ring-2 ring-focus/35" : "border-border bg-surface"].join(" ")} onClick={() => setSwap((p: LegacyAny) => ({ ...p, targetVps: Number(candidate.id), confirm: false }))} data-testid={`vps.lifecycle.swap.candidate.${candidate.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{vpsLabel(candidate, candidate.id)}</div>
                      <span className="shrink-0 rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-muted" data-testid={`vps.lifecycle.swap.candidate.${candidate.id}.badge`}>
                        {selected ? t("vps.lifecycle.swap.candidate.selected") : t("vps.lifecycle.swap.candidate.badge")}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-faint">
                      {nodeLabel(candidate)} / {vpsLocationLabel(candidate)}
                    </div>
                    <div className="mt-1 text-xs text-faint">{resourceSummary(candidate)}</div>
                    <div className="mt-1 text-xs text-faint">
                      {t("vps.lifecycle.swap.preview.dataset")} {datasetLabel(candidate)}
                    </div>
                    <div className="mt-2 text-xs text-muted" data-testid={`vps.lifecycle.swap.candidate.${candidate.id}.reasons`}>
                      {reasons.map((reason) => t(reason)).join(" · ")}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <Alert variant="neutral" title={t("vps.lifecycle.swap.candidates.empty_title")}>
              {t("vps.lifecycle.swap.candidates.empty")}
            </Alert>
          )}
        </div>
        <Field label={t("vps.lifecycle.field.target_vps")} help={t("vps.lifecycle.swap.target_help")}>
          <VpsLookupInput value={swap.targetVps} onChange={(targetVps) => setSwap((prev: LegacyAny) => ({ ...prev, targetVps, confirm: false }))} userId={ownerId ?? undefined} placeholder={t("vps.lifecycle.placeholder.vps")} testId="vps.lifecycle.swap.target" disabled={swapM.isPending} />
        </Field>
        {isAdminMode ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <Checkbox checked={swap.hostname} onChange={(v) => setSwap((p: LegacyAny) => ({ ...p, hostname: v, confirm: false }))} label={t("vps.lifecycle.swap.option.hostname")} testId="vps.lifecycle.swap.hostname" />
            <Checkbox checked={swap.resources} onChange={(v) => setSwap((p: LegacyAny) => ({ ...p, resources: v, confirm: false }))} label={t("vps.lifecycle.swap.option.resources")} testId="vps.lifecycle.swap.resources" />
            <Checkbox checked={swap.expirations} onChange={(v) => setSwap((p: LegacyAny) => ({ ...p, expirations: v, confirm: false }))} label={t("vps.lifecycle.swap.option.expirations")} testId="vps.lifecycle.swap.expirations" />
          </div>
        ) : (
          <Alert variant="neutral">{t("vps.lifecycle.swap.user_options_hint")}</Alert>
        )}
        {swapPreview}
        <Alert variant="warn" title={t("vps.lifecycle.swap.warning_title")}>
          {t("vps.lifecycle.swap.warning_body")}
        </Alert>
        <Checkbox checked={swap.confirm} onChange={(v) => setSwap((p: LegacyAny) => ({ ...p, confirm: v }))} label={t("vps.lifecycle.confirm.swap")} testId="vps.lifecycle.swap.confirm" />
        {swapM.isError ? (
          <Alert title={t("vps.lifecycle.swap.error")} variant="danger">
            {mutationErrorMessage(swapM.error, t("vps.lifecycle.validation.swap"))}
          </Alert>
        ) : null}
      </div>
    </Drawer>
  );
  const swapCard = (
    <>
      <Card testId="vps.lifecycle.swap">
        <CardHeader
          title={t("vps.lifecycle.swap.title")}
          subtitle={isAdminMode ? t("vps.lifecycle.swap.subtitle") : t("vps.lifecycle.swap.subtitle_user")}
          actions={
            <Button variant="primary" onClick={() => setSwapOpen(true)} testId="vps.lifecycle.swap.open">
              {t("vps.lifecycle.swap.open")}
            </Button>
          }
        />
        <CardBody className="space-y-3">
          <div className="text-sm text-muted">{t("vps.lifecycle.swap.entry_summary")}</div>
          {likelyCandidateRows.length > 0 ? (
            <div className="text-xs text-faint" data-testid="vps.lifecycle.swap.entry_candidates">
              {t("vps.lifecycle.swap.entry_candidates", { count: likelyCandidateRows.length })}
            </div>
          ) : null}
        </CardBody>
      </Card>
      {swapDrawer}
    </>
  );
  return swapCard;
}

import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAppMode } from "../../../app/appMode";
import { useI18n } from "../../../app/i18n";
import { useChrome } from "../../../components/layout/ChromeContext";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { Checkbox } from "../../../components/ui/Checkbox";
import { Drawer } from "../../../components/ui/Drawer";
import { Input } from "../../../components/ui/Input";
import { NodeLookupInput } from "../../../components/ui/NodeLookupInput";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { UserLookupInput } from "../../../components/ui/UserLookupInput";
import { VpsLookupInput } from "../../../components/ui/VpsLookupInput";
import { LifecyclePanel } from "../../../components/lifetimes/LifecyclePanel";
import { getMetaActionStateId } from "../../../lib/api/haveapi";
import { fetchLocations, type Location } from "../../../lib/api/infra";
import { fetchNodes, type Node } from "../../../lib/api/nodes";
import { fetchIpAddressesForVps, type IpAddress } from "../../../lib/api/ipAddresses";
import { fetchOsTemplates, type OsTemplate } from "../../../lib/api/osTemplates";
import { fetchVps, fetchVpsList, updateVps, vpsBoot, vpsClone, vpsDelete, vpsMigrate, vpsReinstall, vpsReplace, vpsSwapWith, type VpsBootPayload, type VpsClonePayload, type VpsMigratePayload, type VpsReplacePayload, type VpsSwapWithPayload, type Vps } from "../../../lib/api/vps";
import { formatDateTime, formatMiB } from "../../../lib/format";
import { gateVpsMutation } from "../../../lib/gates/vps";
import { parseLookupIdLike } from "../../../lib/lookupInput";
import { vpsMatchesOwner } from "../../../lib/vpsClientFilters";
import { preflightVpsNotBusy } from "./vpsPreflight";
import { useVps } from "./VpsContext";
import { BootForm, CloneForm, DeleteForm, Field, LifecycleActionKind, LifecycleActionPanel, MigrateForm, ReplaceForm, ReinstallForm, SwapForm, TemplateForm, defaultExpirationInput, lifecycleActionKinds, locationEnvironmentId, locationLabel, migrateHourOptions, migrateWeekdayOptions, mutationErrorMessage, nodeLocation, parseOptionalId, parseOptionalNonNegativeInt, parseRequiredId, pickedNodeLabel, rankSwapCandidate, resourceId, templateLabel, toIsoDateTime } from "./VpsLifecyclePage.shared";
import { renderVpsLifecycleSwapCard } from "./VpsLifecycleSwapCard";
export function VpsLifecyclePage() {
  const { t } = useI18n();
  const { mode, basePath } = useAppMode();
  const chrome = useChrome();
  const navigate = useNavigate();
  const routeParams = useParams();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { vps, refetch, refetchChains, vpsRef, busyTransaction, busyLocalLock } = useVps();
  const vpsId = Number(vps.id);
  const objectLabel = String((vps as LegacyAny).hostname ?? "") || `#${vpsId}`;
  const ownerId = resourceId((vps as LegacyAny).user);
  const nodeId = resourceId((vps as LegacyAny).node);
  const locationId = resourceId((vps as LegacyAny).node?.location ?? (vps as LegacyAny).location);
  const osTemplateId = resourceId((vps as LegacyAny).os_template);
  const isAdminMode = mode === "admin";
  const routeActionRaw = routeParams["lifecycleAction"];
  const requestedActionRaw = routeActionRaw ?? searchParams.get("action");
  const requestedAction = lifecycleActionKinds.has(requestedActionRaw as LifecycleActionKind) ? (requestedActionRaw as LifecycleActionKind) : null;
  const invalidAction = Boolean(routeActionRaw && !requestedAction);
  const [openActions, setOpenActions] = useState<Set<LifecycleActionKind>>(() => new Set());
  const templatesNeeded = isAdminMode || requestedAction === "template" || requestedAction === "boot" || requestedAction === "reinstall" || openActions.has("template") || openActions.has("boot") || openActions.has("reinstall");
  const templatesQ = useQuery({
    queryKey: ["os_templates", "vps-lifecycle", { limit: 500, enabled: true, hypervisorType: "vpsadminos" }],
    queryFn: async () => (await fetchOsTemplates({ limit: 500, enabled: true, hypervisorType: "vpsadminos" })).data,
    enabled: templatesNeeded,
    staleTime: 60_000,
  });
  const locationsQ = useQuery({
    queryKey: ["locations", "vps-lifecycle", { limit: 500, hasHypervisor: true, hypervisorType: "vpsadminos", includes: "environment" }],
    queryFn: async () => (await fetchLocations({ limit: 500, hasHypervisor: true, hypervisorType: "vpsadminos", includes: "environment" })).data,
    enabled: !isAdminMode,
    staleTime: 60_000,
  });
  const nodesQ = useQuery({
    queryKey: ["nodes", "vps-lifecycle-migrate", { limit: 500, includes: "location__environment" }],
    queryFn: async () => (await fetchNodes({ limit: 500, includes: "location__environment" })).data,
    enabled: isAdminMode && requestedAction === "migrate",
    staleTime: 60_000,
  });
  const sourceIpsQ = useQuery({
    queryKey: ["ip_address", "list", "vps-lifecycle-source", { vpsId }],
    queryFn: async () => (await fetchIpAddressesForVps(vpsId, { limit: 100 })).data,
    staleTime: 30_000,
  });
  const [clone, setClone] = useState<CloneForm>(() => ({
    user: ownerId ? String(ownerId) : "",
    node: nodeId ? String(nodeId) : "",
    location: locationId ? String(locationId) : "",
    hostname: `${String((vps as LegacyAny).hostname ?? `vps-${vpsId}`)}-${vpsId}-clone`,
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
  const [swapOpen, setSwapOpen] = useState(false);
  useEffect(() => {
    if (requestedAction === "swap") setSwapOpen(true);
  }, [requestedAction]);
  const [replace, setReplace] = useState<ReplaceForm>(() => ({
    node: nodeId ? String(nodeId) : "",
    expirationDate: defaultExpirationInput(),
    start: false,
    reason: "",
    confirm: false,
  }));
  const [replaceNodeLabel, setReplaceNodeLabel] = useState("");
  const [templateForm, setTemplateForm] = useState<TemplateForm>(() => ({
    osTemplate: osTemplateId ? String(osTemplateId) : "",
    autoUpdate: Boolean((vps as LegacyAny).enable_os_template_auto_update),
    confirm: false,
  }));
  const [boot, setBoot] = useState<BootForm>(() => ({
    osTemplate: osTemplateId ? String(osTemplateId) : "",
    mountRootDataset: true,
    mountpoint: "/mnt/vps",
    confirm: false,
  }));
  const [reinstall, setReinstall] = useState<ReinstallForm>(() => ({
    osTemplate: osTemplateId ? String(osTemplateId) : "",
    confirm: false,
  }));
  const [migrate, setMigrate] = useState<MigrateForm>(() => ({
    node: "",
    replaceIpAddresses: false,
    transferIpAddresses: true,
    scheduleMode: "maintenance",
    finishWeekday: "",
    finishHour: "",
    stopOnError: true,
    cleanupData: true,
    noStart: false,
    skipStart: false,
    sendMail: true,
    reason: "",
    confirm: false,
  }));
  const [deleteForm, setDeleteForm] = useState<DeleteForm>({
    lazy: true,
    confirm: false,
  });
  const targetVpsQ = useQuery({
    queryKey: ["vps", "show", "swap-target", { id: swap.targetVps ?? -1 }],
    queryFn: async () => (await fetchVps(swap.targetVps!, { includes: "node__location,user" })).data,
    enabled: Boolean(swap.targetVps),
    staleTime: 30_000,
  });
  const swapCandidatesQ = useQuery({
    queryKey: ["vps", "swap-candidates", { ownerId: ownerId ?? null, source: vpsId }],
    queryFn: async () => {
      const res = await fetchVpsList({
        limit: 50,
        user: ownerId ?? undefined,
      });
      return res.data
        .filter((candidate) => vpsMatchesOwner(candidate, ownerId ?? undefined))
        .filter((candidate) => Number(candidate.id) !== vpsId)
        .sort((a, b) => {
          const byScore = rankSwapCandidate(b, vps as Vps, nodeId ?? null, locationId ?? null) - rankSwapCandidate(a, vps as Vps, nodeId ?? null, locationId ?? null);
          if (byScore !== 0) return byScore;
          return Number(a.id) - Number(b.id);
        })
        .slice(0, 6);
    },
    enabled: Boolean(ownerId),
    staleTime: 30_000,
  });
  const targetIpsQ = useQuery({
    queryKey: ["ip_address", "list", "vps-lifecycle-target", { vpsId: swap.targetVps ?? -1 }],
    queryFn: async () => (await fetchIpAddressesForVps(swap.targetVps!, { limit: 100 })).data,
    enabled: Boolean(swap.targetVps),
    staleTime: 30_000,
  });
  const cloneTargetReady = isAdminMode ? Boolean(clone.user.trim() && clone.node.trim()) : Boolean(clone.location.trim());
  const sourceLocation = ((vps as LegacyAny).node?.location ?? (vps as LegacyAny).location) as Location | undefined;
  const sourceLocationId = locationId;
  const sourceEnvironmentId = locationEnvironmentId(sourceLocation);
  const migrateNodeId = parseLookupIdLike(migrate.node.trim());
  const migrateTargetNode = migrateNodeId !== null ? nodesQ.data?.find((node) => Number(node.id) === migrateNodeId) : undefined;
  const migrateTargetLocation = nodeLocation(migrateTargetNode);
  const migrateTargetLocationId = resourceId(migrateTargetLocation);
  const migrateTargetEnvironmentId = locationEnvironmentId(migrateTargetLocation);
  const migrateCanTransferIpAddresses = sourceEnvironmentId !== undefined && migrateTargetEnvironmentId !== undefined && sourceEnvironmentId !== migrateTargetEnvironmentId;
  const migrateCanReplaceIpAddresses = sourceLocationId !== null && migrateTargetLocationId !== null && sourceLocationId !== migrateTargetLocationId;
  const migrateTargetSelected = Boolean(migrateTargetNode);
  const cloneLocationId = parseLookupIdLike(clone.location.trim());
  const cloneLocation = cloneLocationId !== null ? locationsQ.data?.find((location) => Number(location.id) === cloneLocationId) : undefined;
  const cloneEnvironmentId = locationEnvironmentId(cloneLocation);
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
        hostname: clone.hostname.trim() || undefined,
        subdatasets: clone.subdatasets,
        dataset_plans: clone.datasetPlans,
        resources: clone.resources,
        features: clone.features,
        stop: clone.stop,
      };
      if (isAdminMode) {
        payload.user = parseRequiredId(clone.user);
        payload.node = parseRequiredId(clone.node);
      } else {
        payload.location = parseRequiredId(clone.location);
        if (cloneEnvironmentId !== undefined) payload.environment = cloneEnvironmentId;
      }
      return vpsClone(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, "action.vps.clone.label");
      const newId = Number((res.data as LegacyAny)?.id);
      if (Number.isInteger(newId) && newId > 0) navigate(`${basePath}/vps/${newId}`);
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });
  const swapM = useMutation({
    mutationFn: async () => {
      await preflight();
      if (!swap.targetVps) throw new Error("required-id");
      const payload: VpsSwapWithPayload = { vps: swap.targetVps };
      if (isAdminMode) {
        payload.hostname = swap.hostname;
        payload.resources = swap.resources;
        payload.expirations = swap.expirations;
      }
      return vpsSwapWith(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, "action.vps.swap.label");
      void qc.invalidateQueries({ queryKey: ["vps", vpsId] });
      setSwap((p) => ({ ...p, confirm: false }));
      setSwapOpen(false);
      chrome.openTasks();
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
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
      track(res.meta, "action.vps.replace.label");
      const newId = Number((res.data as LegacyAny)?.id);
      if (Number.isInteger(newId) && newId > 0 && newId !== vpsId) navigate(`${basePath}/vps/${newId}`);
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
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
      track(res.meta, "action.vps.template.label");
      void qc.invalidateQueries({ queryKey: ["vps", vpsId] });
      setTemplateForm((p) => ({ ...p, confirm: false }));
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
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
        if (!mountpoint || !mountpoint.startsWith("/")) throw new Error("invalid-id");
        payload.mount_root_dataset = mountpoint;
      }
      return vpsBoot(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, "action.vps.boot.label");
      setBoot((p) => ({ ...p, confirm: false }));
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
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
      track(res.meta, "action.vps.reinstall.label");
      setReinstall((p) => ({ ...p, confirm: false }));
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });
  const migrateM = useMutation({
    mutationFn: async () => {
      await preflight();
      const finishWeekday = migrate.scheduleMode === "custom" ? parseOptionalNonNegativeInt(migrate.finishWeekday) : undefined;
      const finishHour = migrate.scheduleMode === "custom" ? parseOptionalNonNegativeInt(migrate.finishHour) : undefined;
      if (migrate.scheduleMode === "custom" && (finishWeekday === undefined || finishHour === undefined || finishHour > 23)) {
        throw new Error("invalid-id");
      }
      const payload: VpsMigratePayload = {
        node: parseRequiredId(migrate.node),
        replace_ip_addresses: migrateCanReplaceIpAddresses ? migrate.replaceIpAddresses : false,
        transfer_ip_addresses: migrateCanTransferIpAddresses ? migrate.transferIpAddresses : false,
        maintenance_window: migrate.scheduleMode === "maintenance",
        stop_on_error: migrate.stopOnError,
        cleanup_data: migrate.cleanupData,
        no_start: migrate.noStart,
        skip_start: migrate.skipStart,
        send_mail: migrate.sendMail,
      };
      if (finishWeekday !== undefined) payload.finish_weekday = finishWeekday;
      if (finishHour !== undefined) payload.finish_minutes = finishHour * 60;
      const reason = migrate.reason.trim();
      if (reason) payload.reason = reason;
      return vpsMigrate(vpsId, payload);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, "action.vps.migrate.label");
      setMigrate((p) => ({ ...p, confirm: false }));
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });
  const deleteM = useMutation({
    mutationFn: async () => {
      await preflight();
      return vpsDelete(vpsId, isAdminMode ? { lazy: deleteForm.lazy } : undefined);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: (res) => {
      track(res.meta, "action.vps.delete.label");
      navigate(`${basePath}/vps`);
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });
  const busyLocal = busyLocalLock || cloneM.isPending || swapM.isPending || replaceM.isPending || templateM.isPending || bootM.isPending || reinstallM.isPending || migrateM.isPending || deleteM.isPending;
  const gate = gateVpsMutation({ vps, busyLocal, busyTransaction });
  const sourceIps = sourceIpsQ.data ?? [];
  const targetIps = targetIpsQ.data ?? [];
  const cloneCard = (
    <Card testId="vps.lifecycle.clone">
      <CardHeader title={t("vps.lifecycle.clone.title")} subtitle={isAdminMode ? t("vps.lifecycle.clone.subtitle") : t("vps.lifecycle.clone.subtitle_user")} />
      <CardBody className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {isAdminMode ? (
            <>
              <Field label={t("vps.lifecycle.field.owner")} help={t("vps.lifecycle.clone.owner_help")}>
                <UserLookupInput value={clone.user} onChange={(user) => setClone((prev) => ({ ...prev, user }))} placeholder={t("vps.lifecycle.placeholder.user")} testId="vps.lifecycle.clone.user" disabled={cloneM.isPending} />
              </Field>
              <Field label={t("vps.lifecycle.field.node")} help={t("vps.lifecycle.clone.node_help")}>
                <NodeLookupInput value={clone.node} onChange={(node) => setClone((prev) => ({ ...prev, node }))} placeholder={t("vps.lifecycle.placeholder.node")} testId="vps.lifecycle.clone.node" disabled={cloneM.isPending} />
              </Field>
            </>
          ) : (
            <Field label={t("vps.lifecycle.field.location")} help={t("vps.lifecycle.clone.location_help")}>
              <Select value={clone.location} onChange={(e) => setClone((prev) => ({ ...prev, location: e.target.value }))} disabled={cloneM.isPending || locationsQ.isLoading} testId="vps.lifecycle.clone.location">
                <option value="">{t("vps.lifecycle.placeholder.location")}</option>
                {locationsQ.data?.map((location) => (
                  <option key={location.id} value={location.id}>
                    {locationLabel(location)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={t("vps.lifecycle.field.hostname")} help={t("vps.lifecycle.clone.hostname_help")}>
            <Input value={clone.hostname} onChange={(e) => setClone((prev) => ({ ...prev, hostname: e.target.value }))} testId="vps.lifecycle.clone.hostname" disabled={cloneM.isPending} />
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Checkbox checked={clone.subdatasets} onChange={(v) => setClone((p) => ({ ...p, subdatasets: v }))} label={t("vps.lifecycle.clone.option.subdatasets")} testId="vps.lifecycle.clone.subdatasets" />
          <Checkbox checked={clone.datasetPlans} onChange={(v) => setClone((p) => ({ ...p, datasetPlans: v }))} label={t("vps.lifecycle.clone.option.dataset_plans")} testId="vps.lifecycle.clone.dataset_plans" />
          <Checkbox checked={clone.resources} onChange={(v) => setClone((p) => ({ ...p, resources: v }))} label={t("vps.lifecycle.clone.option.resources")} testId="vps.lifecycle.clone.resources" />
          <Checkbox checked={clone.features} onChange={(v) => setClone((p) => ({ ...p, features: v }))} label={t("vps.lifecycle.clone.option.features")} testId="vps.lifecycle.clone.features" />
          <Checkbox checked={clone.stop} onChange={(v) => setClone((p) => ({ ...p, stop: v }))} label={t("vps.lifecycle.clone.option.stop")} testId="vps.lifecycle.clone.stop" />
        </div>
        <Checkbox checked={clone.confirm} onChange={(v) => setClone((p) => ({ ...p, confirm: v }))} label={t("vps.lifecycle.confirm.clone")} testId="vps.lifecycle.clone.confirm" />
        {cloneM.isError ? (
          <Alert title={t("vps.lifecycle.clone.error")} variant="danger">
            {mutationErrorMessage(cloneM.error, t("vps.lifecycle.validation.clone"))}
          </Alert>
        ) : null}
        <div className="flex justify-end">
          <ActionButton variant="primary" testId="vps.lifecycle.clone.submit" disabled={!clone.confirm || !cloneTargetReady || !gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} loading={cloneM.isPending} onClick={() => cloneM.mutate()}>
            {t("vps.lifecycle.clone.submit")}
          </ActionButton>
        </div>
      </CardBody>
    </Card>
  );
  const swapCard = renderVpsLifecycleSwapCard({
    t,
    isAdminMode,
    swapCandidatesQ,
    targetVpsQ,
    swap,
    sourceIps,
    targetIps,
    vps,
    vpsId,
    ownerId,
    locationId,
    sourceIpsQ,
    targetIpsQ,
    setSwap,
    setSwapOpen,
    swapOpen,
    swapM,
    gate,
    nodeId,
  });
  const deleteCard = (
    <Card testId="vps.lifecycle.delete">
      <CardHeader title={t("vps.lifecycle.delete.title")} subtitle={t("vps.lifecycle.delete.subtitle")} />
      <CardBody className="space-y-4">
        {!isAdminMode ? <Alert variant="neutral">{t("vps.lifecycle.user_delete.summary")}</Alert> : null}
        <Alert variant="danger" title={t("vps.lifecycle.delete.warning_title")}>
          {t("vps.lifecycle.delete.warning_body")}
        </Alert>
        {isAdminMode ? <Checkbox checked={deleteForm.lazy} onChange={(v) => setDeleteForm((p) => ({ ...p, lazy: v }))} label={t("vps.lifecycle.delete.lazy")} description={t("vps.lifecycle.delete.lazy_help")} testId="vps.lifecycle.delete.lazy" /> : null}
        <Checkbox checked={deleteForm.confirm} onChange={(v) => setDeleteForm((p) => ({ ...p, confirm: v }))} label={t("vps.lifecycle.confirm.delete")} testId="vps.lifecycle.delete.confirm" />
        {deleteM.isError ? (
          <Alert title={t("vps.lifecycle.delete.error")} variant="danger">
            {mutationErrorMessage(deleteM.error, t("vps.lifecycle.validation.delete"))}
          </Alert>
        ) : null}
        <div className="flex justify-end">
          <ActionButton variant="danger" testId="vps.lifecycle.delete.submit" disabled={!deleteForm.confirm || !gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} loading={deleteM.isPending} onClick={() => deleteM.mutate()}>
            {t("vps.lifecycle.delete.submit")}
          </ActionButton>
        </div>
      </CardBody>
    </Card>
  );
  const handleActionToggle = (kind: LifecycleActionKind, open: boolean) => {
    setOpenActions((prev) => {
      const next = new Set(prev);
      if (open) next.add(kind);
      else next.delete(kind);
      return next;
    });
  };
  const panelOpen = (kind: LifecycleActionKind) => requestedAction === kind || openActions.has(kind);
  const actionPanelProps = (kind: LifecycleActionKind) => ({
    kind,
    open: panelOpen(kind),
    openLabel: t("common.open"),
    closeLabel: t("common.close"),
    onToggle: handleActionToggle,
  });
  const lifecycleBasePath = `${basePath}/vps/${vpsId}/lifecycle`;
  const goToAction = (kind: LifecycleActionKind) => navigate(`${lifecycleBasePath}/${kind}`);
  const allActionChoices: Array<{
    kind: LifecycleActionKind;
    title: string;
    description: string;
    danger?: boolean;
    adminOnly?: boolean;
  }> = [
    { kind: "reinstall", title: t("vps.lifecycle.reinstall.title"), description: t("vps.lifecycle.reinstall.subtitle"), danger: true },
    { kind: "clone", title: t("vps.lifecycle.clone.title"), description: isAdminMode ? t("vps.lifecycle.clone.subtitle") : t("vps.lifecycle.clone.subtitle_user") },
    { kind: "swap", title: t("vps.lifecycle.swap.title"), description: isAdminMode ? t("vps.lifecycle.swap.subtitle") : t("vps.lifecycle.swap.subtitle_user"), danger: true },
    { kind: "delete", title: t("vps.lifecycle.delete.title"), description: t("vps.lifecycle.delete.subtitle"), danger: true },
    { kind: "lifetime", title: t("vps.lifecycle.lifetime.title"), description: isAdminMode ? t("vps.lifecycle.lifetime.subtitle_admin") : t("vps.lifecycle.lifetime.subtitle_user"), adminOnly: true },
    { kind: "template", title: t("vps.lifecycle.template.title"), description: t("vps.lifecycle.template.subtitle"), adminOnly: true },
    { kind: "boot", title: t("vps.lifecycle.boot.title"), description: t("vps.lifecycle.boot.subtitle"), danger: true, adminOnly: true },
    { kind: "replace", title: t("vps.lifecycle.replace.title"), description: t("vps.lifecycle.replace.subtitle"), danger: true, adminOnly: true },
    { kind: "migrate", title: t("vps.lifecycle.migrate.title"), description: t("vps.lifecycle.migrate.subtitle"), adminOnly: true },
  ];
  const actionChoices = allActionChoices.filter((choice) => isAdminMode || !choice.adminOnly);
  const activeChoice = requestedAction ? actionChoices.find((choice) => choice.kind === requestedAction) : undefined;
  if (invalidAction || (requestedAction && !actionChoices.some((choice) => choice.kind === requestedAction))) {
    return (
      <div className="space-y-4" data-testid="vps.lifecycle.page">
        <Card testId="vps.lifecycle.summary">
          <CardHeader title={t("vps.lifecycle.title")} subtitle={t("vps.lifecycle.invalid_action")} />
          <CardBody>
            <Button variant="primary" onClick={() => navigate(lifecycleBasePath)}>
              {t("vps.lifecycle.back_to_actions")}
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }
  if (!requestedAction) {
    return (
      <div className="space-y-4" data-testid="vps.lifecycle.page">
        <Card testId="vps.lifecycle.summary">
          <CardHeader title={t("vps.lifecycle.title")} subtitle={isAdminMode ? t("vps.lifecycle.subtitle_admin") : t("vps.lifecycle.subtitle_user")} />
          <CardBody className="space-y-4">
            <Alert variant="neutral">{isAdminMode ? t("vps.lifecycle.action_index.summary_admin") : t("vps.lifecycle.action_index.summary_user")}</Alert>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="vps.lifecycle.action_index">
              {actionChoices.map((choice) => (
                <button key={choice.kind} type="button" className={["rounded-lg border bg-surface p-4 text-left shadow-card transition hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-focus", choice.danger ? "border-danger-border" : "border-border"].join(" ")} onClick={() => goToAction(choice.kind)} data-testid={`vps.lifecycle.action_link.${choice.kind}`}>
                  <span className={choice.danger ? "block text-sm font-semibold text-danger" : "block text-sm font-semibold text-fg"}>{choice.title}</span>
                  <span className="mt-1 block text-xs text-muted">{choice.description}</span>
                </button>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }
  if (!isAdminMode) {
    return (
      <div className="space-y-4" data-testid="vps.lifecycle.page">
        <Card testId="vps.lifecycle.summary">
          <CardHeader
            title={activeChoice?.title ?? t("vps.lifecycle.title")}
            subtitle={activeChoice?.description ?? t("vps.lifecycle.subtitle_user")}
            actions={
              <Button variant="secondary" onClick={() => navigate(lifecycleBasePath)}>
                {t("vps.lifecycle.back_to_actions")}
              </Button>
            }
          />
          <CardBody>
            <Alert variant="neutral">{t("vps.lifecycle.user_lifecycle.summary")}</Alert>
          </CardBody>
        </Card>
        {requestedAction === "lifetime" ? (
          <LifecycleActionPanel {...actionPanelProps("lifetime")} title={t("vps.lifecycle.lifetime.title")} subtitle={t("vps.lifecycle.lifetime.subtitle_user")}>
            <LifecyclePanel kind="vps" id={vps.id} objectLabel={objectLabel} objectState={(vps as LegacyAny).object_state as LegacyAny} expirationDate={(vps as LegacyAny).expiration_date as LegacyAny} remindAfterDate={(vps as LegacyAny).remind_after_date as LegacyAny} onUpdated={refetch} testId="vps.lifecycle.lifetime" />
          </LifecycleActionPanel>
        ) : null}
        {requestedAction === "reinstall" ? (
          <LifecycleActionPanel {...actionPanelProps("reinstall")} title={t("vps.lifecycle.reinstall.title")} subtitle={t("vps.lifecycle.reinstall.subtitle")} danger>
            <Card testId="vps.lifecycle.reinstall">
              <CardHeader title={t("vps.lifecycle.reinstall.title")} subtitle={t("vps.lifecycle.reinstall.subtitle")} />
              <CardBody className="space-y-4">
                <Alert variant="warn" title={t("vps.lifecycle.reinstall.warning_title")}>
                  {t("vps.lifecycle.reinstall.warning_body")}
                </Alert>
                <Field label={t("vps.lifecycle.field.os_template")} help={t("vps.lifecycle.reinstall.os_template_help")}>
                  <Select value={reinstall.osTemplate} onChange={(e) => setReinstall((prev) => ({ ...prev, osTemplate: e.target.value }))} disabled={reinstallM.isPending || templatesQ.isLoading} testId="vps.lifecycle.reinstall.os_template">
                    <option value="">{t("vps.lifecycle.placeholder.os_template")}</option>
                    {templatesQ.data?.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {templateLabel(tpl)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Checkbox checked={reinstall.confirm} onChange={(v) => setReinstall((p) => ({ ...p, confirm: v }))} label={t("vps.lifecycle.confirm.reinstall")} testId="vps.lifecycle.reinstall.confirm" />
                {reinstallM.isError ? (
                  <Alert title={t("vps.lifecycle.reinstall.error")} variant="danger">
                    {mutationErrorMessage(reinstallM.error, t("vps.lifecycle.validation.reinstall"))}
                  </Alert>
                ) : null}
                <div className="flex justify-end">
                  <ActionButton variant="danger" testId="vps.lifecycle.reinstall.submit" disabled={!reinstall.confirm || !reinstall.osTemplate || !gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} loading={reinstallM.isPending} onClick={() => reinstallM.mutate()}>
                    {t("vps.lifecycle.reinstall.submit")}
                  </ActionButton>
                </div>
              </CardBody>
            </Card>
          </LifecycleActionPanel>
        ) : null}
        {requestedAction === "clone" ? (
          <LifecycleActionPanel {...actionPanelProps("clone")} title={t("vps.lifecycle.clone.title")} subtitle={t("vps.lifecycle.clone.subtitle_user")}>
            {cloneCard}
          </LifecycleActionPanel>
        ) : null}
        {requestedAction === "swap" ? (
          <LifecycleActionPanel {...actionPanelProps("swap")} title={t("vps.lifecycle.swap.title")} subtitle={t("vps.lifecycle.swap.subtitle_user")} danger>
            {swapCard}
          </LifecycleActionPanel>
        ) : null}
        {requestedAction === "delete" ? (
          <LifecycleActionPanel {...actionPanelProps("delete")} title={t("vps.lifecycle.delete.title")} subtitle={t("vps.lifecycle.delete.subtitle")} danger>
            {deleteCard}
          </LifecycleActionPanel>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-4" data-testid="vps.lifecycle.page">
      <Card testId="vps.lifecycle.summary">
        <CardHeader
          title={activeChoice?.title ?? t("vps.lifecycle.title")}
          subtitle={activeChoice?.description ?? t("vps.lifecycle.subtitle_admin")}
          actions={
            <Button variant="secondary" onClick={() => navigate(lifecycleBasePath)}>
              {t("vps.lifecycle.back_to_actions")}
            </Button>
          }
        />
        <CardBody>
          <div className="mt-3 text-xs text-faint">
            {t("vps.lifecycle.current_target", {
              vps: `#${vpsId}`,
              node: nodeId ? `#${nodeId}` : "—",
              owner: ownerId ? `#${ownerId}` : "—",
              expiration: formatDateTime((vps as LegacyAny).expiration_date),
            })}
          </div>
        </CardBody>
      </Card>
      {requestedAction === "lifetime" ? (
        <LifecycleActionPanel {...actionPanelProps("lifetime")} title={t("vps.lifecycle.lifetime.title")} subtitle={t("vps.lifecycle.lifetime.subtitle_admin")}>
          <LifecyclePanel kind="vps" id={vps.id} objectLabel={objectLabel} objectState={(vps as LegacyAny).object_state as LegacyAny} expirationDate={(vps as LegacyAny).expiration_date as LegacyAny} remindAfterDate={(vps as LegacyAny).remind_after_date as LegacyAny} onUpdated={refetch} testId="vps.lifecycle.lifetime" />
        </LifecycleActionPanel>
      ) : null}
      {requestedAction === "template" ? (
        <LifecycleActionPanel {...actionPanelProps("template")} title={t("vps.lifecycle.template.title")} subtitle={t("vps.lifecycle.template.subtitle")}>
          <Card testId="vps.lifecycle.template">
            <CardHeader title={t("vps.lifecycle.template.title")} subtitle={t("vps.lifecycle.template.subtitle")} />
            <CardBody className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label={t("vps.lifecycle.field.os_template")} help={t("vps.lifecycle.template.os_template_help")}>
                  <Select value={templateForm.osTemplate} onChange={(e) => setTemplateForm((prev) => ({ ...prev, osTemplate: e.target.value }))} disabled={templateM.isPending || templatesQ.isLoading} testId="vps.lifecycle.template.os_template">
                    <option value="">{t("vps.lifecycle.placeholder.os_template")}</option>
                    {templatesQ.data?.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {templateLabel(tpl)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex items-end">
                  <Checkbox checked={templateForm.autoUpdate} onChange={(v) => setTemplateForm((p) => ({ ...p, autoUpdate: v }))} label={t("vps.lifecycle.template.auto_update")} description={t("vps.lifecycle.template.auto_update_help")} testId="vps.lifecycle.template.auto_update" />
                </div>
              </div>
              <Checkbox checked={templateForm.confirm} onChange={(v) => setTemplateForm((p) => ({ ...p, confirm: v }))} label={t("vps.lifecycle.confirm.template")} testId="vps.lifecycle.template.confirm" />
              {templateM.isError ? (
                <Alert title={t("vps.lifecycle.template.error")} variant="danger">
                  {mutationErrorMessage(templateM.error, t("vps.lifecycle.validation.template"))}
                </Alert>
              ) : null}
              <div className="flex justify-end">
                <ActionButton variant="primary" testId="vps.lifecycle.template.submit" disabled={!templateForm.confirm || !templateForm.osTemplate || !gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} loading={templateM.isPending} onClick={() => templateM.mutate()}>
                  {t("vps.lifecycle.template.submit")}
                </ActionButton>
              </div>
            </CardBody>
          </Card>
        </LifecycleActionPanel>
      ) : null}
      {requestedAction === "boot" ? (
        <LifecycleActionPanel {...actionPanelProps("boot")} title={t("vps.lifecycle.boot.title")} subtitle={t("vps.lifecycle.boot.subtitle")} danger>
          <Card testId="vps.lifecycle.boot">
            <CardHeader title={t("vps.lifecycle.boot.title")} subtitle={t("vps.lifecycle.boot.subtitle")} />
            <CardBody className="space-y-4">
              <Alert variant="warn" title={t("vps.lifecycle.boot.warning_title")}>
                {t("vps.lifecycle.boot.warning_body")}
              </Alert>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label={t("vps.lifecycle.field.os_template")} help={t("vps.lifecycle.boot.os_template_help")}>
                  <Select value={boot.osTemplate} onChange={(e) => setBoot((prev) => ({ ...prev, osTemplate: e.target.value }))} disabled={bootM.isPending || templatesQ.isLoading} testId="vps.lifecycle.boot.os_template">
                    <option value="">{t("vps.lifecycle.placeholder.os_template")}</option>
                    {templatesQ.data?.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {templateLabel(tpl)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("vps.lifecycle.boot.mountpoint")} help={t("vps.lifecycle.boot.mountpoint_help")}>
                  <Input value={boot.mountpoint} onChange={(e) => setBoot((prev) => ({ ...prev, mountpoint: e.target.value }))} disabled={bootM.isPending || !boot.mountRootDataset} testId="vps.lifecycle.boot.mountpoint" />
                </Field>
              </div>
              <Checkbox checked={boot.mountRootDataset} onChange={(v) => setBoot((p) => ({ ...p, mountRootDataset: v }))} label={t("vps.lifecycle.boot.mount_root_dataset")} description={t("vps.lifecycle.boot.mount_root_dataset_help")} testId="vps.lifecycle.boot.mount_root_dataset" />
              <Checkbox checked={boot.confirm} onChange={(v) => setBoot((p) => ({ ...p, confirm: v }))} label={t("vps.lifecycle.confirm.boot")} testId="vps.lifecycle.boot.confirm" />
              {bootM.isError ? (
                <Alert title={t("vps.lifecycle.boot.error")} variant="danger">
                  {mutationErrorMessage(bootM.error, t("vps.lifecycle.validation.boot"))}
                </Alert>
              ) : null}
              <div className="flex justify-end">
                <ActionButton variant="danger" testId="vps.lifecycle.boot.submit" disabled={!boot.confirm || !boot.osTemplate || !gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} loading={bootM.isPending} onClick={() => bootM.mutate()}>
                  {t("vps.lifecycle.boot.submit")}
                </ActionButton>
              </div>
            </CardBody>
          </Card>
        </LifecycleActionPanel>
      ) : null}
      {requestedAction === "reinstall" ? (
        <LifecycleActionPanel {...actionPanelProps("reinstall")} title={t("vps.lifecycle.reinstall.title")} subtitle={t("vps.lifecycle.reinstall.subtitle")} danger>
          <Card testId="vps.lifecycle.reinstall">
            <CardHeader title={t("vps.lifecycle.reinstall.title")} subtitle={t("vps.lifecycle.reinstall.subtitle")} />
            <CardBody className="space-y-4">
              <Alert variant="warn" title={t("vps.lifecycle.reinstall.warning_title")}>
                {t("vps.lifecycle.reinstall.warning_body")}
              </Alert>
              <Field label={t("vps.lifecycle.field.os_template")} help={t("vps.lifecycle.reinstall.os_template_help")}>
                <Select value={reinstall.osTemplate} onChange={(e) => setReinstall((prev) => ({ ...prev, osTemplate: e.target.value }))} disabled={reinstallM.isPending || templatesQ.isLoading} testId="vps.lifecycle.reinstall.os_template">
                  <option value="">{t("vps.lifecycle.placeholder.os_template")}</option>
                  {templatesQ.data?.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {templateLabel(tpl)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Checkbox checked={reinstall.confirm} onChange={(v) => setReinstall((p) => ({ ...p, confirm: v }))} label={t("vps.lifecycle.confirm.reinstall")} testId="vps.lifecycle.reinstall.confirm" />
              {reinstallM.isError ? (
                <Alert title={t("vps.lifecycle.reinstall.error")} variant="danger">
                  {mutationErrorMessage(reinstallM.error, t("vps.lifecycle.validation.reinstall"))}
                </Alert>
              ) : null}
              <div className="flex justify-end">
                <ActionButton variant="danger" testId="vps.lifecycle.reinstall.submit" disabled={!reinstall.confirm || !reinstall.osTemplate || !gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} loading={reinstallM.isPending} onClick={() => reinstallM.mutate()}>
                  {t("vps.lifecycle.reinstall.submit")}
                </ActionButton>
              </div>
            </CardBody>
          </Card>
        </LifecycleActionPanel>
      ) : null}
      {requestedAction === "clone" ? (
        <LifecycleActionPanel {...actionPanelProps("clone")} title={t("vps.lifecycle.clone.title")} subtitle={t("vps.lifecycle.clone.subtitle")}>
          {cloneCard}
        </LifecycleActionPanel>
      ) : null}
      {requestedAction === "swap" ? (
        <LifecycleActionPanel {...actionPanelProps("swap")} title={t("vps.lifecycle.swap.title")} subtitle={t("vps.lifecycle.swap.subtitle")} danger>
          {swapCard}
        </LifecycleActionPanel>
      ) : null}
      {requestedAction === "replace" ? (
        <LifecycleActionPanel {...actionPanelProps("replace")} title={t("vps.lifecycle.replace.title")} subtitle={t("vps.lifecycle.replace.subtitle")} danger>
          <Card testId="vps.lifecycle.replace">
            <CardHeader title={t("vps.lifecycle.replace.title")} subtitle={t("vps.lifecycle.replace.subtitle")} />
            <CardBody className="space-y-4">
              <Alert variant="warn" title={t("vps.lifecycle.replace.warning_title")}>
                {t("vps.lifecycle.replace.warning_body")}
              </Alert>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label={t("vps.lifecycle.field.node")} help={t("vps.lifecycle.replace.node_help")}>
                  <NodeLookupInput
                    value={replace.node}
                    selectedLabel={replaceNodeLabel}
                    onChange={(node) => {
                      setReplaceNodeLabel("");
                      setReplace((prev) => ({ ...prev, node }));
                    }}
                    onPick={(node) => setReplaceNodeLabel(pickedNodeLabel(node))}
                    placeholder={t("vps.lifecycle.placeholder.node_optional")}
                    testId="vps.lifecycle.replace.node"
                    disabled={replaceM.isPending}
                  />
                </Field>
                <Field label={t("vps.lifecycle.field.expiration_date")} help={t("vps.lifecycle.replace.expiration_help")}>
                  <Input type="datetime-local" value={replace.expirationDate} onChange={(e) => setReplace((prev) => ({ ...prev, expirationDate: e.target.value }))} testId="vps.lifecycle.replace.expiration" disabled={replaceM.isPending} />
                </Field>
              </div>
              <Checkbox checked={replace.start} onChange={(v) => setReplace((p) => ({ ...p, start: v }))} label={t("vps.lifecycle.replace.start")} description={t("vps.lifecycle.replace.start_help")} testId="vps.lifecycle.replace.start" />
              <Field label={t("vps.lifecycle.field.reason")} help={t("vps.lifecycle.replace.reason_help")}>
                <Textarea rows={3} value={replace.reason} onChange={(e) => setReplace((prev) => ({ ...prev, reason: e.target.value }))} testId="vps.lifecycle.replace.reason" disabled={replaceM.isPending} />
              </Field>
              <Checkbox checked={replace.confirm} onChange={(v) => setReplace((p) => ({ ...p, confirm: v }))} label={t("vps.lifecycle.confirm.replace")} testId="vps.lifecycle.replace.confirm" />
              {replaceM.isError ? (
                <Alert title={t("vps.lifecycle.replace.error")} variant="danger">
                  {mutationErrorMessage(replaceM.error, t("vps.lifecycle.validation.replace"))}
                </Alert>
              ) : null}
              <div className="flex justify-end">
                <ActionButton variant="danger" testId="vps.lifecycle.replace.submit" disabled={!replace.confirm || !gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} loading={replaceM.isPending} onClick={() => replaceM.mutate()}>
                  {t("vps.lifecycle.replace.submit")}
                </ActionButton>
              </div>
            </CardBody>
          </Card>
        </LifecycleActionPanel>
      ) : null}
      {requestedAction === "migrate" ? (
        <LifecycleActionPanel {...actionPanelProps("migrate")} title={t("vps.lifecycle.migrate.title")} subtitle={t("vps.lifecycle.migrate.subtitle")}>
          <Card testId="vps.lifecycle.migrate">
            <CardHeader title={t("vps.lifecycle.migrate.title")} subtitle={t("vps.lifecycle.migrate.subtitle")} />
            <CardBody className="space-y-4">
              <Field label={t("vps.lifecycle.field.node")} help={t("vps.lifecycle.migrate.node_help")}>
                <Select
                  value={migrate.node}
                  onChange={(e) => {
                    const nextNodeId = parseLookupIdLike(e.target.value);
                    const nextNode = nextNodeId !== null ? nodesQ.data?.find((node) => Number(node.id) === nextNodeId) : undefined;
                    const nextLocation = nodeLocation(nextNode);
                    const nextLocationId = resourceId(nextLocation);
                    const nextEnvironmentId = locationEnvironmentId(nextLocation);
                    const nextChangedLocation = sourceLocationId !== null && nextLocationId !== null && sourceLocationId !== nextLocationId;
                    const nextChangedEnvironment = sourceEnvironmentId !== undefined && nextEnvironmentId !== undefined && sourceEnvironmentId !== nextEnvironmentId;
                    setMigrate((prev) => ({
                      ...prev,
                      node: e.target.value,
                      transferIpAddresses: nextChangedEnvironment ? prev.transferIpAddresses : false,
                      replaceIpAddresses: nextChangedLocation ? prev.replaceIpAddresses : false,
                      scheduleMode: nextChangedEnvironment || nextChangedLocation ? "now" : "maintenance",
                      confirm: false,
                    }));
                  }}
                  testId="vps.lifecycle.migrate.node"
                  disabled={migrateM.isPending || nodesQ.isLoading || nodesQ.isError}
                >
                  <option value="">{nodesQ.isLoading ? t("common.loading") : t("vps.lifecycle.placeholder.node")}</option>
                  {nodesQ.data?.map((node) => (
                    <option key={node.id} value={node.id}>
                      {pickedNodeLabel(node)}
                    </option>
                  ))}
                </Select>
                {nodesQ.isError ? <div className="mt-1 text-xs text-danger">{t("vps.lifecycle.migrate.nodes_load_error")}</div> : null}
              </Field>
              <div className="rounded-md border border-border bg-surface p-3" data-testid="vps.lifecycle.migrate.schedule_panel">
                <div className="mb-3">
                  <div className="text-sm font-semibold text-fg">{t("vps.lifecycle.migrate.schedule.title")}</div>
                  <div className="text-xs text-muted">{t("vps.lifecycle.migrate.schedule.subtitle")}</div>
                </div>
                <div className="space-y-3">
                  <Field label={t("vps.lifecycle.migrate.schedule.label")} help={t("vps.lifecycle.migrate.schedule.help")}>
                    <Select
                      value={migrate.scheduleMode}
                      onChange={(e) =>
                        setMigrate((prev) => ({
                          ...prev,
                          scheduleMode: e.target.value as MigrateForm["scheduleMode"],
                          confirm: false,
                        }))
                      }
                      testId="vps.lifecycle.migrate.schedule"
                      disabled={migrateM.isPending}
                    >
                      <option value="maintenance">{t("vps.lifecycle.migrate.schedule.maintenance")}</option>
                      <option value="now">{t("vps.lifecycle.migrate.schedule.now")}</option>
                      <option value="custom">{t("vps.lifecycle.migrate.schedule.custom")}</option>
                    </Select>
                  </Field>
                  {migrate.scheduleMode === "custom" ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label={t("vps.lifecycle.migrate.finish_weekday")} help={t("vps.lifecycle.migrate.finish_weekday_help")}>
                        <Select value={migrate.finishWeekday} onChange={(e) => setMigrate((prev) => ({ ...prev, finishWeekday: e.target.value, confirm: false }))} testId="vps.lifecycle.migrate.finish_weekday" disabled={migrateM.isPending}>
                          <option value="">{t("vps.lifecycle.migrate.schedule.choose_day")}</option>
                          {migrateWeekdayOptions.map((day) => (
                            <option key={day.value} value={day.value}>
                              {t(day.labelKey)}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label={t("vps.lifecycle.migrate.finish_hour")} help={t("vps.lifecycle.migrate.finish_hour_help")}>
                        <Select value={migrate.finishHour} onChange={(e) => setMigrate((prev) => ({ ...prev, finishHour: e.target.value, confirm: false }))} testId="vps.lifecycle.migrate.finish_hour" disabled={migrateM.isPending}>
                          <option value="">{t("vps.lifecycle.migrate.schedule.choose_hour")}</option>
                          {migrateHourOptions.map((hour) => (
                            <option key={hour.value} value={hour.value}>
                              {hour.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {migrateTargetSelected && migrateCanTransferIpAddresses ? <Checkbox checked={migrate.transferIpAddresses} onChange={(v) => setMigrate((p) => ({ ...p, transferIpAddresses: v, confirm: false }))} label={t("vps.lifecycle.migrate.option.transfer_ip_addresses")} testId="vps.lifecycle.migrate.transfer_ip_addresses" /> : null}
                {migrateTargetSelected && migrateCanReplaceIpAddresses ? <Checkbox checked={migrate.replaceIpAddresses} onChange={(v) => setMigrate((p) => ({ ...p, replaceIpAddresses: v, confirm: false }))} label={t("vps.lifecycle.migrate.option.replace_ip_addresses")} testId="vps.lifecycle.migrate.replace_ip_addresses" /> : null}
                <Checkbox checked={migrate.stopOnError} onChange={(v) => setMigrate((p) => ({ ...p, stopOnError: v, confirm: false }))} label={t("vps.lifecycle.migrate.option.stop_on_error")} testId="vps.lifecycle.migrate.stop_on_error" />
                <Checkbox checked={migrate.cleanupData} onChange={(v) => setMigrate((p) => ({ ...p, cleanupData: v, confirm: false }))} label={t("vps.lifecycle.migrate.option.cleanup_data")} testId="vps.lifecycle.migrate.cleanup_data" />
                <Checkbox checked={migrate.sendMail} onChange={(v) => setMigrate((p) => ({ ...p, sendMail: v, confirm: false }))} label={t("vps.lifecycle.migrate.option.send_mail")} testId="vps.lifecycle.migrate.send_mail" />
              </div>
              <details className="rounded-md border border-border bg-surface p-3" data-testid="vps.lifecycle.migrate.advanced">
                <summary className="cursor-pointer text-sm font-semibold text-fg">{t("vps.lifecycle.migrate.advanced.title")}</summary>
                <div className="mt-3 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Checkbox checked={migrate.noStart} onChange={(v) => setMigrate((p) => ({ ...p, noStart: v, confirm: false }))} label={t("vps.lifecycle.migrate.option.no_start")} testId="vps.lifecycle.migrate.no_start" />
                    <Checkbox checked={migrate.skipStart} onChange={(v) => setMigrate((p) => ({ ...p, skipStart: v, confirm: false }))} label={t("vps.lifecycle.migrate.option.skip_start")} testId="vps.lifecycle.migrate.skip_start" />
                  </div>
                  <Field label={t("vps.lifecycle.migrate.reason")} help={t("vps.lifecycle.migrate.reason_help")}>
                    <Textarea value={migrate.reason} onChange={(e) => setMigrate((prev) => ({ ...prev, reason: e.target.value, confirm: false }))} testId="vps.lifecycle.migrate.reason" disabled={migrateM.isPending} />
                  </Field>
                </div>
              </details>
              <Checkbox checked={migrate.confirm} onChange={(v) => setMigrate((p) => ({ ...p, confirm: v }))} label={t("vps.lifecycle.confirm.migrate")} testId="vps.lifecycle.migrate.confirm" />
              {migrateM.isError ? (
                <Alert title={t("vps.lifecycle.migrate.error")} variant="danger">
                  {mutationErrorMessage(migrateM.error, t("vps.lifecycle.validation.migrate"))}
                </Alert>
              ) : null}
              <div className="flex justify-end">
                <ActionButton variant="danger" testId="vps.lifecycle.migrate.submit" disabled={!migrate.confirm || !migrate.node.trim() || (migrate.scheduleMode === "custom" && (!migrate.finishWeekday || !migrate.finishHour)) || !gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} loading={migrateM.isPending} onClick={() => migrateM.mutate()}>
                  {t("vps.lifecycle.migrate.submit")}
                </ActionButton>
              </div>
            </CardBody>
          </Card>
        </LifecycleActionPanel>
      ) : null}
      {requestedAction === "delete" ? (
        <LifecycleActionPanel {...actionPanelProps("delete")} title={t("vps.lifecycle.delete.title")} subtitle={t("vps.lifecycle.delete.subtitle")} danger>
          {deleteCard}
        </LifecycleActionPanel>
      ) : null}
    </div>
  );
}

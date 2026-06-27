import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../app/auth";
import { useAppMode } from "../../../app/appMode";
import { useI18n } from "../../../app/i18n";
import { useToasts } from "../../../app/toasts";
import { useChrome } from "../../../components/layout/ChromeContext";
import { SummaryGrid } from "../../../components/layout/SummaryGrid";
import { ActionButton } from "../../../components/ui/ActionButton";
import { Alert } from "../../../components/ui/Alert";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { Spinner } from "../../../components/ui/Spinner";
import { StatusDot } from "../../../components/ui/StatusDot";
import { StatCard } from "../../../components/ui/StatCard";
import { Table } from "../../../components/ui/Table";
import { Textarea } from "../../../components/ui/Textarea";
import { toneSurfaceClass } from "../../../components/ui/tone";
import { UserLookupInput } from "../../../components/ui/UserLookupInput";
import { fetchEnvironments } from "../../../lib/api/infra";
import { assignIpAddressRoute, assignIpAddressRouteWithHostAddress, fetchIpAddressesForVps, freeIpAddressRoute, updateIpAddress, type IpAddress } from "../../../lib/api/ipAddresses";
import { assignHostIpAddress, createHostIpAddress, deleteHostIpAddress, fetchHostIpAddresses, freeHostIpAddress, updateHostIpAddress, type HostIpAddress } from "../../../lib/api/networking";
import { fetchNetworkInterfaceAccountingForVps, fetchNetworkInterfaces, updateNetworkInterface, type NetworkInterface, type NetworkInterfaceAccounting } from "../../../lib/api/networkInterfaces";
import { updateVps } from "../../../lib/api/vps";
import { getMetaActionStateId } from "../../../lib/api/haveapi";
import { gateVpsMutation } from "../../../lib/gates/vps";
import { preflightVpsNotBusy } from "./vpsPreflight";
import { useVps } from "./VpsContext";
import { canonicalBool, formatBytes, formatMbpsFromBytesPerSec, groupIpByInterface, hostAddr, hostAssigned, idFromResourceRef, ipAddressLabel, ipFamilyLabel, ipLocationLabel, labelFromResourceRef, monthKey, parsePositiveId, sumAccountingRows } from "./VpsNetworkPage.shared";
import { renderVpsNetworkDialogs } from "./VpsNetworkDialogs";
export function VpsNetworkPage() {
  const auth = useAuth();
  const { basePath, mode } = useAppMode();
  const chrome = useChrome();
  const qc = useQueryClient();
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const { vps, refetch, refetchChains, vpsRef, busyTransaction, busyLocalLock } = useVps();
  const vpsId = vps.id;
  const canAdmin = auth.role === "admin";
  const adminBasePath = mode === "admin" ? basePath : "/admin";
  const netEnabled = canonicalBool((vps as LegacyAny).enable_network, true);
  const objectLabel = String((vps as LegacyAny).hostname ?? "") || `#${vpsId}`;
  const netifsQ = useQuery({
    queryKey: ["network_interface", "list", { vpsId, limit: 100 }],
    queryFn: async () => (await fetchNetworkInterfaces(vpsId, { limit: 100 })).data,
    refetchOnWindowFocus: false,
  });
  const ipsQ = useQuery({
    queryKey: ["ip_address", "list", { vpsId, limit: 250 }],
    queryFn: async () => (await fetchIpAddressesForVps(vpsId, { limit: 250 })).data,
    refetchOnWindowFocus: false,
  });
  const acctMonth = useMemo(() => monthKey(new Date()), []);
  const acctQ = useQuery({
    queryKey: ["network_interface", "accounting", { vpsId, year: acctMonth.year, month: acctMonth.month }],
    queryFn: async () => (await fetchNetworkInterfaceAccountingForVps(vpsId, acctMonth.year, acctMonth.month)).data,
    refetchOnWindowFocus: false,
  });
  const hostAddrsQ = useQuery({
    queryKey: ["host_ip_addresses", "vps", { vpsId, limit: 250 }],
    queryFn: async () => (await fetchHostIpAddresses({ vps: vpsId, limit: 250, order: "interface" })).data,
    refetchOnWindowFocus: false,
  });
  const environmentsQ = useQuery({
    queryKey: ["environments", "vps-network-ip-owner"],
    queryFn: async () => (await fetchEnvironments({ limit: 250 })).data,
    enabled: canAdmin,
    staleTime: 60_000,
  });
  const acctTotals = useMemo(() => sumAccountingRows(acctQ.data ?? []), [acctQ.data]);
  const ipByNetif = useMemo(() => groupIpByInterface(ipsQ.data ?? []), [ipsQ.data]);
  const [editNetif, setEditNetif] = useState<NetworkInterface | null>(null);
  const [editName, setEditName] = useState("");
  const [editEnable, setEditEnable] = useState(true);
  const [editMaxTx, setEditMaxTx] = useState("");
  const [editMaxRx, setEditMaxRx] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [ptrEditor, setPtrEditor] = useState<HostIpAddress | null>(null);
  const [ptrValue, setPtrValue] = useState("");
  const [createHostForIp, setCreateHostForIp] = useState<IpAddress | null>(null);
  const [createHostValue, setCreateHostValue] = useState("");
  const [assignHost, setAssignHost] = useState<HostIpAddress | null>(null);
  const [assignHostInterface, setAssignHostInterface] = useState("");
  const [freeHost, setFreeHost] = useState<HostIpAddress | null>(null);
  const [deleteHost, setDeleteHost] = useState<HostIpAddress | null>(null);
  const [freeRouteIp, setFreeRouteIp] = useState<IpAddress | null>(null);
  const [assignRouteIp, setAssignRouteIp] = useState<IpAddress | null>(null);
  const [assignRouteInterface, setAssignRouteInterface] = useState("");
  const [assignRouteWithHost, setAssignRouteWithHost] = useState(false);
  const [ownerIp, setOwnerIp] = useState<IpAddress | null>(null);
  const [ownerUser, setOwnerUser] = useState("");
  const [ownerEnvironment, setOwnerEnvironment] = useState("");
  const openEdit = (ni: NetworkInterface) => {
    setEditNetif(ni);
    setEditError(null);
    setEditName(ni.name ?? "");
    setEditEnable(ni.enable !== false);
    setEditMaxTx(typeof ni.max_tx === "number" ? String(Math.round(ni.max_tx / 1024 / 1024)) : "");
    setEditMaxRx(typeof ni.max_rx === "number" ? String(Math.round(ni.max_rx / 1024 / 1024)) : "");
  };
  const updateNetifM = useMutation({
    mutationFn: async (payload: { id: number; params: Record<string, unknown> }) => {
      await preflightVpsNotBusy({ vpsId, t, knownBusy: busyTransaction || busyLocalLock });
      return updateNetworkInterface(payload.id, payload.params);
    },
    onMutate: () => {
      chrome.acquireLocalLock(vpsRef);
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["network_interface", "list", { vpsId, limit: 100 }] });
      qc.invalidateQueries({ queryKey: ["ip_address", "list", { vpsId, limit: 250 }] });
      const asId = getMetaActionStateId(r.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: "action.vps.network.interface_update.label",
          objectLabel,
          object: vpsRef,
        });
      }
      refetchChains();
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
    },
    onSettled: () => {
      chrome.releaseLocalLock(vpsRef);
    },
  });
  const parseLimit = (raw: string, which: "tx" | "rx"): number | null => {
    const v = raw.trim();
    if (!v) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      setEditError(which === "tx" ? t("vps.network.edit.validation.max_tx") : t("vps.network.edit.validation.max_rx"));
      return null;
    }
    return Math.round(n * 1024 * 1024);
  };
  const editDirty = useMemo(() => {
    if (!editNetif) return false;
    const nameDirty = (editName ?? "").trim() !== String(editNetif.name ?? "");
    if (!canAdmin) return nameDirty;
    const enableDirty = canonicalBool(editEnable, true) !== canonicalBool(editNetif.enable, true);
    const txDirty = (() => {
      const raw = editMaxTx.trim();
      const curr = typeof editNetif.max_tx === "number" ? String(Math.round(editNetif.max_tx / 1024 / 1024)) : "";
      return raw !== curr;
    })();
    const rxDirty = (() => {
      const raw = editMaxRx.trim();
      const curr = typeof editNetif.max_rx === "number" ? String(Math.round(editNetif.max_rx / 1024 / 1024)) : "";
      return raw !== curr;
    })();
    return nameDirty || enableDirty || txDirty || rxDirty;
  }, [canAdmin, editEnable, editMaxRx, editMaxTx, editName, editNetif]);
  const saveNetif = async () => {
    if (!editNetif) return;
    const params: Record<string, unknown> = {
      name: editName.trim(),
    };
    if (canAdmin) {
      params["enable"] = editEnable;
      const tx = parseLimit(editMaxTx, "tx");
      if (editMaxTx.trim() && tx === null) return;
      if (tx !== null) params["max_tx"] = tx;
      const rx = parseLimit(editMaxRx, "rx");
      if (editMaxRx.trim() && rx === null) return;
      if (rx !== null) params["max_rx"] = rx;
    }
    setEditError(null);
    try {
      await updateNetifM.mutateAsync({ id: editNetif.id, params });
      setEditNetif(null);
    } catch (e: any) {
      setEditError(String(e?.message ?? e));
    }
  };
  // VPS-level enable_network toggle (admin only)
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  const [confirmEnableOpen, setConfirmEnableOpen] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [netToggleError, setNetToggleError] = useState<string | null>(null);
  const toggleNetM = useMutation({
    mutationFn: async (payload: { enable: boolean; reason?: string }) => {
      await preflightVpsNotBusy({ vpsId, t, knownBusy: busyTransaction || busyLocalLock });
      const params: Record<string, unknown> = { enable_network: payload.enable };
      if (!payload.enable && String(payload.reason ?? "").trim()) {
        params["change_reason"] = String(payload.reason ?? "").trim();
      }
      return updateVps(vpsId, params);
    },
    onMutate: () => {
      chrome.acquireLocalLock(vpsRef);
    },
    onSuccess: (r, vars) => {
      setNetToggleError(null);
      refetch();
      qc.invalidateQueries({ queryKey: ["network_interface", "list", { vpsId, limit: 100 }] });
      qc.invalidateQueries({ queryKey: ["ip_address", "list", { vpsId, limit: 250 }] });
      const asId = getMetaActionStateId(r.meta);
      if (asId !== undefined) {
        chrome.trackActionState(asId, {
          actionLabelKey: vars.enable ? "action.vps.network.enable.label" : "action.vps.network.disable.label",
          objectLabel,
          object: vpsRef,
        });
      }
      refetchChains();
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
      setNetToggleError(String(e?.message ?? e));
    },
    onSettled: () => {
      chrome.releaseLocalLock(vpsRef);
    },
  });
  const refreshNetworkData = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ["host_ip_addresses"] }), qc.invalidateQueries({ queryKey: ["ip_address"] }), qc.invalidateQueries({ queryKey: ["ip_addresses"] }), qc.invalidateQueries({ queryKey: ["network_interface", "list", { vpsId, limit: 100 }] }), qc.invalidateQueries({ queryKey: ["ip_address", "list", { vpsId, limit: 250 }] }), hostAddrsQ.refetch(), ipsQ.refetch(), netifsQ.refetch()]);
  };
  const trackNetworkAction = (meta: unknown, labelKey: string) => {
    const asId = getMetaActionStateId(meta);
    if (asId !== undefined) {
      chrome.trackActionState(asId, {
        actionLabelKey: labelKey,
        objectLabel,
        object: vpsRef,
      });
    }
    refetchChains();
  };
  const updatePtrM = useMutation({
    mutationFn: async () => {
      if (!ptrEditor) throw new Error(t("vps.network.host_addresses.validation.missing"));
      await preflightVpsNotBusy({ vpsId, t, knownBusy: busyTransaction || busyLocalLock });
      return updateHostIpAddress(ptrEditor.id, { reverse_record_value: ptrValue.trim() });
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: async (res) => {
      setPtrEditor(null);
      setPtrValue("");
      trackNetworkAction(res.meta, "action.vps.network.ptr_update.label");
      await refreshNetworkData();
      pushToast({ variant: "ok", title: t("vps.network.host_addresses.toast.ptr_saved") });
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });
  const createHostM = useMutation({
    mutationFn: async () => {
      if (!createHostForIp) throw new Error(t("vps.network.host_addresses.validation.missing_ip"));
      await preflightVpsNotBusy({ vpsId, t, knownBusy: busyTransaction || busyLocalLock });
      const addrs = createHostValue
        .split(/\r?\n/)
        .map((v) => v.trim())
        .filter(Boolean);
      if (addrs.length === 0) throw new Error(t("vps.network.host_addresses.validation.empty"));
      const results = [];
      for (const addr of addrs) {
        results.push(await createHostIpAddress({ ip_address: createHostForIp.id, addr }));
      }
      return results;
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: async (results) => {
      setCreateHostForIp(null);
      setCreateHostValue("");
      for (const res of results) trackNetworkAction(res.meta, "action.vps.network.host_create.label");
      await refreshNetworkData();
      pushToast({ variant: "ok", title: t("vps.network.host_addresses.toast.created", { count: results.length }) });
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });
  const freeHostM = useMutation({
    mutationFn: async () => {
      if (!freeHost) throw new Error(t("vps.network.host_addresses.validation.missing"));
      await preflightVpsNotBusy({ vpsId, t, knownBusy: busyTransaction || busyLocalLock });
      return freeHostIpAddress(freeHost.id);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: async (res) => {
      setFreeHost(null);
      trackNetworkAction(res.meta, "action.vps.network.host_free.label");
      await refreshNetworkData();
      pushToast({ variant: "ok", title: t("vps.network.host_addresses.toast.freed") });
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });
  const assignHostM = useMutation({
    mutationFn: async () => {
      if (!assignHost) throw new Error(t("vps.network.host_addresses.validation.missing"));
      const networkInterface = Number(assignHostInterface);
      if (!Number.isInteger(networkInterface) || networkInterface <= 0) {
        throw new Error(t("vps.network.host_addresses.assign.validation.interface"));
      }
      await preflightVpsNotBusy({ vpsId, t, knownBusy: busyTransaction || busyLocalLock });
      return assignHostIpAddress(assignHost.id, { network_interface: networkInterface });
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: async (res) => {
      setAssignHost(null);
      setAssignHostInterface("");
      trackNetworkAction(res.meta, "action.vps.network.host_assign.label");
      await refreshNetworkData();
      pushToast({ variant: "ok", title: t("vps.network.host_addresses.toast.assigned") });
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });
  const deleteHostM = useMutation({
    mutationFn: async () => {
      if (!deleteHost) throw new Error(t("vps.network.host_addresses.validation.missing"));
      await preflightVpsNotBusy({ vpsId, t, knownBusy: busyTransaction || busyLocalLock });
      return deleteHostIpAddress(deleteHost.id);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: async () => {
      setDeleteHost(null);
      await refreshNetworkData();
      pushToast({ variant: "ok", title: t("vps.network.host_addresses.toast.deleted") });
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });
  const freeRouteM = useMutation({
    mutationFn: async () => {
      if (!freeRouteIp) throw new Error(t("vps.network.ip_addresses.validation.missing"));
      await preflightVpsNotBusy({ vpsId, t, knownBusy: busyTransaction || busyLocalLock });
      return freeIpAddressRoute(freeRouteIp.id);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: async (res) => {
      setFreeRouteIp(null);
      trackNetworkAction(res.meta, "action.vps.network.route_free.label");
      await refreshNetworkData();
      pushToast({ variant: "ok", title: t("vps.network.ip_addresses.toast.route_freed") });
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });
  const assignRouteM = useMutation({
    mutationFn: async () => {
      if (!assignRouteIp) throw new Error(t("vps.network.ip_addresses.validation.missing"));
      const networkInterface = Number(assignRouteInterface);
      if (!Number.isInteger(networkInterface) || networkInterface <= 0) {
        throw new Error(t("vps.network.ip_addresses.assign.validation.interface"));
      }
      await preflightVpsNotBusy({ vpsId, t, knownBusy: busyTransaction || busyLocalLock });
      if (assignRouteWithHost) {
        return assignIpAddressRouteWithHostAddress(assignRouteIp.id, { network_interface: networkInterface });
      }
      return assignIpAddressRoute(assignRouteIp.id, { network_interface: networkInterface });
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: async (res) => {
      setAssignRouteIp(null);
      setAssignRouteInterface("");
      setAssignRouteWithHost(false);
      trackNetworkAction(res.meta, "action.vps.network.route_assign.label");
      await refreshNetworkData();
      pushToast({ variant: "ok", title: t("vps.network.ip_addresses.toast.route_assigned") });
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });
  const updateOwnerM = useMutation({
    mutationFn: async () => {
      if (!ownerIp) throw new Error(t("vps.network.ip_addresses.validation.missing"));
      const user = ownerUser.trim() ? parsePositiveId(ownerUser) : null;
      if (ownerUser.trim() && !user) throw new Error(t("vps.network.ip_addresses.owner.validation.user"));
      const params: Record<string, unknown> = { user };
      if (user) {
        const environment = parsePositiveId(ownerEnvironment);
        if (!environment) throw new Error(t("vps.network.ip_addresses.owner.validation.environment"));
        params["environment"] = environment;
      }
      return updateIpAddress(ownerIp.id, params);
    },
    onMutate: () => chrome.acquireLocalLock(vpsRef),
    onSuccess: async (res) => {
      setOwnerIp(null);
      setOwnerUser("");
      setOwnerEnvironment("");
      trackNetworkAction(res.meta, "action.vps.network.route_owner_update.label");
      await refreshNetworkData();
      pushToast({ variant: "ok", title: t("vps.network.ip_addresses.owner.toast.saved") });
    },
    onError: (e: any) => {
      if (e?.code === "BUSY") chrome.openTasks();
    },
    onSettled: () => chrome.releaseLocalLock(vpsRef),
  });
  const busyLocal = busyLocalLock || updateNetifM.isPending || toggleNetM.isPending || updatePtrM.isPending || createHostM.isPending || assignHostM.isPending || freeHostM.isPending || deleteHostM.isPending || freeRouteM.isPending || assignRouteM.isPending || updateOwnerM.isPending;
  const gate = gateVpsMutation({ vps, busyLocal, busyTransaction });
  const netifs = netifsQ.data ?? [];
  const unassignedIps = ipByNetif.get(-1) ?? [];
  const showGateAlert = !gate.allowed;
  return (
    <div data-testid="vps.network.page" className="space-y-4">
      <Card testId="vps.network.summary">
        <CardHeader
          title={t("vps.network.title")}
          subtitle={t("vps.network.subtitle")}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                testId="vps.network.accounting.refresh"
                onClick={() => {
                  void acctQ.refetch();
                  void netifsQ.refetch();
                  void ipsQ.refetch();
                }}
              >
                {t("common.refresh")}
              </Button>
              <Badge variant={netEnabled ? "ok" : "warn"}>{netEnabled ? t("vps.network.status.enabled") : t("vps.network.status.disabled")}</Badge>
              {canAdmin ? (
                netEnabled ? (
                  <ActionButton
                    testId="vps.network.disable"
                    variant="danger"
                    size="sm"
                    disabled={!gate.allowed}
                    disabledReason={!gate.allowed ? gate.reason : undefined}
                    onClick={() => {
                      setNetToggleError(null);
                      setConfirmDisableOpen(true);
                    }}
                  >
                    {t("vps.network.disable_button")}
                  </ActionButton>
                ) : (
                  <ActionButton
                    testId="vps.network.enable"
                    variant="primary"
                    size="sm"
                    disabled={!gate.allowed}
                    disabledReason={!gate.allowed ? gate.reason : undefined}
                    onClick={() => {
                      setNetToggleError(null);
                      setConfirmEnableOpen(true);
                    }}
                  >
                    {t("vps.network.enable_button")}
                  </ActionButton>
                )
              ) : null}
            </div>
          }
        />
        <CardBody>
          {showGateAlert ? (
            <Alert title={t(gate.reason.titleKey)} variant="warn">
              <div className="space-y-2">
                {gate.reason.descriptionKey ? <div>{t(gate.reason.descriptionKey)}</div> : null}
                <div>
                  <Button variant="secondary" size="sm" onClick={chrome.openTasks}>
                    {t("common.open_tasks")}
                  </Button>
                </div>
              </div>
            </Alert>
          ) : null}
          {netToggleError ? (
            <Alert title={t("vps.network.toggle_error.title")} variant="danger" className={showGateAlert ? "mt-3" : ""}>
              {netToggleError}
            </Alert>
          ) : null}
          <div className="mt-4">
            <SummaryGrid testId="vps.network.accounting.grid">
              <StatCard
                testId="vps.network.accounting.in"
                className="md:col-span-4"
                variant="compact"
                title={t("vps.network.accounting.ingress")}
                value={acctQ.isLoading ? t("common.loading") : formatBytes(acctTotals.bytesIn)}
                subtitle={t("vps.network.accounting.period", {
                  year: acctMonth.year,
                  month: String(acctMonth.month).padStart(2, "0"),
                })}
              />
              <StatCard
                testId="vps.network.accounting.out"
                className="md:col-span-4"
                variant="compact"
                title={t("vps.network.accounting.egress")}
                value={acctQ.isLoading ? t("common.loading") : formatBytes(acctTotals.bytesOut)}
                subtitle={t("vps.network.accounting.period", {
                  year: acctMonth.year,
                  month: String(acctMonth.month).padStart(2, "0"),
                })}
              />
              <StatCard testId="vps.network.accounting.status" className="md:col-span-4" variant="compact" title={t("vps.network.accounting.status")} value={acctQ.isError ? t("vps.network.accounting.error") : t("vps.network.accounting.ok")} subtitle={t("vps.network.accounting.note")} />
            </SummaryGrid>
          </div>
        </CardBody>
      </Card>
      <Card testId="vps.network.interfaces">
        <CardHeader
          title={t("vps.network.interfaces.title")}
          subtitle={canAdmin ? t("vps.network.interfaces.subtitle_admin") : t("vps.network.interfaces.subtitle_user")}
          actions={
            <Button variant="secondary" size="sm" onClick={() => void netifsQ.refetch()}>
              {t("common.refresh")}
            </Button>
          }
        />
        <CardBody>
          {netifsQ.isLoading ? (
            <div className="py-2">
              <Spinner label={t("common.loading")} />
            </div>
          ) : netifsQ.isError ? (
            <Alert title={t("vps.network.interfaces.load_error")} variant="danger">
              {String((netifsQ.error as LegacyAny)?.message ?? netifsQ.error)}
            </Alert>
          ) : netifs.length === 0 ? (
            <div className="py-2 text-sm text-muted">{t("vps.network.interfaces.empty")}</div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="space-y-3 md:hidden">
                {netifs.map((ni) => {
                  const ips = ipByNetif.get(ni.id) ?? [];
                  const rowVariant = ni.enable === false ? "warn" : "ok";
                  return (
                    <Card key={ni.id} testId={`vps.network.interfaces.card.${ni.id}`} className={ni.enable === false ? toneSurfaceClass("warn") : undefined}>
                      <CardBody>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusDot variant={rowVariant} testId={`vps.network.interfaces.card.${ni.id}.dot`} />
                              <div className="truncate text-base font-semibold">{ni.name ?? t("vps.network.interfaces.unnamed")}</div>
                              <Badge variant="neutral">{String(ni.type ?? "—")}</Badge>
                              {canAdmin ? <Badge variant={ni.enable !== false ? "ok" : "warn"}>{ni.enable !== false ? t("vps.network.interfaces.enabled") : t("vps.network.interfaces.disabled")}</Badge> : null}
                            </div>
                            <div className="mt-1 text-xs text-muted">{t("vps.network.interfaces.ip_count", { n: ips.length })}</div>
                          </div>
                          <Button variant="secondary" size="sm" testId={`vps.network.interfaces.card.${ni.id}.edit`} onClick={() => openEdit(ni)}>
                            {t("common.edit")}
                          </Button>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm">
                          <div>
                            <div className="text-xs text-muted">{t("vps.network.interfaces.max_tx")}</div>
                            <div className="font-mono">{formatMbpsFromBytesPerSec(ni.max_tx as LegacyAny)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted">{t("vps.network.interfaces.max_rx")}</div>
                            <div className="font-mono">{formatMbpsFromBytesPerSec(ni.max_rx as LegacyAny)}</div>
                          </div>
                        </div>
                        {ips.length > 0 ? (
                          <div className="mt-3">
                            <div className="text-xs font-medium text-muted">{t("vps.network.ip_addresses.title")}</div>
                            <div className="mt-1 space-y-1">
                              {ips.map((ip) => (
                                <div key={ip.id} className="text-sm">
                                  <span className="font-mono">{String((ip as LegacyAny).address ?? (ip as LegacyAny).addr ?? "—")}</span>
                                  {(ip as LegacyAny).purpose || (ip as LegacyAny).routed ? (
                                    <span className="ml-2 text-xs text-muted">
                                      {(ip as LegacyAny).purpose ? String((ip as LegacyAny).purpose) : ""}
                                      {(ip as LegacyAny).routed ? ` · ${t("vps.network.ip_addresses.routed")}` : ""}
                                    </span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
              {/* Desktop: table */}
              <div className="hidden overflow-x-auto md:block">
                <Table testId="vps.network.interfaces.table" minWidth="md">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-3"></th>
                      <th className="px-4 py-3">{t("vps.network.interfaces.field.name")}</th>
                      <th className="px-4 py-3">{t("vps.network.interfaces.field.type")}</th>
                      <th className="px-4 py-3">{t("vps.network.interfaces.field.ip_count")}</th>
                      {canAdmin ? <th className="px-4 py-3">{t("vps.network.interfaces.field.enabled")}</th> : null}
                      <th className="px-4 py-3">{t("vps.network.interfaces.field.max_tx")}</th>
                      <th className="px-4 py-3">{t("vps.network.interfaces.field.max_rx")}</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {netifs.map((ni) => {
                      const ips = ipByNetif.get(ni.id) ?? [];
                      return (
                        <tr key={ni.id} data-testid={`vps.network.interfaces.row.${ni.id}`} data-row-variant={ni.enable === false ? "warn" : undefined} className="border-b border-border/60 last:border-b-0">
                          <td className="px-4 py-3">
                            <StatusDot variant={ni.enable === false ? "warn" : "ok"} testId={`vps.network.interfaces.row.${ni.id}.dot`} />
                          </td>
                          <td className="px-4 py-3 font-medium">{ni.name ?? "—"}</td>
                          <td className="px-4 py-3">{String(ni.type ?? "—")}</td>
                          <td className="px-4 py-3">{ips.length}</td>
                          {canAdmin ? (
                            <td className="px-4 py-3">
                              <Badge variant={ni.enable !== false ? "ok" : "warn"}>{ni.enable !== false ? t("vps.network.interfaces.enabled") : t("vps.network.interfaces.disabled")}</Badge>
                            </td>
                          ) : null}
                          <td className="px-4 py-3 font-mono text-xs">{formatMbpsFromBytesPerSec(ni.max_tx as LegacyAny)}</td>
                          <td className="px-4 py-3 font-mono text-xs">{formatMbpsFromBytesPerSec(ni.max_rx as LegacyAny)}</td>
                          <td className="px-4 py-3 text-right">
                            <Button variant="secondary" size="sm" testId={`vps.network.interfaces.row.${ni.id}.edit`} onClick={() => openEdit(ni)}>
                              {t("common.edit")}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </CardBody>
      </Card>
      <Card testId="vps.network.ip_addresses">
        <CardHeader
          title={t("vps.network.ip_addresses.title")}
          subtitle={t("vps.network.ip_addresses.subtitle")}
          actions={
            <Button variant="secondary" size="sm" onClick={() => void ipsQ.refetch()}>
              {t("common.refresh")}
            </Button>
          }
        />
        <CardBody>
          {ipsQ.isLoading ? (
            <div className="py-2">
              <Spinner label={t("common.loading")} />
            </div>
          ) : ipsQ.isError ? (
            <Alert title={t("vps.network.ip_addresses.load_error")} variant="danger">
              {String((ipsQ.error as LegacyAny)?.message ?? ipsQ.error)}
            </Alert>
          ) : (ipsQ.data ?? []).length === 0 ? (
            <div className="py-2 text-sm text-muted">{t("vps.network.ip_addresses.empty")}</div>
          ) : (
            <div className="space-y-3">
              {netifs.map((ni) => {
                const ips = ipByNetif.get(ni.id) ?? [];
                if (ips.length === 0) return null;
                return (
                  <Card key={ni.id} testId={`vps.network.ip_addresses.card.${ni.id}`}>
                    <CardBody>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold">
                            {ni.name ?? t("vps.network.interfaces.unnamed")}
                            <span className="text-faint"> · </span>
                            <span className="text-sm text-muted">{String(ni.type ?? "—")}</span>
                          </div>
                          <div className="mt-0.5 text-xs text-muted">{t("vps.network.ip_addresses.count", { n: ips.length })}</div>
                        </div>
                        <Badge variant="neutral">{t("vps.network.ip_addresses.assigned")}</Badge>
                      </div>
                      <div className="mt-3 space-y-2">
                        {ips.map((ip) => {
                          const addr = ipAddressLabel(ip);
                          const net = String((ip.network as LegacyAny)?.address ?? (ip.network as LegacyAny)?.label ?? "");
                          const purpose = (ip as LegacyAny).purpose ? String((ip as LegacyAny).purpose) : "";
                          const routed = Boolean((ip as LegacyAny).routed);
                          const owner = labelFromResourceRef((ip as LegacyAny).user);
                          const location = ipLocationLabel(ip);
                          return (
                            <div key={ip.id} data-testid={`vps.network.ip_addresses.item.${ip.id}`} className="rounded-md border border-border bg-surface-2 p-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-mono text-sm">{addr}</div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                                  {routed ? <Badge variant="neutral">{t("vps.network.ip_addresses.routed")}</Badge> : null}
                                  <ActionButton
                                    variant="primary"
                                    size="sm"
                                    testId={`vps.network.ip_addresses.item.${ip.id}.host_create`}
                                    disabled={!gate.allowed}
                                    disabledReason={!gate.allowed ? gate.reason : undefined}
                                    onClick={() => {
                                      setCreateHostForIp(ip);
                                      setCreateHostValue("");
                                    }}
                                  >
                                    {t("vps.network.ip_addresses.action.host_create")}
                                  </ActionButton>
                                  {canAdmin ? (
                                    <>
                                      <Button to={`${adminBasePath}/networking/ip-addresses/${ip.id}`} variant="secondary" size="sm" testId={`vps.network.ip_addresses.item.${ip.id}.detail`}>
                                        {t("vps.network.ip_addresses.action.detail")}
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        testId={`vps.network.ip_addresses.item.${ip.id}.owner`}
                                        onClick={() => {
                                          setOwnerIp(ip);
                                          setOwnerUser("");
                                          setOwnerEnvironment("");
                                        }}
                                      >
                                        {t("vps.network.ip_addresses.action.owner")}
                                      </Button>
                                      <ActionButton variant="danger" size="sm" testId={`vps.network.ip_addresses.item.${ip.id}.free_route`} disabled={!gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} loading={freeRouteM.isPending} onClick={() => setFreeRouteIp(ip)}>
                                        {t("vps.network.ip_addresses.action.free_route")}
                                      </ActionButton>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                                <span>{t("vps.network.ip_addresses.field.network", { network: net || "—" })}</span>
                                <span>{t("vps.network.ip_addresses.field.purpose", { purpose: purpose || "—" })}</span>
                                <span>{t("vps.network.ip_addresses.field.owner", { owner })}</span>
                                <span>{t("vps.network.ip_addresses.field.family", { family: ipFamilyLabel(ip) })}</span>
                                <span>{t("vps.network.ip_addresses.field.location", { location })}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
              {unassignedIps.length > 0 ? (
                <Alert title={t("vps.network.ip_addresses.unassigned.title")} variant="warn">
                  <div className="space-y-2">
                    <div>{t("vps.network.ip_addresses.unassigned.body")}</div>
                    <div className="space-y-1">
                      {unassignedIps.map((ip) => (
                        <div key={ip.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="font-mono">{String((ip as LegacyAny).address ?? (ip as LegacyAny).addr ?? "—")}</span>
                          {canAdmin ? (
                            <ActionButton
                              variant="primary"
                              size="sm"
                              testId={`vps.network.ip_addresses.unassigned.${ip.id}.assign`}
                              disabled={!gate.allowed}
                              disabledReason={!gate.allowed ? gate.reason : undefined}
                              onClick={() => {
                                setAssignRouteIp(ip);
                                setAssignRouteInterface("");
                                setAssignRouteWithHost(false);
                              }}
                            >
                              {t("vps.network.ip_addresses.action.assign_route")}
                            </ActionButton>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </Alert>
              ) : null}
            </div>
          )}
        </CardBody>
      </Card>
      <Card testId="vps.network.host_addresses">
        <CardHeader
          title={t("vps.network.host_addresses.title")}
          subtitle={t("vps.network.host_addresses.subtitle")}
          actions={
            <Button variant="secondary" size="sm" onClick={() => void hostAddrsQ.refetch()}>
              {t("common.refresh")}
            </Button>
          }
        />
        <CardBody>
          {hostAddrsQ.isLoading ? (
            <div className="py-2">
              <Spinner label={t("common.loading")} />
            </div>
          ) : hostAddrsQ.isError ? (
            <Alert title={t("vps.network.host_addresses.load_error")} variant="danger">
              {String((hostAddrsQ.error as LegacyAny)?.message ?? hostAddrsQ.error)}
            </Alert>
          ) : (hostAddrsQ.data ?? []).length === 0 ? (
            <div className="py-2 text-sm text-muted">{t("vps.network.host_addresses.empty")}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table testId="vps.network.host_addresses.table" minWidth="lg">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-4 py-3">{t("vps.network.host_addresses.field.address")}</th>
                    <th className="px-4 py-3">{t("vps.network.host_addresses.field.route")}</th>
                    <th className="px-4 py-3">{t("vps.network.host_addresses.field.ptr")}</th>
                    <th className="px-4 py-3">{t("vps.network.host_addresses.field.state")}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {(hostAddrsQ.data ?? []).map((row) => {
                    const id = Number((row as LegacyAny).id);
                    const routeAddr = String((row as LegacyAny).ip_address?.addr ?? (row as LegacyAny).ip_address?.ip_addr ?? "—");
                    const assigned = hostAssigned(row);
                    const canDelete = (row as LegacyAny).user_created && !assigned;
                    return (
                      <tr key={id} data-testid={`vps.network.host_addresses.row.${id}`} className="border-b border-border/60 last:border-b-0">
                        <td className="px-4 py-3 font-mono text-sm">{hostAddr(row)}</td>
                        <td className="px-4 py-3 font-mono text-sm">{routeAddr}</td>
                        <td className="px-4 py-3 text-sm">{String((row as LegacyAny).reverse_record_value ?? t("common.na"))}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={assigned ? "ok" : "warn"}>{assigned ? t("common.assigned") : t("common.unassigned")}</Badge>
                            {(row as LegacyAny).user_created ? <Badge variant="neutral">{t("common.custom")}</Badge> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              testId={`vps.network.host_addresses.row.${id}.ptr`}
                              onClick={() => {
                                setPtrEditor(row);
                                setPtrValue(String((row as LegacyAny).reverse_record_value ?? ""));
                              }}
                            >
                              {t("vps.network.host_addresses.action.ptr")}
                            </Button>
                            {assigned ? (
                              <ActionButton variant="danger" size="sm" testId={`vps.network.host_addresses.row.${id}.free`} disabled={!gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} loading={freeHostM.isPending} onClick={() => setFreeHost(row)}>
                                {t("vps.network.host_addresses.action.free")}
                              </ActionButton>
                            ) : (
                              <ActionButton
                                variant="primary"
                                size="sm"
                                testId={`vps.network.host_addresses.row.${id}.assign`}
                                disabled={!gate.allowed}
                                disabledReason={!gate.allowed ? gate.reason : undefined}
                                loading={assignHostM.isPending}
                                onClick={() => {
                                  setAssignHost(row);
                                  setAssignHostInterface("");
                                }}
                              >
                                {t("vps.network.host_addresses.action.assign")}
                              </ActionButton>
                            )}
                            {canDelete ? (
                              <Button variant="danger" size="sm" testId={`vps.network.host_addresses.row.${id}.delete`} onClick={() => setDeleteHost(row)}>
                                {t("common.delete")}
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
          {updatePtrM.error || createHostM.error || assignHostM.error || freeHostM.error || deleteHostM.error || freeRouteM.error || assignRouteM.error || updateOwnerM.error ? (
            <Alert title={t("vps.network.host_addresses.action_error")} variant="danger" className="mt-3">
              {String((updatePtrM.error as LegacyAny)?.message ?? (createHostM.error as LegacyAny)?.message ?? (assignHostM.error as LegacyAny)?.message ?? (freeHostM.error as LegacyAny)?.message ?? (deleteHostM.error as LegacyAny)?.message ?? (freeRouteM.error as LegacyAny)?.message ?? (assignRouteM.error as LegacyAny)?.message ?? (updateOwnerM.error as LegacyAny)?.message ?? t("common.unknown_error"))}
            </Alert>
          ) : null}
        </CardBody>
      </Card>
      {renderVpsNetworkDialogs({
        t,
        editNetif,
        setEditNetif,
        updateNetifM,
        editDirty,
        gate,
        saveNetif,
        editError,
        editName,
        setEditName,
        canAdmin,
        editEnable,
        setEditEnable,
        editMaxTx,
        setEditMaxTx,
        editMaxRx,
        setEditMaxRx,
        ptrEditor,
        setPtrEditor,
        updatePtrM,
        ptrValue,
        setPtrValue,
        createHostForIp,
        setCreateHostForIp,
        createHostM,
        createHostValue,
        setCreateHostValue,
        assignHost,
        setAssignHost,
        assignHostInterface,
        setAssignHostInterface,
        netifs,
        assignHostM,
        freeHost,
        setFreeHost,
        freeHostM,
        deleteHost,
        setDeleteHost,
        deleteHostM,
        freeRouteIp,
        setFreeRouteIp,
        freeRouteM,
        assignRouteIp,
        setAssignRouteIp,
        assignRouteInterface,
        setAssignRouteInterface,
        assignRouteWithHost,
        setAssignRouteWithHost,
        assignRouteM,
        confirmDisableOpen,
        setConfirmDisableOpen,
        toggleNetM,
        changeReason,
        setChangeReason,
        confirmEnableOpen,
        setConfirmEnableOpen,
        ownerIp,
        setOwnerIp,
        ownerUser,
        setOwnerUser,
        ownerEnvironment,
        setOwnerEnvironment,
        environmentsQ,
        updateOwnerM,
      })}
    </div>
  );
}

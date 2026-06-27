import { ActionButton } from "../../../components/ui/ActionButton";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { UserLookupInput } from "../../../components/ui/UserLookupInput";
import type { NetworkInterface } from "../../../lib/api/networkInterfaces";
import { hostAddr, idFromResourceRef, ipAddressLabel, ipFamilyLabel, ipLocationLabel, labelFromResourceRef } from "./VpsNetworkPage.shared";
export function renderVpsNetworkDialogs(ctx: LegacyAny) {
  const { t, editNetif, setEditNetif, updateNetifM, editDirty, gate, saveNetif, editError, editName, setEditName, canAdmin, editEnable, setEditEnable, editMaxTx, setEditMaxTx, editMaxRx, setEditMaxRx, ptrEditor, setPtrEditor, updatePtrM, ptrValue, setPtrValue, createHostForIp, setCreateHostForIp, createHostM, createHostValue, setCreateHostValue, assignHost, setAssignHost, assignHostInterface, setAssignHostInterface, netifs, assignHostM, freeHost, setFreeHost, freeHostM, deleteHost, setDeleteHost, deleteHostM, freeRouteIp, setFreeRouteIp, freeRouteM, assignRouteIp, setAssignRouteIp, assignRouteInterface, setAssignRouteInterface, assignRouteWithHost, setAssignRouteWithHost, assignRouteM, confirmDisableOpen, setConfirmDisableOpen, toggleNetM, changeReason, setChangeReason, confirmEnableOpen, setConfirmEnableOpen, ownerIp, setOwnerIp, ownerUser, setOwnerUser, ownerEnvironment, setOwnerEnvironment, environmentsQ, updateOwnerM } = ctx;
  return (
    <>
      <Modal
        open={!!editNetif}
        testId="vps.network.edit"
        title={editNetif ? t("vps.network.edit.title", { name: String(editNetif.name ?? editNetif.type ?? editNetif.id) }) : t("vps.network.edit.title_fallback")}
        onClose={() => setEditNetif(null)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" testId="vps.network.edit.cancel" onClick={() => setEditNetif(null)} disabled={updateNetifM.isPending}>
              {t("common.cancel")}
            </Button>
            <ActionButton testId="vps.network.edit.save" disabled={!editDirty || !gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} loading={updateNetifM.isPending} onClick={() => void saveNetif()}>
              {t("common.save")}
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-4">
          {editError ? (
            <Alert title={t("vps.network.edit.error.title")} variant="danger">
              {editError}
            </Alert>
          ) : null}
          <div>
            <div className="text-xs font-medium text-muted">{t("vps.network.interfaces.field.name")}</div>
            <div className="mt-1">
              <Input testId="vps.network.edit.name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={t("vps.network.interfaces.name_placeholder")} autoComplete="off" />
            </div>
          </div>
          {canAdmin ? (
            <>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input data-testid="vps.network.edit.enabled" type="checkbox" checked={editEnable} onChange={(e) => setEditEnable(e.target.checked)} className="h-4 w-4 rounded border-border bg-surface text-accent focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg" />
                  <span>{t("vps.network.interfaces.field.enabled")}</span>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-muted">{t("vps.network.interfaces.field.max_tx")}</div>
                  <div className="mt-1">
                    <Input testId="vps.network.edit.max_tx" value={editMaxTx} onChange={(e) => setEditMaxTx(e.target.value)} placeholder="1000" autoComplete="off" />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted">{t("vps.network.interfaces.field.max_rx")}</div>
                  <div className="mt-1">
                    <Input testId="vps.network.edit.max_rx" value={editMaxRx} onChange={(e) => setEditMaxRx(e.target.value)} placeholder="1000" autoComplete="off" />
                  </div>
                </div>
              </div>
              <div className="space-y-1 text-xs text-muted">
                <div>{t("vps.network.edit.basic_limits_note")}</div>
                <div>{t("vps.network.edit.advanced_limits_note")}</div>
              </div>
            </>
          ) : (
            <div className="text-xs text-muted">{t("vps.network.edit.user_mode_hint")}</div>
          )}
        </div>
      </Modal>
      <Modal
        open={!!createHostForIp}
        testId="vps.network.host_addresses.create"
        title={
          createHostForIp
            ? t("vps.network.host_addresses.create.title_for_ip", {
                address: String((createHostForIp as LegacyAny).addr ?? (createHostForIp as LegacyAny).address ?? `#${createHostForIp.id}`),
              })
            : t("vps.network.host_addresses.create.title")
        }
        onClose={() => {
          if (createHostM.isPending) return;
          setCreateHostForIp(null);
          setCreateHostValue("");
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              testId="vps.network.host_addresses.create.cancel"
              onClick={() => {
                setCreateHostForIp(null);
                setCreateHostValue("");
              }}
              disabled={createHostM.isPending}
            >
              {t("common.cancel")}
            </Button>
            <ActionButton testId="vps.network.host_addresses.create.submit" loading={createHostM.isPending} disabled={!createHostValue.trim() || !gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} onClick={() => createHostM.mutate()}>
              {t("vps.network.host_addresses.create.submit")}
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="text-sm text-muted">{t("vps.network.host_addresses.create.help")}</div>
          <Textarea rows={5} testId="vps.network.host_addresses.create.addresses" value={createHostValue} onChange={(e) => setCreateHostValue(e.target.value)} placeholder={t("vps.network.host_addresses.create.placeholder")} disabled={createHostM.isPending} />
        </div>
      </Modal>
      <Modal
        open={!!ptrEditor}
        testId="vps.network.host_addresses.ptr"
        title={ptrEditor ? t("vps.network.host_addresses.ptr.title_for_ip", { address: hostAddr(ptrEditor) }) : t("vps.network.host_addresses.ptr.title")}
        onClose={() => {
          if (updatePtrM.isPending) return;
          setPtrEditor(null);
          setPtrValue("");
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              testId="vps.network.host_addresses.ptr.cancel"
              onClick={() => {
                setPtrEditor(null);
                setPtrValue("");
              }}
              disabled={updatePtrM.isPending}
            >
              {t("common.cancel")}
            </Button>
            <ActionButton testId="vps.network.host_addresses.ptr.submit" loading={updatePtrM.isPending} disabled={!gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} onClick={() => updatePtrM.mutate()}>
              {t("common.save")}
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="text-sm text-muted">{t("vps.network.host_addresses.ptr.help")}</div>
          <Input testId="vps.network.host_addresses.ptr.value" value={ptrValue} onChange={(e) => setPtrValue(e.target.value)} placeholder="host.example.org." autoComplete="off" disabled={updatePtrM.isPending} />
        </div>
      </Modal>
      <ConfirmDialog testId="vps.network.host_addresses.free_confirm" open={!!freeHost} title={t("vps.network.host_addresses.free.title")} description={freeHost ? t("vps.network.host_addresses.free.description", { address: hostAddr(freeHost) }) : ""} danger confirmLabel={t("vps.network.host_addresses.action.free")} confirmLoading={freeHostM.isPending} confirmDisabled={!gate.allowed} onCancel={() => setFreeHost(null)} onConfirm={() => freeHostM.mutate()} />
      <Modal
        open={!!assignHost}
        testId="vps.network.host_addresses.assign"
        title={assignHost ? t("vps.network.host_addresses.assign.title_for_ip", { address: hostAddr(assignHost) }) : t("vps.network.host_addresses.assign.title")}
        onClose={() => {
          if (assignHostM.isPending) return;
          setAssignHost(null);
          setAssignHostInterface("");
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              testId="vps.network.host_addresses.assign.cancel"
              onClick={() => {
                setAssignHost(null);
                setAssignHostInterface("");
              }}
              disabled={assignHostM.isPending}
            >
              {t("common.cancel")}
            </Button>
            <ActionButton testId="vps.network.host_addresses.assign.submit" loading={assignHostM.isPending} disabled={!assignHostInterface || !gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} onClick={() => assignHostM.mutate()}>
              {t("vps.network.host_addresses.action.assign")}
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <div className="mb-1 text-sm font-medium">{t("vps.network.ip_addresses.assign.interface")}</div>
            <Select
              testId="vps.network.host_addresses.assign.interface"
              value={assignHostInterface}
              onChange={(e) => setAssignHostInterface(e.target.value)}
              options={[
                { value: "", label: t("vps.network.ip_addresses.assign.interface.placeholder") },
                ...netifs.map((ni: NetworkInterface) => ({
                  value: String(ni.id),
                  label: `${ni.name ?? `#${ni.id}`} (#${ni.id})`,
                })),
              ]}
            />
          </label>
          <div className="rounded-md border border-border bg-surface-2 p-3 text-xs text-muted">
            {assignHost
              ? t("vps.network.host_addresses.assign.preview", {
                  address: hostAddr(assignHost),
                  interface: netifs.find((ni: NetworkInterface) => String(ni.id) === assignHostInterface)?.name ?? (assignHostInterface ? `#${assignHostInterface}` : "—"),
                })
              : null}
          </div>
        </div>
      </Modal>
      <Modal
        open={!!ownerIp}
        testId="vps.network.ip_addresses.owner"
        title={ownerIp ? t("vps.network.ip_addresses.owner.title_for_ip", { address: ipAddressLabel(ownerIp) }) : t("vps.network.ip_addresses.owner.title")}
        onClose={() => {
          if (updateOwnerM.isPending) return;
          setOwnerIp(null);
          setOwnerUser("");
          setOwnerEnvironment("");
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              testId="vps.network.ip_addresses.owner.cancel"
              onClick={() => {
                setOwnerIp(null);
                setOwnerUser("");
                setOwnerEnvironment("");
              }}
              disabled={updateOwnerM.isPending}
            >
              {t("common.cancel")}
            </Button>
            <ActionButton testId="vps.network.ip_addresses.owner.submit" loading={updateOwnerM.isPending} disabled={!canAdmin || (!ownerUser.trim() && !idFromResourceRef((ownerIp as LegacyAny)?.user)) || !gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} onClick={() => updateOwnerM.mutate()}>
              {ownerUser.trim() ? t("vps.network.ip_addresses.owner.save") : t("vps.network.ip_addresses.owner.clear")}
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted">{t("vps.network.ip_addresses.owner.current_user")}</div>
              <div className="font-medium">{labelFromResourceRef((ownerIp as LegacyAny)?.user)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">{t("vps.network.ip_addresses.owner.family")}</div>
              <div className="font-medium">{ownerIp ? ipFamilyLabel(ownerIp) : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted">{t("vps.network.ip_addresses.owner.location")}</div>
              <div className="font-medium">{ownerIp ? ipLocationLabel(ownerIp) : "—"}</div>
            </div>
          </div>
          <label className="block">
            <div className="mb-1 text-sm font-medium">{t("vps.network.ip_addresses.owner.user")}</div>
            <UserLookupInput testId="vps.network.ip_addresses.owner.user" value={ownerUser} onChange={setOwnerUser} placeholder={idFromResourceRef((ownerIp as LegacyAny)?.user) ? `#${idFromResourceRef((ownerIp as LegacyAny)?.user)}` : t("vps.network.ip_addresses.owner.unassigned")} allowRawId />
          </label>
          <label className="block">
            <div className="mb-1 text-sm font-medium">{t("vps.network.ip_addresses.owner.environment")}</div>
            <Select
              testId="vps.network.ip_addresses.owner.environment"
              value={ownerEnvironment}
              onChange={(e) => setOwnerEnvironment(e.target.value)}
              disabled={environmentsQ.isLoading || !ownerUser.trim()}
              options={[
                { value: "", label: t("vps.network.ip_addresses.owner.environment.placeholder") },
                ...(environmentsQ.data ?? []).map((env: any) => ({
                  value: String(env.id),
                  label: String(env.label ?? env.name ?? `#${env.id}`),
                })),
              ]}
            />
          </label>
          <div className="rounded-md border border-border bg-surface-2 p-3 text-xs text-muted">{ownerUser.trim() ? t("vps.network.ip_addresses.owner.preview_set", { user: ownerUser.trim(), address: ownerIp ? ipAddressLabel(ownerIp) : "—" }) : t("vps.network.ip_addresses.owner.preview_clear", { address: ownerIp ? ipAddressLabel(ownerIp) : "—" })}</div>
        </div>
      </Modal>
      <ConfirmDialog testId="vps.network.host_addresses.delete_confirm" open={!!deleteHost} title={t("vps.network.host_addresses.delete.title")} description={deleteHost ? t("vps.network.host_addresses.delete.description", { address: hostAddr(deleteHost) }) : ""} danger confirmLabel={t("common.delete")} confirmLoading={deleteHostM.isPending} confirmDisabled={!gate.allowed} onCancel={() => setDeleteHost(null)} onConfirm={() => deleteHostM.mutate()} />
      <ConfirmDialog
        testId="vps.network.ip_addresses.free_route_confirm"
        open={!!freeRouteIp}
        title={t("vps.network.ip_addresses.free_route.title")}
        description={
          freeRouteIp
            ? t("vps.network.ip_addresses.free_route.description", {
                address: String((freeRouteIp as LegacyAny).addr ?? (freeRouteIp as LegacyAny).address ?? `#${freeRouteIp.id}`),
              })
            : ""
        }
        danger
        confirmLabel={t("vps.network.ip_addresses.action.free_route")}
        confirmLoading={freeRouteM.isPending}
        confirmDisabled={!gate.allowed}
        onCancel={() => setFreeRouteIp(null)}
        onConfirm={() => freeRouteM.mutate()}
      />
      <Modal
        open={!!assignRouteIp}
        testId="vps.network.ip_addresses.assign_route"
        title={
          assignRouteIp
            ? t("vps.network.ip_addresses.assign.title_for_ip", {
                address: String((assignRouteIp as LegacyAny).addr ?? (assignRouteIp as LegacyAny).address ?? `#${assignRouteIp.id}`),
              })
            : t("vps.network.ip_addresses.assign.title")
        }
        onClose={() => {
          if (assignRouteM.isPending) return;
          setAssignRouteIp(null);
          setAssignRouteInterface("");
          setAssignRouteWithHost(false);
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              testId="vps.network.ip_addresses.assign_route.cancel"
              onClick={() => {
                setAssignRouteIp(null);
                setAssignRouteInterface("");
                setAssignRouteWithHost(false);
              }}
              disabled={assignRouteM.isPending}
            >
              {t("common.cancel")}
            </Button>
            <ActionButton testId="vps.network.ip_addresses.assign_route.submit" loading={assignRouteM.isPending} disabled={!assignRouteInterface || !gate.allowed} disabledReason={!gate.allowed ? gate.reason : undefined} onClick={() => assignRouteM.mutate()}>
              {t("vps.network.ip_addresses.action.assign_route")}
            </ActionButton>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <div className="mb-1 text-sm font-medium">{t("vps.network.ip_addresses.assign.interface")}</div>
            <Select
              testId="vps.network.ip_addresses.assign_route.interface"
              value={assignRouteInterface}
              onChange={(e) => setAssignRouteInterface(e.target.value)}
              options={[
                { value: "", label: t("vps.network.ip_addresses.assign.interface.placeholder") },
                ...netifs.map((ni: NetworkInterface) => ({
                  value: String(ni.id),
                  label: `${ni.name ?? `#${ni.id}`} (#${ni.id})`,
                })),
              ]}
            />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input data-testid="vps.network.ip_addresses.assign_route.with_host" type="checkbox" checked={assignRouteWithHost} onChange={(e) => setAssignRouteWithHost(e.target.checked)} className="mt-1 h-4 w-4 rounded border-border bg-surface text-accent focus:ring-2 focus:ring-focus/35 focus:ring-offset-2 focus:ring-offset-bg" />
            <span>
              <span className="font-medium">{t("vps.network.ip_addresses.assign.with_host")}</span>
              <span className="block text-xs text-muted">{t("vps.network.ip_addresses.assign.with_host_help")}</span>
            </span>
          </label>
          <div className="text-xs text-muted">{t("vps.network.ip_addresses.assign.help")}</div>
        </div>
      </Modal>
      <ConfirmDialog
        testId="vps.network.disable_confirm"
        open={confirmDisableOpen}
        title={t("vps.network.disable_dialog.title")}
        description={t("vps.network.disable_dialog.description")}
        danger
        confirmLabel={t("vps.network.disable_button")}
        confirmLoading={toggleNetM.isPending}
        confirmDisabled={!gate.allowed}
        onCancel={() => setConfirmDisableOpen(false)}
        onConfirm={async () => {
          try {
            await toggleNetM.mutateAsync({ enable: false, reason: changeReason });
            setConfirmDisableOpen(false);
            setChangeReason("");
          } catch {
            // errors are shown via netToggleError
          }
        }}
      >
        <div>
          <div className="text-xs font-medium text-muted">{t("vps.network.change_reason.label")}</div>
          <div className="mt-1">
            <Input testId="vps.network.disable.reason" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder={t("vps.network.change_reason.placeholder")} autoComplete="off" />
          </div>
          <div className="mt-1 text-xs text-muted">{t("vps.network.change_reason.help")}</div>
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        testId="vps.network.enable_confirm"
        open={confirmEnableOpen}
        title={t("vps.network.enable_dialog.title")}
        description={t("vps.network.enable_dialog.description")}
        confirmLabel={t("vps.network.enable_button")}
        confirmLoading={toggleNetM.isPending}
        confirmDisabled={!gate.allowed}
        onCancel={() => setConfirmEnableOpen(false)}
        onConfirm={async () => {
          try {
            await toggleNetM.mutateAsync({ enable: true });
            setConfirmEnableOpen(false);
          } catch {
            // errors are shown via netToggleError
          }
        }}
      />
    </>
  );
}

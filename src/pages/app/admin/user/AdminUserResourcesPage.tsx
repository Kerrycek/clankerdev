import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../app/i18n";
import { useToasts } from "../../../../app/toasts";
import { Alert } from "../../../../components/ui/Alert";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../../../components/ui/Card";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { ErrorState } from "../../../../components/ui/ErrorState";
import { FormField } from "../../../../components/ui/FormField";
import { KeysetPagination } from "../../../../components/ui/KeysetPagination";
import { LoadingState } from "../../../../components/ui/LoadingState";
import { Modal } from "../../../../components/ui/Modal";
import { Select, type SelectOption } from "../../../../components/ui/Select";
import { StatCard } from "../../../../components/ui/StatCard";
import { SwitchRow } from "../../../../components/ui/SwitchRow";
import { TableCard } from "../../../../components/ui/TableCard";
import { Textarea } from "../../../../components/ui/Textarea";
import { formatErrorMessage } from "../../../../lib/errors";
import { useKeysetPagination } from "../../../../lib/hooks/useKeysetPagination";
import { parsePositiveInt } from "../../../../lib/parse";
import { formatDateTime } from "../../../../lib/time";
import { getMetaTotalCount } from "../../../../lib/api/haveapi";
import { fetchEnvironments, type Environment } from "../../../../lib/api/infra";
import { fetchUserClusterResources, type UserClusterResource } from "../../../../lib/api/clusterResources";
import { createUserClusterResourcePackage, deleteUserClusterResourcePackage, fetchClusterResourcePackages, fetchUserClusterResourcePackages, updateUserClusterResourcePackage, type ClusterResourcePackage, type UserClusterResourcePackage } from "../../../../lib/api/clusterResourcePackages";
import { useAdminUserContext } from "./AdminUserLayout";
function envLabel(env: Environment | null | undefined): string {
  const e: any = env ?? {};
  const label = typeof e.label === "string" ? e.label.trim() : "";
  return label || (typeof e.id === "number" ? `#${e.id}` : "—");
}
function packageLabel(pkg: ClusterResourcePackage | null | undefined, fallback?: string | null): string {
  const p: any = pkg ?? {};
  const label = typeof p.label === "string" ? p.label.trim() : "";
  if (label) return label;
  const f = typeof fallback === "string" ? fallback.trim() : "";
  if (f) return f;
  return typeof p.id === "number" ? `#${p.id}` : "—";
}
function packageIdFromRecord(rec: UserClusterResourcePackage): number | undefined {
  const raw = (rec as LegacyAny).cluster_resource_package;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (raw && typeof raw === "object" && typeof raw.id === "number") return raw.id;
  const direct = (rec as LegacyAny).cluster_resource_package_id;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  return undefined;
}
function assignedPackageLabel(rec: UserClusterResourcePackage): string {
  return packageLabel((rec as LegacyAny).cluster_resource_package, rec.label ?? null);
}
function userLabel(u: any): string {
  if (!u) return "—";
  const login = typeof u.login === "string" ? u.login.trim() : "";
  if (login) return login;
  return typeof u.id === "number" ? `#${u.id}` : "—";
}
function effectiveResourceLabel(row: UserClusterResource): string {
  const cr: any = (row as LegacyAny).cluster_resource ?? row;
  const label = typeof cr.label === "string" ? cr.label.trim() : "";
  const name = typeof cr.name === "string" ? cr.name.trim() : "";
  if (label && name) return `${label} (${name})`;
  return label || name || (typeof cr.id === "number" ? `#${cr.id}` : "—");
}
function resourceValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value;
  return String(value);
}
type EditorState = null | {
  mode: "create" | "edit";
  record?: UserClusterResourcePackage;
};
export function AdminUserResourcesPage() {
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userId, user } = useAdminUserContext();
  const pagination = useKeysetPagination({
    id: "admin.user.resources.assignments",
    filterKey: JSON.stringify({ userId }),
    searchParams,
    setSearchParams,
    defaultLimit: 50,
    allowedLimits: [25, 50, 100, 200],
  });
  const assignmentsQ = useQuery({
    queryKey: ["user_cluster_resource_packages", "user", { userId, limit: pagination.limit, fromId: pagination.fromId }],
    queryFn: async () =>
      await fetchUserClusterResourcePackages({
        userId,
        limit: pagination.limit,
        fromId: pagination.fromId ?? undefined,
      }),
    staleTime: 5_000,
  });
  const effectiveQ = useQuery({
    queryKey: ["users", userId, "cluster_resources"],
    queryFn: async () => (await fetchUserClusterResources(userId, { limit: 500 })).data,
    staleTime: 10_000,
  });
  const envQ = useQuery({
    queryKey: ["environments", { limit: 500 }],
    queryFn: async () => (await fetchEnvironments({ limit: 500 })).data,
    staleTime: 60_000,
  });
  const packagesQ = useQuery({
    queryKey: ["cluster_resource_packages", { isPersonal: false, limit: 500 }],
    queryFn: async () => (await fetchClusterResourcePackages({ isPersonal: false, limit: 500 })).data,
    staleTime: 60_000,
  });
  const assignmentsRes = assignmentsQ.data;
  const assignments = assignmentsRes?.data ?? [];
  const effectiveResources = effectiveQ.data ?? [];
  const assignmentTotal = getMetaTotalCount(assignmentsRes?.meta) ?? assignments.length;
  const lastAssignment = assignments[assignments.length - 1];
  const cursor = lastAssignment ? lastAssignment.id : null;
  const hasMore = assignments.length === pagination.limit && typeof cursor === "number";
  const canNext = pagination.hasForward || hasMore;
  const environments = envQ.data ?? [];
  const globalPackages = packagesQ.data ?? [];
  const environmentCount = useMemo(() => {
    const ids = new Set<string>();
    for (const rec of assignments) {
      const env = (rec as LegacyAny).environment;
      if (typeof env?.id === "number") ids.add(String(env.id));
      else {
        const label = envLabel(env);
        if (label !== "—") ids.add(label);
      }
    }
    return ids.size;
  }, [assignments]);
  const envOptions: SelectOption[] = useMemo(() => [{ value: "", label: t("common.select") }, ...environments.map((e) => ({ value: String(e.id), label: envLabel(e) }))], [environments, t]);
  const packageOptions: SelectOption[] = useMemo(() => [{ value: "", label: t("common.select") }, ...globalPackages.map((pkg) => ({ value: String(pkg.id), label: packageLabel(pkg) }))], [globalPackages, t]);
  const [editor, setEditor] = useState<EditorState>(null);
  const [environmentId, setEnvironmentId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [comment, setComment] = useState("");
  const [fromPersonal, setFromPersonal] = useState(false);
  const [deleteRec, setDeleteRec] = useState<UserClusterResourcePackage | null>(null);
  function openCreate() {
    const firstEnv = environments.length === 1 ? String(environments[0]!.id) : "";
    setEnvironmentId(firstEnv);
    setPackageId("");
    setComment("");
    setFromPersonal(false);
    setEditor({ mode: "create" });
  }
  function openEdit(rec: UserClusterResourcePackage) {
    const env = (rec as LegacyAny).environment;
    const pkgId = packageIdFromRecord(rec);
    setEnvironmentId(typeof env?.id === "number" ? String(env.id) : "");
    setPackageId(pkgId ? String(pkgId) : "");
    setComment(typeof rec.comment === "string" ? rec.comment : "");
    setFromPersonal(false);
    setEditor({ mode: "edit", record: rec });
  }
  const invalidateResourceQueries = async () => {
    await qc.invalidateQueries({ queryKey: ["user_cluster_resource_packages"] });
    await qc.invalidateQueries({ queryKey: ["users", userId, "cluster_resources"] });
  };
  const createM = useMutation({
    mutationFn: async () => {
      const envId = parsePositiveInt(environmentId);
      const pkgId = parsePositiveInt(packageId);
      if (!envId) throw new Error(t("admin.user.resources.validation.environment"));
      if (!pkgId) throw new Error(t("admin.user.resources.validation.package"));
      return await createUserClusterResourcePackage({
        environmentId: envId,
        userId,
        clusterResourcePackageId: pkgId,
        comment,
        fromPersonal,
      });
    },
    onSuccess: async () => {
      setEditor(null);
      await invalidateResourceQueries();
      pushToast({ variant: "ok", title: t("admin.user.resources.toast.created") });
    },
    onError: (err) => pushToast({ variant: "danger", title: t("common.error"), body: formatErrorMessage(err), autoDismissMs: false }),
  });
  const updateM = useMutation({
    mutationFn: async () => {
      const id = editor?.record?.id;
      if (!id) throw new Error(t("admin.user.resources.validation.assignment"));
      return await updateUserClusterResourcePackage({ id, comment });
    },
    onSuccess: async () => {
      setEditor(null);
      await invalidateResourceQueries();
      pushToast({ variant: "ok", title: t("admin.user.resources.toast.updated") });
    },
    onError: (err) => pushToast({ variant: "danger", title: t("common.error"), body: formatErrorMessage(err), autoDismissMs: false }),
  });
  const deleteM = useMutation({
    mutationFn: async () => {
      if (!deleteRec?.id) throw new Error(t("admin.user.resources.validation.assignment"));
      return await deleteUserClusterResourcePackage(deleteRec.id);
    },
    onSuccess: async () => {
      setDeleteRec(null);
      await invalidateResourceQueries();
      pushToast({ variant: "ok", title: t("admin.user.resources.toast.deleted") });
    },
    onError: (err) => pushToast({ variant: "danger", title: t("common.error"), body: formatErrorMessage(err), autoDismissMs: false }),
  });
  const editorIsCreate = editor?.mode === "create";
  const editorLoading = createM.isPending || updateM.isPending;
  const selectedEnv = environments.find((e) => String(e.id) === environmentId);
  const selectedPackage = globalPackages.find((pkg) => String(pkg.id) === packageId);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" size="sm" to="/admin/cluster/resource-packages" testId="admin.user.resources.open_packages">
          {t("admin.user.resources.open_package_admin")}
        </Button>
        <Button variant="primary" size="sm" onClick={openCreate} disabled={envQ.isLoading || packagesQ.isLoading} testId="admin.user.resources.assign.open">
          {t("admin.user.resources.assign.open")}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard title={t("admin.user.resources.stat.assignments")} value={assignmentTotal} subtitle={t("admin.user.resources.stat.assignments.subtitle")} testId="admin.user.resources.stat.assignments" />
        <StatCard title={t("admin.user.resources.stat.environments")} value={environmentCount} subtitle={t("admin.user.resources.stat.environments.subtitle")} testId="admin.user.resources.stat.environments" />
        <StatCard title={t("admin.user.resources.stat.effective")} value={effectiveResources.length} subtitle={t("admin.user.resources.stat.effective.subtitle")} testId="admin.user.resources.stat.effective" />
      </div>
      <Card testId="admin.user.resources.assignments.card">
        <CardHeader title={t("admin.user.resources.assignments.title")} subtitle={t("admin.user.resources.assignments.subtitle")} />
        <CardBody>
          {assignmentsQ.isLoading ? <LoadingState testId="admin.user.resources.assignments.loading" /> : null}
          {assignmentsQ.isError ? <ErrorState title={t("admin.user.resources.assignments.load_error")} error={assignmentsQ.error} testId="admin.user.resources.assignments.error" /> : null}
          {!assignmentsQ.isLoading && !assignmentsQ.isError ? (
            assignments.length === 0 ? (
              <EmptyState title={t("admin.user.resources.assignments.empty.title")} message={t("admin.user.resources.assignments.empty.body")} testId="admin.user.resources.assignments.empty" />
            ) : (
              <TableCard minWidth="lg" testId="admin.user.resources.assignments.table_card" tableTestId="admin.user.resources.assignments.table" footer={<KeysetPagination testId="admin.user.resources.assignments.pagination" page={pagination.page} pageCount={pagination.pageCount} canPrev={pagination.canPrev} canNext={canNext} onPrev={pagination.goPrev} onNext={() => pagination.goNext(cursor)} onGoToPage={pagination.goToPage} limit={pagination.limit} allowedLimits={pagination.allowedLimits} onLimitChange={pagination.setLimit} />}>
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t("common.environment")}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t("admin.user.resources.col.package")}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t("common.comment")}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t("admin.user.resources.col.added_by")}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t("common.created_at")}</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((rec) => {
                    const env = (rec as LegacyAny).environment as Environment | null | undefined;
                    const pkgId = packageIdFromRecord(rec);
                    const pkgName = assignedPackageLabel(rec);
                    const addedBy = (rec as LegacyAny).added_by;
                    const commentText = typeof rec.comment === "string" ? rec.comment.trim() : "";
                    const createdAt = typeof rec.created_at === "string" ? rec.created_at : null;
                    return (
                      <tr key={rec.id} data-testid={`admin.user.resources.assignment.row.${rec.id}`}>
                        <td className="px-3 py-2 text-muted">{envLabel(env)}</td>
                        <td className="px-3 py-2 text-fg">
                          <div className="flex items-center gap-2">
                            {pkgId ? (
                              <Link className="font-medium text-link hover:underline" to={`/admin/cluster/resource-packages/${pkgId}`}>
                                {pkgName}
                              </Link>
                            ) : (
                              <span className="font-medium">{pkgName}</span>
                            )}
                            {pkgId ? <Badge variant="neutral">#{pkgId}</Badge> : null}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted">{commentText || "—"}</td>
                        <td className="px-3 py-2 text-muted">{userLabel(addedBy)}</td>
                        <td className="px-3 py-2 text-muted tabular-nums">{formatDateTime(createdAt)}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button size="sm" variant="secondary" onClick={() => openEdit(rec)} testId={`admin.user.resources.assignment.row.${rec.id}.edit`}>
                              {t("common.edit")}
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => setDeleteRec(rec)} testId={`admin.user.resources.assignment.row.${rec.id}.delete`}>
                              {t("common.delete")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableCard>
            )
          ) : null}
        </CardBody>
      </Card>
      <Card testId="admin.user.resources.effective.card">
        <CardHeader title={t("admin.user.resources.effective.title")} subtitle={t("admin.user.resources.effective.subtitle")} />
        <CardBody>
          {effectiveQ.isLoading ? <LoadingState testId="admin.user.resources.effective.loading" /> : null}
          {effectiveQ.isError ? <ErrorState title={t("admin.user.resources.effective.load_error")} error={effectiveQ.error} testId="admin.user.resources.effective.error" /> : null}
          {!effectiveQ.isLoading && !effectiveQ.isError ? (
            effectiveResources.length === 0 ? (
              <EmptyState title={t("admin.user.resources.effective.empty.title")} message={t("admin.user.resources.effective.empty.body")} testId="admin.user.resources.effective.empty" />
            ) : (
              <TableCard minWidth="md" testId="admin.user.resources.effective.table_card" tableTestId="admin.user.resources.effective.table">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t("common.environment")}</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted">{t("admin.user.resources.col.resource")}</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-muted">{t("admin.user.resources.col.value")}</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveResources.map((row) => {
                    const env = (row as LegacyAny).environment as Environment | null | undefined;
                    return (
                      <tr key={row.id} data-testid={`admin.user.resources.effective.row.${row.id}`}>
                        <td className="px-3 py-2 text-muted">{envLabel(env)}</td>
                        <td className="px-3 py-2 text-fg">{effectiveResourceLabel(row)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-fg">{resourceValue((row as LegacyAny).value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableCard>
            )
          ) : null}
        </CardBody>
      </Card>
      <Modal
        open={Boolean(editor)}
        title={editorIsCreate ? t("admin.user.resources.assign.create.title") : t("admin.user.resources.assign.edit.title")}
        onClose={() => (editorLoading ? null : setEditor(null))}
        testId="admin.user.resources.assign.modal"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditor(null)} disabled={editorLoading}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (editor?.mode === "edit") updateM.mutate();
                else createM.mutate();
              }}
              loading={editorLoading}
              disabled={editorIsCreate ? !parsePositiveInt(environmentId) || !parsePositiveInt(packageId) : false}
              testId="admin.user.resources.assign.save"
            >
              {t("common.save")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Alert variant="neutral" testId="admin.user.resources.assign.impact">
            {editorIsCreate
              ? t("admin.user.resources.assign.impact.create", {
                  user: userLabel(user),
                  environment: selectedEnv ? envLabel(selectedEnv) : "—",
                  package: selectedPackage ? packageLabel(selectedPackage) : "—",
                })
              : t("admin.user.resources.assign.impact.edit", {
                  package: editor?.record ? assignedPackageLabel(editor.record) : "—",
                })}
          </Alert>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t("common.environment")}>
              <Select value={environmentId} onChange={(e) => setEnvironmentId(e.target.value)} options={envOptions} disabled={!editorIsCreate || envQ.isLoading} testId="admin.user.resources.assign.environment" />
            </FormField>
            <FormField label={t("admin.user.resources.field.package")}>
              <Select value={packageId} onChange={(e) => setPackageId(e.target.value)} options={packageOptions} disabled={!editorIsCreate || packagesQ.isLoading} testId="admin.user.resources.assign.package" />
            </FormField>
          </div>
          {packagesQ.isError ? <ErrorState title={t("admin.user.resources.assign.packages_load_error")} error={packagesQ.error} testId="admin.user.resources.assign.packages_error" /> : null}
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">{t("common.comment")}</span>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder={t("admin.user.resources.assign.comment_placeholder")} testId="admin.user.resources.assign.comment" />
          </label>
          {editorIsCreate ? <SwitchRow checked={fromPersonal} onChange={(value) => setFromPersonal(Boolean(value))} label={t("admin.cluster.resource_packages.assign.from_personal.label")} description={t("admin.user.resources.assign.from_personal.description")} testId="admin.user.resources.assign.from_personal" /> : null}
        </div>
      </Modal>
      <ConfirmDialog open={Boolean(deleteRec)} onCancel={() => setDeleteRec(null)} onConfirm={() => deleteM.mutate()} danger title={t("admin.user.resources.delete_confirm.title")} description={t("admin.user.resources.delete_confirm.description")} confirmLabel={t("common.delete")} confirmLoading={deleteM.isPending} testId="admin.user.resources.delete_confirm">
        <div className="space-y-2 text-sm text-muted">
          <div>{t("admin.user.resources.delete_confirm.package", { package: deleteRec ? assignedPackageLabel(deleteRec) : "—" })}</div>
          <div>{t("admin.user.resources.delete_confirm.user", { user: userLabel(user) })}</div>
        </div>
      </ConfirmDialog>
    </div>
  );
}

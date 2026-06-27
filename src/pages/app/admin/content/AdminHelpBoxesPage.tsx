import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useI18n } from "../../../../app/i18n";
import { useTheme } from "../../../../app/theme";
import { useToasts } from "../../../../app/toasts";
import { Alert } from "../../../../components/ui/Alert";
import { Badge } from "../../../../components/ui/Badge";
import { Button } from "../../../../components/ui/Button";
import { ConfirmDialog } from "../../../../components/ui/ConfirmDialog";
import { Input } from "../../../../components/ui/Input";
import { Modal } from "../../../../components/ui/Modal";
import { SandboxedHtml } from "../../../../components/ui/SandboxedHtml";
import { Select } from "../../../../components/ui/Select";
import { Spinner } from "../../../../components/ui/Spinner";
import { TableCard } from "../../../../components/ui/TableCard";
import { Textarea } from "../../../../components/ui/Textarea";
import { createHelpBox, deleteHelpBox, fetchHelpBoxesAdmin, updateHelpBox, type HelpBox } from "../../../../lib/api/helpBoxes";
import { fetchLanguages, type Language } from "../../../../lib/api/languages";
import { formatErrorMessage } from "../../../../lib/errors";
function snippet(s: string | undefined | null, limit = 120): string {
  const t = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  if (t.length <= limit) return t;
  return `${t.slice(0, limit - 1)}…`;
}
function parseIntOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}
export function AdminHelpBoxesPage() {
  const { t } = useI18n();
  const theme = useTheme();
  const { pushToast } = useToasts();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pageFilter, setPageFilter] = useState(() => searchParams.get("page") ?? "");
  const [actionFilter, setActionFilter] = useState(() => searchParams.get("action") ?? "");
  const [contentSearch, setContentSearch] = useState(() => searchParams.get("search") ?? "");
  // Filter tri-state:
  // - '__all__' => do not filter by language
  // - ''        => default language (NULL)
  // - '123'     => language id
  const [languageFilter, setLanguageFilter] = useState<string>(() => searchParams.get("language") ?? "__all__");
  const languageParam: number | null | undefined = useMemo(() => {
    if (languageFilter === "__all__") return undefined;
    if (languageFilter === "") return null;
    const n = Number(languageFilter);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  }, [languageFilter]);
  useEffect(() => {
    const next = new URLSearchParams();
    if (pageFilter.trim()) next.set("page", pageFilter.trim());
    if (actionFilter.trim()) next.set("action", actionFilter.trim());
    if (contentSearch.trim()) next.set("search", contentSearch.trim());
    if (languageFilter !== "__all__") next.set("language", languageFilter);
    const current = searchParams.toString();
    const target = next.toString();
    if (current !== target) {
      setSearchParams(next, { replace: true });
    }
  }, [actionFilter, contentSearch, languageFilter, pageFilter, searchParams, setSearchParams]);
  const langsQ = useQuery({
    queryKey: ["languages", { limit: 250 }],
    queryFn: async () => (await fetchLanguages({ limit: 250 })).data,
    refetchOnWindowFocus: false,
  });
  const languageKey = languageParam === undefined ? "__all__" : languageParam;
  const q = useQuery({
    queryKey: ["help_boxes", "admin", { page: pageFilter || null, action: actionFilter || null, language: languageKey }],
    queryFn: async () =>
      (
        await fetchHelpBoxesAdmin({
          page: pageFilter.trim() || undefined,
          action: actionFilter.trim() || undefined,
          ...(languageParam !== undefined ? { language: languageParam } : {}),
          limit: 500,
        })
      ).data,
    refetchOnWindowFocus: false,
  });
  const rows = useMemo(() => {
    const base = q.data ?? [];
    const term = contentSearch.trim().toLowerCase();
    if (!term) return base;
    return base.filter((b) =>
      String(b.content ?? "")
        .toLowerCase()
        .includes(term),
    );
  }, [contentSearch, q.data]);
  const languages = (langsQ.data ?? []) as Language[];
  // -------------
  // Preview modal
  // -------------
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<HelpBox | null>(null);
  // -------------
  // Editor modal
  // -------------
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editorTarget, setEditorTarget] = useState<HelpBox | null>(null);
  const [editorPage, setEditorPage] = useState("");
  const [editorAction, setEditorAction] = useState("");
  const [editorLanguage, setEditorLanguage] = useState<string>("");
  const [editorOrder, setEditorOrder] = useState("0");
  const [editorContent, setEditorContent] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);
  const openCreate = () => {
    setEditorMode("create");
    setEditorTarget(null);
    setEditorError(null);
    setEditorPage("");
    setEditorAction("");
    setEditorLanguage("");
    setEditorOrder("0");
    setEditorContent("");
    setEditorOpen(true);
  };
  const openEdit = (b: HelpBox) => {
    setEditorMode("edit");
    setEditorTarget(b);
    setEditorError(null);
    setEditorPage(String(b.page ?? ""));
    setEditorAction(String(b.action ?? ""));
    setEditorLanguage(b.language && typeof b.language.id === "number" ? String(b.language.id) : "");
    setEditorOrder(typeof b.order === "number" ? String(b.order) : "0");
    setEditorContent(String(b.content ?? ""));
    setEditorOpen(true);
  };
  const editorOrderParsed = useMemo(() => parseIntOrNull(editorOrder), [editorOrder]);
  const editorLangParsed = editorLanguage.trim() ? Number(editorLanguage) : null;
  const editorLangId = editorLangParsed !== null ? editorLangParsed : null;
  const editorValid = Boolean(editorPage.trim()) && Boolean(editorAction.trim()) && Boolean(editorContent.trim()) && editorOrderParsed !== null;
  const saveM = useMutation({
    mutationFn: async () => {
      if (!editorPage.trim()) throw new Error(t("admin.help_boxes.validation.page"));
      if (!editorAction.trim()) throw new Error(t("admin.help_boxes.validation.action"));
      if (!editorContent.trim()) throw new Error(t("admin.help_boxes.validation.content"));
      if (editorOrderParsed === null) throw new Error(t("admin.help_boxes.validation.order"));
      if (editorMode === "create") {
        await createHelpBox({
          page: editorPage.trim(),
          action: editorAction.trim(),
          content: editorContent,
          order: editorOrderParsed,
          language: editorLangId,
        });
      } else {
        if (!editorTarget) throw new Error("Missing target");
        await updateHelpBox(editorTarget.id, {
          page: editorPage.trim(),
          action: editorAction.trim(),
          content: editorContent,
          order: editorOrderParsed,
          language: editorLangId,
        });
      }
    },
    onSuccess: () => {
      pushToast({ variant: "ok", title: t("admin.help_boxes.toast.saved") });
      setEditorOpen(false);
      setEditorError(null);
      qc.invalidateQueries({ queryKey: ["help_boxes"] });
    },
    onError: (e) => {
      const msg = formatErrorMessage(e);
      setEditorError(msg);
      pushToast({ variant: "danger", title: t("common.error"), body: msg });
    },
  });
  // -----------
  // Delete
  // -----------
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HelpBox | null>(null);
  const delM = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      await deleteHelpBox(deleteTarget.id);
    },
    onSuccess: () => {
      pushToast({ variant: "ok", title: t("admin.help_boxes.toast.deleted") });
      setDeleteOpen(false);
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["help_boxes"] });
    },
    onError: (e) => {
      const msg = formatErrorMessage(e);
      pushToast({ variant: "danger", title: t("common.error"), body: msg });
    },
  });
  return (
    <div className="space-y-4" data-testid="admin.help_boxes.page">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <div className="text-xs text-faint">{t("admin.help_boxes.filter.page")}</div>
            <Input value={pageFilter} onChange={(e) => setPageFilter(e.target.value)} placeholder={t("admin.help_boxes.filter.page_placeholder")} testId="admin.help_boxes.filter.page" />
          </div>
          <div>
            <div className="text-xs text-faint">{t("admin.help_boxes.filter.action")}</div>
            <Input value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} placeholder={t("admin.help_boxes.filter.action_placeholder")} testId="admin.help_boxes.filter.action" />
          </div>
          <div>
            <div className="text-xs text-faint">{t("admin.help_boxes.filter.language")}</div>
            <Select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)} testId="admin.help_boxes.filter.language">
              <option value="__all__">{t("common.all")}</option>
              <option value="">{t("common.default")}</option>
              {languages.map((l) => (
                <option key={l.id} value={String(l.id)}>
                  {String(l.label ?? l.code ?? l.id)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <div className="text-xs text-faint">{t("admin.help_boxes.filter.search")}</div>
            <Input value={contentSearch} onChange={(e) => setContentSearch(e.target.value)} placeholder={t("admin.help_boxes.filter.search_placeholder")} testId="admin.help_boxes.filter.search" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="primary" onClick={openCreate} testId="admin.help_boxes.create">
            {t("admin.help_boxes.action.create")}
          </Button>
        </div>
      </div>
      {q.isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner />
        </div>
      ) : q.error ? (
        <Alert variant="danger" title={t("common.error")}>
          {formatErrorMessage(q.error)}
        </Alert>
      ) : rows.length === 0 ? (
        <Alert variant="neutral" title={t("admin.help_boxes.empty.title")}>
          {t("admin.help_boxes.empty.body")}
        </Alert>
      ) : (
        <TableCard testId="admin.help_boxes.table" minWidth="lg">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-faint">{t("admin.help_boxes.table.order")}</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-faint">{t("admin.help_boxes.table.page")}</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-faint">{t("admin.help_boxes.table.action")}</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-faint">{t("admin.help_boxes.table.language")}</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-faint">{t("admin.help_boxes.table.content")}</th>
              <th className="px-4 py-2 text-right text-xs font-semibold text-faint">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const page = String(b.page ?? "");
              const action = String(b.action ?? "");
              const lang = b.language ? String(b.language.label ?? b.language.code ?? b.language.id) : t("common.default");
              const pageBadge = page === "*" ? <Badge variant="info">*</Badge> : null;
              const actionBadge = action === "*" ? <Badge variant="info">*</Badge> : null;
              return (
                <tr key={b.id} className="table-row-tone">
                  <td className="px-4 py-2 text-xs text-muted">{typeof b.order === "number" ? b.order : "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-fg">{page || "—"}</span>
                      {pageBadge}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-fg">{action || "—"}</span>
                      {actionBadge}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted">{lang}</td>
                  <td className="px-4 py-2">
                    <div className="text-sm text-fg">{snippet(b.content)}</div>
                    <div className="mt-0.5 text-xs text-faint">#{b.id}</div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setPreviewTarget(b);
                          setPreviewOpen(true);
                        }}
                        testId={`admin.help_boxes.preview.${b.id}`}
                      >
                        {t("admin.help_boxes.action.preview")}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => openEdit(b)} testId={`admin.help_boxes.edit.${b.id}`}>
                        {t("admin.help_boxes.action.edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setDeleteTarget(b);
                          setDeleteOpen(true);
                        }}
                        testId={`admin.help_boxes.delete.${b.id}`}
                      >
                        {t("admin.help_boxes.action.delete")}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      )}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={t("admin.help_boxes.preview.title")}
        size="lg"
        testId="admin.help_boxes.preview"
        footer={
          <div className="flex items-center justify-end">
            <Button variant="secondary" onClick={() => setPreviewOpen(false)}>
              {t("common.close")}
            </Button>
          </div>
        }
      >
        {previewTarget ? (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-md border border-border bg-surface p-3 text-sm">
                <div className="text-xs text-faint">{t("admin.help_boxes.field.page")}</div>
                <div className="mt-1 font-mono text-sm">{String(previewTarget.page ?? "")}</div>
              </div>
              <div className="rounded-md border border-border bg-surface p-3 text-sm">
                <div className="text-xs text-faint">{t("admin.help_boxes.field.action")}</div>
                <div className="mt-1 font-mono text-sm">{String(previewTarget.action ?? "")}</div>
              </div>
            </div>
            <SandboxedHtml html={String(previewTarget.content ?? "")} testId="admin.help_boxes.preview.iframe" autoHeight maxAutoHeight={448} variant="helpBox" theme={theme.effective} className="min-h-0" />
            <div>
              <div className="text-xs text-faint">{t("admin.help_boxes.preview.raw")}</div>
              <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-border bg-surface p-3 text-xs text-fg">{String(previewTarget.content ?? "")}</pre>
            </div>
          </div>
        ) : null}
      </Modal>
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editorMode === "create" ? t("admin.help_boxes.modal.create.title") : t("admin.help_boxes.modal.edit.title")}
        size="lg"
        testId="admin.help_boxes.editor"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditorOpen(false)} disabled={saveM.isPending}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={() => saveM.mutate()} loading={saveM.isPending} disabled={!editorValid} testId="admin.help_boxes.editor.save">
              {t("common.save")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {editorError ? (
            <Alert variant="danger" title={t("common.error")}>
              {editorError}
            </Alert>
          ) : null}
          <Alert variant="info" title={t("admin.help_boxes.editor.help_title")}>
            {t("admin.help_boxes.editor.help_body")}
          </Alert>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs text-faint">{t("admin.help_boxes.field.page")}</div>
              <Input value={editorPage} onChange={(e) => setEditorPage(e.target.value)} testId="admin.help_boxes.editor.page" />
              {!editorPage.trim() ? <div className="mt-1 text-xs text-danger">{t("admin.help_boxes.validation.page")}</div> : null}
            </div>
            <div>
              <div className="text-xs text-faint">{t("admin.help_boxes.field.action")}</div>
              <Input value={editorAction} onChange={(e) => setEditorAction(e.target.value)} testId="admin.help_boxes.editor.action" />
              {!editorAction.trim() ? <div className="mt-1 text-xs text-danger">{t("admin.help_boxes.validation.action")}</div> : null}
            </div>
            <div>
              <div className="text-xs text-faint">{t("admin.help_boxes.field.language")}</div>
              <Select value={editorLanguage} onChange={(e) => setEditorLanguage(e.target.value)} testId="admin.help_boxes.editor.language">
                <option value="">{t("common.default")}</option>
                {languages.map((l) => (
                  <option key={l.id} value={String(l.id)}>
                    {String(l.label ?? l.code ?? l.id)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="text-xs text-faint">{t("admin.help_boxes.field.order")}</div>
              <Input value={editorOrder} onChange={(e) => setEditorOrder(e.target.value)} testId="admin.help_boxes.editor.order" />
              {editorOrderParsed === null ? <div className="mt-1 text-xs text-danger">{t("admin.help_boxes.validation.order")}</div> : null}
            </div>
          </div>
          <div>
            <div className="text-xs text-faint">{t("admin.help_boxes.field.content")}</div>
            <div className="mt-1">
              <Textarea value={editorContent} onChange={(e) => setEditorContent(e.target.value)} rows={10} testId="admin.help_boxes.editor.content" />
            </div>
            {!editorContent.trim() ? <div className="mt-1 text-xs text-danger">{t("admin.help_boxes.validation.content")}</div> : null}
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={deleteOpen}
        title={t("admin.help_boxes.delete.title")}
        description={t("admin.help_boxes.delete.body")}
        danger
        confirmLabel={t("common.delete")}
        confirmLoading={delM.isPending}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={() => delM.mutate()}
        testId="admin.help_boxes.delete_confirm"
      >
        {deleteTarget ? (
          <div className="rounded-md border border-border bg-surface p-3 text-sm">
            <div className="font-semibold">#{deleteTarget.id}</div>
            <div className="mt-1 text-muted">{snippet(deleteTarget.content, 220) || t("common.na")}</div>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

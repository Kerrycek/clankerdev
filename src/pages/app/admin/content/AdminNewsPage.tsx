import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';

import { Alert } from '../../../../components/ui/Alert';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';
import { Spinner } from '../../../../components/ui/Spinner';
import { TableCard } from '../../../../components/ui/TableCard';
import { Textarea } from '../../../../components/ui/Textarea';

import { createNewsLog, deleteNewsLog, fetchNewsLogs, updateNewsLog, type NewsLog } from '../../../../lib/api/newslog';
import { isoToLocalInput, localInputToIso } from '../../../../lib/datetimeLocal';
import { formatErrorMessage } from '../../../../lib/errors';
import { formatDateTime } from '../../../../lib/format';

function isFuture(iso?: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
}

function snippet(s: string | undefined | null, limit = 140): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= limit) return t;
  return `${t.slice(0, limit - 1)}…`;
}

export function AdminNewsPage() {
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [sinceLocal, setSinceLocal] = useState('');

  const sinceParsed = useMemo(() => localInputToIso(sinceLocal), [sinceLocal]);
  const sinceParam = sinceParsed.valid ? sinceParsed.iso ?? undefined : undefined;

  const q = useQuery({
    queryKey: ['news_logs', { since: sinceParam ?? null }],
    queryFn: async () => (await fetchNewsLogs({ since: sinceParam })).data,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(() => {
    const base = q.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return base;
    return base.filter((n) => String(n.message ?? '').toLowerCase().includes(term));
  }, [q.data, search]);

  // -----------------
  // Create / Edit UI
  // -----------------

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editorTarget, setEditorTarget] = useState<NewsLog | null>(null);
  const [editorPublishedLocal, setEditorPublishedLocal] = useState('');
  const [editorMessage, setEditorMessage] = useState('');
  const [editorError, setEditorError] = useState<string | null>(null);

  const openCreate = () => {
    setEditorMode('create');
    setEditorTarget(null);
    setEditorError(null);
    setEditorMessage('');
    setEditorPublishedLocal(isoToLocalInput(new Date().toISOString()));
    setEditorOpen(true);
  };

  const openEdit = (n: NewsLog) => {
    setEditorMode('edit');
    setEditorTarget(n);
    setEditorError(null);
    setEditorMessage(String(n.message ?? ''));
    setEditorPublishedLocal(isoToLocalInput(String(n.published_at ?? '')));
    setEditorOpen(true);
  };

  const editorPublishedParsed = useMemo(() => localInputToIso(editorPublishedLocal), [editorPublishedLocal]);
  const editorValid = editorMessage.trim().length > 0 && editorPublishedParsed.valid && Boolean(editorPublishedParsed.iso);

  const saveM = useMutation({
    mutationFn: async () => {
      const pub = editorPublishedParsed;
      if (!pub.valid || !pub.iso) throw new Error(t('admin.newslog.validation.published_at'));
      if (!editorMessage.trim()) throw new Error(t('admin.newslog.validation.message'));

      if (editorMode === 'create') {
        await createNewsLog({ message: editorMessage.trim(), published_at: pub.iso });
      } else {
        if (!editorTarget) throw new Error('Missing target');
        await updateNewsLog(editorTarget.id, { message: editorMessage.trim(), published_at: pub.iso });
      }
    },
    onSuccess: () => {
      pushToast({ variant: 'ok', title: t('admin.newslog.toast.saved') });
      setEditorOpen(false);
      setEditorError(null);
      qc.invalidateQueries({ queryKey: ['news_logs'] });
    },
    onError: (e) => {
      const msg = formatErrorMessage(e);
      setEditorError(msg);
      pushToast({ variant: 'danger', title: t('common.error'), body: msg });
    },
  });

  // -----------------
  // Delete
  // -----------------

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NewsLog | null>(null);

  const delM = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      await deleteNewsLog(deleteTarget.id);
    },
    onSuccess: () => {
      pushToast({ variant: 'ok', title: t('admin.newslog.toast.deleted') });
      setDeleteOpen(false);
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['news_logs'] });
    },
    onError: (e) => {
      const msg = formatErrorMessage(e);
      pushToast({ variant: 'danger', title: t('common.error'), body: msg });
    },
  });

  return (
    <div className="space-y-4" data-testid="admin.newslog.page">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-xs text-faint">{t('admin.newslog.filter.search')}</div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.newslog.filter.search_placeholder')}
              testId="admin.newslog.filter.search"
            />
          </div>

          <div>
            <div className="text-xs text-faint">{t('admin.newslog.filter.since')}</div>
            <Input
              type="datetime-local"
              value={sinceLocal}
              onChange={(e) => setSinceLocal(e.target.value)}
              testId="admin.newslog.filter.since"
            />
            {!sinceParsed.valid ? <div className="mt-1 text-xs text-danger">{t('admin.newslog.validation.since')}</div> : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="primary" onClick={openCreate} testId="admin.newslog.create">
            {t('admin.newslog.action.create')}
          </Button>
        </div>
      </div>

      {q.isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner />
        </div>
      ) : q.error ? (
        <Alert variant="danger" title={t('common.error')}>
          {formatErrorMessage(q.error)}
        </Alert>
      ) : rows.length === 0 ? (
        <Alert variant="neutral" title={t('admin.newslog.empty.title')}>
          {t('admin.newslog.empty.body')}
        </Alert>
      ) : (
        <TableCard testId="admin.newslog.table">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-faint">{t('admin.newslog.table.published_at')}</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-faint">{t('admin.newslog.table.status')}</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-faint">{t('admin.newslog.table.message')}</th>
              <th className="px-4 py-2 text-right text-xs font-semibold text-faint">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => {
              const scheduled = isFuture(n.published_at ?? null);
              return (
                <tr key={n.id} className="table-row-tone">
                  <td className="px-4 py-2 text-xs text-muted">{formatDateTime(String(n.published_at ?? ''))}</td>
                  <td className="px-4 py-2">
                    {scheduled ? (
                      <Badge variant="info">{t('admin.newslog.status.scheduled')}</Badge>
                    ) : (
                      <Badge variant="neutral">{t('admin.newslog.status.published')}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-sm font-medium text-fg">{snippet(n.message)}</div>
                    <div className="mt-0.5 text-xs text-faint">#{n.id}</div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(n)} testId={`admin.newslog.edit.${n.id}`}>
                        {t('admin.newslog.action.edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setDeleteTarget(n);
                          setDeleteOpen(true);
                        }}
                        testId={`admin.newslog.delete.${n.id}`}
                      >
                        {t('admin.newslog.action.delete')}
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
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editorMode === 'create' ? t('admin.newslog.modal.create.title') : t('admin.newslog.modal.edit.title')}
        size="lg"
        testId="admin.newslog.editor"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditorOpen(false)} disabled={saveM.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => saveM.mutate()}
              loading={saveM.isPending}
              disabled={!editorValid}
              testId="admin.newslog.editor.save"
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {editorError ? (
            <Alert variant="danger" title={t('common.error')}>
              {editorError}
            </Alert>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs text-faint">{t('admin.newslog.field.published_at')}</div>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="datetime-local"
                  value={editorPublishedLocal}
                  onChange={(e) => setEditorPublishedLocal(e.target.value)}
                  testId="admin.newslog.editor.published_at"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setEditorPublishedLocal(isoToLocalInput(new Date().toISOString()))}
                  testId="admin.newslog.editor.set_now"
                >
                  {t('admin.newslog.action.set_now')}
                </Button>
              </div>
              {!editorPublishedParsed.valid ? (
                <div className="mt-1 text-xs text-danger">{t('admin.newslog.validation.published_at')}</div>
              ) : null}
            </div>

            <div>
              <div className="text-xs text-faint">{t('admin.newslog.field.status')}</div>
              <div className="mt-2">
                {isFuture(editorPublishedParsed.iso) ? (
                  <Badge variant="info">{t('admin.newslog.status.scheduled')}</Badge>
                ) : (
                  <Badge variant="neutral">{t('admin.newslog.status.published')}</Badge>
                )}
              </div>
              <div className="mt-2 text-xs text-faint">{t('admin.newslog.status_hint')}</div>
            </div>
          </div>

          <div>
            <div className="text-xs text-faint">{t('admin.newslog.field.message')}</div>
            <div className="mt-1">
              <Textarea
                value={editorMessage}
                onChange={(e) => setEditorMessage(e.target.value)}
                rows={6}
                testId="admin.newslog.editor.message"
              />
            </div>
            {!editorMessage.trim() ? <div className="mt-1 text-xs text-danger">{t('admin.newslog.validation.message')}</div> : null}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title={t('admin.newslog.delete.title')}
        description={t('admin.newslog.delete.body')}
        danger
        confirmLabel={t('common.delete')}
        confirmLoading={delM.isPending}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={() => delM.mutate()}
        testId="admin.newslog.delete_confirm"
      >
        {deleteTarget ? (
          <div className="rounded-md border border-border bg-surface p-3 text-sm">
            <div className="font-semibold">#{deleteTarget.id}</div>
            <div className="mt-1 text-muted">{snippet(deleteTarget.message, 220) || t('common.na')}</div>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

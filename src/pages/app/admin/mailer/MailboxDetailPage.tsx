import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppMode } from '../../../../app/appMode';
import { useI18n } from '../../../../app/i18n';
import { useToasts } from '../../../../app/toasts';

import {
  createMailboxHandler,
  deleteMailbox,
  deleteMailboxHandler,
  fetchMailbox,
  fetchMailboxHandlers,
  updateMailbox,
  updateMailboxHandler,
  type Mailbox,
  type MailboxHandler,
} from '../../../../lib/api/mailer';
import { formatDateTime } from '../../../../lib/format';
import { formatErrorMessage } from '../../../../lib/errors';

import { DetailShell } from '../../../../components/layout/DetailShell';

import { Alert } from '../../../../components/ui/Alert';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { Input } from '../../../../components/ui/Input';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Modal } from '../../../../components/ui/Modal';
import { ObjectHeader } from '../../../../components/ui/ObjectHeader';
import { TableCard } from '../../../../components/ui/TableCard';
import { clsx } from '../../../../components/ui/clsx';

import { MailerTabs } from './MailerTabs';

function parsePositiveInt(v: string | undefined): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sortedHandlers(list: MailboxHandler[]): MailboxHandler[] {
  return [...list].sort((a: any, b: any) => {
    const ao = Number(a.order ?? 0);
    const bo = Number(b.order ?? 0);
    if (ao !== bo) return ao - bo;
    return Number(a.id ?? 0) - Number(b.id ?? 0);
  });
}

/**
 * Renumber handlers in the order they are given.
 *
 * IMPORTANT: do not sort here. Reordering is expressed by array order.
 */
function normalizeHandlerOrders(list: MailboxHandler[]): Array<MailboxHandler & { order: number }> {
  return list.map((h, i) => ({ ...(h as any), order: i + 1 }));
}

const KNOWN_HANDLER_SUGGESTIONS: Array<{ class_name: string; labelKey: string }> = [
  { class_name: 'VpsAdmin::API::IncidentReports::Handler', labelKey: 'mailer.mailboxes.handlers.known.incident_reports' },
];

export function MailboxDetailPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const { pushToast } = useToasts();
  const qc = useQueryClient();
  const nav = useNavigate();

  const { mailboxId } = useParams();
  const id = useMemo(() => parsePositiveInt(mailboxId), [mailboxId]);

  const mailboxQ = useQuery({
    queryKey: ['mailer', 'mailboxes', 'show', { id }],
    enabled: id !== null,
    queryFn: async () => (await fetchMailbox(id as number)).data,
    staleTime: 15_000,
  });

  const handlersQ = useQuery({
    queryKey: ['mailer', 'mailboxes', 'handlers', 'index', { id, limit: 500 }],
    enabled: id !== null,
    queryFn: async () => (await fetchMailboxHandlers(id as number, { limit: 500 })).data,
    staleTime: 10_000,
  });

  const mailbox: Mailbox | null = (mailboxQ.data as any) ?? null;
  const label = String((mailbox as any)?.label ?? (id ? `#${id}` : ''));
  const server = String((mailbox as any)?.server ?? '');
  const port = Number((mailbox as any)?.port ?? 0);
  const user = String((mailbox as any)?.user ?? '');
  const ssl = Boolean((mailbox as any)?.enable_ssl);
  const createdAt = (mailbox as any)?.created_at;
  const updatedAt = (mailbox as any)?.updated_at;

  const handlersRaw: MailboxHandler[] = (handlersQ.data as any) ?? [];
  const handlers = useMemo(() => sortedHandlers(handlersRaw), [handlersRaw]);

  // --- Edit mailbox modal ---
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    label: '',
    server: '',
    port: '993',
    user: '',
    password: '',
    enable_ssl: true,
  });

  useEffect(() => {
    if (!mailbox) return;
    setEditForm({
      label: String((mailbox as any).label ?? ''),
      server: String((mailbox as any).server ?? ''),
      port: String((mailbox as any).port ?? 993),
      user: String((mailbox as any).user ?? ''),
      password: '',
      enable_ssl: Boolean((mailbox as any).enable_ssl),
    });
  }, [mailbox]);

  const canSaveMailbox = useMemo(() => {
    const l = editForm.label.trim();
    const s = editForm.server.trim();
    const u = editForm.user.trim();
    const p = parsePositiveInt(editForm.port.trim());
    return Boolean(l && s && u && p);
  }, [editForm]);

  const updateMailboxM = useMutation({
    mutationFn: async () => {
      if (id === null) throw new Error('invalid mailbox id');
      const portN = parsePositiveInt(editForm.port.trim());
      if (!portN) throw new Error('invalid port');

      return (
        await updateMailbox(id, {
          label: editForm.label.trim(),
          server: editForm.server.trim(),
          port: portN,
          user: editForm.user.trim(),
          password: editForm.password,
          enable_ssl: editForm.enable_ssl,
        })
      ).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mailboxes'] });
      setEditOpen(false);
      pushToast({ variant: 'ok', title: t('mailer.mailboxes.update_success') });
    },
    onError: (err: any) => {
      pushToast({
        variant: 'danger',
        title: t('mailer.mailboxes.update_error'),
        body: formatErrorMessage(err),
      });
    },
  });

  // --- Delete mailbox ---
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const deleteMailboxM = useMutation({
    mutationFn: async () => {
      if (id === null) throw new Error('invalid mailbox id');
      return await deleteMailbox(id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mailboxes'] });
      pushToast({ variant: 'ok', title: t('mailer.mailboxes.delete_success') });
      nav(`${basePath}/mailer/mailboxes`);
    },
    onError: (err: any) => {
      pushToast({
        variant: 'danger',
        title: t('mailer.mailboxes.delete_error'),
        body: formatErrorMessage(err),
      });
    },
  });

  const deleteMailboxDisabled = deleteConfirm.trim() !== label;

  // --- Handler editor modal ---
  const [handlerModalOpen, setHandlerModalOpen] = useState(false);
  const [editingHandler, setEditingHandler] = useState<MailboxHandler | null>(null);
  const [handlerForm, setHandlerForm] = useState({ class_name: '', order: '1', continue: false });

  const openAddHandler = () => {
    const nextOrder = handlers.length ? Number((handlers[handlers.length - 1] as any).order ?? handlers.length) + 1 : 1;
    setEditingHandler(null);
    setHandlerForm({ class_name: '', order: String(nextOrder), continue: false });
    setHandlerModalOpen(true);
  };

  const openEditHandler = (h: MailboxHandler) => {
    setEditingHandler(h);
    setHandlerForm({
      class_name: String((h as any).class_name ?? ''),
      order: String((h as any).order ?? 1),
      continue: Boolean((h as any).continue),
    });
    setHandlerModalOpen(true);
  };

  const canSaveHandler = useMemo(() => {
    const cn = handlerForm.class_name.trim();
    const ord = parsePositiveInt(handlerForm.order.trim());
    return Boolean(cn && ord);
  }, [handlerForm]);

  const createHandlerM = useMutation({
    mutationFn: async () => {
      if (id === null) throw new Error('invalid mailbox id');
      const cn = handlerForm.class_name.trim();
      const ord = parsePositiveInt(handlerForm.order.trim());
      if (!cn || !ord) throw new Error('invalid handler');
      return (
        await createMailboxHandler(id, {
          class_name: cn,
          order: ord,
          continue: handlerForm.continue,
        })
      ).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mailboxes', 'handlers'] });
      setHandlerModalOpen(false);
      pushToast({ variant: 'ok', title: t('mailer.mailboxes.handlers.create_success') });
    },
    onError: (err: any) => {
      pushToast({
        variant: 'danger',
        title: t('mailer.mailboxes.handlers.create_error'),
        body: formatErrorMessage(err),
      });
    },
  });

  const updateHandlerM = useMutation({
    mutationFn: async () => {
      if (id === null) throw new Error('invalid mailbox id');
      if (!editingHandler) throw new Error('no handler');
      const handlerId = Number((editingHandler as any).id);
      const cn = handlerForm.class_name.trim();
      const ord = parsePositiveInt(handlerForm.order.trim());
      if (!handlerId || !cn || !ord) throw new Error('invalid handler');
      return (
        await updateMailboxHandler(id, handlerId, {
          class_name: cn,
          order: ord,
          continue: handlerForm.continue,
        })
      ).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mailboxes', 'handlers'] });
      setHandlerModalOpen(false);
      setEditingHandler(null);
      pushToast({ variant: 'ok', title: t('mailer.mailboxes.handlers.update_success') });
    },
    onError: (err: any) => {
      pushToast({
        variant: 'danger',
        title: t('mailer.mailboxes.handlers.update_error'),
        body: formatErrorMessage(err),
      });
    },
  });

  const [deleteHandler, setDeleteHandler] = useState<MailboxHandler | null>(null);

  const deleteHandlerM = useMutation({
    mutationFn: async () => {
      if (id === null) throw new Error('invalid mailbox id');
      if (!deleteHandler) throw new Error('no handler');
      const handlerId = Number((deleteHandler as any).id);
      return await deleteMailboxHandler(id, handlerId);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mailboxes', 'handlers'] });
      setDeleteHandler(null);
      pushToast({ variant: 'ok', title: t('mailer.mailboxes.handlers.delete_success') });
    },
    onError: (err: any) => {
      pushToast({
        variant: 'danger',
        title: t('mailer.mailboxes.handlers.delete_error'),
        body: formatErrorMessage(err),
      });
    },
  });

  const reorderHandlersM = useMutation({
    mutationFn: async (next: MailboxHandler[]) => {
      if (id === null) throw new Error('invalid mailbox id');
      const normalized = normalizeHandlerOrders(next);

      // Update only changed items.
      const current = new Map<number, number>();
      for (const h of handlers) {
        current.set(Number((h as any).id), Number((h as any).order ?? 0));
      }

      for (const h of normalized) {
        const handlerId = Number((h as any).id);
        const want = Number((h as any).order);
        if (!handlerId) continue;
        const have = current.get(handlerId) ?? 0;
        if (have === want) continue;
        await updateMailboxHandler(id, handlerId, { order: want });
      }

      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mailboxes', 'handlers'] });
      pushToast({ variant: 'ok', title: t('mailer.mailboxes.handlers.reorder_success') });
    },
    onError: (err: any) => {
      pushToast({
        variant: 'danger',
        title: t('mailer.mailboxes.handlers.reorder_error'),
        body: formatErrorMessage(err),
      });
    },
  });

  const moveHandler = (handlerId: number, dir: -1 | 1) => {
    const idx = handlers.findIndex((h: any) => Number(h.id) === handlerId);
    if (idx < 0) return;
    const to = idx + dir;
    if (to < 0 || to >= handlers.length) return;
    const next = [...handlers];
    const fromHandler = next[idx];
    const toHandler = next[to];
    if (!fromHandler || !toHandler) return;
    next[idx] = toHandler;
    next[to] = fromHandler;
    reorderHandlersM.mutate(next);
  };

  if (id === null) {
    return (
      <DetailShell testId="admin.mailer.mailboxes.detail.invalid">
        <ErrorState
          testId="admin.mailer.mailboxes.detail.invalid_state"
          title={t('mailer.mailboxes.detail.invalid_title')}
          body={t('mailer.mailboxes.detail.invalid_body')}
          error={new Error('invalid mailbox id')}
          onRetry={() => nav(`${basePath}/mailer/mailboxes`)}
        />
      </DetailShell>
    );
  }

  if (mailboxQ.isLoading) return <LoadingState testId="admin.mailer.mailboxes.detail.loading" />;
  if (mailboxQ.isError) {
    return (
      <DetailShell testId="admin.mailer.mailboxes.detail.error">
        <ErrorState
          testId="admin.mailer.mailboxes.detail.error_state"
          title={t('mailer.mailboxes.detail.load_error')}
          error={mailboxQ.error}
          onRetry={() => void mailboxQ.refetch()}
          detailsExtra={{ page: 'admin.mailer.mailboxes.detail' }}
        />
      </DetailShell>
    );
  }

  return (
    <DetailShell testId="admin.mailer.mailboxes.detail">
      <ObjectHeader
        testId="admin.mailer.mailboxes.detail.header"
        kicker={
          <span className="flex items-center gap-2">
            <Link to={`${basePath}/mailer/mailboxes`} className="hover:underline">
              {t('mailer.tabs.mailboxes')}
            </Link>
            <span className="text-faint">/</span>
            <span className="text-faint">#{id}</span>
          </span>
        }
        title={label}
        meta={
          <span className="font-mono text-xs">
            {server}
            {port ? `:${port}` : ''}
          </span>
        }
        badges={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={ssl ? 'ok' : 'warn'}>{ssl ? t('mailer.mailboxes.ssl.on') : t('mailer.mailboxes.ssl.off')}</Badge>
          </div>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)} testId="admin.mailer.mailboxes.detail.edit">
              {t('common.edit')}
            </Button>
            <Button variant="danger" onClick={() => setDeleteOpen(true)} testId="admin.mailer.mailboxes.detail.delete">
              {t('common.delete')}
            </Button>
          </>
        }
        tabs={<MailerTabs />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4" data-testid="admin.mailer.mailboxes.detail.connection">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{t('mailer.mailboxes.detail.connection.title')}</div>
              <div className="mt-1 text-xs text-muted">{t('mailer.mailboxes.detail.connection.description')}</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-muted">{t('mailer.mailboxes.fields.user')}</div>
              <div className="mt-1 font-mono text-xs text-muted">{user || t('common.na')}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted">{t('mailer.mailboxes.fields.password')}</div>
              <div className="mt-1 text-xs text-muted">••••••</div>
              <div className="mt-1 text-xs text-faint">{t('mailer.mailboxes.password.hidden')}</div>
            </div>

            <div>
              <div className="text-xs font-semibold text-muted">{t('mailer.mailboxes.fields.enable_ssl')}</div>
              <div className="mt-1">
                <Badge variant={ssl ? 'ok' : 'warn'}>{ssl ? t('mailer.mailboxes.ssl.on') : t('mailer.mailboxes.ssl.off')}</Badge>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted">{t('common.updated')}</div>
              <div className="mt-1 text-xs text-muted">{updatedAt ? formatDateTime(String(updatedAt)) : t('common.na')}</div>
              <div className="mt-1 text-xs text-faint">
                {createdAt ? `${t('common.created')}: ${formatDateTime(String(createdAt))}` : t('common.na')}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4" data-testid="admin.mailer.mailboxes.detail.handlers">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{t('mailer.mailboxes.detail.handlers.title')}</div>
              <div className="mt-1 text-xs text-muted">{t('mailer.mailboxes.detail.handlers.description')}</div>
            </div>
            <Button variant="primary" size="sm" onClick={openAddHandler} testId="admin.mailer.mailboxes.detail.handlers.add">
              {t('mailer.mailboxes.handlers.create')}
            </Button>
          </div>

          {handlersQ.isLoading ? (
            <div className="mt-4">
              <LoadingState testId="admin.mailer.mailboxes.detail.handlers.loading" />
            </div>
          ) : handlersQ.isError ? (
            <div className="mt-4">
              <ErrorState
                testId="admin.mailer.mailboxes.detail.handlers.error"
                title={t('mailer.mailboxes.handlers.list.load_error')}
                error={handlersQ.error}
                onRetry={() => void handlersQ.refetch()}
                detailsExtra={{ page: 'admin.mailer.mailboxes.handlers.list' }}
              />
            </div>
          ) : handlers.length === 0 ? (
            <div className="mt-4">
              <Alert variant="neutral" title={t('mailer.mailboxes.handlers.empty.title')}>
                {t('mailer.mailboxes.handlers.empty.body')}
              </Alert>
            </div>
          ) : (
            <div className="mt-4">
              <TableCard testId="admin.mailer.mailboxes.detail.handlers.table" minWidth="full" variant="plain">
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-muted">{t('mailer.mailboxes.handlers.fields.order')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-muted">{t('mailer.mailboxes.handlers.fields.class_name')}</th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-muted">{t('mailer.mailboxes.handlers.fields.continue')}</th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-muted">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {handlers.map((h, idx) => {
                    const hid = Number((h as any).id);
                    const order = Number((h as any).order ?? 0);
                    const cn = String((h as any).class_name ?? '');
                    const cont = Boolean((h as any).continue);
                    const busy = reorderHandlersM.isPending;
                    const isFirst = idx === 0;
                    const isLast = idx === handlers.length - 1;

                    return (
                      <tr key={hid} data-testid={`admin.mailer.mailboxes.handler.${hid}`}>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{order}</span>
                            <div className="flex items-center gap-1" data-row-no-nav>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={busy || isFirst}
                                onClick={() => moveHandler(hid, -1)}
                                title={t('common.move_up')}
                                ariaLabel={t('common.move_up')}
                                testId={`admin.mailer.mailboxes.handler.${hid}.up`}
                              >
                                ↑
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={busy || isLast}
                                onClick={() => moveHandler(hid, 1)}
                                title={t('common.move_down')}
                                ariaLabel={t('common.move_down')}
                                testId={`admin.mailer.mailboxes.handler.${hid}.down`}
                              >
                                ↓
                              </Button>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <span className="font-mono text-xs text-muted">{cn || t('common.na')}</span>
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant={cont ? 'info' : 'neutral'}>
                            {cont ? t('mailer.mailboxes.handlers.continue.yes') : t('mailer.mailboxes.handlers.continue.no')}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-right" data-row-no-nav>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openEditHandler(h)}
                              testId={`admin.mailer.mailboxes.handler.${hid}.edit`}
                            >
                              {t('common.edit')}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setDeleteHandler(h)}
                              testId={`admin.mailer.mailboxes.handler.${hid}.delete`}
                            >
                              {t('common.delete')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableCard>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={t('mailer.mailboxes.edit.title')}
        testId="admin.mailer.mailboxes.edit.modal"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={updateMailboxM.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => updateMailboxM.mutate()}
              loading={updateMailboxM.isPending}
              disabled={!canSaveMailbox}
              testId="admin.mailer.mailboxes.edit.modal.save"
            >
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <div>
            <div className="text-xs font-semibold text-muted">{t('mailer.mailboxes.fields.label')}</div>
            <div className="mt-1">
              <Input
                value={editForm.label}
                onChange={(e) => setEditForm((p) => ({ ...p, label: e.target.value }))}
                placeholder={t('mailer.mailboxes.placeholders.label')}
                autoComplete="off"
                testId="admin.mailer.mailboxes.edit.label"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <div className="text-xs font-semibold text-muted">{t('mailer.mailboxes.fields.server')}</div>
              <div className="mt-1">
                <Input
                  value={editForm.server}
                  onChange={(e) => setEditForm((p) => ({ ...p, server: e.target.value }))}
                  placeholder={t('mailer.mailboxes.placeholders.server')}
                  autoComplete="off"
                  testId="admin.mailer.mailboxes.edit.server"
                />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted">{t('mailer.mailboxes.fields.port')}</div>
              <div className="mt-1">
                <Input
                  value={editForm.port}
                  onChange={(e) => setEditForm((p) => ({ ...p, port: e.target.value }))}
                  placeholder="993"
                  autoComplete="off"
                  testId="admin.mailer.mailboxes.edit.port"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-muted">{t('mailer.mailboxes.fields.user')}</div>
              <div className="mt-1">
                <Input
                  value={editForm.user}
                  onChange={(e) => setEditForm((p) => ({ ...p, user: e.target.value }))}
                  placeholder={t('mailer.mailboxes.placeholders.user')}
                  autoComplete="off"
                  testId="admin.mailer.mailboxes.edit.user"
                />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted">{t('mailer.mailboxes.fields.password')}</div>
              <div className="mt-1">
                <Input
                  value={editForm.password}
                  onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder={t('mailer.mailboxes.password.change_placeholder')}
                  autoComplete="new-password"
                  type="password"
                  testId="admin.mailer.mailboxes.edit.password"
                />
                <div className="mt-1 text-xs text-faint">{t('mailer.mailboxes.password.hidden')}</div>
              </div>
            </div>
          </div>

          <Checkbox
            checked={editForm.enable_ssl}
            onChange={(checked) => setEditForm((p) => ({ ...p, enable_ssl: checked }))}
            label={t('mailer.mailboxes.enable_ssl.label')}
            description={t('mailer.mailboxes.enable_ssl.description')}
            testId="admin.mailer.mailboxes.edit.enable_ssl"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteConfirm('');
        }}
        onConfirm={() => deleteMailboxM.mutate()}
        danger
        title={t('mailer.mailboxes.delete_confirm.title')}
        description={t('mailer.mailboxes.delete_confirm.description')}
        confirmLabel={t('common.delete')}
        confirmLoading={deleteMailboxM.isPending}
        confirmDisabled={deleteMailboxDisabled}
        testId="admin.mailer.mailboxes.delete_confirm"
      >
        <div className="mt-2">
          <div className="text-xs font-semibold text-muted">{t('mailer.mailboxes.delete_confirm.hint')}</div>
          <div className="mt-1">
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={label}
              autoComplete="off"
              testId="admin.mailer.mailboxes.delete_confirm.input"
            />
          </div>
        </div>
      </ConfirmDialog>

      <Modal
        open={handlerModalOpen}
        onClose={() => {
          setHandlerModalOpen(false);
          setEditingHandler(null);
        }}
        title={editingHandler ? t('mailer.mailboxes.handlers.edit.title') : t('mailer.mailboxes.handlers.create.title')}
        testId="admin.mailer.mailboxes.handler.modal"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setHandlerModalOpen(false);
                setEditingHandler(null);
              }}
              disabled={createHandlerM.isPending || updateHandlerM.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (editingHandler) updateHandlerM.mutate();
                else createHandlerM.mutate();
              }}
              loading={createHandlerM.isPending || updateHandlerM.isPending}
              disabled={!canSaveHandler}
              testId="admin.mailer.mailboxes.handler.modal.save"
            >
              {editingHandler ? t('common.save') : t('common.create')}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <div>
            <div className="text-xs font-semibold text-muted">{t('mailer.mailboxes.handlers.fields.class_name')}</div>
            <div className="mt-1">
              <Input
                value={handlerForm.class_name}
                onChange={(e) => setHandlerForm((p) => ({ ...p, class_name: e.target.value }))}
                placeholder={t('mailer.mailboxes.handlers.placeholders.class_name')}
                autoComplete="off"
                testId="admin.mailer.mailboxes.handler.modal.class_name"
              />
            </div>
            <div className={clsx('mt-2 flex flex-wrap items-center gap-2')}>
              <span className="text-xs text-faint">{t('mailer.mailboxes.handlers.known.title')}</span>
              {KNOWN_HANDLER_SUGGESTIONS.map((s) => (
                <Button
                  key={s.class_name}
                  size="sm"
                  variant="secondary"
                  onClick={() => setHandlerForm((p) => ({ ...p, class_name: s.class_name }))}
                  testId={`admin.mailer.mailboxes.handler.modal.suggest.${s.class_name}`}
                >
                  {t(s.labelKey)}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-muted">{t('mailer.mailboxes.handlers.fields.order')}</div>
              <div className="mt-1">
                <Input
                  value={handlerForm.order}
                  onChange={(e) => setHandlerForm((p) => ({ ...p, order: e.target.value }))}
                  placeholder="1"
                  autoComplete="off"
                  testId="admin.mailer.mailboxes.handler.modal.order"
                />
              </div>
            </div>
            <div>
              <Checkbox
                checked={handlerForm.continue}
                onChange={(checked) => setHandlerForm((p) => ({ ...p, continue: checked }))}
                label={t('mailer.mailboxes.handlers.continue.checkbox_label')}
                description={t('mailer.mailboxes.handlers.continue.checkbox_description')}
                testId="admin.mailer.mailboxes.handler.modal.continue"
              />
            </div>
          </div>

          <Alert variant="warn" title={t('mailer.mailboxes.handlers.safety.title')}>
            {t('mailer.mailboxes.handlers.safety.body')}
          </Alert>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteHandler)}
        onCancel={() => setDeleteHandler(null)}
        onConfirm={() => deleteHandlerM.mutate()}
        danger
        title={t('mailer.mailboxes.handlers.delete_confirm.title')}
        description={t('mailer.mailboxes.handlers.delete_confirm.description')}
        confirmLabel={t('common.delete')}
        confirmLoading={deleteHandlerM.isPending}
        testId="admin.mailer.mailboxes.handlers.delete_confirm"
      />
    </DetailShell>
  );
}

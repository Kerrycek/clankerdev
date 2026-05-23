import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppMode } from '../../../../app/appMode';
import { useI18n } from '../../../../app/i18n';

import {
  addMailTemplateRecipient,
  createMailRecipient,
  createMailTemplateTranslation,
  deleteMailTemplateRecipient,
  fetchMailRecipients,
  fetchMailTemplate,
  fetchMailTemplateRecipients,
  fetchMailTemplateTranslations,
  updateMailTemplate,
  type MailRecipient,
  type MailTemplateRecipient,
  type MailTemplateTranslation,
} from '../../../../lib/api/mailer';
import { fetchLanguages, type Language } from '../../../../lib/api/languages';
import { formatDateTime } from '../../../../lib/format';
import { resourceId, refLabel } from '../../../../lib/resources';

import { DetailShell } from '../../../../components/layout/DetailShell';

import { Alert } from '../../../../components/ui/Alert';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { Input } from '../../../../components/ui/Input';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { Modal } from '../../../../components/ui/Modal';
import { ObjectHeader } from '../../../../components/ui/ObjectHeader';
import { Select, type SelectOption } from '../../../../components/ui/Select';
import { TableCard } from '../../../../components/ui/TableCard';
import { TableRowLink } from '../../../../components/ui/TableRowLink';
import { Textarea } from '../../../../components/ui/Textarea';

import { MailerTabs } from './MailerTabs';

function parsePositiveInt(v: string | undefined): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function splitCsv(v: unknown): string[] {
  return String(v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function MailTemplateDetailPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { mailTemplateId } = useParams();
  const id = useMemo(() => parsePositiveInt(mailTemplateId), [mailTemplateId]);

  const tplQ = useQuery({
    queryKey: ['mailer', 'mail_templates', 'show', { id }],
    enabled: id !== null,
    queryFn: async () => (await fetchMailTemplate(id as number)).data,
    staleTime: 15_000,
  });

  const recipientsQ = useQuery({
    queryKey: ['mailer', 'mail_templates', 'recipients', 'index', { id, limit: 500 }],
    enabled: id !== null,
    queryFn: async () => (await fetchMailTemplateRecipients(id as number, { limit: 500 })).data,
    staleTime: 10_000,
  });

  const translationsQ = useQuery({
    queryKey: ['mailer', 'mail_templates', 'translations', 'index', { id, limit: 500 }],
    enabled: id !== null,
    queryFn: async () => (await fetchMailTemplateTranslations(id as number, { limit: 500 })).data,
    staleTime: 10_000,
  });

  const [userVisibility, setUserVisibility] = useState<string>('');
  const uvCurrent = String((tplQ.data as any)?.user_visibility ?? '').trim() || 'default';

  useEffect(() => {
    if (!tplQ.data) return;
    setUserVisibility(uvCurrent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tplQ.data]);

  const saveUvM = useMutation({
    mutationFn: async () => {
      if (id === null) throw new Error('invalid template id');
      return (await updateMailTemplate(id, { user_visibility: userVisibility })).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates'] });
    },
  });

  const roles = splitCsv((tplQ.data as any)?.registry_roles);
  const isPublic = Boolean((tplQ.data as any)?.registry_public);

  const associatedRecipientIds = useMemo(() => {
    const ids = new Set<number>();
    for (const r of recipientsQ.data ?? []) {
      const mr = (r as any).mail_recipient;
      const rid = resourceId(mr);
      if (rid) ids.add(rid);
    }
    return ids;
  }, [recipientsQ.data]);

  // --- Add / create recipient modal ---
  const [recipientModalOpen, setRecipientModalOpen] = useState(false);
  const [recipientModalMode, setRecipientModalMode] = useState<'existing' | 'create'>('existing');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);
  const [newRecipient, setNewRecipient] = useState<{ label: string; to: string; cc: string; bcc: string }>({
    label: '',
    to: '',
    cc: '',
    bcc: '',
  });

  const allRecipientsQ = useQuery({
    queryKey: ['mailer', 'mail_recipients', 'index', { limit: 500 }],
    enabled: recipientModalOpen,
    queryFn: async () => (await fetchMailRecipients({ limit: 500 })).data,
    staleTime: 30_000,
  });

  const addRecipientM = useMutation({
    mutationFn: async (mailRecipientId: number) => {
      if (id === null) throw new Error('invalid template id');
      return (await addMailTemplateRecipient(id, mailRecipientId)).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'recipients'] });
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'show'] });
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'index'] });
      setRecipientModalOpen(false);
      setSelectedRecipientId(null);
      setRecipientSearch('');
      setRecipientModalMode('existing');
    },
  });

  const createRecipientM = useMutation({
    mutationFn: async (payload: { label?: string; to?: string; cc?: string; bcc?: string }) =>
      (await createMailRecipient(payload)).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_recipients', 'index'] });
    },
  });

  const [removeRecipientId, setRemoveRecipientId] = useState<number | null>(null);

  const removeRecipientM = useMutation({
    mutationFn: async (mailRecipientId: number) => {
      if (id === null) throw new Error('invalid template id');
      return await deleteMailTemplateRecipient(id, mailRecipientId);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'recipients'] });
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'show'] });
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'index'] });
      setRemoveRecipientId(null);
    },
  });

  // --- Add translation modal (guarded) ---
  const [confirmAddTranslationOpen, setConfirmAddTranslationOpen] = useState(false);
  const [translationModalOpen, setTranslationModalOpen] = useState(false);

  const languagesQ = useQuery({
    queryKey: ['languages', 'index', { limit: 500 }],
    queryFn: async () => (await fetchLanguages({ limit: 500 })).data,
    staleTime: 60_000,
  });

  const languageOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [{ value: '', label: t('common.select') }];
    for (const l of languagesQ.data ?? []) {
      const lid = Number((l as any).id);
      if (!Number.isFinite(lid) || lid <= 0) continue;
      const label = String((l as any).label ?? (l as any).code ?? `#${lid}`);
      opts.push({ value: String(lid), label });
    }
    return opts;
  }, [languagesQ.data, t]);

  const [newTranslation, setNewTranslation] = useState<{
    language: string;
    from: string;
    reply_to: string;
    return_path: string;
    subject: string;
    text_plain: string;
    text_html: string;
  }>({
    language: '',
    from: '',
    reply_to: '',
    return_path: '',
    subject: '',
    text_plain: '',
    text_html: '',
  });

  const createTranslationM = useMutation({
    mutationFn: async (payload: {
      language: number;
      from?: string;
      reply_to?: string;
      return_path?: string;
      subject: string;
      text_plain?: string;
      text_html?: string;
    }) => {
      if (id === null) throw new Error('invalid template id');
      return (await createMailTemplateTranslation(id, payload)).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'translations'] });
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'show'] });
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'index'] });
      setTranslationModalOpen(false);
      setNewTranslation({ language: '', from: '', reply_to: '', return_path: '', subject: '', text_plain: '', text_html: '' });
    },
  });

  const canSaveUv = userVisibility.trim() && userVisibility !== uvCurrent;

  const uvOptions: SelectOption[] = useMemo(
    () => [
      { value: 'default', label: t('mailer.templates.visibility.default') },
      { value: 'visible', label: t('mailer.templates.visibility.visible') },
      { value: 'invisible', label: t('mailer.templates.visibility.invisible') },
    ],
    [t]
  );

  if (id === null) {
    return (
      <DetailShell variant="wide" testId="admin.mailer.templates.detail">
        <MailerTabs />
        <ErrorState
          testId="admin.mailer.templates.detail.invalid"
          title={t('mailer.templates.detail.invalid_title')}
          error={new Error('invalid template id')}
          detailsExtra={{ page: 'admin.mailer.templates.detail' }}
        />
      </DetailShell>
    );
  }

  const tpl = tplQ.data as any;
  const title = String(tpl?.label ?? tpl?.name ?? `#${id}`);

  return (
    <DetailShell variant="wide" testId="admin.mailer.templates.detail">
      <MailerTabs />

      <ObjectHeader
        title={title}
        kicker={
          <Link className="text-accent hover:underline" to={`${basePath}/mailer/templates`}>
            {t('mailer.templates.list.title')}
          </Link>
        }
        meta={<span className="text-xs text-faint">#{id}</span>}
      />

      {tplQ.isLoading ? (
        <LoadingState testId="admin.mailer.templates.detail.loading" />
      ) : tplQ.isError ? (
        <ErrorState
          testId="admin.mailer.templates.detail.error"
          title={t('mailer.templates.detail.load_error')}
          error={tplQ.error}
          onRetry={() => void tplQ.refetch()}
          detailsExtra={{ page: 'admin.mailer.templates.detail' }}
        />
      ) : !tpl ? (
        <ErrorState
          testId="admin.mailer.templates.detail.not_found"
          title={t('mailer.templates.detail.not_found_title')}
          error={new Error('not found')}
          onRetry={() => void tplQ.refetch()}
          detailsExtra={{ page: 'admin.mailer.templates.detail.not_found' }}
        />
      ) : (
        <>
          {/* Summary */}
          <Card>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-muted">{t('mailer.templates.fields.name')}</div>
                <div className="mt-1 text-sm">{String(tpl?.name ?? t('common.na'))}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted">{t('mailer.templates.fields.template_id')}</div>
                <div className="mt-1 text-sm font-mono">{String(tpl?.template_id ?? t('common.na'))}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted">{t('mailer.templates.fields.label')}</div>
                <div className="mt-1 text-sm">{String(tpl?.label ?? t('common.na'))}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted">{t('mailer.templates.fields.updated')}</div>
                <div className="mt-1 text-sm">{formatDateTime(tpl?.updated_at)}</div>
              </div>

              <div className="md:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="w-full sm:w-72">
                    <div className="text-xs font-medium text-muted">{t('mailer.templates.fields.user_visibility')}</div>
                    <div className="mt-1">
                      <Select
                        value={userVisibility}
                        onChange={(e) => setUserVisibility(e.target.value)}
                        options={uvOptions}
                        testId="admin.mailer.templates.detail.visibility.select"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setUserVisibility(uvCurrent);
                      }}
                      disabled={!canSaveUv || saveUvM.isPending}
                      testId="admin.mailer.templates.detail.visibility.reset"
                    >
                      {t('common.reset')}
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => saveUvM.mutate()}
                      loading={saveUvM.isPending}
                      disabled={!canSaveUv}
                      testId="admin.mailer.templates.detail.visibility.save"
                    >
                      {t('common.save')}
                    </Button>
                  </div>
                </div>

                {saveUvM.isError ? (
                  <div className="mt-3">
                    <Alert variant="danger" title={t('mailer.templates.detail.save_visibility_error')}>
                      {String((saveUvM.error as any)?.message ?? saveUvM.error)}
                    </Alert>
                  </div>
                ) : null}
              </div>
            </div>
          </Card>

          {/* Registry metadata */}
          <Card>
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold">{t('mailer.templates.detail.registry.title')}</div>
                {isPublic ? <Badge variant="info">{t('mailer.templates.badge.public')}</Badge> : <Badge variant="neutral">{t('mailer.templates.badge.internal')}</Badge>}
              </div>

              {tpl?.registry_description ? <div className="mt-2 text-sm text-muted">{String(tpl.registry_description)}</div> : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {roles.length ? (
                  roles.map((r) => (
                    <Badge key={r} variant="neutral">
                      {r}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted">{t('common.na')}</span>
                )}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-muted">{t('mailer.templates.detail.registry.vars')}</div>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-border bg-surface p-3 text-xs text-fg">
                    {String(tpl?.registry_vars ?? t('common.na'))}
                  </pre>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted">{t('mailer.templates.detail.registry.params')}</div>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-border bg-surface p-3 text-xs text-fg">
                    {String(tpl?.registry_params ?? t('common.na'))}
                  </pre>
                </div>
              </div>
            </div>
          </Card>

          {/* Recipients */}
          <Card>
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{t('mailer.templates.detail.recipients.title')}</div>
                <div className="text-xs text-muted">{t('mailer.templates.detail.recipients.subtitle')}</div>
              </div>
              <Button
                variant="secondary"
                onClick={() => setRecipientModalOpen(true)}
                testId="admin.mailer.templates.detail.recipients.add"
              >
                {t('mailer.templates.detail.recipients.add')}
              </Button>
            </div>
            <div className="p-4">
              {recipientsQ.isLoading ? (
                <LoadingState testId="admin.mailer.templates.detail.recipients.loading" />
              ) : recipientsQ.isError ? (
                <ErrorState
                  testId="admin.mailer.templates.detail.recipients.error"
                  title={t('mailer.templates.detail.recipients.load_error')}
                  error={recipientsQ.error}
                  onRetry={() => void recipientsQ.refetch()}
                  detailsExtra={{ page: 'admin.mailer.templates.detail.recipients' }}
                />
              ) : (recipientsQ.data ?? []).length === 0 ? (
                <div className="text-sm text-muted">{t('mailer.templates.detail.recipients.empty')}</div>
              ) : (
                <TableCard minWidth="md" tableTestId="admin.mailer.templates.detail.recipients.table">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-2">{t('common.label')}</th>
                      <th className="px-4 py-2">{t('mailer.recipients.fields.to')}</th>
                      <th className="px-4 py-2">{t('mailer.recipients.fields.cc')}</th>
                      <th className="px-4 py-2">{t('mailer.recipients.fields.bcc')}</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(recipientsQ.data ?? []).map((r: MailTemplateRecipient) => {
                      const mr = (r as any).mail_recipient as MailRecipient | undefined;
                      const rid = resourceId(mr);
                      const label = refLabel(mr) ?? (rid ? `#${rid}` : t('common.na'));
                      const to = String((mr as any)?.to ?? '');
                      const cc = String((mr as any)?.cc ?? '');
                      const bcc = String((mr as any)?.bcc ?? '');

                      return (
                        <tr key={rid ?? (r as any).id} className="border-b border-border">
                          <td className="px-4 py-2 text-sm">{label}</td>
                          <td className="max-w-xs truncate px-4 py-2 text-sm" title={to}>
                            {to || <span className="text-muted">{t('common.na')}</span>}
                          </td>
                          <td className="max-w-xs truncate px-4 py-2 text-sm" title={cc}>
                            {cc || <span className="text-muted">{t('common.na')}</span>}
                          </td>
                          <td className="max-w-xs truncate px-4 py-2 text-sm" title={bcc}>
                            {bcc || <span className="text-muted">{t('common.na')}</span>}
                          </td>
                          <td className="px-4 py-2 text-right text-sm">
                            {rid ? (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setRemoveRecipientId(rid)}
                                testId={`admin.mailer.templates.detail.recipients.remove.${rid}`}
                              >
                                {t('common.remove')}
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </TableCard>
              )}
            </div>
          </Card>

          {/* Translations */}
          <Card>
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{t('mailer.templates.detail.translations.title')}</div>
                <div className="text-xs text-muted">{t('mailer.templates.detail.translations.subtitle')}</div>
              </div>
              <Button
                variant="secondary"
                onClick={() => setConfirmAddTranslationOpen(true)}
                testId="admin.mailer.templates.detail.translations.add"
              >
                {t('mailer.templates.detail.translations.add')}
              </Button>
            </div>
            <div className="p-4">
              {translationsQ.isLoading ? (
                <LoadingState testId="admin.mailer.templates.detail.translations.loading" />
              ) : translationsQ.isError ? (
                <ErrorState
                  testId="admin.mailer.templates.detail.translations.error"
                  title={t('mailer.templates.detail.translations.load_error')}
                  error={translationsQ.error}
                  onRetry={() => void translationsQ.refetch()}
                  detailsExtra={{ page: 'admin.mailer.templates.detail.translations' }}
                />
              ) : (translationsQ.data ?? []).length === 0 ? (
                <div className="text-sm text-muted">{t('mailer.templates.detail.translations.empty')}</div>
              ) : (
                <TableCard minWidth="lg" tableTestId="admin.mailer.templates.detail.translations.table">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-4 py-2">{t('mailer.translations.columns.language')}</th>
                      <th className="px-4 py-2">{t('mailer.translations.columns.subject')}</th>
                      <th className="px-4 py-2">{t('common.updated')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(translationsQ.data ?? []).map((tr: MailTemplateTranslation) => {
                      const tid = Number((tr as any).id);
                      const lang = (tr as any).language as Language | undefined;
                      const langLabel = String((lang as any)?.label ?? (lang as any)?.code ?? t('common.na'));
                      const subject = String((tr as any).subject ?? '');

                      return (
                        <TableRowLink
                          key={tid}
                          to={`${basePath}/mailer/templates/${id}/translations/${tid}`}
                          testId={`admin.mailer.templates.detail.translation.${tid}`}
                        >
                          <td className="px-4 py-2 text-sm">{langLabel}</td>
                          <td className="px-4 py-2 text-sm">
                            {subject ? <span title={subject}>{subject}</span> : <span className="text-muted">{t('common.na')}</span>}
                          </td>
                          <td className="px-4 py-2 text-sm">{formatDateTime((tr as any).updated_at)}</td>
                        </TableRowLink>
                      );
                    })}
                  </tbody>
                </TableCard>
              )}
            </div>
          </Card>

          <Button variant="secondary" onClick={() => nav(-1)} testId="admin.mailer.templates.detail.back">
            {t('common.back')}
          </Button>

          {/* Recipient modal */}
          <Modal
            open={recipientModalOpen}
            onClose={() => setRecipientModalOpen(false)}
            title={t('mailer.templates.detail.recipients.add')}
            size="lg"
            testId="admin.mailer.templates.detail.recipients.modal"
            footer={
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted">{t('mailer.templates.detail.recipients.modal.hint')}</div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => setRecipientModalOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  {recipientModalMode === 'existing' ? (
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (selectedRecipientId) addRecipientM.mutate(selectedRecipientId);
                      }}
                      loading={addRecipientM.isPending}
                      disabled={!selectedRecipientId || associatedRecipientIds.has(selectedRecipientId)}
                      testId="admin.mailer.templates.detail.recipients.modal.add"
                    >
                      {t('common.add')}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={async () => {
                        if (id === null) return;
                        const created = await createRecipientM.mutateAsync({
                          label: newRecipient.label.trim() || undefined,
                          to: newRecipient.to.trim() || undefined,
                          cc: newRecipient.cc.trim() || undefined,
                          bcc: newRecipient.bcc.trim() || undefined,
                        });
                        const rid = Number((created as any).id);
                        if (Number.isFinite(rid) && rid > 0) addRecipientM.mutate(rid);
                      }}
                      loading={createRecipientM.isPending || addRecipientM.isPending}
                      disabled={!newRecipient.to.trim() && !newRecipient.cc.trim() && !newRecipient.bcc.trim()}
                      testId="admin.mailer.templates.detail.recipients.modal.create"
                    >
                      {t('mailer.templates.detail.recipients.modal.create_and_add')}
                    </Button>
                  )}
                </div>
              </div>
            }
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                variant={recipientModalMode === 'existing' ? 'primary' : 'secondary'}
                onClick={() => setRecipientModalMode('existing')}
                size="sm"
                testId="admin.mailer.templates.detail.recipients.modal.mode.existing"
              >
                {t('mailer.templates.detail.recipients.modal.mode.existing')}
              </Button>
              <Button
                variant={recipientModalMode === 'create' ? 'primary' : 'secondary'}
                onClick={() => setRecipientModalMode('create')}
                size="sm"
                testId="admin.mailer.templates.detail.recipients.modal.mode.create"
              >
                {t('mailer.templates.detail.recipients.modal.mode.create')}
              </Button>
            </div>

            {recipientModalMode === 'existing' ? (
              <>
                <div className="mb-3">
                  <Input
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder={t('mailer.templates.detail.recipients.modal.search')}
                    testId="admin.mailer.templates.detail.recipients.modal.search"
                  />
                </div>

                {allRecipientsQ.isLoading ? (
                  <LoadingState testId="admin.mailer.templates.detail.recipients.modal.loading" />
                ) : allRecipientsQ.isError ? (
                  <ErrorState
                    testId="admin.mailer.templates.detail.recipients.modal.error"
                    title={t('mailer.templates.detail.recipients.modal.load_error')}
                    error={allRecipientsQ.error}
                    onRetry={() => void allRecipientsQ.refetch()}
                    detailsExtra={{ page: 'admin.mailer.templates.detail.recipients.modal' }}
                  />
                ) : (
                  <div className="max-h-scroll-registry overflow-auto rounded-md border border-border">
                    {(allRecipientsQ.data ?? [])
                      .filter((r) => {
                        const needle = recipientSearch.trim().toLowerCase();
                        if (!needle) return true;
                        const hay = `${String((r as any).label ?? '')} ${String((r as any).to ?? '')} ${String((r as any).cc ?? '')} ${String((r as any).bcc ?? '')}`.toLowerCase();
                        return hay.includes(needle);
                      })
                      .map((r: MailRecipient) => {
                        const rid = Number((r as any).id);
                        const label = String((r as any).label ?? `#${rid}`);
                        const to = String((r as any).to ?? '');
                        const cc = String((r as any).cc ?? '');
                        const bcc = String((r as any).bcc ?? '');
                        const selected = selectedRecipientId === rid;
                        const already = associatedRecipientIds.has(rid);

                        return (
                          <button
                            key={rid}
                            type="button"
                            className={
                              'w-full border-b border-border px-3 py-2 text-left text-sm transition last:border-b-0 ' +
                              (selected ? 'bg-surface-2' : 'hover:bg-surface-2')
                            }
                            onClick={() => setSelectedRecipientId(rid)}
                            disabled={already}
                            data-testid={`admin.mailer.templates.detail.recipients.modal.pick.${rid}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate font-medium">{label}</div>
                                <div className="mt-0.5 truncate text-xs text-muted" title={to}>
                                  {to || t('common.na')}
                                </div>
                              </div>
                              {already ? <Badge variant="warn">{t('mailer.templates.detail.recipients.modal.already_added')}</Badge> : null}
                            </div>
                            {(cc || bcc) ? (
                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                                {cc ? <span className="truncate" title={cc}>CC: {cc}</span> : null}
                                {bcc ? <span className="truncate" title={bcc}>BCC: {bcc}</span> : null}
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                  </div>
                )}

                {selectedRecipientId && associatedRecipientIds.has(selectedRecipientId) ? (
                  <div className="mt-3">
                    <Alert variant="warn" title={t('mailer.templates.detail.recipients.modal.already_added')}>
                      {t('mailer.templates.detail.recipients.modal.already_added_desc')}
                    </Alert>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="grid gap-3">
                <div>
                  <div className="text-xs font-medium text-muted">{t('common.label')}</div>
                  <Input
                    value={newRecipient.label}
                    onChange={(e) => setNewRecipient({ ...newRecipient, label: e.target.value })}
                    placeholder={t('mailer.recipients.create.label_placeholder')}
                  />
                </div>
                <div>
                  <div className="text-xs font-medium text-muted">{t('mailer.recipients.fields.to')}</div>
                  <Input value={newRecipient.to} onChange={(e) => setNewRecipient({ ...newRecipient, to: e.target.value })} placeholder={t('mailer.recipients.create.address_placeholder')} />
                </div>
                <div>
                  <div className="text-xs font-medium text-muted">{t('mailer.recipients.fields.cc')}</div>
                  <Input value={newRecipient.cc} onChange={(e) => setNewRecipient({ ...newRecipient, cc: e.target.value })} placeholder={t('mailer.recipients.create.address_placeholder')} />
                </div>
                <div>
                  <div className="text-xs font-medium text-muted">{t('mailer.recipients.fields.bcc')}</div>
                  <Input value={newRecipient.bcc} onChange={(e) => setNewRecipient({ ...newRecipient, bcc: e.target.value })} placeholder={t('mailer.recipients.create.address_placeholder')} />
                </div>
                <Alert variant="info" title={t('mailer.templates.detail.recipients.modal.create_info')}>
                  {t('mailer.templates.detail.recipients.modal.create_info_desc')}
                </Alert>
              </div>
            )}
          </Modal>

          {/* Remove recipient confirm */}
          <ConfirmDialog
            open={removeRecipientId !== null}
            title={t('mailer.templates.detail.recipients.remove_confirm.title')}
            description={t('mailer.templates.detail.recipients.remove_confirm.description')}
            danger
            confirmLabel={t('common.remove')}
            confirmLoading={removeRecipientM.isPending}
            onCancel={() => setRemoveRecipientId(null)}
            onConfirm={() => {
              if (removeRecipientId) removeRecipientM.mutate(removeRecipientId);
            }}
            testId="admin.mailer.templates.detail.recipients.remove_confirm"
          />

          {/* Confirm add translation */}
          <ConfirmDialog
            open={confirmAddTranslationOpen}
            title={t('mailer.templates.detail.translations.add_confirm.title')}
            description={t('mailer.templates.detail.translations.add_confirm.description')}
            onCancel={() => setConfirmAddTranslationOpen(false)}
            onConfirm={() => {
              setConfirmAddTranslationOpen(false);
              setTranslationModalOpen(true);
            }}
            testId="admin.mailer.templates.detail.translations.add_confirm"
          />

          {/* Add translation modal */}
          <Modal
            open={translationModalOpen}
            onClose={() => setTranslationModalOpen(false)}
            title={t('mailer.templates.detail.translations.add')}
            size="lg"
            testId="admin.mailer.templates.detail.translations.modal"
            footer={
              <div className="flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={() => setTranslationModalOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="primary"
                  loading={createTranslationM.isPending}
                  disabled={!newTranslation.subject.trim() || !parsePositiveInt(newTranslation.language)}
                  onClick={() => {
                    const lid = parsePositiveInt(newTranslation.language);
                    if (!lid) return;
                    createTranslationM.mutate({
                      language: lid,
                      from: newTranslation.from.trim() || undefined,
                      reply_to: newTranslation.reply_to.trim() || undefined,
                      return_path: newTranslation.return_path.trim() || undefined,
                      subject: newTranslation.subject.trim(),
                      text_plain: newTranslation.text_plain || undefined,
                      text_html: newTranslation.text_html || undefined,
                    });
                  }}
                  testId="admin.mailer.templates.detail.translations.modal.create"
                >
                  {t('common.create')}
                </Button>
              </div>
            }
          >
            <div className="grid gap-3">
              <div>
                <div className="text-xs font-medium text-muted">{t('mailer.translations.fields.language')}</div>
                <Select
                  value={newTranslation.language}
                  onChange={(e) => setNewTranslation({ ...newTranslation, language: e.target.value })}
                  options={languageOptions}
                  testId="admin.mailer.templates.detail.translations.modal.language"
                />
              </div>

              <div>
                <div className="text-xs font-medium text-muted">{t('mailer.translations.fields.subject')}</div>
                <Input
                  value={newTranslation.subject}
                  onChange={(e) => setNewTranslation({ ...newTranslation, subject: e.target.value })}
                  placeholder={t('mailer.translations.fields.subject_placeholder')}
                  testId="admin.mailer.templates.detail.translations.modal.subject"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <div className="text-xs font-medium text-muted">{t('mailer.translations.fields.from')}</div>
                  <Input value={newTranslation.from} onChange={(e) => setNewTranslation({ ...newTranslation, from: e.target.value })} testId="admin.mailer.templates.detail.translations.modal.from" />
                </div>
                <div>
                  <div className="text-xs font-medium text-muted">{t('mailer.translations.fields.reply_to')}</div>
                  <Input value={newTranslation.reply_to} onChange={(e) => setNewTranslation({ ...newTranslation, reply_to: e.target.value })} testId="admin.mailer.templates.detail.translations.modal.reply_to" />
                </div>
                <div>
                  <div className="text-xs font-medium text-muted">{t('mailer.translations.fields.return_path')}</div>
                  <Input value={newTranslation.return_path} onChange={(e) => setNewTranslation({ ...newTranslation, return_path: e.target.value })} testId="admin.mailer.templates.detail.translations.modal.return_path" />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-muted">{t('mailer.translations.fields.text_plain')}</div>
                  <Textarea
                    value={newTranslation.text_plain}
                    onChange={(e) => setNewTranslation({ ...newTranslation, text_plain: e.target.value })}
                    rows={10}
                    className="font-mono text-xs"
                    testId="admin.mailer.templates.detail.translations.modal.text_plain"
                  />
                </div>
                <div>
                  <div className="text-xs font-medium text-muted">{t('mailer.translations.fields.text_html')}</div>
                  <Textarea
                    value={newTranslation.text_html}
                    onChange={(e) => setNewTranslation({ ...newTranslation, text_html: e.target.value })}
                    rows={10}
                    className="font-mono text-xs"
                    testId="admin.mailer.templates.detail.translations.modal.text_html"
                  />
                </div>
              </div>

              {createTranslationM.isError ? (
                <Alert variant="danger" title={t('mailer.templates.detail.translations.modal.create_error')}>
                  {String((createTranslationM.error as any)?.message ?? createTranslationM.error)}
                </Alert>
              ) : null}
            </div>
          </Modal>
        </>
      )}
    </DetailShell>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAppMode } from '../../../../app/appMode';
import { useI18n } from '../../../../app/i18n';

import {
  deleteMailTemplateTranslation,
  fetchMailTemplate,
  fetchMailTemplateTranslation,
  updateMailTemplateTranslation,
  type MailTemplate,
  type MailTemplateTranslation,
} from '../../../../lib/api/mailer';
import { formatDateTime } from '../../../../lib/format';

import { DetailShell } from '../../../../components/layout/DetailShell';

import { Alert } from '../../../../components/ui/Alert';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../../components/ui/Card';
import { Checkbox } from '../../../../components/ui/Checkbox';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { Input } from '../../../../components/ui/Input';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { ObjectHeader } from '../../../../components/ui/ObjectHeader';
import { SandboxedHtml } from '../../../../components/ui/SandboxedHtml';
import { Textarea } from '../../../../components/ui/Textarea';

import { MailerTabs } from './MailerTabs';

function parsePositiveInt(v: string | undefined): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function MailTemplateTranslationPage() {
  const { basePath } = useAppMode();
  const { t } = useI18n();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { mailTemplateId, translationId } = useParams();
  const tplId = useMemo(() => parsePositiveInt(mailTemplateId), [mailTemplateId]);
  const trId = useMemo(() => parsePositiveInt(translationId), [translationId]);

  const tplQ = useQuery({
    queryKey: ['mailer', 'mail_templates', 'show', { id: tplId }],
    enabled: tplId !== null,
    queryFn: async () => (await fetchMailTemplate(tplId as number)).data,
    staleTime: 30_000,
  });

  const trQ = useQuery({
    queryKey: ['mailer', 'mail_templates', 'translations', 'show', { tplId, trId }],
    enabled: tplId !== null && trId !== null,
    queryFn: async () => (await fetchMailTemplateTranslation(tplId as number, trId as number)).data,
    staleTime: 15_000,
  });

  const [tab, setTab] = useState<'plain' | 'html'>('plain');
  const [showRawHtml, setShowRawHtml] = useState(false);

  const [editingEnabled, setEditingEnabled] = useState(false);
  const [confirmEnableEditingOpen, setConfirmEnableEditingOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [form, setForm] = useState({
    from: '',
    reply_to: '',
    return_path: '',
    subject: '',
    text_plain: '',
    text_html: '',
  });

  useEffect(() => {
    if (!trQ.data) return;
    const tr = trQ.data as any;
    setForm({
      from: String(tr.from ?? ''),
      reply_to: String(tr.reply_to ?? ''),
      return_path: String(tr.return_path ?? ''),
      subject: String(tr.subject ?? ''),
      text_plain: String(tr.text_plain ?? ''),
      text_html: String(tr.text_html ?? ''),
    });
  }, [trQ.data]);

  const saveM = useMutation({
    mutationFn: async () => {
      if (tplId === null || trId === null) throw new Error('invalid id');
      return (
        await updateMailTemplateTranslation(tplId, trId, {
          from: form.from.trim() || undefined,
          reply_to: form.reply_to.trim() || undefined,
          return_path: form.return_path.trim() || undefined,
          subject: form.subject.trim() || undefined,
          text_plain: form.text_plain,
          text_html: form.text_html,
        })
      ).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'translations'] });
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'show'] });
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'index'] });
    },
  });

  const deleteM = useMutation({
    mutationFn: async () => {
      if (tplId === null || trId === null) throw new Error('invalid id');
      return await deleteMailTemplateTranslation(tplId, trId);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'translations'] });
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'show'] });
      await qc.invalidateQueries({ queryKey: ['mailer', 'mail_templates', 'index'] });
      nav(`${basePath}/mailer/templates/${tplId}`);
    },
  });

  if (tplId === null || trId === null) {
    return (
      <DetailShell variant="wide" testId="admin.mailer.templates.translation.detail">
        <MailerTabs />
        <ErrorState
          testId="admin.mailer.templates.translation.detail.invalid"
          title={t('mailer.translations.detail.invalid_title')}
          error={new Error('invalid id')}
          detailsExtra={{ page: 'admin.mailer.templates.translation.detail', mailTemplateId, translationId }}
        />
      </DetailShell>
    );
  }

  const tpl = tplQ.data as MailTemplate | undefined;
  const tr = trQ.data as MailTemplateTranslation | undefined;

  const tplLabel = String((tpl as any)?.label ?? (tpl as any)?.name ?? `#${tplId}`);
  const lang = (tr as any)?.language;
  const langLabel = String((lang as any)?.label ?? (lang as any)?.code ?? t('common.na'));

  const hasBodyPlain = Boolean(form.text_plain && form.text_plain.trim().length);
  const hasBodyHtml = Boolean(form.text_html && form.text_html.trim().length);

  const bodyTab = tab === 'plain' ? (
    hasBodyPlain ? (
      <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-surface p-3 text-sm text-fg">
        {form.text_plain}
      </pre>
    ) : (
      <div className="text-sm text-muted">{t('mailer.translations.detail.body.empty_plain')}</div>
    )
  ) : tab === 'html' ? (
    hasBodyHtml ? (
      showRawHtml ? (
        <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-surface p-3 text-xs text-fg">
          {form.text_html}
        </pre>
      ) : (
        <SandboxedHtml html={form.text_html} testId="admin.mailer.templates.translation.detail.preview" />
      )
    ) : (
      <div className="text-sm text-muted">{t('mailer.translations.detail.body.empty_html')}</div>
    )
  ) : null;

  const canSave = editingEnabled && !saveM.isPending;

  return (
    <DetailShell variant="wide" testId="admin.mailer.templates.translation.detail">
      <MailerTabs />

      <ObjectHeader
        title={t('mailer.translations.detail.title', { lang: langLabel })}
        kicker={
          <Link className="text-accent hover:underline" to={`${basePath}/mailer/templates/${tplId}`}>
            {tplLabel}
          </Link>
        }
        badges={<Badge variant="neutral">#{trId}</Badge>}
        meta={
          <span>
            {t('mailer.translations.detail.meta', {
              templateId: tplId,
              language: langLabel,
            })}
          </span>
        }
        actions={
          editingEnabled ? (
            <>
              <Button variant="primary" onClick={() => saveM.mutate()} loading={saveM.isPending} disabled={!canSave} testId="admin.mailer.templates.translation.detail.save">
                {t('common.save')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!tr) return;
                  const tt = tr as any;
                  setForm({
                    from: String(tt.from ?? ''),
                    reply_to: String(tt.reply_to ?? ''),
                    return_path: String(tt.return_path ?? ''),
                    subject: String(tt.subject ?? ''),
                    text_plain: String(tt.text_plain ?? ''),
                    text_html: String(tt.text_html ?? ''),
                  });
                }}
                disabled={saveM.isPending}
                testId="admin.mailer.templates.translation.detail.reset"
              >
                {t('common.reset')}
              </Button>
              <Button
                variant="danger"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={saveM.isPending || deleteM.isPending}
                testId="admin.mailer.templates.translation.detail.delete"
              >
                {t('common.delete')}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmEnableEditingOpen(true)} testId="admin.mailer.templates.translation.detail.enable_editing">
              {t('mailer.translations.detail.enable_editing')}
            </Button>
          )
        }
      />

      {trQ.isLoading || tplQ.isLoading ? (
        <LoadingState testId="admin.mailer.templates.translation.detail.loading" />
      ) : trQ.isError ? (
        <ErrorState
          testId="admin.mailer.templates.translation.detail.error"
          title={t('mailer.translations.detail.load_error')}
          error={trQ.error}
          onRetry={() => void trQ.refetch()}
          detailsExtra={{ page: 'admin.mailer.templates.translation.detail', tplId, trId }}
        />
      ) : !tr ? (
        <ErrorState
          testId="admin.mailer.templates.translation.detail.not_found"
          kindOverride="not_found"
          title={t('mailer.translations.detail.not_found_title')}
          body={t('mailer.translations.detail.not_found_body')}
          backTo={`${basePath}/mailer/templates/${tplId}`}
          showStatusLink={false}
          showDetails={false}
          detailsExtra={{ page: 'admin.mailer.templates.translation.detail', tplId, trId }}
        />
      ) : (
        <>
          {!editingEnabled ? (
            <Alert variant="info" title={t('mailer.translations.detail.readonly.title')} testId="admin.mailer.templates.translation.detail.readonly">
              {t('mailer.translations.detail.readonly.body')}
            </Alert>
          ) : (
            <Alert variant="warn" title={t('mailer.translations.detail.editing.title')} testId="admin.mailer.templates.translation.detail.editing">
              {t('mailer.translations.detail.editing.body')}
            </Alert>
          )}

          <Card testId="admin.mailer.templates.translation.detail.fields">
            <CardHeader title={t('mailer.translations.detail.section.fields')} />
            <CardBody>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <div className="text-xs font-medium text-muted">{t('mailer.translations.fields.from')}</div>
                  {editingEnabled ? (
                    <Input value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} testId="admin.mailer.templates.translation.detail.from" />
                  ) : (
                    <div className="mt-1 text-sm">{String((tr as any).from ?? t('common.na'))}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-medium text-muted">{t('mailer.translations.fields.reply_to')}</div>
                  {editingEnabled ? (
                    <Input
                      value={form.reply_to}
                      onChange={(e) => setForm({ ...form, reply_to: e.target.value })}
                      testId="admin.mailer.templates.translation.detail.reply_to"
                    />
                  ) : (
                    <div className="mt-1 text-sm">{String((tr as any).reply_to ?? t('common.na'))}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-medium text-muted">{t('mailer.translations.fields.return_path')}</div>
                  {editingEnabled ? (
                    <Input
                      value={form.return_path}
                      onChange={(e) => setForm({ ...form, return_path: e.target.value })}
                      testId="admin.mailer.templates.translation.detail.return_path"
                    />
                  ) : (
                    <div className="mt-1 text-sm">{String((tr as any).return_path ?? t('common.na'))}</div>
                  )}
                </div>

                <div className="md:col-span-3">
                  <div className="text-xs font-medium text-muted">{t('mailer.translations.fields.subject')}</div>
                  {editingEnabled ? (
                    <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} testId="admin.mailer.templates.translation.detail.subject" />
                  ) : (
                    <div className="mt-1 text-sm">{String((tr as any).subject ?? t('common.na'))}</div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-muted">{t('common.updated')}</div>
                  <div className="mt-1 text-sm">{formatDateTime((tr as any).updated_at)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">{t('common.created')}</div>
                  <div className="mt-1 text-sm">{formatDateTime((tr as any).created_at)}</div>
                </div>
              </div>

              {saveM.isError ? (
                <div className="mt-4">
                  <Alert variant="danger" title={t('mailer.translations.detail.save_error')}>
                    {String((saveM.error as any)?.message ?? saveM.error)}
                  </Alert>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card testId="admin.mailer.templates.translation.detail.body">
            <CardHeader
              title={t('mailer.translations.detail.section.body')}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={tab === 'plain' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setTab('plain')}
                    testId="admin.mailer.templates.translation.detail.tab.plain"
                  >
                    {t('mailer.translations.detail.tab.plain')}
                  </Button>
                  <Button
                    variant={tab === 'html' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setTab('html')}
                    testId="admin.mailer.templates.translation.detail.tab.html"
                  >
                    {t('mailer.translations.detail.tab.html')}
                  </Button>
                </div>
              }
            />
            <CardBody>
              {tab === 'html' && hasBodyHtml ? (
                <Checkbox
                  checked={showRawHtml}
                  onChange={setShowRawHtml}
                  label={t('mailer.translations.detail.body.raw_toggle')}
                  description={t('mailer.translations.detail.body.raw_toggle_desc')}
                  testId="admin.mailer.templates.translation.detail.body.raw_toggle"
                  className="mb-3"
                />
              ) : null}

              {editingEnabled ? (
                <div className="mb-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium text-muted">{t('mailer.translations.fields.text_plain')}</div>
                    <Textarea
                      value={form.text_plain}
                      onChange={(e) => setForm({ ...form, text_plain: e.target.value })}
                      rows={10}
                      className="font-mono text-xs"
                      testId="admin.mailer.templates.translation.detail.text_plain"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted">{t('mailer.translations.fields.text_html')}</div>
                    <Textarea
                      value={form.text_html}
                      onChange={(e) => setForm({ ...form, text_html: e.target.value })}
                      rows={10}
                      className="font-mono text-xs"
                      testId="admin.mailer.templates.translation.detail.text_html"
                    />
                  </div>
                </div>
              ) : null}

              {bodyTab}
            </CardBody>
          </Card>

          <Button variant="secondary" onClick={() => nav(`${basePath}/mailer/templates/${tplId}`)} testId="admin.mailer.templates.translation.detail.back">
            {t('common.back')}
          </Button>

          <ConfirmDialog
            open={confirmEnableEditingOpen}
            title={t('mailer.translations.detail.enable_editing_confirm.title')}
            description={t('mailer.translations.detail.enable_editing_confirm.description')}
            onCancel={() => setConfirmEnableEditingOpen(false)}
            onConfirm={() => {
              setConfirmEnableEditingOpen(false);
              setEditingEnabled(true);
            }}
            testId="admin.mailer.templates.translation.detail.enable_editing_confirm"
          />

          <ConfirmDialog
            open={confirmDeleteOpen}
            title={t('mailer.translations.detail.delete_confirm.title')}
            description={t('mailer.translations.detail.delete_confirm.description')}
            danger
            confirmLabel={t('common.delete')}
            confirmLoading={deleteM.isPending}
            onCancel={() => setConfirmDeleteOpen(false)}
            onConfirm={() => deleteM.mutate()}
            testId="admin.mailer.templates.translation.detail.delete_confirm"
          />
        </>
      )}
    </DetailShell>
  );
}

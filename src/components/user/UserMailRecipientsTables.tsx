import React, { useEffect, useId, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';
import { formatErrorMessage } from '../../lib/errors';
import {
  updateUserMailRoleRecipient,
  updateUserMailTemplateRecipient,
  type UserMailRoleRecipient,
  type UserMailTemplateRecipient,
} from '../../lib/api/userMail';

import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
import { CopyButton } from '../ui/CopyButton';
import { ErrorState } from '../ui/ErrorState';
import { Input } from '../ui/Input';
import { LoadingState } from '../ui/LoadingState';
import { Select } from '../ui/Select';
import { StatusDot } from '../ui/StatusDot';
import { TableCard } from '../ui/TableCard';
import { Textarea } from '../ui/Textarea';

import {
  computeEffectiveRoleTo,
  computeEffectiveTemplateTo,
  formatEmailsForTextarea,
  isMailTemplateView,
  normalizeEmailsForApi,
  type EffectiveToSource,
  type MailTemplateView,
} from './UserMailPreferencesModel';

function MobileCellLabel(props: { children: React.ReactNode }) {
  return <div className="mb-1 text-xs font-semibold text-muted md:hidden">{props.children}</div>;
}

function SourceBadge(props: { source: EffectiveToSource }) {
  const { t } = useI18n();

  if (props.source === 'disabled') {
    return <Badge variant="danger">{t('mail.prefs.effective.source.disabled')}</Badge>;
  }

  if (props.source === 'template') {
    return <Badge variant="info">{t('mail.prefs.effective.source.template')}</Badge>;
  }

  if (props.source === 'role') {
    return <Badge variant="warn">{t('mail.prefs.effective.source.role')}</Badge>;
  }

  return <Badge variant="neutral">{t('mail.prefs.effective.source.primary')}</Badge>;
}

function recipientIdentity(recipient: { id: string; label?: string }): string {
  const id = String(recipient.id);
  const label = recipient.label?.trim();
  return label && label !== id ? `${label} (${id})` : id;
}

function RoleRecipientRow(props: {
  userId: number;
  userEmail?: string;
  recp: UserMailRoleRecipient;
}) {
  const { t } = useI18n();
  const toasts = useToasts();
  const qc = useQueryClient();
  const descriptionId = useId();
  const recipient = recipientIdentity(props.recp);

  const [value, setValue] = useState<string>(formatEmailsForTextarea(props.recp.to));

  useEffect(() => {
    setValue(formatEmailsForTextarea(props.recp.to));
  }, [props.recp.id, props.recp.to]);

  const normalized = useMemo(() => normalizeEmailsForApi(value), [value]);
  const storedNormalized = useMemo(() => normalizeEmailsForApi(formatEmailsForTextarea(props.recp.to)), [props.recp.to]);
  const dirty = normalized !== storedNormalized;

  const effective = useMemo(
    () => computeEffectiveRoleTo({ role: props.recp, userEmail: props.userEmail }),
    [props.recp, props.userEmail]
  );

  const mut = useMutation({
    mutationFn: async () =>
      updateUserMailRoleRecipient(props.userId, String(props.recp.id), {
        to: normalized,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', props.userId, 'mail_role_recipients'] });
      await qc.invalidateQueries({ queryKey: ['users', props.userId, 'mail_template_recipients'] });
      toasts.pushToast({ variant: 'ok', title: t('mail.prefs.toast.saved.title'), body: t('mail.prefs.toast.saved.body') });
    },
  });

  return (
    <tr className="block border-b border-border md:table-row">
      <td className="block px-4 pb-2 pt-4 align-top md:table-cell md:py-3">
        <MobileCellLabel>{t('mail.prefs.roles.col.role')}</MobileCellLabel>
        <div className="text-sm font-medium text-fg">{props.recp.label ?? props.recp.id}</div>
        {props.recp.description ? <div id={descriptionId} className="mt-1 text-xs text-muted">{props.recp.description}</div> : null}
      </td>

      <td className="block px-4 py-2 align-top md:table-cell md:py-3">
        <MobileCellLabel>{t('mail.prefs.roles.col.to')}</MobileCellLabel>
        <Textarea
          testId={`mail.roles.to.${props.recp.id}`}
          ariaLabel={t('mail.prefs.roles.to_aria', { recipient })}
          ariaDescribedBy={props.recp.description ? descriptionId : undefined}
          value={value}
          onChange={(e) => {
            mut.reset();
            setValue(e.target.value);
          }}
          rows={3}
          placeholder={t('mail.prefs.email_list.placeholder')}
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            disabled={!dirty || mut.isPending}
            onClick={() => mut.mutate()}
            testId={`mail.roles.save.${props.recp.id}`}
            ariaLabel={t('mail.prefs.roles.save_aria', { recipient })}
            className="min-h-11 md:min-h-0"
          >
            {mut.isPending ? t('common.saving') : t('common.save')}
          </Button>

          {dirty ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                mut.reset();
                setValue(formatEmailsForTextarea(props.recp.to));
              }}
              testId={`mail.roles.reset.${props.recp.id}`}
              ariaLabel={t('mail.prefs.roles.reset_aria', { recipient })}
              className="min-h-11 md:min-h-0"
            >
              {t('common.reset')}
            </Button>
          ) : null}
        </div>
        {mut.isError ? (
          <Alert
            variant="danger"
            title={t('mail.prefs.toast.save_failed.title')}
            className="mt-2"
            testId={`mail.roles.save_error.${props.recp.id}`}
          >
            {formatErrorMessage(mut.error) || t('mail.prefs.toast.save_failed.body')}
          </Alert>
        ) : null}
      </td>

      <td className="block px-4 pb-4 pt-2 align-top md:table-cell md:py-3">
        <MobileCellLabel>{t('mail.prefs.roles.col.effective')}</MobileCellLabel>
        {effective.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="break-all text-sm text-fg">{effective.join(', ')}</div>
            <CopyButton
              text={effective.join(',')}
              size="sm"
              variant="ghost"
              testId={`mail.roles.copy.${props.recp.id}`}
              ariaLabel={t('mail.prefs.roles.copy_aria', { recipient })}
              className="min-h-11 md:min-h-0"
            />
          </div>
        ) : (
          <div className="text-sm text-muted">{t('common.na')}</div>
        )}
      </td>
    </tr>
  );
}

function TemplateRecipientRow(props: {
  userId: number;
  userEmail?: string;
  roleRecipients: UserMailRoleRecipient[];
  recp: UserMailTemplateRecipient;
}) {
  const { t } = useI18n();
  const toasts = useToasts();
  const qc = useQueryClient();
  const descriptionId = useId();
  const recipient = recipientIdentity(props.recp);

  const [toValue, setToValue] = useState<string>(formatEmailsForTextarea(props.recp.to));
  const [enabled, setEnabled] = useState<boolean>(props.recp.enabled !== false);

  useEffect(() => {
    setToValue(formatEmailsForTextarea(props.recp.to));
    setEnabled(props.recp.enabled !== false);
  }, [props.recp.id, props.recp.to, props.recp.enabled]);

  const normalizedTo = useMemo(() => normalizeEmailsForApi(toValue), [toValue]);
  const storedTo = useMemo(() => normalizeEmailsForApi(formatEmailsForTextarea(props.recp.to)), [props.recp.to]);
  const storedEnabled = props.recp.enabled !== false;
  const dirty = normalizedTo !== storedTo || enabled !== storedEnabled;

  const effective = useMemo(
    () =>
      computeEffectiveTemplateTo({
        template: { ...props.recp, to: normalizedTo, enabled },
        userEmail: props.userEmail,
        roleRecipients: props.roleRecipients,
      }),
    [props.recp, normalizedTo, enabled, props.roleRecipients, props.userEmail]
  );

  const mut = useMutation({
    mutationFn: async () =>
      updateUserMailTemplateRecipient(props.userId, String(props.recp.id), {
        to: normalizedTo,
        enabled,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', props.userId, 'mail_template_recipients'] });
      toasts.pushToast({ variant: 'ok', title: t('mail.prefs.toast.saved.title'), body: t('mail.prefs.toast.saved.body') });
    },
  });

  const rowVariant = enabled ? '' : 'bg-danger-row';

  return (
    <tr className={`block border-b border-border md:table-row ${rowVariant}`}>
      <td className="block px-4 pb-2 pt-4 align-top md:table-cell md:py-3">
        <MobileCellLabel>{t('mail.prefs.templates.col.template')}</MobileCellLabel>
        <div className="flex items-center gap-2">
          <StatusDot variant={enabled ? 'neutral' : 'danger'} />
          <div className="text-sm font-medium text-fg">{props.recp.label ?? props.recp.id}</div>
        </div>
        <div className="mt-1 break-all text-xs text-faint">{props.recp.id}</div>
        {props.recp.description ? <div id={descriptionId} className="mt-2 text-xs text-muted">{props.recp.description}</div> : null}
      </td>

      <td className="block px-4 py-2 align-top md:table-cell md:py-3">
        <MobileCellLabel>{t('mail.prefs.templates.col.enabled')}</MobileCellLabel>
        <Checkbox
          checked={!enabled}
          onChange={(checked) => {
            mut.reset();
            setEnabled(!checked);
          }}
          label={t('mail.prefs.templates.disable_label')}
          description={t('mail.prefs.templates.disable_desc')}
          testId={`mail.templates.disable.${props.recp.id}`}
        />
      </td>

      <td className="block px-4 py-2 align-top md:table-cell md:py-3">
        <MobileCellLabel>{t('mail.prefs.templates.col.to')}</MobileCellLabel>
        <Textarea
          testId={`mail.templates.to.${props.recp.id}`}
          ariaLabel={t('mail.prefs.templates.to_aria', { recipient })}
          ariaDescribedBy={props.recp.description ? descriptionId : undefined}
          value={toValue}
          onChange={(e) => {
            mut.reset();
            setToValue(e.target.value);
          }}
          rows={3}
          placeholder={t('mail.prefs.email_list.placeholder')}
          disabled={!enabled}
        />
      </td>

      <td className="block px-4 py-2 align-top md:table-cell md:py-3">
        <MobileCellLabel>{t('mail.prefs.templates.col.effective')}</MobileCellLabel>
        <div className="flex flex-col gap-2">
          <SourceBadge source={effective.source} />
          {effective.source === 'disabled' ? (
            <div className="text-sm text-muted">{t('mail.prefs.templates.disabled_hint')}</div>
          ) : effective.to.length > 0 ? (
            <div className="break-all text-sm text-fg">{effective.to.join(', ')}</div>
          ) : (
            <div className="text-sm text-muted">{t('common.na')}</div>
          )}
          {effective.source !== 'disabled' && effective.to.length > 0 ? (
            <CopyButton
              text={effective.to.join(',')}
              size="sm"
              variant="ghost"
              testId={`mail.templates.copy.${props.recp.id}`}
              ariaLabel={t('mail.prefs.templates.copy_aria', { recipient })}
              className="min-h-11 md:min-h-0"
            />
          ) : null}
        </div>
      </td>

      <td className="block px-4 pb-4 pt-2 align-top md:table-cell md:py-3">
        <MobileCellLabel>{t('mail.prefs.templates.col.actions')}</MobileCellLabel>
        <div className="flex flex-wrap items-start gap-2 md:flex-col">
          <Button
            size="sm"
            disabled={!dirty || mut.isPending}
            onClick={() => mut.mutate()}
            testId={`mail.templates.save.${props.recp.id}`}
            ariaLabel={t('mail.prefs.templates.save_aria', { recipient })}
            className="min-h-11 md:min-h-0"
          >
            {mut.isPending ? t('common.saving') : t('common.save')}
          </Button>

          {dirty ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                mut.reset();
                setToValue(formatEmailsForTextarea(props.recp.to));
                setEnabled(props.recp.enabled !== false);
              }}
              testId={`mail.templates.reset.${props.recp.id}`}
              ariaLabel={t('mail.prefs.templates.reset_aria', { recipient })}
              className="min-h-11 md:min-h-0"
            >
              {t('common.reset')}
            </Button>
          ) : null}
        </div>
        {mut.isError ? (
          <Alert
            variant="danger"
            title={t('mail.prefs.toast.save_failed.title')}
            className="mt-2"
            testId={`mail.templates.save_error.${props.recp.id}`}
          >
            {formatErrorMessage(mut.error) || t('mail.prefs.toast.save_failed.body')}
          </Alert>
        ) : null}
      </td>
    </tr>
  );
}

export function MailRoleRecipientsTable(props: {
  userId: number;
  userEmail: string;
  roleRecipients: UserMailRoleRecipient[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  return (
    <TableCard tableClassName="block min-w-full md:table" testId="mail.roles">
      <thead className="hidden md:table-header-group">
        <tr className="text-left text-xs text-muted">
          <th className="px-4 py-3">{t('mail.prefs.roles.col.role')}</th>
          <th className="px-4 py-3">{t('mail.prefs.roles.col.to')}</th>
          <th className="px-4 py-3">{t('mail.prefs.roles.col.effective')}</th>
        </tr>
      </thead>
      <tbody className="block md:table-row-group">
        {props.isLoading ? (
          <tr className="block md:table-row">
            <td colSpan={3} className="block px-4 py-6 md:table-cell">
              <LoadingState kind="inline" />
            </td>
          </tr>
        ) : props.isError ? (
          <tr className="block md:table-row">
            <td colSpan={3} className="block px-4 py-6 md:table-cell">
              <ErrorState
                error={props.error}
                title={t('mail.prefs.roles.load_failed.title')}
                body={t('mail.prefs.roles.load_failed.body')}
                onRetry={props.onRetry}
                showBack={false}
              />
            </td>
          </tr>
        ) : props.roleRecipients.length === 0 ? (
          <tr className="block md:table-row">
            <td colSpan={3} className="block px-4 py-6 text-sm text-muted md:table-cell">
              {t('mail.prefs.roles.empty')}
            </td>
          </tr>
        ) : (
          props.roleRecipients.map((r) => <RoleRecipientRow key={String(r.id)} userId={props.userId} userEmail={props.userEmail} recp={r} />)
        )}
      </tbody>
      <tfoot className="block md:table-footer-group">
        <tr className="block md:table-row">
          <td colSpan={3} className="block px-4 py-3 text-xs text-muted md:table-cell">
            {t('mail.prefs.roles.help')}
          </td>
        </tr>
      </tfoot>
    </TableCard>
  );
}

export function MailTemplateRecipientsCard(props: {
  userId: number;
  userEmail: string;
  roleRecipients: UserMailRoleRecipient[];
  templates: UserMailTemplateRecipient[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  needle: string;
  onNeedleChange: (value: string) => void;
  view: MailTemplateView;
  onViewChange: (value: MailTemplateView) => void;
}) {
  const { t } = useI18n();

  return (
    <Card testId="mail.templates">
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-fg">{t('mail.prefs.templates.title')}</div>
            <div className="mt-1 text-sm text-muted">{t('mail.prefs.templates.subtitle')}</div>
          </div>
          <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
            <div className="w-full sm:w-56">
              <Input
                label={t('mail.prefs.templates.search.label')}
                value={props.needle}
                onChange={(e) => props.onNeedleChange(e.target.value)}
                placeholder={t('mail.prefs.templates.search.placeholder')}
                testId="mail.templates.search"
                className="min-h-11 md:min-h-0"
              />
            </div>
            <div className="w-full sm:w-40">
              <Select
                label={t('mail.prefs.templates.view.label')}
                testId="mail.templates.view"
                value={props.view}
                onChange={(e) => {
                  const next = e.target.value;
                  if (isMailTemplateView(next)) props.onViewChange(next);
                }}
                options={[
                  { value: 'all', label: t('mail.prefs.templates.view.all') },
                  { value: 'changed', label: t('mail.prefs.templates.view.changed') },
                  { value: 'disabled', label: t('mail.prefs.templates.view.disabled') },
                ]}
                className="min-h-11 md:min-h-0"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-muted">{t('mail.prefs.templates.help')}</div>
      </div>

      <div className="overflow-x-auto">
        <table className="block w-full min-w-0 text-sm tabular-nums md:table md:min-w-table-lg">
          <thead className="hidden md:table-header-group">
            <tr className="border-y border-border bg-surface-2 text-left text-xs text-muted">
              <th className="px-4 py-3">{t('mail.prefs.templates.col.template')}</th>
              <th className="px-4 py-3">{t('mail.prefs.templates.col.enabled')}</th>
              <th className="px-4 py-3">{t('mail.prefs.templates.col.to')}</th>
              <th className="px-4 py-3">{t('mail.prefs.templates.col.effective')}</th>
              <th className="px-4 py-3">{t('mail.prefs.templates.col.actions')}</th>
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {props.isLoading ? (
              <tr className="block md:table-row">
                <td colSpan={5} className="block px-4 py-6 md:table-cell">
                  <LoadingState kind="inline" />
                </td>
              </tr>
            ) : props.isError ? (
              <tr className="block md:table-row">
                <td colSpan={5} className="block px-4 py-6 md:table-cell">
                  <ErrorState
                    error={props.error}
                    title={t('mail.prefs.templates.load_failed.title')}
                    body={t('mail.prefs.templates.load_failed.body')}
                    onRetry={props.onRetry}
                    showBack={false}
                  />
                </td>
              </tr>
            ) : props.templates.length === 0 ? (
              <tr className="block md:table-row">
                <td colSpan={5} className="block px-4 py-6 text-sm text-muted md:table-cell">
                  {props.needle || props.view !== 'all' ? t('mail.prefs.templates.empty_filtered') : t('mail.prefs.templates.empty')}
                </td>
              </tr>
            ) : (
              props.templates.map((r) => (
                <TemplateRecipientRow
                  key={String(r.id)}
                  userId={props.userId}
                  userEmail={props.userEmail}
                  roleRecipients={props.roleRecipients}
                  recp={r}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-2 text-xs text-muted">
          <StatusDot variant="neutral" />
          <div>
            <div className="font-medium text-fg">{t('mail.prefs.templates.effective_legend.title')}</div>
            <div className="mt-0.5">{t('mail.prefs.templates.effective_legend.body')}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

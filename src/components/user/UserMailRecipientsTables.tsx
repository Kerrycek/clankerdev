import React, { useEffect, useMemo, useState } from 'react';
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

function RoleRecipientRow(props: {
  userId: number;
  userEmail?: string;
  recp: UserMailRoleRecipient;
}) {
  const { t } = useI18n();
  const toasts = useToasts();
  const qc = useQueryClient();

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
    onError: (error: unknown) => {
      toasts.pushToast({
        variant: 'danger',
        title: t('mail.prefs.toast.save_failed.title'),
        body: formatErrorMessage(error) || t('mail.prefs.toast.save_failed.body'),
      });
    },
  });

  return (
    <tr className="border-b border-border">
      <td className="px-4 py-3 align-top">
        <div className="text-sm font-medium text-fg">{props.recp.label ?? props.recp.id}</div>
        {props.recp.description ? <div className="mt-1 text-xs text-muted">{props.recp.description}</div> : null}
      </td>

      <td className="px-4 py-3 align-top">
        <Textarea
          testId={`mail.roles.to.${props.recp.id}`}
          ariaLabel={t('mail.prefs.roles.col.to')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          placeholder={t('mail.prefs.email_list.placeholder')}
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            disabled={!dirty || mut.isPending}
            onClick={() => mut.mutate()}
            testId={`mail.roles.save.${props.recp.id}`}
          >
            {mut.isPending ? t('common.saving') : t('common.save')}
          </Button>

          {dirty ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setValue(formatEmailsForTextarea(props.recp.to))}
              testId={`mail.roles.reset.${props.recp.id}`}
            >
              {t('common.reset')}
            </Button>
          ) : null}
        </div>
      </td>

      <td className="px-4 py-3 align-top">
        {effective.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="text-sm text-fg">{effective.join(', ')}</div>
            <CopyButton text={effective.join(',')} size="sm" variant="ghost" testId={`mail.roles.copy.${props.recp.id}`} />
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
    onError: (error: unknown) => {
      toasts.pushToast({
        variant: 'danger',
        title: t('mail.prefs.toast.save_failed.title'),
        body: formatErrorMessage(error) || t('mail.prefs.toast.save_failed.body'),
      });
    },
  });

  const rowVariant = enabled ? '' : 'bg-danger-row';

  return (
    <tr className={`border-b border-border ${rowVariant}`}>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <StatusDot variant={enabled ? 'neutral' : 'danger'} />
          <div className="text-sm font-medium text-fg">{props.recp.label ?? props.recp.id}</div>
        </div>
        <div className="mt-1 text-xs text-faint">{props.recp.id}</div>
        {props.recp.description ? <div className="mt-2 text-xs text-muted">{props.recp.description}</div> : null}
      </td>

      <td className="px-4 py-3 align-top">
        <Checkbox
          checked={!enabled}
          onChange={(checked) => setEnabled(!checked)}
          label={t('mail.prefs.templates.disable_label')}
          description={t('mail.prefs.templates.disable_desc')}
          testId={`mail.templates.disable.${props.recp.id}`}
        />
      </td>

      <td className="px-4 py-3 align-top">
        <Textarea
          testId={`mail.templates.to.${props.recp.id}`}
          ariaLabel={t('mail.prefs.templates.col.to')}
          value={toValue}
          onChange={(e) => setToValue(e.target.value)}
          rows={3}
          placeholder={t('mail.prefs.email_list.placeholder')}
          disabled={!enabled}
        />
      </td>

      <td className="px-4 py-3 align-top">
        <div className="flex flex-col gap-2">
          <SourceBadge source={effective.source} />
          {effective.source === 'disabled' ? (
            <div className="text-sm text-muted">{t('mail.prefs.templates.disabled_hint')}</div>
          ) : effective.to.length > 0 ? (
            <div className="text-sm text-fg">{effective.to.join(', ')}</div>
          ) : (
            <div className="text-sm text-muted">{t('common.na')}</div>
          )}
          {effective.source !== 'disabled' && effective.to.length > 0 ? (
            <CopyButton text={effective.to.join(',')} size="sm" variant="ghost" testId={`mail.templates.copy.${props.recp.id}`} />
          ) : null}
        </div>
      </td>

      <td className="px-4 py-3 align-top">
        <div className="flex flex-col items-start gap-2">
          <Button
            size="sm"
            disabled={!dirty || mut.isPending}
            onClick={() => mut.mutate()}
            testId={`mail.templates.save.${props.recp.id}`}
          >
            {mut.isPending ? t('common.saving') : t('common.save')}
          </Button>

          {dirty ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setToValue(formatEmailsForTextarea(props.recp.to));
                setEnabled(props.recp.enabled !== false);
              }}
              testId={`mail.templates.reset.${props.recp.id}`}
            >
              {t('common.reset')}
            </Button>
          ) : null}
        </div>
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
    <TableCard tableClassName="min-w-full" testId="mail.roles">
      <thead>
        <tr className="text-left text-xs text-muted">
          <th className="px-4 py-3">{t('mail.prefs.roles.col.role')}</th>
          <th className="px-4 py-3">{t('mail.prefs.roles.col.to')}</th>
          <th className="px-4 py-3">{t('mail.prefs.roles.col.effective')}</th>
        </tr>
      </thead>
      <tbody>
        {props.isLoading ? (
          <tr>
            <td colSpan={3} className="px-4 py-6">
              <LoadingState kind="inline" />
            </td>
          </tr>
        ) : props.isError ? (
          <tr>
            <td colSpan={3} className="px-4 py-6">
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
          <tr>
            <td colSpan={3} className="px-4 py-6 text-sm text-muted">
              {t('mail.prefs.roles.empty')}
            </td>
          </tr>
        ) : (
          props.roleRecipients.map((r) => <RoleRecipientRow key={String(r.id)} userId={props.userId} userEmail={props.userEmail} recp={r} />)
        )}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={3} className="px-4 py-3 text-xs text-muted">
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-56">
              <Input
                value={props.needle}
                onChange={(e) => props.onNeedleChange(e.target.value)}
                placeholder={t('mail.prefs.templates.search.placeholder')}
                testId="mail.templates.search"
              />
            </div>
            <Select
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
            />
          </div>
        </div>

        <div className="mt-3 text-xs text-muted">{t('mail.prefs.templates.help')}</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-table-lg text-sm tabular-nums">
          <thead>
            <tr className="border-y border-border bg-surface-2 text-left text-xs text-muted">
              <th className="px-4 py-3">{t('mail.prefs.templates.col.template')}</th>
              <th className="px-4 py-3">{t('mail.prefs.templates.col.enabled')}</th>
              <th className="px-4 py-3">{t('mail.prefs.templates.col.to')}</th>
              <th className="px-4 py-3">{t('mail.prefs.templates.col.effective')}</th>
              <th className="px-4 py-3">{t('mail.prefs.templates.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {props.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6">
                  <LoadingState kind="inline" />
                </td>
              </tr>
            ) : props.isError ? (
              <tr>
                <td colSpan={5} className="px-4 py-6">
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
              <tr>
                <td colSpan={5} className="px-4 py-6 text-sm text-muted">
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

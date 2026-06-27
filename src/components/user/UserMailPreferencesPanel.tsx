import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '../../app/i18n';
import { useToasts } from '../../app/toasts';

import { fetchLanguages, type Language } from '../../lib/api/languages';
import { fetchUser, updateUser, type User } from '../../lib/api/users';
import {
  fetchUserMailRoleRecipients,
  fetchUserMailTemplateRecipients,
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

function formatEmailsForTextarea(raw: string | null | undefined): string {
  if (!raw) return '';
  // Split by comma, trim and join with comma+newline for readability.
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(',\n');
}

/**
 * Accept commas, whitespace and newlines as separators. Normalize to a comma-separated list.
 */
function normalizeEmailsForApi(raw: string): string {
  const parts = String(raw ?? '')
    .replace(/;/g, ',')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.join(',');
}

function parseRoles(rolesRaw: string | undefined): string[] {
  if (!rolesRaw) return [];
  return rolesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseEmails(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

type EffectiveToSource = 'disabled' | 'template' | 'role' | 'primary';

function computeEffectiveTemplateTo(args: {
  template: UserMailTemplateRecipient;
  userEmail?: string;
  roleRecipients: UserMailRoleRecipient[];
}): { source: EffectiveToSource; to: string[]; rolesUsed: string[] } {
  const enabled = args.template.enabled !== false;
  if (!enabled) return { source: 'disabled', to: [], rolesUsed: [] };

  const templateTo = parseEmails(args.template.to);
  if (templateTo.length > 0) return { source: 'template', to: templateTo, rolesUsed: [] };

  const roles = parseRoles(args.template.roles);
  const roleTo: string[] = [];
  const rolesUsed: string[] = [];

  for (const r of roles) {
    const recp = args.roleRecipients.find((x) => String(x.id) === r);
    const addr = parseEmails(recp?.to ?? null);
    if (addr.length > 0) {
      roleTo.push(...addr);
      rolesUsed.push(r);
    }
  }

  if (roleTo.length > 0) return { source: 'role', to: roleTo, rolesUsed };

  return { source: 'primary', to: args.userEmail ? [args.userEmail] : [], rolesUsed: [] };
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

  const effective = useMemo(() => {
    const override = parseEmails(props.recp.to);
    if (override.length > 0) return override;
    return props.userEmail ? [props.userEmail] : [];
  }, [props.recp.to, props.userEmail]);

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
    onError: (e: any) => {
      toasts.pushToast({
        variant: 'danger',
        title: t('mail.prefs.toast.save_failed.title'),
        body: e?.message ? String(e.message) : t('mail.prefs.toast.save_failed.body'),
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
            <CopyButton
              text={effective.join(',')}
              size="sm"
              variant="ghost"
              testId={`mail.roles.copy.${props.recp.id}`}
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
    onError: (e: any) => {
      toasts.pushToast({
        variant: 'danger',
        title: t('mail.prefs.toast.save_failed.title'),
        body: e?.message ? String(e.message) : t('mail.prefs.toast.save_failed.body'),
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
            <CopyButton
              text={effective.to.join(',')}
              size="sm"
              variant="ghost"
              testId={`mail.templates.copy.${props.recp.id}`}
            />
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

export function UserMailPreferencesPanel(props: { userId: number; user?: User }) {
  const { t } = useI18n();
  const toasts = useToasts();
  const qc = useQueryClient();

  const userQ = useQuery({
    queryKey: ['users', props.userId],
    enabled: !props.user,
    queryFn: async () => (await fetchUser(props.userId)).data,
    staleTime: 30_000,
  });

  const user = props.user ?? userQ.data;

  const languagesQ = useQuery({
    queryKey: ['languages'],
    queryFn: async () => (await fetchLanguages({ limit: 500 })).data,
    staleTime: 60_000,
  });

  const roleQ = useQuery({
    queryKey: ['users', props.userId, 'mail_role_recipients'],
    queryFn: async () => (await fetchUserMailRoleRecipients(props.userId)).data,
    staleTime: 10_000,
  });

  const tplQ = useQuery({
    queryKey: ['users', props.userId, 'mail_template_recipients'],
    queryFn: async () => (await fetchUserMailTemplateRecipients(props.userId)).data,
    staleTime: 10_000,
  });

  const [mailerEnabled, setMailerEnabled] = useState(true);
  const [languageId, setLanguageId] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    setMailerEnabled(user.mailer_enabled !== false);

    const lang = (user as LegacyAny).language;
    const id = typeof lang === 'object' && lang ? (lang as LegacyAny).id : typeof lang === 'number' ? lang : undefined;
    setLanguageId(id ? String(id) : '');
  }, [user?.id, (user as LegacyAny)?.mailer_enabled, (user as LegacyAny)?.language]);

  const storedMailerEnabled = user ? user.mailer_enabled !== false : true;

  const storedLanguageId = useMemo(() => {
    const lang = user ? (user as LegacyAny).language : undefined;
    const id = typeof lang === 'object' && lang ? (lang as LegacyAny).id : typeof lang === 'number' ? lang : undefined;
    return id ? String(id) : '';
  }, [user]);

  const settingsDirty = user ? mailerEnabled !== storedMailerEnabled || languageId !== storedLanguageId : false;

  const updateSettings = useMutation({
    mutationFn: async () => {
      if (!user) return;

      const payload: Record<string, unknown> = {};
      if (mailerEnabled !== storedMailerEnabled) payload['mailer_enabled'] = mailerEnabled;
      if (languageId !== storedLanguageId) payload['language'] = Number(languageId);

      return updateUser(props.userId, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users', props.userId] });
      await qc.invalidateQueries({ queryKey: ['user', 'current'] });
      toasts.pushToast({ variant: 'ok', title: t('mail.prefs.toast.saved.title'), body: t('mail.prefs.toast.saved.body') });
    },
    onError: (e: any) => {
      toasts.pushToast({
        variant: 'danger',
        title: t('mail.prefs.toast.save_failed.title'),
        body: e?.message ? String(e.message) : t('mail.prefs.toast.save_failed.body'),
      });
    },
  });

  // Template list view controls
  const [tplView, setTplView] = useState<'all' | 'changed' | 'disabled'>('all');
  const [tplNeedle, setTplNeedle] = useState('');

  const roleRecipients = roleQ.data ?? [];

  const templates = useMemo(() => {
    const raw = tplQ.data ?? [];

    const needle = tplNeedle.trim().toLowerCase();

    return raw.filter((r) => {
      const enabled = r.enabled !== false;
      const changed = (r.to && String(r.to).trim().length > 0) || !enabled;

      if (tplView === 'changed' && !changed) return false;
      if (tplView === 'disabled' && enabled) return false;

      if (!needle) return true;

      const label = (r.label ?? '').toString().toLowerCase();
      const id = (r.id ?? '').toString().toLowerCase();
      return label.includes(needle) || id.includes(needle);
    });
  }, [tplQ.data, tplNeedle, tplView]);

  const languages = languagesQ.data ?? [];

  const languageOptions = useMemo(() => {
    return (languages as Language[]).map((l) => ({ value: String(l.id), label: l.label ?? l.code ?? String(l.id) }));
  }, [languages]);

  if (!props.user && userQ.isLoading) {
    return <LoadingState />;
  }

  if (!props.user && userQ.isError) {
    return <ErrorState error={userQ.error} onRetry={() => userQ.refetch()} />;
  }

  if (!user) {
    return <ErrorState kindOverride="not_found" title={t('mail.prefs.user_missing.title')} body={t('mail.prefs.user_missing.body')} />;
  }

  const userEmail = user.email ?? '';

  return (
    <div className="space-y-4">
      <Alert title={t('mail.prefs.precedence.title')} variant="info">
        {t('mail.prefs.precedence.body')}
      </Alert>

      <Card>
        <div className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-fg">{t('mail.prefs.settings.title')}</div>
              <div className="mt-1 text-sm text-muted">{t('mail.prefs.settings.subtitle')}</div>
            </div>
            <Button
              disabled={!settingsDirty || !languageId || updateSettings.isPending}
              onClick={() => updateSettings.mutate()}
              testId="mail.settings.save"
            >
              {updateSettings.isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <Checkbox
                checked={mailerEnabled}
                onChange={(checked) => setMailerEnabled(checked)}
                label={t('mail.prefs.settings.enabled.label')}
                description={t('mail.prefs.settings.enabled.desc')}
                testId="mail.settings.enabled"
              />
            </div>

            <div>
              <div className="text-sm font-medium text-fg">{t('mail.prefs.settings.language.label')}</div>
              <div className="mt-1 text-xs text-muted">{t('mail.prefs.settings.language.desc')}</div>
              <div className="mt-2">
                {languagesQ.isLoading ? (
                  <LoadingState kind="inline" />
                ) : languagesQ.isError ? (
                  <div className="text-sm text-danger">{t('mail.prefs.languages.load_failed')}</div>
                ) : (
                  <Select
                    testId="mail.settings.language"
                    value={languageId}
                    onChange={(e) => setLanguageId(e.target.value)}
                    options={languageOptions}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-faint">
            {t('mail.prefs.settings.primary_email')}: <span className="tabular-nums text-fg">{userEmail || t('common.na')}</span>
          </div>
        </div>
      </Card>

      <TableCard tableClassName="min-w-full" testId="mail.roles">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="px-4 py-3">{t('mail.prefs.roles.col.role')}</th>
            <th className="px-4 py-3">{t('mail.prefs.roles.col.to')}</th>
            <th className="px-4 py-3">{t('mail.prefs.roles.col.effective')}</th>
          </tr>
        </thead>
        <tbody>
          {roleQ.isLoading ? (
            <tr>
              <td colSpan={3} className="px-4 py-6">
                <LoadingState kind="inline" />
              </td>
            </tr>
          ) : roleQ.isError ? (
            <tr>
              <td colSpan={3} className="px-4 py-6">
                <ErrorState
                  error={roleQ.error}
                  title={t('mail.prefs.roles.load_failed.title')}
                  body={t('mail.prefs.roles.load_failed.body')}
                  onRetry={() => roleQ.refetch()}
                  showBack={false}
                />
              </td>
            </tr>
          ) : roleRecipients.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-sm text-muted">
                {t('mail.prefs.roles.empty')}
              </td>
            </tr>
          ) : (
            roleRecipients.map((r) => (
              <RoleRecipientRow key={String(r.id)} userId={props.userId} userEmail={userEmail} recp={r} />
            ))
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
                  value={tplNeedle}
                  onChange={(e) => setTplNeedle(e.target.value)}
                  placeholder={t('mail.prefs.templates.search.placeholder')}
                  testId="mail.templates.search"
                />
              </div>
              <Select
                testId="mail.templates.view"
                value={tplView}
                onChange={(e) => setTplView(e.target.value as LegacyAny)}
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
              {tplQ.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6">
                    <LoadingState kind="inline" />
                  </td>
                </tr>
              ) : tplQ.isError ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6">
                    <ErrorState
                      error={tplQ.error}
                      title={t('mail.prefs.templates.load_failed.title')}
                      body={t('mail.prefs.templates.load_failed.body')}
                      onRetry={() => tplQ.refetch()}
                      showBack={false}
                    />
                  </td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-sm text-muted">
                    {tplNeedle || tplView !== 'all' ? t('mail.prefs.templates.empty_filtered') : t('mail.prefs.templates.empty')}
                  </td>
                </tr>
              ) : (
                templates.map((r) => (
                  <TemplateRecipientRow
                    key={String(r.id)}
                    userId={props.userId}
                    userEmail={userEmail}
                    roleRecipients={roleRecipients}
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
    </div>
  );
}

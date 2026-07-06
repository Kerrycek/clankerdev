import React from 'react';

import { useI18n } from '../../app/i18n';
import type { VpsUserData } from '../../lib/api/vpsUserData';

import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { Input } from '../ui/Input';
import { Select, type SelectOption } from '../ui/Select';
import { StatusDot } from '../ui/StatusDot';
import { Textarea } from '../ui/Textarea';
import { VpsLookupInput } from '../ui/VpsLookupInput';

import {
  MAX_USER_DATA_CONTENT_LEN,
  safeUserDataId,
  safeUserDataString,
  type UserDataFormState,
  type UserDataValidationHint,
  userDataFormatLabelKey,
} from './UserDataTemplatesModel';

export function UserDataTemplateEditorDrawer(props: {
  prefix: string;
  open: boolean;
  mode: 'create' | 'edit' | null;
  form: UserDataFormState;
  setForm: React.Dispatch<React.SetStateAction<UserDataFormState>>;
  formatOptions: SelectOption[];
  validationHints: UserDataValidationHint[];
  hintKey: string | null;
  contentOverLimit: boolean;
  canSave: boolean;
  busy: boolean;
  createPending: boolean;
  updatePending: boolean;
  onClose: () => void;
  onCreate: () => void;
  onUpdate: () => void;
}) {
  const { t } = useI18n();
  const contentLen = props.form.content.length;

  return (
    <Drawer
      open={props.open}
      onClose={props.onClose}
      title={props.mode === 'edit' ? t('user_data.editor.edit.title') : t('user_data.editor.create.title')}
      width="lg"
      testId={`${props.prefix}.editor.drawer`}
    >
      <div className="space-y-4">
        {props.hintKey ? <Alert variant="info" title={t('user_data.hint.title')}>{t(props.hintKey)}</Alert> : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-muted">{t('user_data.fields.label')}</div>
            <div className="mt-1">
              <Input
                value={props.form.label}
                onChange={(e) => props.setForm((prev) => ({ ...prev, label: e.target.value }))}
                placeholder={t('user_data.placeholders.label')}
                autoComplete="off"
                testId={`${props.prefix}.editor.label`}
              />
            </div>
            <div className="mt-1 text-xs text-faint">{t('user_data.help.label')}</div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted">{t('user_data.fields.format')}</div>
            <div className="mt-1">
              <Select
                value={props.form.format}
                onChange={(e) => props.setForm((prev) => ({ ...prev, format: e.target.value }))}
                options={props.formatOptions.slice(1)}
                testId={`${props.prefix}.editor.format`}
              />
            </div>
            <div className="mt-1 text-xs text-faint">{t('user_data.help.format')}</div>
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between gap-3">
            <div className="text-xs font-semibold text-muted">{t('user_data.fields.content')}</div>
            <div className={`text-xs ${props.contentOverLimit ? 'text-danger' : 'text-faint'}`}>
              {t('user_data.help.content_len', { n: contentLen, max: MAX_USER_DATA_CONTENT_LEN })}
            </div>
          </div>
          <div className="mt-1">
            <Textarea
              value={props.form.content}
              onChange={(e) => props.setForm((prev) => ({ ...prev, content: e.target.value }))}
              placeholder={t('user_data.placeholders.content')}
              testId={`${props.prefix}.editor.content`}
              className="min-h-56 font-mono text-xs"
            />
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted">{t('user_data.validation.title')}</div>
          <div className="mt-2 space-y-1">
            {props.validationHints.map((hint, idx) => (
              <div key={`${hint.labelKey}-${idx}`} className="flex items-center gap-2 text-sm">
                <StatusDot variant={hint.ok ? 'ok' : 'warn'} />
                <span className={hint.ok ? 'text-fg' : 'text-muted'}>{t(hint.labelKey, hint.vars)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={props.onClose} disabled={props.busy}>
            {t('common.cancel')}
          </Button>

          {props.mode === 'edit' ? (
            <Button
              variant="primary"
              onClick={props.onUpdate}
              loading={props.updatePending}
              disabled={!props.canSave}
              testId={`${props.prefix}.editor.save`}
            >
              {t('common.save')}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={props.onCreate}
              loading={props.createPending}
              disabled={!props.canSave}
              testId={`${props.prefix}.editor.create`}
            >
              {t('common.create')}
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  );
}

export function UserDataTemplateDeployDrawer(props: {
  prefix: string;
  item: VpsUserData | null;
  deployVpsId: number | null;
  isAdmin: boolean;
  userIdForAdmin?: number;
  pending: boolean;
  onChangeVpsId: (id: number | null) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();
  const id = props.item ? safeUserDataId(props.item.id) : 0;
  const label = props.item ? safeUserDataString(props.item.label) || `#${id}` : '';
  const format = props.item ? safeUserDataString(props.item.format) : '';

  return (
    <Drawer
      open={Boolean(props.item)}
      onClose={props.onClose}
      title={t('user_data.deploy.title')}
      width="md"
      testId={`${props.prefix}.deploy.drawer`}
    >
      <div className="space-y-4">
        {props.item ? (
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <div className="text-xs font-semibold text-muted">{t('user_data.deploy.fields.template')}</div>
            <div className="mt-1 font-medium text-fg">{label}</div>
            <div className="mt-1 text-xs text-faint">
              #{id} · {t(userDataFormatLabelKey(format))}
            </div>
          </div>
        ) : null}

        <Alert variant="info" title={t('user_data.deploy.hint.title')}>
          {t('user_data.deploy.hint.body')}
        </Alert>

        <div>
          <div className="text-xs font-semibold text-muted">{t('user_data.deploy.fields.vps')}</div>
          <div className="mt-1">
            <VpsLookupInput
              value={props.deployVpsId}
              onChange={props.onChangeVpsId}
              userId={props.isAdmin ? props.userIdForAdmin : undefined}
              placeholder={t('user_data.deploy.placeholders.vps')}
              ariaLabel={t('user_data.deploy.fields.vps')}
              testId={`${props.prefix}.deploy.vps`}
            />
          </div>
          <div className="mt-1 text-xs text-faint">{t('user_data.deploy.help.vps')}</div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={props.onClose} disabled={props.pending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={props.onSubmit}
            loading={props.pending}
            disabled={!props.deployVpsId}
            testId={`${props.prefix}.deploy.submit`}
          >
            {t('user_data.action.deploy')}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

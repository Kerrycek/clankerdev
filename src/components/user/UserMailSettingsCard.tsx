import React from 'react';

import { useI18n } from '../../app/i18n';
import type { Language } from '../../lib/api/languages';

import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Checkbox } from '../ui/Checkbox';
import { LoadingState } from '../ui/LoadingState';
import { Select } from '../ui/Select';

export function UserMailSettingsCard(props: {
  mailerEnabled: boolean;
  onMailerEnabledChange: (value: boolean) => void;
  languageId: string;
  onLanguageIdChange: (value: string) => void;
  languages: Language[];
  languagesLoading: boolean;
  languagesError: boolean;
  settingsDirty: boolean;
  savePending: boolean;
  onSave: () => void;
  userEmail: string;
}) {
  const { t } = useI18n();
  const languageOptions = props.languages.map((l) => ({ value: String(l.id), label: l.label ?? l.code ?? String(l.id) }));

  return (
    <Card>
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-fg">{t('mail.prefs.settings.title')}</div>
            <div className="mt-1 text-sm text-muted">{t('mail.prefs.settings.subtitle')}</div>
          </div>
          <Button disabled={!props.settingsDirty || !props.languageId || props.savePending} onClick={props.onSave} testId="mail.settings.save">
            {props.savePending ? t('common.saving') : t('common.save')}
          </Button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <Checkbox
              checked={props.mailerEnabled}
              onChange={props.onMailerEnabledChange}
              label={t('mail.prefs.settings.enabled.label')}
              description={t('mail.prefs.settings.enabled.desc')}
              testId="mail.settings.enabled"
            />
          </div>

          <div>
            <div className="text-sm font-medium text-fg">{t('mail.prefs.settings.language.label')}</div>
            <div className="mt-1 text-xs text-muted">{t('mail.prefs.settings.language.desc')}</div>
            <div className="mt-2">
              {props.languagesLoading ? (
                <LoadingState kind="inline" />
              ) : props.languagesError ? (
                <div className="text-sm text-danger">{t('mail.prefs.languages.load_failed')}</div>
              ) : (
                <Select
                  testId="mail.settings.language"
                  value={props.languageId}
                  onChange={(e) => props.onLanguageIdChange(e.target.value)}
                  options={languageOptions}
                />
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs text-faint">
          {t('mail.prefs.settings.primary_email')}: <span className="tabular-nums text-fg">{props.userEmail || t('common.na')}</span>
        </div>
      </div>
    </Card>
  );
}

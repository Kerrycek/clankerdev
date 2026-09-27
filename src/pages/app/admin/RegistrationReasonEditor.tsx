import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useI18n } from '../../../app/i18n';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { fetchLanguages } from '../../../lib/api/languages';
import {
  applicantLanguageId,
  applicantMessageLanguage,
  registrationReasonPresets,
  registrationReasonText,
  type ApplicantMessageLanguage,
  type RegistrationReasonAction,
} from './RegistrationReasonPresets';

export function RegistrationReasonEditor(props: {
  action: RegistrationReasonAction;
  language: unknown;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  disabled: boolean;
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const [preset, setPreset] = useState('');
  const [manualLanguage, setManualLanguage] = useState<ApplicantMessageLanguage | ''>('');
  const directLanguage = applicantMessageLanguage(props.language);
  const catalog = useQuery({
    queryKey: ['languages', 'registration-reason'],
    queryFn: async () => (await fetchLanguages({ limit: 250 })).data,
    enabled: !directLanguage && applicantLanguageId(props.language) !== undefined,
    staleTime: 60_000,
  });
  const detectedLanguage = directLanguage ?? applicantMessageLanguage(props.language, catalog.data);
  const language = detectedLanguage ?? (manualLanguage || null);
  const previousLanguage = useRef(language);

  useEffect(() => {
    if (language === previousLanguage.current) return;
    previousLanguage.current = language;
    if (!preset) return; // Free text is never silently translated or overwritten.
    if (!language) {
      setPreset('');
      props.onChange('');
      return;
    }
    const text = registrationReasonText(props.action, preset, language);
    if (text) props.onChange(text);
  }, [language, preset, props.action, props.onChange]);

  return (
    <div className="space-y-3">
      <Select
        label={t('requests.resolve.preset.label')}
        value={preset}
        disabled={props.disabled || !language}
        onChange={(event) => {
          const key = event.target.value;
          setPreset(key);
          if (key && language) {
            const text = registrationReasonText(props.action, key, language);
            if (text) props.onChange(text);
          }
        }}
        testId={`${props.testIdPrefix}.reason_preset`}
      >
        <option value="">{t('requests.resolve.preset.custom')}</option>
        {registrationReasonPresets(props.action).map(key => <option key={key} value={key}>{t(`requests.resolve.preset.${key}`)}</option>)}
      </Select>
      {!detectedLanguage ? (
        <Select
          label={t('requests.resolve.preset.language_unknown')}
          value={manualLanguage}
          onChange={(event) => setManualLanguage(event.target.value as ApplicantMessageLanguage | '')}
          disabled={props.disabled}
          testId={`${props.testIdPrefix}.reason_language_choice`}
        >
          <option value="">{t('requests.resolve.preset.choose_language')}</option>
          <option value="cs">{t('requests.resolve.preset.language_cs')}</option>
          <option value="en">{t('requests.resolve.preset.language_en')}</option>
        </Select>
      ) : null}
      <p className="text-xs text-muted" data-testid={`${props.testIdPrefix}.reason_language`}>
        {language ? t('requests.resolve.preset.language', { language: t(`requests.resolve.preset.language_${language}`) }) : t('requests.resolve.preset.choose_language')}
        {' '}{t('requests.resolve.preset.editable')}
      </p>
      <Textarea
        value={props.value}
        onChange={(event) => { setPreset(''); props.onChange(event.target.value); }}
        label={t('requests.resolve.reason.required')}
        rows={4}
        maxLength={500}
        disabled={props.disabled}
        ariaInvalid={props.invalid}
        ariaDescribedBy={props.invalid ? `${props.testIdPrefix}.reason.error` : undefined}
        testId={`${props.testIdPrefix}.reason`}
      />
    </div>
  );
}

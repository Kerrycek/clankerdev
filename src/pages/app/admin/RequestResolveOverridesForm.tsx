import React from 'react';

import { useI18n } from '../../../app/i18n';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';

import type { RequestResolveOverrides, RequestReviewType } from './RequestReviewTypes';

type SelectResource = {
  id: number;
  label?: string;
  name?: string;
  code?: string;
};

function resourceOptionLabel(resource: SelectResource): string {
  return resource.label ?? resource.name ?? resource.code ?? `#${resource.id}`;
}

export function RequestResolveOverridesForm(props: {
  open: boolean;
  onToggle: (open: boolean) => void;
  reqType: RequestReviewType;
  values: RequestResolveOverrides;
  onChange: (key: keyof RequestResolveOverrides, value: string) => void;
  locations: readonly SelectResource[];
  templates: readonly SelectResource[];
  languages: readonly SelectResource[];
  invalidNumericKeys: ReadonlySet<keyof RequestResolveOverrides>;
  resourcesLoading: boolean;
  resourcesError: boolean;
  onRetryResources: () => void;
  testIdPrefix: string;
}) {
  const { t } = useI18n();
  const numericErrorId = `${props.testIdPrefix}.override.numeric.error`;
  const field = (key: keyof RequestResolveOverrides) => ({
    value: props.values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      props.onChange(key, event.target.value);
    },
  });

  return (
    <details
      className="mt-4"
      open={props.open}
      onToggle={(event) => props.onToggle(event.currentTarget.open)}
      data-testid={`${props.testIdPrefix}.overrides`}
    >
      <summary className="cursor-pointer text-sm text-accent">{t('requests.resolve.overrides')}</summary>
      {props.reqType === 'registration' && props.resourcesLoading ? (
        <div className="mt-3 text-sm text-muted" aria-live="polite">
          {t('requests.resolve.overrides.resources_loading')}
        </div>
      ) : null}
      {props.reqType === 'registration' && props.resourcesError ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-danger-border bg-danger-bg p-2 text-sm">
          <span>{t('requests.resolve.overrides.resources_error')}</span>
          <Button size="sm" variant="secondary" onClick={props.onRetryResources}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {props.reqType === 'registration' ? (
          <>
            <Input
              {...field('login')}
              placeholder={t('requests.override.login')}
              label={t('requests.override.login')}
              testId={`${props.testIdPrefix}.override.login`}
            />
            <Input
              {...field('fullName')}
              placeholder={t('requests.override.full_name')}
              label={t('requests.override.full_name')}
              testId={`${props.testIdPrefix}.override.full_name`}
            />
            <Input
              {...field('orgName')}
              placeholder={t('requests.override.org_name')}
              label={t('requests.override.org_name')}
              testId={`${props.testIdPrefix}.override.org_name`}
            />
            <Input
              {...field('orgId')}
              placeholder={t('requests.override.org_id')}
              label={t('requests.override.org_id')}
              testId={`${props.testIdPrefix}.override.org_id`}
            />
            <Input
              {...field('email')}
              placeholder={t('requests.override.email')}
              label={t('requests.override.email')}
              testId={`${props.testIdPrefix}.override.email`}
            />
            <Input
              {...field('address')}
              placeholder={t('requests.override.address')}
              label={t('requests.override.address')}
              testId={`${props.testIdPrefix}.override.address`}
            />
            <Input
              {...field('yearOfBirth')}
              placeholder={t('requests.override.year_of_birth')}
              label={t('requests.override.year_of_birth')}
              inputMode="numeric"
              ariaInvalid={props.invalidNumericKeys.has('yearOfBirth')}
              ariaDescribedBy={props.invalidNumericKeys.has('yearOfBirth') ? numericErrorId : undefined}
              testId={`${props.testIdPrefix}.override.year_of_birth`}
            />
            <Input
              {...field('how')}
              placeholder={t('requests.override.how')}
              label={t('requests.override.how')}
              testId={`${props.testIdPrefix}.override.how`}
            />
            <Input
              {...field('note')}
              placeholder={t('requests.override.note')}
              label={t('requests.override.note')}
              testId={`${props.testIdPrefix}.override.note`}
            />
            <Select
              {...field('osTemplate')}
              label={t('requests.override.os_template')}
              ariaInvalid={props.invalidNumericKeys.has('osTemplate')}
              ariaDescribedBy={props.invalidNumericKeys.has('osTemplate') ? numericErrorId : undefined}
              testId={`${props.testIdPrefix}.override.os_template`}
            >
              <option value="">{t('common.select')}</option>
              {props.templates.map((template) => (
                <option key={template.id} value={String(template.id)}>{resourceOptionLabel(template)}</option>
              ))}
            </Select>
            <Select
              {...field('location')}
              label={t('requests.override.location')}
              ariaInvalid={props.invalidNumericKeys.has('location')}
              ariaDescribedBy={props.invalidNumericKeys.has('location') ? numericErrorId : undefined}
              testId={`${props.testIdPrefix}.override.location`}
            >
              <option value="">{t('common.select')}</option>
              {props.locations.map((location) => (
                <option key={location.id} value={String(location.id)}>{resourceOptionLabel(location)}</option>
              ))}
            </Select>
            <Input
              {...field('currency')}
              placeholder={t('requests.override.currency')}
              label={t('requests.override.currency')}
              testId={`${props.testIdPrefix}.override.currency`}
            />
            <Select
              {...field('language')}
              label={t('requests.override.language')}
              ariaInvalid={props.invalidNumericKeys.has('language')}
              ariaDescribedBy={props.invalidNumericKeys.has('language') ? numericErrorId : undefined}
              testId={`${props.testIdPrefix}.override.language`}
            >
              <option value="">{t('common.select')}</option>
              {props.languages.map((language) => (
                <option key={language.id} value={String(language.id)}>{resourceOptionLabel(language)}</option>
              ))}
            </Select>
            <Input
              {...field('timeZone')}
              placeholder={t('requests.override.time_zone')}
              label={t('requests.override.time_zone')}
              testId={`${props.testIdPrefix}.override.time_zone`}
            />
          </>
        ) : (
          <>
            <Input
              {...field('fullName')}
              placeholder={t('requests.override.full_name')}
              label={t('requests.override.full_name')}
              testId={`${props.testIdPrefix}.override.full_name`}
            />
            <Input
              {...field('email')}
              placeholder={t('requests.override.email')}
              label={t('requests.override.email')}
              testId={`${props.testIdPrefix}.override.email`}
            />
            <Input
              {...field('address')}
              placeholder={t('requests.override.address')}
              label={t('requests.override.address')}
              testId={`${props.testIdPrefix}.override.address`}
            />
            <Input
              {...field('changeReason')}
              placeholder={t('requests.override.change_reason')}
              label={t('requests.override.change_reason')}
              testId={`${props.testIdPrefix}.override.change_reason`}
            />
          </>
        )}
      </div>
    </details>
  );
}

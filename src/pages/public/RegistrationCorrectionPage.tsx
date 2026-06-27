import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { useI18n } from '../../app/i18n';

import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { LoadingState } from '../../components/ui/LoadingState';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';

import { fetchLocations, type Location } from '../../lib/api/infra';
import { fetchLanguages, type Language } from '../../lib/api/languages';
import { fetchOsTemplates, type OsTemplate } from '../../lib/api/osTemplates';
import {
  previewRegistrationRequest,
  updateRegistrationRequestByToken,
  type RegistrationRequest,
} from '../../lib/api/requests';

type FormState = {
  login: string;
  full_name: string;
  org_name: string;
  org_id: string;
  email: string;
  address: string;
  year_of_birth: string;
  how: string;
  note: string;
  os_template: string;
  location: string;
  currency: string;
  language: string;
};

const emptyForm: FormState = {
  login: '',
  full_name: '',
  org_name: '',
  org_id: '',
  email: '',
  address: '',
  year_of_birth: '',
  how: '',
  note: '',
  os_template: '',
  location: '',
  currency: '',
  language: '',
};

function parsePositiveInt(value: string): number | undefined {
  const t = String(value ?? '').trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i <= 0) return undefined;
  return i;
}

function refId(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = (value as LegacyAny).id;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function refLabel(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return (
    (typeof (value as LegacyAny).label === 'string' && (value as LegacyAny).label) ||
    (typeof (value as LegacyAny).name === 'string' && (value as LegacyAny).name) ||
    (typeof (value as LegacyAny).code === 'string' && (value as LegacyAny).code) ||
    undefined
  );
}

function ensureOption<T extends { id: number }>(
  rows: T[],
  id: number | undefined,
  fallback: T | null
): T[] {
  if (!id || rows.some((r) => Number(r.id) === id) || !fallback) return rows;
  return [fallback, ...rows];
}

export function RegistrationCorrectionPage() {
  const { t } = useI18n();
  const params = useParams();
  const requestId = parsePositiveInt(String(params['requestId'] ?? ''));
  const token = String(params['token'] ?? '').trim();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setSuccess(false);
    setSubmitError(null);
  }, [requestId, token]);

  const previewQ = useQuery({
    queryKey: ['public', 'requests', 'registration', 'preview', requestId, token],
    enabled: Boolean(requestId && token),
    queryFn: async () => (await previewRegistrationRequest(requestId as number, token)).data,
    retry: false,
  });

  const locationsQ = useQuery({
    queryKey: ['locations', 'public', 'index'],
    enabled: Boolean(requestId && token),
    queryFn: async () => (await fetchLocations({ limit: 500 })).data,
    staleTime: 60_000,
  });

  const templatesQ = useQuery({
    queryKey: ['os_templates', 'public', 'index'],
    enabled: Boolean(requestId && token),
    queryFn: async () => (await fetchOsTemplates({ limit: 500, enabled: true })).data,
    staleTime: 60_000,
  });

  const languagesQ = useQuery({
    queryKey: ['languages', 'public', 'index'],
    enabled: Boolean(requestId && token),
    queryFn: async () => (await fetchLanguages({ limit: 250 })).data,
    staleTime: 60_000,
  });

  useEffect(() => {
    const req = previewQ.data;
    if (!req) return;

    setForm({
      login: String(req.login ?? ''),
      full_name: String(req.full_name ?? ''),
      org_name: String(req.org_name ?? ''),
      org_id: String(req.org_id ?? ''),
      email: String(req.email ?? ''),
      address: String(req.address ?? ''),
      year_of_birth: req.year_of_birth != null ? String(req.year_of_birth) : '',
      how: String(req.how ?? ''),
      note: String(req.note ?? ''),
      os_template: refId(req.os_template) ? String(refId(req.os_template)) : '',
      location: refId(req.location) ? String(refId(req.location)) : '',
      currency: String(req.currency ?? ''),
      language: refId(req.language) ? String(refId(req.language)) : '',
    });
    setSubmitError(null);
  }, [previewQ.data]);

  const templateOptions = useMemo(() => {
    const req = previewQ.data;
    const currentId = refId(req?.os_template);
    const fallback = currentId
      ? ({ id: currentId, label: refLabel(req?.os_template) ?? `#${currentId}` } as OsTemplate)
      : null;
    return ensureOption(templatesQ.data ?? [], currentId, fallback);
  }, [previewQ.data, templatesQ.data]);

  const locationOptions = useMemo(() => {
    const req = previewQ.data;
    const currentId = refId(req?.location);
    const fallback = currentId
      ? ({ id: currentId, label: refLabel(req?.location) ?? `#${currentId}` } as Location)
      : null;
    return ensureOption(locationsQ.data ?? [], currentId, fallback);
  }, [locationsQ.data, previewQ.data]);

  const languageOptions = useMemo(() => {
    const req = previewQ.data;
    const currentId = refId(req?.language);
    const fallback = currentId
      ? ({ id: currentId, label: refLabel(req?.language) ?? `#${currentId}` } as Language)
      : null;
    return ensureOption(languagesQ.data ?? [], currentId, fallback);
  }, [languagesQ.data, previewQ.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!requestId || !token) throw new Error(t('requests.correction.invalid.body'));
      const payload = {
        login: form.login.trim(),
        full_name: form.full_name.trim(),
        org_name: form.org_name.trim() || undefined,
        org_id: form.org_id.trim() || undefined,
        email: form.email.trim(),
        address: form.address.trim(),
        year_of_birth: Number(form.year_of_birth),
        how: form.how.trim() || undefined,
        note: form.note.trim() || undefined,
        os_template: Number(form.os_template),
        location: Number(form.location),
        currency: form.currency.trim(),
        language: Number(form.language),
      };
      return (await updateRegistrationRequestByToken(requestId, token, payload)).data;
    },
    onSuccess: () => {
      setSuccess(true);
      setSubmitError(null);
      previewQ.refetch();
    },
    onError: (err: any) => {
      setSuccess(false);
      setSubmitError(err?.message ?? String(err));
    },
  });

  const invalid = !requestId || !token;
  const loading = previewQ.isLoading;
  const loadError = previewQ.isError;
  const request = previewQ.data as RegistrationRequest | undefined;

  const requiredMissing =
    !form.login.trim() ||
    !form.full_name.trim() ||
    !form.email.trim() ||
    !form.address.trim() ||
    !parsePositiveInt(form.year_of_birth) ||
    !parsePositiveInt(form.os_template) ||
    !parsePositiveInt(form.location) ||
    !form.currency.trim() ||
    !parsePositiveInt(form.language);

  if (invalid) {
    return (
      <Alert title={t('requests.correction.invalid.title')} variant="danger">
        {t('requests.correction.invalid.body')}
      </Alert>
    );
  }

  if (loading) return <LoadingState />;

  if (loadError || !request) {
    return (
      <Alert title={t('requests.correction.not_found.title')} variant="danger">
        {t('requests.correction.not_found.body')}
      </Alert>
    );
  }

  return (
    <div className="space-y-6" data-testid="public.requests.correction.page">
      <div className="space-y-2">
        <div className="text-sm">
          <Link to="/" className="underline">← {t('common.back')}</Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('requests.correction.title')}</h1>
        <div className="text-sm text-muted">{t('requests.correction.description')}</div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="warn">{t('requests.state.pending_correction')}</Badge>
          <Badge variant="neutral">#{request.id}</Badge>
        </div>
      </div>

      {request.admin_response ? (
        <Alert title={t('requests.correction.admin_message.title')} variant="info">
          <div className="whitespace-pre-wrap text-sm">{String(request.admin_response)}</div>
        </Alert>
      ) : null}

      {success ? (
        <Alert title={t('requests.correction.success.title')} variant="ok">
          {t('requests.correction.success.body')}
        </Alert>
      ) : null}

      {submitError ? (
        <Alert title={t('requests.correction.submit_error.title')} variant="danger">
          {submitError}
        </Alert>
      ) : null}

      <Card>
        <CardHeader title={t('requests.correction.form.title')} subtitle={t('requests.correction.form.subtitle')} />
        <CardBody>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!requiredMissing && !mutation.isPending) mutation.mutate();
            }}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-sm font-medium">{t('requests.field.login')}</div>
                <Input value={form.login} onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))} testId="public.requests.correction.login" />
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">{t('requests.field.full_name')}</div>
                <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} testId="public.requests.correction.full_name" />
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">{t('requests.field.org')}</div>
                <Input value={form.org_name} onChange={(e) => setForm((f) => ({ ...f, org_name: e.target.value }))} testId="public.requests.correction.org_name" />
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">{t('requests.correction.field.org_id')}</div>
                <Input value={form.org_id} onChange={(e) => setForm((f) => ({ ...f, org_id: e.target.value }))} testId="public.requests.correction.org_id" />
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">{t('requests.field.email')}</div>
                <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} testId="public.requests.correction.email" />
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">{t('requests.correction.field.year_of_birth')}</div>
                <Input value={form.year_of_birth} onChange={(e) => setForm((f) => ({ ...f, year_of_birth: e.target.value }))} testId="public.requests.correction.year_of_birth" />
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 text-sm font-medium">{t('requests.field.address')}</div>
                <Textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={4} testId="public.requests.correction.address" />
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">{t('requests.field.how')}</div>
                <Input value={form.how} onChange={(e) => setForm((f) => ({ ...f, how: e.target.value }))} testId="public.requests.correction.how" />
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">{t('requests.field.note')}</div>
                <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} testId="public.requests.correction.note" />
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">{t('requests.correction.field.location')}</div>
                <Select value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} testId="public.requests.correction.location">
                  <option value="">{t('common.select')}</option>
                  {locationOptions.map((loc) => (
                    <option key={loc.id} value={String(loc.id)}>{loc.label ?? `#${loc.id}`}</option>
                  ))}
                </Select>
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">{t('requests.correction.field.os_template')}</div>
                <Select value={form.os_template} onChange={(e) => setForm((f) => ({ ...f, os_template: e.target.value }))} testId="public.requests.correction.os_template">
                  <option value="">{t('common.select')}</option>
                  {templateOptions.map((tpl) => (
                    <option key={tpl.id} value={String(tpl.id)}>{tpl.label ?? tpl.name ?? `#${tpl.id}`}</option>
                  ))}
                </Select>
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">{t('requests.correction.field.currency')}</div>
                <Input value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} testId="public.requests.correction.currency" />
              </div>
              <div>
                <div className="mb-1 text-sm font-medium">{t('requests.correction.field.language')}</div>
                <Select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} testId="public.requests.correction.language">
                  <option value="">{t('common.select')}</option>
                  {languageOptions.map((lang) => (
                    <option key={lang.id} value={String(lang.id)}>{lang.label ?? lang.code ?? `#${lang.id}`}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="submit" variant="primary" disabled={requiredMissing || mutation.isPending} testId="public.requests.correction.submit">
                {mutation.isPending ? t('common.working') : t('requests.correction.submit')}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { useAppMode } from '../../../app/appMode';
import { useAuth } from '../../../app/auth';
import { useI18n } from '../../../app/i18n';
import { useChrome } from '../../../components/layout/ChromeContext';
import { ListShell } from '../../../components/layout/ListShell';
import { PageHeader } from '../../../components/layout/PageHeader';
import { SyncStaleBanner } from '../../../components/layout/SyncStaleBanner';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Input } from '../../../components/ui/Input';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { UserLookupInput } from '../../../components/ui/UserLookupInput';
import { fetchDefaultObjectClusterResources } from '../../../lib/api/clusterResources';
import { getMetaActionStateId } from '../../../lib/api/haveapi';
import { fetchLocations, type Location } from '../../../lib/api/infra';
import { fetchNodes, type Node } from '../../../lib/api/nodes';
import { fetchOsTemplates, type OsTemplate } from '../../../lib/api/osTemplates';
import { createVps, type CreateVpsPayload } from '../../../lib/api/vps';
import { formatErrorMessage } from '../../../lib/errors';
import { objectRef } from '../../../lib/objectRef';

type FormState = {
  locationId: string;
  nodeId: string;
  osTemplateId: string;
  userId: string;
  hostname: string;
  cpu: string;
  memory: string;
  diskspace: string;
  swap: string;
  ipv4: string;
  ipv6: string;
  ipv4Private: string;
  start: boolean;
  info: string;
};

const HOSTNAME_RE = /^[a-zA-Z0-9][a-zA-Z\-_.0-9]*[a-zA-Z0-9]$/;

function defaultForm(): FormState {
  return {
    locationId: '',
    nodeId: '',
    osTemplateId: '',
    userId: '',
    hostname: '',
    cpu: '8',
    memory: '4096',
    diskspace: '122880',
    swap: '0',
    ipv4: '1',
    ipv6: '1',
    ipv4Private: '0',
    start: true,
    info: '',
  };
}

function toPositiveInt(raw: string): number | undefined {
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function toNonNegativeInt(raw: string): number | undefined {
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < 0) return undefined;
  return n;
}

function optionalResource(raw: string): number | undefined {
  const trimmed = String(raw).trim();
  if (!trimmed) return undefined;
  return toPositiveInt(trimmed);
}

function labelOf(x: { id: number; label?: string; name?: string; domain?: string; fqdn?: string }): string {
  const main = x.label || x.name || x.fqdn || x.domain || `#${x.id}`;
  return `${main} (#${x.id})`;
}

function templateLabel(t: OsTemplate): string {
  const bits = [t.label || t.name || `#${t.id}`, t.distribution, t.version, t.arch].filter(Boolean);
  return `${bits.join(' · ')} (#${t.id})`;
}

function nodeLabel(n: Node): string {
  const loc = n.location?.label || n.location?.domain;
  return `${n.name || n.fqdn || `#${n.id}`}${loc ? ` · ${loc}` : ''} (#${n.id})`;
}

function locationEnvironmentId(loc: Location | undefined): number | undefined {
  const nested = loc?.environment?.id;
  if (typeof nested === 'number') return nested;

  const raw = loc ? (loc as any).environment_id : undefined;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }

  return undefined;
}

function validateForm(form: FormState, isAdmin: boolean): string[] {
  const errors: string[] = [];
  const hostname = form.hostname.trim();
  if (!hostname) errors.push('vps.create.validation.hostname_required');
  else if (hostname.length < 2 || hostname.length > 64 || !HOSTNAME_RE.test(hostname)) errors.push('vps.create.validation.hostname_format');
  if (!optionalResource(form.osTemplateId)) errors.push('vps.create.validation.os_template_required');
  if (!optionalResource(form.locationId)) errors.push('vps.create.validation.target_required');
  if (isAdmin) {
    if (!form.userId.trim()) errors.push('vps.create.validation.user_required');
    else if (!optionalResource(form.userId)) errors.push('vps.create.validation.user_invalid');
    if (!optionalResource(form.nodeId)) errors.push('vps.create.validation.node_required');
  }

  const numeric: Array<[keyof FormState, number, number, string]> = [
    ['cpu', 1, 32, 'vps.create.validation.cpu'],
    ['memory', 512, 131072, 'vps.create.validation.memory'],
    ['diskspace', 1024, 10485760, 'vps.create.validation.diskspace'],
    ['swap', 0, 12288, 'vps.create.validation.swap'],
    ['ipv4', 0, 64, 'vps.create.validation.ipv4'],
    ['ipv6', 0, 64, 'vps.create.validation.ipv6'],
    ['ipv4Private', 0, 64, 'vps.create.validation.ipv4_private'],
  ];

  for (const [key, min, max, msg] of numeric) {
    const n = Number(form[key]);
    if (!Number.isInteger(n) || n < min || n > max) errors.push(msg);
  }

  return errors;
}

export function VpsCreatePage() {
  const { basePath, mode } = useAppMode();
  const auth = useAuth();
  const isAdmin = mode === 'admin' || auth.role === 'admin';
  const effectiveBasePath = isAdmin ? '/admin' : basePath;
  const { t } = useI18n();
  const navigate = useNavigate();
  const chrome = useChrome();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => defaultForm());
  const [submitted, setSubmitted] = useState(false);

  const locationQ = useQuery({
    queryKey: ['locations', { limit: 500, hasHypervisor: true, includes: 'environment' }],
    queryFn: async () =>
      (
        await fetchLocations({
          limit: 500,
          hasHypervisor: true,
          includes: 'environment',
        })
      ).data,
  });
  const locations = locationQ.data ?? [];
  const selectedLocationId = optionalResource(form.locationId);
  const selectedLocation = useMemo(
    () => locations.find((loc) => Number(loc.id) === selectedLocationId),
    [locations, selectedLocationId]
  );
  const selectedEnvironmentId = locationEnvironmentId(selectedLocation);

  const nodesQ = useQuery({
    queryKey: ['nodes', { limit: 500, location: selectedLocationId ?? null }],
    queryFn: async () => (await fetchNodes({ limit: 500, location: selectedLocationId })).data,
    enabled: isAdmin && selectedLocationId !== undefined,
  });
  const templatesQ = useQuery({
    queryKey: ['os_templates', { limit: 500, enabled: true, hypervisorType: 'vpsadminos' }],
    queryFn: async () => (await fetchOsTemplates({ limit: 500, enabled: true, hypervisorType: 'vpsadminos' })).data,
  });
  const defaultResourcesQ = useQuery({
    queryKey: ['default_object_cluster_resources', { environment: selectedEnvironmentId ?? null, className: 'Vps' }],
    queryFn: async () =>
      (await fetchDefaultObjectClusterResources({ limit: 50, environmentId: selectedEnvironmentId, className: 'Vps' })).data,
    enabled: selectedEnvironmentId !== undefined,
  });

  const nodes = isAdmin ? nodesQ.data ?? [] : [];
  const templatesByFamily = useMemo(() => {
    const groups = new Map<string, OsTemplate[]>();
    for (const tpl of templatesQ.data ?? []) {
      const family = tpl.os_family as any;
      const label = family?.label || family?.name || (family?.id ? `#${family.id}` : t('vps.create.option.other_templates'));
      const list = groups.get(label) ?? [];
      list.push(tpl);
      groups.set(label, list);
    }

    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [t, templatesQ.data]);

  useEffect(() => {
    const defaults = defaultResourcesQ.data;
    if (!defaults) return;

    const next: Partial<FormState> = {};
    for (const item of defaults) {
      const name = item.cluster_resource?.name;
      const value = typeof item.value === 'number' ? String(item.value) : undefined;
      if (value === undefined) continue;
      if (name === 'cpu') next.cpu = value;
      else if (name === 'memory') next.memory = value;
      else if (name === 'swap') next.swap = value;
      else if (name === 'diskspace') next.diskspace = value;
      else if (name === 'ipv4') next.ipv4 = value;
      else if (name === 'ipv4_private') next.ipv4Private = value;
      else if (name === 'ipv6') next.ipv6 = value;
    }

    if (Object.keys(next).length === 0) return;
    setForm((prev) => ({ ...prev, ...next }));
  }, [defaultResourcesQ.data]);

  const validationKeys = useMemo(() => validateForm(form, isAdmin), [form, isAdmin]);
  const canSubmit = validationKeys.length === 0;

  useEffect(() => {
    if (mode === 'user' && auth.role === 'admin') {
      navigate('/admin/vps/new', { replace: true });
    }
  }, [auth.role, mode, navigate]);

  const createM = useMutation({
    mutationFn: async () => {
      const errors = validateForm(form, isAdmin);
      if (errors.length > 0) {
        const err: any = new Error('validation');
        err.validationKeys = errors;
        throw err;
      }

      const commonPayload = {
        hostname: form.hostname.trim(),
        os_template: optionalResource(form.osTemplateId),
        start: form.start,
        cpu: toPositiveInt(form.cpu),
        memory: toPositiveInt(form.memory),
        diskspace: toPositiveInt(form.diskspace),
        swap: toNonNegativeInt(form.swap),
        ipv4: toNonNegativeInt(form.ipv4),
        ipv6: toNonNegativeInt(form.ipv6),
        ipv4_private: toNonNegativeInt(form.ipv4Private),
      };

      const payload: CreateVpsPayload = isAdmin
        ? {
            ...commonPayload,
            mode: 'admin',
            node: optionalResource(form.nodeId) as number,
            user: optionalResource(form.userId) as number,
            info: form.info,
          }
        : {
            ...commonPayload,
            mode: 'user',
            location: optionalResource(form.locationId),
          };

      return createVps(payload);
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['vps', 'list'] });
      void qc.invalidateQueries({ queryKey: ['transaction_chain', 'active'] });

      const vpsId = Number(res.data?.id);
      const actionStateId = getMetaActionStateId(res.meta);
      if (actionStateId !== undefined) {
        chrome.trackActionState(actionStateId, {
          actionLabelKey: 'action.vps.create.label',
          objectLabel: form.hostname.trim() || (Number.isFinite(vpsId) ? t('common.vps_ref', { id: vpsId }) : t('vps.create.title')),
          object: Number.isFinite(vpsId) ? objectRef('Vps', vpsId) : undefined,
        });
        navigate(`${effectiveBasePath}/action-states/${actionStateId}`);
        return;
      }

      if (Number.isFinite(vpsId)) navigate(`${effectiveBasePath}/vps/${vpsId}`);
      else navigate(`${effectiveBasePath}/vps`);
    },
  });

  const loading = locationQ.isLoading || (isAdmin && nodesQ.isLoading) || templatesQ.isLoading;
  const loadError = locationQ.error || (isAdmin ? nodesQ.error : null) || templatesQ.error;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function label(text: string, htmlFor?: string) {
    return <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-fg">{text}</label>;
  }

  return (
    <ListShell
      variant="wide"
      testId="vps.create"
      banner={<SyncStaleBanner />}
      header={
        <PageHeader
          testId="vps.create.header"
          title={t('vps.create.title')}
          description={t('vps.create.description')}
          actions={
            <Button variant="secondary" to={`${effectiveBasePath}/vps`} testId="vps.create.back">
              <ArrowLeft className="h-4 w-4" />
              {t('common.back')}
            </Button>
          }
        />
      }
    >
      {loading ? (
        <LoadingState testId="vps.create.loading" />
      ) : loadError ? (
        <ErrorState
          testId="vps.create.load_error"
          title={t('vps.create.load_error.title')}
          error={loadError}
          onRetry={() => {
            void locationQ.refetch();
            void nodesQ.refetch();
            void templatesQ.refetch();
            void defaultResourcesQ.refetch();
          }}
          showBack={false}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <Card testId="vps.create.target">
              <CardHeader title={t('vps.create.section.target')} subtitle={t('vps.create.section.target_help')} />
              <CardBody className="grid gap-4 md:grid-cols-2">
                {isAdmin ? (
                  <div>
                    {label(t('vps.create.field.user'))}
                    <UserLookupInput value={form.userId} onChange={(v) => update('userId', v)} testId="vps.create.user" placeholder={t('vps.create.placeholder.user')} loadingLabel={t('common.loading')} noResultsLabel={t('palette.empty.no_results')} />
                  </div>
                ) : null}
                <div>
                  {label(t('vps.create.field.location'))}
                  <Select
                    value={form.locationId}
                    onChange={(e) => setForm((prev) => ({ ...prev, locationId: e.target.value, nodeId: '' }))}
                    testId="vps.create.location"
                    options={[{ value: '', label: t('common.select') }, ...locations.map((l: Location) => ({ value: String(l.id), label: labelOf(l) }))]}
                  />
                  {selectedLocation?.environment ? (
                    <p className="mt-1 text-xs text-muted">
                      {t('vps.create.location_environment', { environment: labelOf(selectedLocation.environment) })}
                    </p>
                  ) : null}
                </div>
              </CardBody>
            </Card>

            <Card testId="vps.create.system">
              <CardHeader title={t('vps.create.section.system')} subtitle={t('vps.create.section.system_help')} />
              <CardBody>
                <div>
                  {label(t('vps.create.field.os_template'))}
                  <Select value={form.osTemplateId} onChange={(e) => update('osTemplateId', e.target.value)} testId="vps.create.os_template">
                    <option value="">{t('common.select')}</option>
                    {templatesByFamily.map(([family, templates]) => (
                      <optgroup key={family} label={family}>
                        {templates.map((tpl) => (
                          <option key={tpl.id} value={String(tpl.id)}>
                            {templateLabel(tpl)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </div>
              </CardBody>
            </Card>

            <Card testId="vps.create.resources">
              <CardHeader title={t('vps.create.section.resources')} subtitle={t('vps.create.section.resources_help')} />
              <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>{label(t('vps.create.field.cpu'))}<Input type="number" min="1" max="32" step="1" value={form.cpu} onChange={(e) => update('cpu', e.target.value)} testId="vps.create.cpu" /></div>
                <div>{label(t('vps.create.field.memory'))}<Input type="number" min="512" max="131072" step="1" value={form.memory} onChange={(e) => update('memory', e.target.value)} testId="vps.create.memory" /></div>
                <div>{label(t('vps.create.field.diskspace'))}<Input type="number" min="1024" max="10485760" step="1" value={form.diskspace} onChange={(e) => update('diskspace', e.target.value)} testId="vps.create.diskspace" /></div>
                <div>{label(t('vps.create.field.swap'))}<Input type="number" min="0" max="12288" step="1" value={form.swap} onChange={(e) => update('swap', e.target.value)} testId="vps.create.swap" /></div>
                <div>{label(t('vps.create.field.ipv4'))}<Input type="number" min="0" max="64" step="1" value={form.ipv4} onChange={(e) => update('ipv4', e.target.value)} testId="vps.create.ipv4" /></div>
                <div>{label(t('vps.create.field.ipv6'))}<Input type="number" min="0" max="64" step="1" value={form.ipv6} onChange={(e) => update('ipv6', e.target.value)} testId="vps.create.ipv6" /></div>
                <div>{label(t('vps.create.field.ipv4_private'))}<Input type="number" min="0" max="64" step="1" value={form.ipv4Private} onChange={(e) => update('ipv4Private', e.target.value)} testId="vps.create.ipv4_private" /></div>
              </CardBody>
            </Card>
          </div>

          <div className="space-y-4">
            <Card testId="vps.create.confirm">
              <CardHeader title={t('vps.create.section.confirm')} />
              <CardBody className="space-y-4">
                {isAdmin ? (
                  <div>
                    {label(t('vps.create.field.node'))}
                    <Select value={form.nodeId} onChange={(e) => update('nodeId', e.target.value)} testId="vps.create.node" disabled={!selectedLocationId} options={[{ value: '', label: t('common.select') }, ...nodes.map((n) => ({ value: String(n.id), label: nodeLabel(n) }))]} />
                  </div>
                ) : null}
                <div>
                  {label(t('vps.create.field.hostname'))}
                  <Input value={form.hostname} onChange={(e) => update('hostname', e.target.value)} testId="vps.create.hostname" placeholder={t('vps.create.placeholder.hostname')} autoComplete="off" />
                </div>
                <Checkbox checked={form.start} onChange={(v) => update('start', v)} label={t('vps.create.field.start')} testId="vps.create.start" />
                {isAdmin ? (
                  <div>
                    {label(t('vps.create.field.info'))}
                    <Textarea value={form.info} onChange={(e) => update('info', e.target.value)} testId="vps.create.info" rows={4} />
                  </div>
                ) : null}

                {(submitted || createM.isError) && validationKeys.length > 0 ? (
                  <Alert variant="warn" title={t('common.validation_error')} testId="vps.create.validation">
                    <ul className="list-disc space-y-1 pl-5">
                      {validationKeys.map((key) => <li key={key}>{t(key)}</li>)}
                    </ul>
                  </Alert>
                ) : null}

                {createM.isError && validationKeys.length === 0 ? (
                  <Alert variant="danger" title={t('vps.create.error.title')} testId="vps.create.error">
                    {formatErrorMessage(createM.error)}
                  </Alert>
                ) : null}

                <Button
                  onClick={() => {
                    setSubmitted(true);
                    if (canSubmit) createM.mutate();
                  }}
                  disabled={createM.isPending}
                  loading={createM.isPending}
                  testId="vps.create.submit"
                  className="w-full justify-center"
                >
                  <Plus className="h-4 w-4" />
                  {createM.isPending ? t('common.creating') : t('vps.create.submit')}
                </Button>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </ListShell>
  );
}

export default VpsCreatePage;
